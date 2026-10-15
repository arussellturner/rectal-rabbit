import Phaser from 'phaser';

/** Poops you get from a carrot. Bubble carrots (out in the open) are worth more. */
export const BUBBLE_CARROT_POOPS = 3;
export const LOOSE_CARROT_POOPS = 1;

/**
 * A carrot to grab. Above ground it floats in a bobbing bubble you jump into;
 * in a burrow it just sits there. Touch it to collect it.
 */
export class CarrotPickup {
  collected = false;
  private readonly carrot: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Image | null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly inBubble: boolean,
  ) {
    this.carrot = scene.add.image(x, y, 'carrot').setDepth(7).setAngle(inBubble ? -20 : 0);
    this.bubble = inBubble ? scene.add.image(x, y, 'bubble').setDepth(7).setAlpha(0.9) : null;
    const targets = this.bubble ? [this.carrot, this.bubble] : [this.carrot];
    // Bubbles bob gently; loose carrots wiggle.
    scene.tweens.add({
      targets,
      y: y - (inBubble ? 8 : 3),
      duration: inBubble ? 900 : 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      delay: (x * 7) % 600,
    });
  }

  get poops(): number {
    return this.inBubble ? BUBBLE_CARROT_POOPS : LOOSE_CARROT_POOPS;
  }

  /** Is the rabbit's body (center x, top/bottom) touching it? */
  touches(x: number, top: number, bottom: number): boolean {
    if (this.collected) return false;
    const reach = this.inBubble ? 34 : 26;
    return Math.abs(x - this.x) < reach && this.carrot.y > top - reach / 2 && this.carrot.y < bottom + reach / 2;
  }

  collect(): void {
    this.collected = true;
    const { scene, carrot, bubble } = this;
    scene.tweens.killTweensOf(carrot);
    if (bubble) {
      scene.tweens.killTweensOf(bubble);
      // Pop!
      scene.tweens.add({ targets: bubble, scale: 1.6, alpha: 0, duration: 160, onComplete: () => bubble.destroy() });
    }
    scene.tweens.add({
      targets: carrot,
      y: carrot.y - 50,
      angle: 0,
      alpha: 0,
      duration: 450,
      ease: 'Quad.Out',
      onComplete: () => carrot.destroy(),
    });
  }
}
