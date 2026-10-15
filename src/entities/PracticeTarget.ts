import Phaser from 'phaser';

const HITS_TO_KNOCK_DOWN = 3;
const STAND_BACK_UP_MS = 2500;

/** A bullseye to poop at. Wobbles when hit; three hits knock it over. */
export class PracticeTarget {
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  private hits = 0;
  private knockedDown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    groundY: number,
  ) {
    this.art = scene.add.image(x, groundY, 'target').setOrigin(0.5, 1).setDepth(6);
    // Only the round board is hittable, not the post.
    this.hitbox = scene.add.zone(x, groundY - 60, 44, 44);
    scene.physics.add.existing(this.hitbox, true);
  }

  /**
   * Returns 'hit', 'down' (this hit knocked it over), or null if it's already down.
   * A big poop counts as `power` hits.
   */
  hit(fromX: number, power = 1): 'hit' | 'down' | null {
    if (this.knockedDown) return null;
    this.hits += Math.max(1, Math.round(power));
    const away = fromX < this.art.x ? 1 : -1;

    if (this.hits < HITS_TO_KNOCK_DOWN) {
      this.scene.tweens.killTweensOf(this.art);
      this.art.setAngle(0);
      this.scene.tweens.add({ targets: this.art, angle: 14 * away, duration: 80, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
      return 'hit';
    }

    this.hits = 0;
    this.knockedDown = true;
    this.setHittable(false);
    this.scene.tweens.killTweensOf(this.art);
    this.scene.tweens.add({ targets: this.art, angle: 90 * away, duration: 350, ease: 'Bounce.Out' });
    this.scene.time.delayedCall(STAND_BACK_UP_MS, () => {
      this.scene.tweens.add({
        targets: this.art,
        angle: 0,
        duration: 400,
        ease: 'Back.Out',
        onComplete: () => {
          this.knockedDown = false;
          this.setHittable(true);
        },
      });
    });
    return 'down';
  }

  private setHittable(on: boolean): void {
    (this.hitbox.body as Phaser.Physics.Arcade.StaticBody).enable = on;
  }
}
