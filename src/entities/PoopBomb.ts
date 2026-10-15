import Phaser from 'phaser';

/** Poops it takes to make one poop bomb. */
export const BOMB_COST = 5;
/** Bombs left lying around fizzle out after this many seconds. */
const BOMB_LIFETIME = 25;
/** At most this many bombs on the ground at once (the oldest fizzles). */
export const MAX_BOMBS = 3;

/**
 * A poop bomb sitting on the ground. A snow leopard that runs into it sets
 * it off (the level handles the explosion). It pulses and gives off stink.
 */
export class PoopBomb {
  readonly sprite: Phaser.Physics.Arcade.Image;
  age = 0;
  done = false;
  private stinkTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
  ) {
    this.sprite = group.create(x, y, 'poop-bomb') as Phaser.Physics.Arcade.Image;
    this.sprite.setOrigin(0.5, 1).setDepth(8);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.sprite.width * 0.8, this.sprite.height * 0.7).setOffset(this.sprite.width * 0.1, this.sprite.height * 0.3);
    body.setBounce(0.2, 0.2).setDragX(600);
    this.sprite.setData('bomb', this);
    // Plop!
    this.sprite.setScale(1.4, 0.6);
    scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.Out' });
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  update(dt: number): void {
    if (this.done) return;
    this.age += dt;
    // Throb faster as it gets old, so you can tell it's about to fizzle.
    const speed = this.age > BOMB_LIFETIME - 5 ? 18 : 6;
    this.sprite.setTint(Math.sin(this.age * speed) > 0.6 ? 0xffc0a0 : 0xffffff);

    this.stinkTimer -= dt;
    if (this.stinkTimer <= 0) {
      this.stinkTimer = 0.35;
      const s = this.scene.add.image(this.x + (Math.random() - 0.5) * 24, this.y - 30, 'stink').setDepth(8);
      this.scene.tweens.add({
        targets: s,
        y: s.y - 30,
        x: s.x + Math.sin(this.age * 3) * 10,
        alpha: 0,
        duration: 900,
        onComplete: () => s.destroy(),
      });
    }
    if (this.age > BOMB_LIFETIME) this.fizzle();
  }

  /** Remove quietly (too old, or too many bombs). */
  fizzle(): void {
    if (this.done) return;
    this.done = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, scaleY: 0.2, duration: 400, onComplete: () => this.sprite.destroy() });
  }

  /** Gone with a bang: the level spawns the flying poop. */
  detonate(): void {
    this.done = true;
    this.sprite.destroy();
  }
}
