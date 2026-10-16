import Phaser from 'phaser';

/**
 * The bonus heart floating in a bubble halfway through each level. Jump into
 * it to get back one lost heart.
 */
export class HeartPickup {
  collected = false;
  private readonly heart: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
  ) {
    this.heart = scene.add.image(x, y, 'heart').setDepth(7).setScale(1.4);
    this.bubble = scene.add.image(x, y, 'bubble').setDepth(7).setAlpha(0.9).setScale(1.15);
    scene.tweens.add({ targets: [this.heart, this.bubble], y: y - 10, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // A little heartbeat, so it stands out from the carrot bubbles.
    scene.tweens.add({ targets: this.heart, scale: 1.7, duration: 160, yoyo: true, repeat: -1, repeatDelay: 700, ease: 'Quad.Out' });
  }

  /** Is the rabbit's body (center x, top/bottom) touching it? */
  touches(x: number, top: number, bottom: number): boolean {
    if (this.collected) return false;
    const reach = 36;
    return Math.abs(x - this.x) < reach && this.heart.y > top - reach / 2 && this.heart.y < bottom + reach / 2;
  }

  collect(): void {
    this.collected = true;
    const { scene, heart, bubble } = this;
    scene.tweens.killTweensOf(heart);
    scene.tweens.killTweensOf(bubble);
    scene.tweens.add({ targets: bubble, scale: 1.8, alpha: 0, duration: 160, onComplete: () => bubble.destroy() });
    scene.tweens.add({
      targets: heart,
      y: heart.y - 60,
      scale: 2.4,
      alpha: 0,
      duration: 550,
      ease: 'Quad.Out',
      onComplete: () => heart.destroy(),
    });
  }
}
