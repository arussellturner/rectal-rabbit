import Phaser from 'phaser';
import type { RabbitSnapshot } from '../ai/perception';
import { PIXEL } from '../config';
import { input } from '../input/InputManager';
import { PoopAmmo } from '../systems/PoopAmmo';
import { BOMB_COST } from './PoopBomb';
import { poopLaunchVelocity, type PoopAim } from './poopLaunch';
import { RabbitMotor } from './RabbitMotor';
import { MAX_AMMO, POOP_TUNING, TUNING } from './tuning';

/** Poops a poop-splosion uses up. */
export const SPLODE_COST = 5;
/** Seconds the poop-splosion's shield bubble keeps predators off. */
export const SHIELD_TIME = 1;

// Fits through a one-tile (48 px) gap.
const HITBOX_W = 40;
const HITBOX_H = 44;

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
  /** Dropped a poop bomb here (x, feet y). */
  bomb: { x: number; y: number } | null;
  /** Pressed the bomb button without enough poops saved up. */
  bombNotReady: boolean;
  /** Set off a poop-splosion here (the rabbit's middle). */
  splode: { x: number; y: number } | null;
  /** Pressed the poop-splosion button without enough poops. */
  splodeNotReady: boolean;
}

/**
 * The player. Physics lives on an invisible hitbox; the art is a separate
 * animated sprite that follows it, so squash-and-stretch never changes the hitbox.
 */
export class Rabbit {
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Sprite;
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
  /** While > 0, the poop-splosion's shield bubble is up: predators can't catch you. */
  shieldTimer = 0;
  /** Ignore the controls (digging, reached home, ...). */
  controlsLocked = false;
  /** Leave the art alone (the level is animating it: digging, going home). */
  freezeArt = false;

  /** Last time (ms) we touched a jump-through platform, set by the level's collider. */
  private oneWayContactAt = -Infinity;
  private eatTimer = 0;
  private shootCooldown = 0;
  private squashX = 1;
  private squashY = 1;
  private chewPhase = 0;
  private fallSpeed = 0;
  private landTimer = 0;
  private poopTimer = 0;
  private stunTimer = 0;
  /** The see-through brown bubble around the rabbit while the shield is up. */
  private readonly shield: Phaser.GameObjects.Arc;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.hitbox = scene.add.zone(x, y, HITBOX_W, HITBOX_H);
    scene.physics.add.existing(this.hitbox);
    this.body.setCollideWorldBounds(true);

    this.art = scene.add.sprite(x, y, 'rabbit', 0).setOrigin(0.5, 1).setDepth(10).setScale(PIXEL);
    this.shield = scene.add.circle(x, y, 46, 0x8c5c24, 0.35).setStrokeStyle(4, 0xc89048, 0.85).setDepth(11).setVisible(false);
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  /** Can't be caught: just respawned (blinking), or the shield bubble is up. */
  get invulnerable(): boolean {
    return this.invulnerableTimer > 0 || this.shieldTimer > 0;
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
    const events: RabbitEvents = {
      bite: false,
      shot: null,
      emptyShot: false,
      tooFull: false,
      bomb: null,
      bombNotReady: false,
      splode: null,
      splodeNotReady: false,
    };
    const body = this.body;
    this.onGround = body.blocked.down || body.touching.down;
    const onOneWay = this.onGround && this.scene.time.now - this.oneWayContactAt < 60;
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    const live = !this.controlsLocked && this.stunTimer <= 0;

    let jumpPressed = live && input.justPressed('jump');
    if (jumpPressed && onOneWay && input.moveY > 0.5) {
      // ↓ + jump on a thin platform: drop through instead of jumping.
      this.dropThroughTimer = TUNING.dropThroughTime;
      jumpPressed = false;
    }
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);

    if (live) {
      this.updateEating(dt, grass, jumpPressed, events);
      this.updateShooting(dt, events);
      this.updateBomb(events);
      this.updateSplode(events);
    } else {
      this.eating = false;
    }

    const moveX = live && !this.eating ? input.moveX : 0;
    const out = this.motor.step(
      { vx: body.velocity.x, vy: body.velocity.y, onGround: this.onGround },
      // Chewing keeps you in place; jumping gets you out of it.
      { moveX, jumpPressed, jumpHeld: live && input.isDown('jump') },
      dt,
    );
    // While knocked back, keep the hop's momentum instead of braking.
    body.setVelocity(this.stunTimer > 0 ? body.velocity.x : out.vx, out.vy);
    body.setGravityY(out.extraGravity);

    if (moveX > 0.1) this.facing = 1;
    else if (moveX < -0.1) this.facing = -1;

