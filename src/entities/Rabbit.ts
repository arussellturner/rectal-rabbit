import Phaser from 'phaser';
import type { RabbitSnapshot } from '../ai/perception';
import { input } from '../input/InputManager';
import { PoopAmmo } from '../systems/PoopAmmo';
import { PoopCharge } from '../systems/PoopCharge';
import { poopLaunchVelocity, type PoopAim } from './poopLaunch';
import { RabbitMotor } from './RabbitMotor';
import { MAX_AMMO, POOP_TUNING, TUNING } from './tuning';

const HITBOX_W = 34;
const HITBOX_H = 40;
/** Shades of brown for the torrent, so it looks like a mess rather than a line of identical dots. */
const TORRENT_TINTS = [0xffffff, 0xd9b38c, 0xc8a27a, 0xe6c9a0, 0xb88a5c];

/** Anything the rabbit can nibble (a GrassPatch). */
export interface Edible {
  readonly hasGrass: boolean;
  bite(): boolean;
}

/** One pellet to spawn. */
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Visual + hitbox scale (1 = normal). */
  size: number;
  /** Hit strength (1 = normal): stun length, knockback, target damage. */
  power: number;
  tint?: number;
}

/** What happened this frame, for the level to react to (particles, sounds, HUD). */
export interface RabbitEvents {
  bite: boolean;
  /** Pellets to spawn this frame (one for a normal or big poop, many during a torrent). */
  shots: Shot[];
  /** A charged SUPER POOP was fired; how many poops it cost. */
  bigPoop: number | null;
  /** The full-meter torrent just started. */
  torrentStarted: boolean;
  /** A SUPER POOP charge was cancelled. */
  chargeCancelled: boolean;
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
  readonly charge = new PoopCharge(() => POOP_TUNING, MAX_AMMO);

  facing: 1 | -1 = 1;
  onGround = false;
  /** Chewing on grass right now. Predators can hear this. */
  eating = false;
  /** While > 0, jump-through platforms are ignored (dropping down through one). */
  dropThroughTimer = 0;
  /** While > 0, predators can't catch you (just respawned). The rabbit blinks. */
  invulnerableTimer = 0;
  /** While > 0, the full-meter torrent is spraying. No moving, no cancelling. */
  torrentTimer = 0;

  /** Last time (ms) we touched a jump-through platform, set by the level's collider. */
  private oneWayContactAt = -Infinity;
  private eatTimer = 0;
  private shootCooldown = 0;
  /** A tap that landed during the cooldown: fired as soon as the cooldown ends. */
  private queuedTap = false;
  private torrentAccum = 0;
  private torrentRumble = 0;
  private lastChargeAmount = 0;
  private squashX = 1;
  private squashY = 1;
  private hopPhase = 0;
  private chewPhase = 0;
  private time = 0;
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

  /** Poops the SUPER POOP would cost if released now (0 if not charging). */
  get chargeAmount(): number {
    return this.charge.amountFor(this.ammo.count);
  }

  /** Full meter, fully charged: letting go now unleashes the torrent. */
  get torrentReady(): boolean {
    return this.charge.torrentReady(this.ammo.count);
  }

  /** Feet planted: eating, charging a SUPER POOP, or mid-torrent. */
  get planted(): boolean {
    return this.eating || this.charge.isCharging || this.torrentTimer > 0;
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
      shots: [],
      bigPoop: null,
      torrentStarted: false,
      chargeCancelled: false,
      emptyShot: false,
      tooFull: false,
    };
    this.time += dt;
    const body = this.body;
    this.onGround = body.blocked.down || body.touching.down;
    const onOneWay = this.onGround && this.scene.time.now - this.oneWayContactAt < 60;

