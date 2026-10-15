import Phaser from 'phaser';
import type { RabbitSnapshot } from '../ai/perception';
import { input } from '../input/InputManager';
import { PoopAmmo } from '../systems/PoopAmmo';
import { poopLaunchVelocity, type PoopAim } from './poopLaunch';
import { RabbitMotor } from './RabbitMotor';
import { MAX_AMMO, POOP_TUNING, TUNING } from './tuning';

const HITBOX_W = 34;
const HITBOX_H = 40;

/** Anything the rabbit can nibble (a GrassPatch). */
export interface Edible {
  readonly hasGrass: boolean;
  bite(): boolean;
}

/** What happened this frame, for the level to react to (particles, sounds, HUD). */
export interface RabbitEvents {
  bite: boolean;
  shot: { x: number; y: number; vx: number; vy: number } | null;
  /** Pressed shoot with nothing in the tank. */
  emptyShot: boolean;
  /** Pressed eat on grass while already full. */
  tooFull: boolean;
}

/**
 * The player. Physics lives on an invisible hitbox; the art is a separate
 * image that follows it, so squash-and-stretch never changes the hitbox.
 */
export class Rabbit {
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  readonly motor = new RabbitMotor(TUNING);
  readonly ammo = new PoopAmmo(MAX_AMMO);

  facing: 1 | -1 = 1;
  onGround = false;
  /** Chewing on grass right now. Predators will be able to hear this (step 3). */
  eating = false;
  /** While > 0, jump-through platforms are ignored (dropping down through one). */
  dropThroughTimer = 0;
  /** While > 0, predators can't catch you (just respawned). The rabbit blinks. */
  invulnerableTimer = 0;

  /** Last time (ms) we touched a jump-through platform, set by the level's collider. */
  private oneWayContactAt = -Infinity;
  private eatTimer = 0;
  private shootCooldown = 0;
  private squashX = 1;
  private squashY = 1;
  private hopPhase = 0;
  private chewPhase = 0;
  private fallSpeed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.hitbox = scene.add.zone(x, y, HITBOX_W, HITBOX_H);
    scene.physics.add.existing(this.hitbox);
    this.body.setCollideWorldBounds(true);

    this.art = scene.add.image(x, y, 'rabbit').setOrigin(0.5, 1).setDepth(10);
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  get invulnerable(): boolean {
    return this.invulnerableTimer > 0;
  }

  /** What predators can see and hear of the rabbit. */
  snapshot(): RabbitSnapshot {
    const b = this.body;
    return {
      x: this.hitbox.x,
      centerY: b.center.y,
      topY: b.top,
      feetY: b.bottom,
      vx: b.velocity.x,
      onGround: this.onGround,
      eating: this.eating,
    };
  }

  /** Called by the one-way platform collider. */
  touchedOneWay(): void {
    this.oneWayContactAt = this.scene.time.now;
  }

  /** @param grass the patch under the rabbit's feet, if any */
  update(dt: number, grass: Edible | null): RabbitEvents {
    const events: RabbitEvents = { bite: false, shot: null, emptyShot: false, tooFull: false };
    const body = this.body;
    this.onGround = body.blocked.down || body.touching.down;
    const onOneWay = this.onGround && this.scene.time.now - this.oneWayContactAt < 60;

    let jumpPressed = input.justPressed('jump');
    if (jumpPressed && onOneWay && input.moveY > 0.5) {
      // ↓ + jump on a thin platform: drop through instead of jumping.
      this.dropThroughTimer = TUNING.dropThroughTime;
      jumpPressed = false;
    }
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);

    this.updateEating(dt, grass, jumpPressed, events);
    this.updateShooting(dt, events);

    const out = this.motor.step(
      { vx: body.velocity.x, vy: body.velocity.y, onGround: this.onGround },
      // Chewing keeps you in place; jumping gets you out of it.
      { moveX: this.eating ? 0 : input.moveX, jumpPressed, jumpHeld: input.isDown('jump') },
      dt,
    );
    body.setVelocity(out.vx, out.vy);
    body.setGravityY(out.extraGravity);