    if (!this.onGround) this.fallSpeed = Math.max(this.fallSpeed, body.velocity.y);
    if (out.jumped) this.squash(0.8, 1.2);
    if (out.landed) {
      const impact = Phaser.Math.Clamp(this.fallSpeed / TUNING.maxFallSpeed, 0, 1);
      this.squash(1 + 0.25 * impact, 1 - 0.2 * impact);
      if (impact > 0.6) input.rumble(90, 0.4 * impact, 0.6 * impact);
      this.fallSpeed = 0;
      this.landTimer = 0.1;
    }

    this.updateArt(dt);
    this.updateShield();
    return events;
  }

  /** Bounced away after a snow leopard catches you (mostly up, so you don't fly into a pit). */
  knockback(dir: 1 | -1): void {
    this.body.setVelocity(dir * 200, -460);
    this.stunTimer = 0.25;
    this.eating = false;
  }

  respawn(x: number, y: number, invulnerableFor = 0): void {
    this.body.reset(x, y);
    this.invulnerableTimer = invulnerableFor;
    this.shieldTimer = 0;
    this.body.setGravityY(0);
    this.dropThroughTimer = 0;
    this.fallSpeed = 0;
    this.stunTimer = 0;
    this.eating = false;
    this.facing = 1;
    this.squash(0.7, 1.3);
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
    const x = this.hitbox.x + (aim === 'drop' ? -this.facing * 8 : out * 26);
    const y = this.body.bottom - (aim === 'drop' ? 6 : 14);
    events.shot = { x, y, ...v };

    this.squash(1.1, 0.9);
    this.poopTimer = 0.2;
    this.art.play('rabbit-poop', true);
    input.rumble(50, 0.15, 0.35);
  }

  private updateBomb(events: RabbitEvents): void {
    if (!input.justPressed('dropBomb')) return;
    if (!this.ammo.spend(BOMB_COST)) {
      events.bombNotReady = true;
      return;
    }
    // Plop it out the back, at your feet.
    events.bomb = { x: this.hitbox.x - this.facing * 22, y: this.body.bottom - 4 };
    this.squash(1.25, 0.75);
    this.poopTimer = 0.25;
    this.art.play('rabbit-poop', true);
    input.rumble(120, 0.5, 0.3);
  }

  /** POOP-SPLOSION! Poop flies out every way, and the shield bubble goes up. */
  private updateSplode(events: RabbitEvents): void {
    if (!input.justPressed('splode')) return;
    if (!this.ammo.spend(SPLODE_COST)) {
      events.splodeNotReady = true;
      return;
    }
    events.splode = { x: this.hitbox.x, y: this.body.center.y };
    this.shieldTimer = SHIELD_TIME;
    this.squash(1.35, 0.7);
    this.poopTimer = 0.3;
    this.art.play('rabbit-poop', true);
    input.rumble(220, 0.9, 0.6);
  }

  /** The bubble follows the rabbit, wobbles, and flickers just before it pops. */
  private updateShield(): void {
    const on = this.shieldTimer > 0;
    this.shield.setVisible(on);
    if (!on) return;
    const t = SHIELD_TIME - this.shieldTimer;
    // Puffs up fast, then wobbles gently.
    const grow = Math.min(1, t / 0.12);
    const wobble = 1 + Math.sin(t * 22) * 0.04;
    this.shield.setPosition(this.hitbox.x, this.body.center.y - 2).setScale(grow * wobble);
    const ending = this.shieldTimer < 0.3 && Math.floor(this.shieldTimer * 20) % 2 === 0;
    this.shield.setAlpha(ending ? 0.3 : 1);
  }

  private squash(x: number, y: number): void {
    this.squashX = x;
    this.squashY = y;
  }

  private updateArt(dt: number): void {
    if (this.freezeArt) return;
    // Ease squash back to normal.
    const k = 1 - Math.exp(-14 * dt);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.poopTimer = Math.max(0, this.poopTimer - dt);

    const speed = Math.abs(this.body.velocity.x);
    const art = this.art;
    if (this.poopTimer > 0) {
      // Let the poop animation finish.
    } else if (this.eating) {
      // Nibble: bob between sitting up and nose-down.
      this.chewPhase += dt * 7;
      art.stop();
      art.setFrame(Math.floor(this.chewPhase) % 2 === 0 ? 0 : 5);
    } else if (!this.onGround) {
      art.play('rabbit-air', true);
    } else if (this.landTimer > 0) {
      art.play('rabbit-land', true);
    } else if (speed > 20) {
      art.play('rabbit-run', true);
      art.anims.timeScale = Phaser.Math.Clamp(speed / TUNING.runSpeed, 0.4, 1.4);
    } else {
      art.play('rabbit-idle', true);
    }
    if (art.anims.currentAnim?.key !== 'rabbit-run') art.anims.timeScale = 1;

    art
      .setPosition(this.hitbox.x, this.body.bottom + PIXEL)
      .setScale(PIXEL * this.squashX, PIXEL * this.squashY)
      .setFlipX(this.facing < 0)
      .setAlpha(this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 12) % 2 === 0 ? 0.3 : 1);
  }
}
