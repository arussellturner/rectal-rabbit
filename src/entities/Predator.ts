import Phaser from 'phaser';
import type { Box } from '../ai/geometry';
import { perceive, type RabbitSnapshot } from '../ai/perception';
import { PredatorBrain, type PredatorState, type Territory } from '../ai/PredatorBrain';
import { SHOW_VISION_CONES } from '../config';
import type { PredatorConfig } from '../data/predators';
import { approach } from './RabbitMotor';
import { textStyle } from '../scenes/textStyles';

const CONE_COLORS: Record<PredatorState, { color: number; alpha: number }> = {
  patrol: { color: 0xffffff, alpha: 0.13 },
  suspicious: { color: 0xffd54f, alpha: 0.2 },
  alerted: { color: 0xff5252, alpha: 0.24 },
  chase: { color: 0xff5252, alpha: 0.12 },
  search: { color: 0xffa726, alpha: 0.18 },
  stunned: { color: 0xffffff, alpha: 0 },
};

/**
 * A predator in the level: an Arcade Physics hitbox driven by a PredatorBrain,
 * plus its art, vision cone, and the "?" / "!" indicator above its head.
 */
export class Predator {
  readonly brain: PredatorBrain;
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  /** Set when the brain just changed state (read by the level for rumble etc). */
  justAlerted = false;

  private readonly cone: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Text;
  private readonly meterBar: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Image[];
  private onGround = false;
  private runPhase = 0;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly cfg: PredatorConfig,
    x: number,
    groundY: number,
    territory: Territory,
  ) {
    this.brain = new PredatorBrain(cfg, territory);
    this.brain.onEnter = (state) => this.onStateChange(state);

    this.cone = scene.add.graphics().setDepth(4);
    this.hitbox = scene.add.zone(x, groundY - cfg.hitbox.h / 2, cfg.hitbox.w, cfg.hitbox.h);
    scene.physics.add.existing(this.hitbox);
    this.art = scene.add.image(x, groundY, cfg.texture).setOrigin(0.5, 1).setDepth(9);
    this.marker = scene.add.text(x, 0, '', textStyle(34)).setOrigin(0.5, 1).setDepth(20);
    this.meterBar = scene.add.graphics().setDepth(20);
    this.stars = [0, 1, 2].map(() => scene.add.image(x, 0, 'star').setDepth(20).setVisible(false));
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  get state(): PredatorState {
    return this.brain.state;
  }

  update(dt: number, rabbit: RabbitSnapshot, walls: readonly Box[], touchingRabbit: boolean): void {
    this.time += dt;
    const body = this.body;
    this.onGround = body.blocked.down || body.touching.down;

    const p = perceive(
      { x: this.hitbox.x, eyeY: body.top + 8, feetY: body.bottom, facing: this.brain.facing },
      rabbit,
      walls,
      this.cfg,
      this.brain.state === 'chase',
      touchingRabbit,
    );
    const intent = this.brain.update(this.hitbox.x, p, dt);

    const desired = intent.targetX === null ? 0 : Math.sign(intent.targetX - this.hitbox.x) * intent.speed;
    body.setVelocityX(approach(body.velocity.x, desired, this.cfg.accel * dt));

    this.updateArt(dt);
    this.drawCone();
    this.drawIndicator();
  }

  /** Hit by a poop pellet. Returns false if it was already stunned. */
  stun(fromX: number): boolean {
    if (this.brain.state === 'stunned') return false;
    this.brain.stun(fromX);
    this.body.setVelocityX(0);
    return true;
  }

  private onStateChange(state: PredatorState): void {
    if (state === 'alerted') {
      this.justAlerted = true;
      // A startled little hop.
      this.scene.tweens.add({ targets: this.art, scaleY: 1.2, scaleX: 0.85, duration: 90, yoyo: true });
      this.marker.setScale(1.8);
      this.scene.tweens.add({ targets: this.marker, scale: 1, duration: 250, ease: 'Back.Out' });
    }
  }

  private updateArt(dt: number): void {
    const speed = Math.abs(this.body.velocity.x);
    let bob = 0;
    if (this.onGround && speed > 20) {
      this.runPhase += dt * (6 + speed / 25);
      bob = -Math.abs(Math.sin(this.runPhase)) * (speed > 150 ? 6 : 2);
    }
    const stunned = this.brain.state === 'stunned';
    this.art
      .setPosition(this.hitbox.x, this.body.bottom + bob)
      .setFlipX(this.brain.facing < 0)
      .setAngle(stunned ? Math.sin(this.time * 9) * 8 : 0);

    const headX = this.hitbox.x + this.brain.facing * 22;
    const headY = this.body.top - 8;
    this.stars.forEach((star, i) => {
      const a = this.time * 5 + (i * Math.PI * 2) / 3;
      star
        .setVisible(stunned)
        .setPosition(headX + Math.cos(a) * 18, headY + Math.sin(a) * 6)
        .setAngle(this.time * 300);
    });
  }

  private drawCone(): void {
    this.cone.clear();
    const { color, alpha } = CONE_COLORS[this.brain.state];
    if (!SHOW_VISION_CONES || alpha === 0) return;

    const eyeX = this.hitbox.x + this.brain.facing * 20;
    const eyeY = this.body.top + 8;
    const half = Phaser.Math.DegToRad(this.cfg.sightHalfAngleDeg);
    const dir = this.brain.facing === 1 ? 0 : Math.PI;
    this.cone.fillStyle(color, alpha);
    this.cone.beginPath();
    this.cone.moveTo(eyeX, eyeY);
    this.cone.arc(eyeX, eyeY, this.cfg.sightRange, dir - half, dir + half, false);
    this.cone.closePath();
    this.cone.fillPath();
  }

  /** "?" with a filling meter while it's unsure, "!" once it has spotted you. */
  private drawIndicator(): void {
    const s = this.brain.state;
    const x = this.hitbox.x;
    const y = this.body.top - 14;
    this.meterBar.clear();

    let text = '';
    let color = '#ffffff';
    if (s === 'alerted' || s === 'chase') {
      text = '!';
      color = '#ff5252';
    } else if (s === 'suspicious' || s === 'search' || (s === 'patrol' && this.brain.meter > 0)) {
      text = '?';
      color = s === 'search' ? '#ffa726' : '#ffd54f';
    }
    this.marker.setText(text).setColor(color).setPosition(x, y - 10);

    if (text === '?') {
      const w = 44;
      this.meterBar.fillStyle(0x1b1f2a, 0.6).fillRect(x - w / 2 - 2, y - 2, w + 4, 8);
      this.meterBar.fillStyle(s === 'search' ? 0xffa726 : 0xffd54f).fillRect(x - w / 2, y, w * this.brain.meter, 4);
    }
  }
}