    let jumpPressed = input.justPressed('jump');
    if (jumpPressed && onOneWay && input.moveY > 0.5) {
      // ↓ + jump on a thin platform: drop through instead of jumping.
      this.dropThroughTimer = TUNING.dropThroughTime;
      jumpPressed = false;
    }
    // Once the torrent starts you're committed: no jumping away.
    if (this.torrentTimer > 0) jumpPressed = false;
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);

    this.updateEating(dt, grass, jumpPressed, events);
    // Jumping mid-charge cancels it, and then still jumps (passed to the motor below).
    this.updateShooting(dt, jumpPressed, events);

    const out = this.motor.step(
      { vx: body.velocity.x, vy: body.velocity.y, onGround: this.onGround },
      // Chewing or charging plants your feet; jumping gets you out of it.
      { moveX: this.planted ? 0 : input.moveX, jumpPressed, jumpHeld: input.isDown('jump') },
      dt,
    );
    body.setVelocity(out.vx, out.vy);
    body.setGravityY(out.extraGravity);

    if (!this.planted) {
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
    this.torrentTimer = 0;
    this.queuedTap = false;
    this.charge.reset();
    this.squash(0.6, 1.4);
    this.updateArt(0);
  }

  private updateEating(dt: number, grass: Edible | null, jumpPressed: boolean, events: RabbitEvents): void {
    const onGrass = this.onGround && grass !== null && grass.hasGrass;
    if (input.justPressed('eat') && onGrass && this.ammo.isFull) events.tooFull = true;

    const busy = this.charge.isCharging || this.torrentTimer > 0;
    if (input.isDown('eat') && onGrass && !this.ammo.isFull && !jumpPressed && !busy) {
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

  /** Tap = one poop. Hold = charge a SUPER POOP. Full meter + full charge = torrent. */
  private updateShooting(dt: number, jumpPressed: boolean, events: RabbitEvents): void {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.torrentTimer > 0) {
      this.updateTorrent(dt, events);
      return;
    }

    const result = this.charge.update(dt, {
      shootHeld: input.isDown('shoot'),
      cancelPressed: jumpPressed || input.justPressed('cancel'),
      available: this.ammo.count,
      onGround: this.onGround,
    });

    if (this.queuedTap && this.shootCooldown <= 0) {
      this.queuedTap = false;
      this.fireSingle(events);
    }

    switch (result.kind) {
      case 'tap':
        this.fireSingle(events);
        break;
      case 'charged':
        if (this.ammo.spend(result.amount)) this.fireBig(result.amount, events);
        break;
      case 'torrent':
        if (this.ammo.spend(MAX_AMMO)) {
          this.torrentTimer = POOP_TUNING.torrentDuration;
          this.torrentAccum = 0;
          this.torrentRumble = 0;
          events.torrentStarted = true;
        }
        break;
      case 'cancelled':
        events.chargeCancelled = true;
        input.rumble(60, 0, 0.25);
        break;
      case 'none':
        break;
    }

    // A buzz each time the charge grows by a poop, stronger as it builds.
    const amount = this.chargeAmount;
    if (amount > this.lastChargeAmount && amount >= 2) {
      const k = amount / MAX_AMMO;
      input.rumble(70, 0.1 + 0.5 * k, 0.2 + 0.5 * k);
    }
    this.lastChargeAmount = amount;
  }

  private fireSingle(events: RabbitEvents): void {
    if (this.shootCooldown > 0) {
      this.queuedTap = true; // don't swallow quick taps
      return;
    }
    this.shootCooldown = POOP_TUNING.shootCooldown;
    if (!this.ammo.spend()) {
      events.emptyShot = true;
      return;
    }
    events.shots.push(this.aimedShot(1, 1));
    this.squash(1.2, 0.82);
    input.rumble(50, 0.15, 0.35);
  }

  private fireBig(amount: number, events: RabbitEvents): void {
    const size = 1 + POOP_TUNING.bigPoopGrowth * (amount - 1);
    events.shots.push(this.aimedShot(size, amount));
    events.bigPoop = amount;
    this.shootCooldown = POOP_TUNING.shootCooldown;
    const k = amount / MAX_AMMO;
    this.squash(1.2 + 0.4 * k, 0.8 - 0.2 * k);
    input.rumble(120 + 200 * k, 0.4 + 0.6 * k, 0.5 + 0.5 * k);
  }

  /** A pellet from the rabbit's tail end, aimed by holding up (lob) or down in the air (drop). */
  private aimedShot(size: number, power: number): Shot {
    let aim: PoopAim = 'normal';
    if (input.moveY < -0.5) aim = 'lob';
    else if (input.moveY > 0.5 && !this.onGround) aim = 'drop';

    const v = poopLaunchVelocity(this.facing, aim, this.body.velocity.x, POOP_TUNING);
    const out = POOP_TUNING.shootBackwards ? -this.facing : this.facing;
    const x = this.hitbox.x + (aim === 'drop' ? -this.facing * 8 : out * (18 + 4 * (size - 1)));
    // Big poops start higher so they don't spawn inside the ground.
    const y = this.body.bottom - (aim === 'drop' ? 6 : Math.max(12, 7 * size + 3));
    return { x, y, ...v, size, power };
  }

  /** Spray a messy fan of pellets out the back for the torrent's duration. */
  private updateTorrent(dt: number, events: RabbitEvents): void {
    const t = POOP_TUNING;
    this.torrentTimer = Math.max(0, this.torrentTimer - dt);
    this.torrentAccum += dt * t.torrentRate;
    const dir = t.shootBackwards ? -this.facing : this.facing;
    while (this.torrentAccum >= 1) {
      this.torrentAccum -= 1;
      const size = Phaser.Math.FloatBetween(0.7, 1.5);
      events.shots.push({
        x: this.hitbox.x + dir * 20,
        y: this.body.bottom - 14,
        vx: dir * t.shootSpeed * Phaser.Math.FloatBetween(0.5, 1.4),
        vy: -t.shootLift * Phaser.Math.FloatBetween(0.1, 2.4),
        size,
        power: 4,
        tint: Phaser.Utils.Array.GetRandom(TORRENT_TINTS),
      });
    }
    this.torrentRumble -= dt;
    if (this.torrentRumble <= 0) {
      input.rumble(120, 1, 1);
      this.torrentRumble = 0.1;
    }
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

    // Charging: crouch lower and tremble harder as it builds. Torrent: shake like crazy.
    let crouch = 0;
    let shake = 0;
    const charge = this.chargeAmount / MAX_AMMO;
    if (this.torrentTimer > 0) {
      crouch = 0.12 + Math.sin(this.time * 40) * 0.08;
      shake = 3;
    } else if (charge > 0) {
      crouch = 0.04 + 0.12 * charge;
      shake = 0.5 + 2.5 * charge;
    }

    this.art
      .setPosition(this.hitbox.x + (Math.random() - 0.5) * 2 * shake, this.body.bottom + bob)
      .setScale(this.squashX + chew + crouch * 0.6, this.squashY - chew - crouch)
      .setAngle(this.eating ? 10 * this.facing : 0)
      .setFlipX(this.facing < 0)
      .setAlpha(this.invulnerable && Math.floor(this.invulnerableTimer * 12) % 2 === 0 ? 0.3 : 1);

    if (this.torrentReady || this.torrentTimer > 0) {
      // Rainbow glow: ready to blow.
      const hue = (this.time * 1.5) % 1;
      this.art.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.35, 1).color);
    } else if (charge > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 14);
      const glow = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(0xffd54f),
        100,
        Math.round(100 * charge * pulse),
      );
      this.art.setTint(Phaser.Display.Color.GetColor(glow.r, glow.g, glow.b));
    } else {
      this.art.clearTint();
    }
  }
}
