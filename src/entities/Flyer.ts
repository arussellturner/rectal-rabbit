import Phaser from 'phaser';
import { FlyerBrain } from '../ai/FlyerBrain';
import type { FlyerConfig } from '../data/flyers';
import { textStyle } from '../scenes/textStyles';
import { drawHealthBar } from './healthBar';

/**
 * A bird of prey swooping at you from the front: a hitbox driven by a
 * FlyerBrain (no gravity until it's knocked out of the sky), its sprite, a
 * health bar, and a "!" at the right edge while it's still off screen.
 */
export class Flyer {
  readonly kind = 'flyer' as const;
  readonly brain: FlyerBrain;
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Sprite;
  dangerous = false;
  gone = false;

  private readonly warning: Phaser.GameObjects.Text;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Image[];
  private shownHealth = 1;
  private time = 0;
  private fallingFor = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly cfg: FlyerConfig,
    x: number,
    y: number,
  ) {
    this.brain = new FlyerBrain(cfg);
    this.hitbox = scene.add.zone(x, y, cfg.hitbox.w, cfg.hitbox.h);
    scene.physics.add.existing(this.hitbox);
    this.art = scene.add.sprite(x, y, cfg.sheet, 0).setOrigin(0.5, 0.55).setDepth(9).setScale(cfg.scale);
    if (cfg.tint !== undefined) this.art.setTint(cfg.tint);
    this.warning = scene.add.text(0, 0, '!', textStyle(40, '#f83800')).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.healthBar = scene.add.graphics().setDepth(20);
    this.stars = [0, 1, 2].map(() => scene.add.image(x, 0, 'star').setDepth(20).setVisible(false));
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  /** Birds can catch you the moment they reach you (no landing to recover from). */
  get canBite(): boolean {
    return this.dangerous;
  }

  get airborne(): boolean {
    return true;
  }

  update(dt: number, rabbit: { x: number; centerY: number; feetY: number }, levelHeight: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.time += dt;
    const body = this.body;
    const intent = this.brain.update({ x: this.hitbox.x, y: this.hitbox.y, rabbitX: rabbit.x, rabbitY: rabbit.centerY, groundY: rabbit.feetY }, dt);
    this.dangerous = intent.dangerous;

    body.setAllowGravity(intent.gravity);
    if (!intent.gravity) body.setVelocity(intent.vx, intent.vy);

    const art = this.art;
    art.play(`${this.cfg.sheet}-${intent.anim}`, true);
    art.setPosition(this.hitbox.x, this.hitbox.y).setFlipX(intent.facing < 0);

    // Dizzy stars while it tumbles out of the sky.
    const dizzy = this.brain.state === 'falling';
    this.stars.forEach((star, i) => {
      const a = this.time * 6 + (i * Math.PI * 2) / 3;
      star.setVisible(dizzy).setPosition(Math.round(this.hitbox.x + Math.cos(a) * 26), Math.round(this.hitbox.y - 30 + Math.sin(a) * 8));
    });

    const show = this.brain.hits > 0 && this.brain.state !== 'leave';
    this.shownHealth = Math.max(this.brain.health, this.shownHealth - dt * 2.5);
    drawHealthBar(this.healthBar, show, this.hitbox.x, body.top - 30, this.cfg.hitsToScare, this.brain.health, this.shownHealth);

    // Gone once it's flown off, or a moment after falling.
    if (dizzy) {
      this.fallingFor += dt;
      if (this.fallingFor > 1.2) art.setAlpha(Math.max(0, 1 - (this.fallingFor - 1.2) * 2));
    }
    const camLeft = cam.scrollX;
    const camRight = camLeft + cam.width;
    const offScreen = body.right < camLeft - 300 || body.left > camRight + 500 || body.bottom < -300 || body.top > levelHeight + 60;
    if ((this.brain.leaving && (offScreen || body.bottom < -100)) || this.fallingFor > 1.7 || body.right < camLeft - 600) this.gone = true;

    // Still off screen ahead: flash a "!" at the right edge.
    const ahead = body.left > camRight;
    this.warning
      .setVisible(ahead && !this.brain.leaving && Math.floor(this.time * 6) % 2 === 0)
      .setX(cam.width - 28)
      .setY(Phaser.Math.Clamp(body.center.y, 60, cam.height - 60));
  }

  hit(_fromX: number, pelletVx = 0): 'stagger' | 'scared' | null {
    const result = this.brain.hit();
    if (result) {
      const dir = pelletVx !== 0 ? Math.sign(pelletVx) : 1;
      this.body.setVelocity(dir * this.cfg.knockback, result === 'scared' ? -200 : -120);
      this.flash();
    }
    return result;
  }

  blast(_fromX: number): boolean {
    if (!this.brain.scare()) return false;
    this.body.setVelocity(0, -300);
    this.flash();
    return true;
  }

  caughtRabbit(): void {
    this.brain.caughtRabbit();
  }

  destroy(): void {
    this.hitbox.destroy();
    this.art.destroy();
    this.warning.destroy();
    this.healthBar.destroy();
    for (const s of this.stars) s.destroy();
  }

  private flash(): void {
    this.art.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      this.art.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.cfg.tint !== undefined) this.art.setTint(this.cfg.tint);
    });
  }
}