    if (!this.eating) {
      if (input.moveX > 0.1) this.facing = 1;
      else if (input.moveX < -0.1) this.facing = -1;
    }

    if (!this.onGround) this.fallSpeed = Math.max(this.fallSpeed, body.velocity.y);
    if (out.jumped) this.squash(0.75, 1.3);
    if (out.landed) {
      const impact = Phaser.Math.Clamp(this.fallSpeed / TUNING.maxFallSpeed, 0, 1);
      this.squash(1 + 0.35 * impact, 1 - 0.3 * impact);
      if (impact > 0.6) input.rumble(90, 0.4 * impact, 0.6 * impact);
      this.fallSpeed = 0;
    }

    this.updateArt(dt);
    return events;
  }

  respawn(x: number, y: number, invulnerableFor = 0): void {
    this.body.reset(x, y);
    this.invulnerableTimer = invulnerableFor;
    this.body.setGravityY(0);
    this.dropThroughTimer = 0;
    this.fallSpeed = 0;
    this.eating = false;
    this.squash(0.6, 1.4);
    this.updateArt(0);
  }

  private updateEating(dt: number, grass: Edible | null, jumpPressed: boolean, events: RabbitEvents): void {
    const onGrass = this.onGround && grass !== null && grass.hasGrass;
    if (input.justPressed('eat') && onGrass && this.ammo.isFull) events.tooFull = true;

    if (input.isDown('eat') && onGrass && !this.ammo.isFull && !jumpPressed) {
      this.eating = true;
      this.eatTimer += dt;
      if (this.eatTimer >= POOP_TUNING.biteTime && grass.bite()) {
        this.eatTimer = 0;
        this.ammo.add(1);
        events.bite = true;
        this.squash(1.12, 0.88);
      }
    } else {
      this.eating = false;
      this.eatTimer = 0;
    }
  }

  private updateShooting(dt: number, events: RabbitEvents): void {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (!input.justPressed('shoot') || this.shootCooldown > 0) return;

    this.shootCooldown = POOP_TUNING.shootCooldown;
    if (!this.ammo.spend()) {
      events.emptyShot = true;
      return;
    }

    let aim: PoopAim = 'normal';
    if (input.moveY < -0.5) aim = 'lob';
    else if (input.moveY > 0.5 && !this.onGround) aim = 'drop';

    const v = poopLaunchVelocity(this.facing, aim, this.body.velocity.x, POOP_TUNING);
    // Pellets come from the rabbit's tail end (or nose end if firing forward).
    const out = POOP_TUNING.shootBackwards ? -this.facing : this.facing;
    const x = this.hitbox.x + (aim === 'drop' ? -this.facing * 8 : out * 18);
    const y = this.body.bottom - (aim === 'drop' ? 6 : 12);
    events.shot = { x, y, ...v };

    this.squash(1.2, 0.82);
    input.rumble(50, 0.15, 0.35);
  }

  private squash(x: number, y: number): void {
    this.squashX = x;
    this.squashY = y;
  }

  private updateArt(dt: number): void {
    // Ease squash back to normal.
    const k = 1 - Math.exp(-14 * dt);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;

    // Little hops while running on the ground.
    const speed = Math.abs(this.body.velocity.x);
    let bob = 0;
    if (this.onGround && speed > 20) {
      this.hopPhase += dt * (8 + speed / 30);
      bob = -Math.abs(Math.sin(this.hopPhase)) * 5;
    } else {
      this.hopPhase = 0;
    }

    // Nose down and nibbling while eating.
    let chew = 0;
    if (this.eating) {
      this.chewPhase += dt * 28;
      chew = Math.sin(this.chewPhase) * 0.04;
    }

    this.art
      .setPosition(this.hitbox.x, this.body.bottom + bob)
      .setScale(this.squashX + chew, this.squashY - chew)
      .setAngle(this.eating ? 10 * this.facing : 0)
      .setFlipX(this.facing < 0)
      .setAlpha(this.invulnerable && Math.floor(this.invulnerableTimer * 12) % 2 === 0 ? 0.3 : 1);
  }
}
