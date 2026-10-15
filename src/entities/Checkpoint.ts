import Phaser from 'phaser';
import { PIXEL } from '../config';
import type { Spot } from '../level/LevelMap';

/** A flagpole. Run past it and the flag goes up: fall in a pit and you start here. */
export class Checkpoint {
  reached = false;
  private readonly flag: Phaser.GameObjects.Image;
  private readonly topY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spot: Spot,
  ) {
    const pole = scene.add.image(spot.x, spot.y, 'pole').setOrigin(0.5, 1).setDepth(3);
    this.topY = pole.y - pole.height + 4 * PIXEL;
    // Flag starts lowered and gray.
    this.flag = scene.add
      .image(spot.x - PIXEL, spot.y - 6 * PIXEL, 'flag')
      .setOrigin(1, 1)
      .setDepth(3)
      .setTint(0x7c7c7c);
  }

  reach(): void {
    if (this.reached) return;
    this.reached = true;
    this.flag.clearTint();
    this.scene.tweens.add({ targets: this.flag, y: this.topY + this.flag.height, duration: 600, ease: 'Quad.Out' });
  }
}
