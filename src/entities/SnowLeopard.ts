import Phaser from 'phaser';
import { ChaserBrain } from '../ai/ChaserBrain';
import { PIXEL, TILE } from '../config';
import type { ChaserConfig } from '../data/chasers';
import type { LevelMap } from '../level/LevelMap';
import { textStyle } from '../scenes/textStyles';
import { approach } from './RabbitMotor';
import { CATCH_TUNING, TUNING } from './tuning';

/**
 * A snow leopard charging in from behind: an Arcade Physics hitbox driven by
 * a ChaserBrain, plus its animated sprite, dizzy stars, and a flashing "!"
 * at the screen edge while it's still off screen.
 */
export class SnowLeopard {
  readonly brain: ChaserBrain;
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Sprite;
  /** Can catch the rabbit this frame. */
  dangerous = true;
  /** Rolled off screen or fell in a pit: the level removes it. */
  gone = false;

  private readonly warning: Phaser.GameObjects.Text;
  private readonly stars: Phaser.GameObjects.Image[];
  /** Health bar over its head, shown from the first poop hit on. */
  private readonly healthBar: Phaser.GameObjects.Graphics;
  /** The bar drains smoothly toward the real health. */
  private shownHealth = 1;
  private onGround = false;
  private time = 0;
  /** Seconds since it last landed (from a jump or a fall). */
  private landedAgo = 99;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly cfg: ChaserConfig,
    x: number,
    feetY: number,
  ) {
    this.brain = new ChaserBrain(cfg);
    this.hitbox = scene.add.zone(x, feetY - cfg.hitbox.h / 2, cfg.hitbox.w, cfg.hitbox.h);
    scene.physics.add.existing(this.hitbox);
    this.art = scene.add.sprite(x, feetY, cfg.sheet, 0).setOrigin(0.5, 1).setDepth(9).setScale(PIXEL);
    this.art.play(`${cfg.sheet}-run`);
    this.warning = scene.add.text(28, 0, '!', textStyle(40, '#f83800')).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.stars = [0, 1, 2].map(() => scene.add.image(x, 0, 'star').setDepth(20).setVisible(false));
    this.healthBar = scene.add.graphics().setDepth(20);
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  update(dt: number, rabbit: { x: number; feetY: number }, level: LevelMap, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.time += dt;
    const body = this.body;
    const wasOnGround = this.onGround;
    this.onGround = body.blocked.down || body.touching.down;
    this.landedAgo = this.onGround && !wasOnGround ? 0 : this.landedAgo + dt;
    const facing = this.brain.facing;
    const camLeft = cam.scrollX;

    // Look just ahead of its nose for walls and pits.
    const front = this.hitbox.x + facing * (this.cfg.hitbox.w / 2 + 10);
    const col = Math.floor(front / TILE);
    const wallAhead =
      level.isSolid(col, Math.floor((body.bottom - 8) / TILE)) || level.isSolid(col, Math.floor(body.center.y / TILE));
    const standRow = Math.floor((body.bottom + 2) / TILE);
    let gapAhead = this.onGround;
    for (let row = standRow; row < level.rows && gapAhead; row++) if (level.isFloor(col, row)) gapAhead = false;

    const intent = this.brain.update(
      {
        selfX: this.hitbox.x,
        feetY: body.bottom,
        onGround: this.onGround,
        rabbitX: rabbit.x,
        rabbitFeetY: rabbit.feetY,
        wallAhead,
        gapAhead,
        offScreen: body.right < camLeft,
      },
      dt,
    );
    this.dangerous = intent.dangerous;

    body.setVelocityX(approach(body.velocity.x, intent.vx, this.cfg.accel * dt));
    if (intent.jump) body.setVelocityY(-this.cfg.jumpVelocity);
    // Heavier on the way down, like the rabbit: snappy, not floaty.
    body.setGravityY(body.velocity.y > 0 ? TUNING.gravity * (TUNING.fallGravityMultiplier - 1) : 0);
    // Rolling away and bumped into a wall: bounce over it.
    if (this.brain.state === 'roll' && this.onGround && (body.blocked.left || body.blocked.right)) {
      body.setVelocityY(-560);
    }

    this.updateArt(intent.anim, intent.facing);
    this.drawHealth(dt);

    const offLeft = body.right < camLeft - 400 && this.brain.leaving;
    const offRight = body.left > camLeft + cam.width + 400;
    if (offLeft || offRight || body.top > level.height + 60) this.gone = true;

    // Still off screen and coming: flash a "!" at the left edge.
    const incoming = body.right < camLeft && intent.dangerous;
    this.warning
      .setVisible(incoming && Math.floor(this.time * 6) % 2 === 0)
      .setY(Phaser.Math.Clamp(body.center.y, 60, cam.height - 60));
  }

  /** Can it catch the rabbit right now? Not for a moment after landing, so landing on you isn't an instant catch. */
  get canBite(): boolean {
    return this.dangerous && this.landedAgo >= CATCH_TUNING.landingRecover;
  }

  /** In the air (jumping over something, or leaping at the rabbit). */
  get airborne(): boolean {
    return !this.onGround;
  }

  /**
   * Hit by a poop pellet fired from `fromX`, flying at `pelletVx`: shoved
   * back the way the poop was going.
   */
  hit(fromX: number, pelletVx = 0): 'stagger' | 'scared' | null {
    const result = this.brain.hit(fromX, this.hitbox.x);
    if (result) {
      const dir = pelletVx !== 0 ? Math.sign(pelletVx) : this.hitbox.x >= fromX ? 1 : -1;
      this.body.setVelocityX(dir * this.cfg.knockback);
      this.body.setVelocityY(result === 'scared' ? -320 : this.onGround ? -160 : this.body.velocity.y);
      this.flash();
    }
    return result;
  }

  caughtRabbit(): void {
    this.brain.caughtRabbit();
    this.body.setVelocityX(0);
  }

  /** Ran into a poop bomb: thrown up in the air and knocked over. */
  blast(fromX: number): boolean {
    if (!this.brain.scare(fromX, this.hitbox.x)) return false;
    this.body.setVelocity(0, -520);
    this.flash();
    return true;
  }

  private flash(): void {
    this.art.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => this.art.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }

  destroy(): void {
    this.hitbox.destroy();
    this.art.destroy();
    this.warning.destroy();
    for (const s of this.stars) s.destroy();
    this.healthBar.destroy();
  }

  /**
   * A chunky 8-bit health bar over its head: one block per poop hit it can
   * take, green when healthy, going yellow then red. Hidden until it's hit,
   * and once it's rolling away.
   */
  private drawHealth(dt: number): void {
    const g = this.healthBar;
    g.clear();
    const brain = this.brain;
    if (brain.hits === 0 || brain.state === 'roll') return;

    const target = brain.health;
    this.shownHealth = Math.max(target, this.shownHealth - dt * 2.5);
    const blocks = this.cfg.hitsToScare;
    const blockW = 8 * PIXEL;
    const gap = PIXEL;
    const w = blocks * blockW + (blocks - 1) * gap;
    const h = 3 * PIXEL;
    const x = Math.round(this.hitbox.x - w / 2);
    const y = Math.round(this.body.top - 44);

    // Black border, dark empty blocks, then the colored fill.
    g.fillStyle(0x000000, 1).fillRect(x - PIXEL, y - PIXEL, w + 2 * PIXEL, h + 2 * PIXEL);
    const color = target > 0.6 ? 0x58d854 : target > 0.3 ? 0xfce048 : 0xf83800;
    for (let i = 0; i < blocks; i++) {
      const bx = x + i * (blockW + gap);
      g.fillStyle(0x3c3c3c, 1).fillRect(bx, y, blockW, h);
      // How much of this block is still full.
      const fill = Phaser.Math.Clamp(this.shownHealth * blocks - i, 0, 1);
      if (fill <= 0) continue;
      // Draining part flashes white, the rest is the health color.
      const real = Phaser.Math.Clamp(target * blocks - i, 0, 1);
      if (fill > real) g.fillStyle(0xfcfcfc, 1).fillRect(bx, y, Math.round(blockW * fill), h);
      if (real > 0) g.fillStyle(color, 1).fillRect(bx, y, Math.round(blockW * real), h);
      g.fillStyle(0xffffff, 0.35).fillRect(bx, y, Math.round(blockW * Math.max(fill, real)), PIXEL);
    }
  }

  private updateArt(anim: string, facing: 1 | -1): void {
    const key = `${this.cfg.sheet}-${anim}`;
    const art = this.art;
    if (anim === 'run' && !this.onGround) {
      // Mid-leap: hold the stretched-out running frame.
      art.anims.stop();
      art.setFrame(2);
    } else {
      art.play(key, true);
    }
    const offset = anim === 'roll' ? 0 : this.cfg.tailOffset;
    art.setPosition(this.hitbox.x - facing * offset, this.body.bottom + PIXEL).setFlipX(facing < 0);

    const dizzy = anim === 'fall';
    const headX = this.hitbox.x + facing * 30;
    const headY = this.body.top - 4;
    this.stars.forEach((star, i) => {
      const a = this.time * 6 + (i * Math.PI * 2) / 3;
      star.setVisible(dizzy).setPosition(Math.round(headX + Math.cos(a) * 24), Math.round(headY + Math.sin(a) * 8));
    });
  }
}
