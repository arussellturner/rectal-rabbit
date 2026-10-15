import Phaser from 'phaser';
import { GrassState } from '../systems/GrassState';
import { BITES_PER_PATCH, POOP_TUNING } from './tuning';

const HALF_WIDTH = 30;

/** A tuft of grass sitting on a surface. Stand on it and hold Eat. */
export class GrassPatch {
  readonly state = new GrassState(BITES_PER_PATCH, () => POOP_TUNING.regrowInterval);
  readonly image: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly surfaceY: number,
  ) {
    this.image = scene.add.image(x, surfaceY + 2, 'grass-3').setOrigin(0.5, 1).setDepth(5);
  }

  get hasGrass(): boolean {
    return this.state.hasGrass;
  }

  /** Is a rabbit whose feet are at (x, bottom) standing on this patch? */
  isUnderfoot(x: number, bottom: number): boolean {
    return Math.abs(x - this.x) <= HALF_WIDTH && Math.abs(bottom - this.surfaceY) <= 4;
  }

  bite(): boolean {
    if (!this.state.bite()) return false;
    this.refresh();
    this.scene.tweens.add({ targets: this.image, scaleX: 1.15, scaleY: 0.8, duration: 70, yoyo: true });
    return true;
  }

  update(dt: number): void {
    if (this.state.update(dt)) {
      this.refresh();
      this.image.setScale(1, 0.4);
      this.scene.tweens.add({ targets: this.image, scaleY: 1, duration: 300, ease: 'Back.Out' });
    }
  }

  private refresh(): void {
    this.image.setTexture(`grass-${Math.min(this.state.bites, 3)}`);
  }
}
