import Phaser from 'phaser';
import { input } from '../input/InputManager';
import { RabbitMotor } from './RabbitMotor';
import { TUNING } from './tuning';

const HITBOX_W = 34;
const HITBOX_H = 40;

/**
 * The player. Physics lives on an invisible hitbox; the art is a separate
 * image that follows it, so squash-and-stretch never changes the hitbox.
 */
export class Rabbit {
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  readonly motor = new RabbitMotor(TUNING);

  facing: 1 | -1 = 1;
  onGround = false;
  /** While > 0, jump-through platforms are ignored (dropping down through one). */
  dropThroughTimer = 0;

  /** Last time (ms) we touched a jump-through platform, set by the level's collider. */
  private oneWayContactAt = -Infinity;
  private squashX = 1;
  private squashY = 1;
  private hopPhase = 0;
  private fallSpeed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.hitbox = scene.add.zone(x, y, HITBOX_W, HITBOX_H);
    scene.physics.add.existing(this.hitbox);
    this.body.setCollideWorldBounds(true);

    this.art = scene.add.image(x, y, 'rabbit').setOrigin(0.5, 1);
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  /** Called by the one-way platform collider. */
  touchedOneWay(): void {
    this.oneWayContactAt = this.scene.time.now;
  }

  update(dt: number): void {
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

    const out = this.motor.step(
      { vx: body.velocity.x, vy: body.velocity.y, onGround: this.onGround },
      { moveX: input.moveX, jumpPressed, jumpHeld: input.isDown('jump') },
      dt,
    );
    body.setVelocity(out.vx, out.vy);
    body.setGravityY(out.extraGravity);

    if (input.moveX > 0.1) this.facing = 1;
    else if (input.moveX < -0.1) this.facing = -1;

    if (!this.onGround) this.fallSpeed = Math.max(this.fallSpeed, body.velocity.y);
    if (out.jumped) this.squash(0.75, 1.3);
    if (out.landed) {
      const impact = Phaser.Math.Clamp(this.fallSpeed / TUNING.maxFallSpeed, 0, 1);
      this.squash(1 + 0.35 * impact, 1 - 0.3 * impact);
      if (impact > 0.6) input.rumble(90, 0.4 * impact, 0.6 * impact);
      this.fallSpeed = 0;
    }

    this.updateArt(dt);
  }

  respawn(x: number, y: number): void {
    this.body.reset(x, y);
    this.body.setGravityY(0);
    this.dropThroughTimer = 0;
    this.fallSpeed = 0;
    this.squash(0.6, 1.4);
    this.updateArt(0);
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

    this.art
      .setPosition(this.hitbox.x, this.body.bottom + bob)
      .setScale(this.squashX, this.squashY)
      .setFlipX(this.facing < 0);
  }
}
