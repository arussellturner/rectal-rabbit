import Phaser from 'phaser';
import { ChaserBrain } from '../ai/ChaserBrain';
import { TILE } from '../config';
import type { ChaserConfig } from '../data/chasers';
import type { LevelMap } from '../level/LevelMap';
import { textStyle } from '../scenes/textStyles';
import { approach } from './RabbitMotor';
import { drawHealthBar } from './healthBar';
import { CATCH_TUNING, TUNING } from './tuning';

/**
 * A predator on foot: a snow leopard charging in from behind, or one of the
 * special predators coming from the front (stoat, fox, snake, ice wolf). An
 * Arcade Physics hitbox driven by a ChaserBrain, plus its animated sprite,
 * dizzy stars, a health bar, and a flashing "!" at the screen edge while
 * it's still off screen.
 */
export class Chaser {
  readonly kind = 'chaser' as const;
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
    this.art = scene.add.sprite(x, feetY, cfg.sheet, 0).setOrigin(0.5, 1).setDepth(9).setScale(cfg.scale);
    if (cfg.tint !== undefined) this.art.setTint(cfg.tint);
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
    // Water, quicksand and lava count as a gap too.
    if (this.onGround && level.hazards.some((h) => front > h.x && front < h.x + h.w)) gapAhead = true;

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
    if (this.brain.state === 'roll' && this.cfg.jumpVelocity > 0 && this.onGround && (body.blocked.left || body.blocked.right)) {
      body.setVelocityY(-560);
    }

    this.updateArt(intent.anim, intent.facing);
    this.drawHealth(dt);

    const camRight = camLeft + cam.width;
    const offLeft = body.right < camLeft - 400 && this.brain.leaving;
    const offRight = body.left > camRight + 400;
    if (offLeft || offRight || body.top > level.height + 60) this.gone = true;

    // Still off screen and coming: flash a "!" at that edge of the screen.
    const behind = body.right < camLeft;
    const ahead = body.left > camRight;
    this.warning
      .setVisible((behind || ahead) && intent.dangerous && Math.floor(this.time * 6) % 2 === 0)
      .setX(ahead ? cam.width - 28 : 28)
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
    this.scene.time.delayedCall(70, () => {
      this.art.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.cfg.tint !== undefined) this.art.setTint(this.cfg.tint);
    });
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
    const brain = this.brain;
    const show = brain.hits > 0 && brain.state !== 'roll';
    this.shownHealth = Math.max(brain.health, this.shownHealth - dt * 2.5);
    drawHealthBar(this.healthBar, show, this.hitbox.x, this.body.top - 44, this.cfg.hitsToScare, brain.health, this.shownHealth);
  }

  private updateArt(anim: string, facing: 1 | -1): void {
    const key = `${this.cfg.sheet}-${anim}`;
    const art = this.art;
    // Mid-leap: the jumping pose.
    art.play(anim === 'run' && !this.onGround ? `${this.cfg.sheet}-air` : key, true);
    const offset = anim === 'leave' && this.cfg.curlsUp ? 0 : this.cfg.tailOffset;
    art.setPosition(this.hitbox.x - facing * offset, this.body.bottom + this.cfg.scale).setFlipX(facing < 0);

    const dizzy = anim === 'fall';
    const headX = this.hitbox.x + facing * this.cfg.hitbox.w * 0.3;
    const headY = this.body.top - 4;
    this.stars.forEach((star, i) => {
      const a = this.time * 6 + (i * Math.PI * 2) / 3;
      star.setVisible(dizzy).setPosition(Math.round(headX + Math.cos(a) * 24), Math.round(headY + Math.sin(a) * 8));
    });
  }
}
