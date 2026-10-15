import Phaser from 'phaser';

/**
 * Creates placeholder art in code so the prototype needs no image files.
 * Real sprites (Aseprite exports) will be loaded here later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeRabbitTexture();
    this.scene.start('Title');
  }

  /** A 56×56 side-view bunny facing right. */
  private makeRabbitTexture(): void {
    const g = this.make.graphics({}, false);
    const fur = 0xc9b49a;
    const furDark = 0xa58d72;
    const pink = 0xf2a7b5;

    // Ears (back ear darker for depth).
    g.fillStyle(furDark).fillEllipse(37, 14, 8, 26);
    g.fillStyle(fur).fillEllipse(45, 13, 9, 26);
    g.fillStyle(pink).fillEllipse(45, 14, 4, 17);
    // Body, head, back foot.
    g.fillStyle(fur).fillEllipse(25, 40, 40, 28);
    g.fillStyle(fur).fillCircle(42, 31, 12);
    g.fillStyle(furDark).fillEllipse(30, 52, 18, 7);
    g.fillStyle(furDark).fillEllipse(44, 53, 9, 5);
    // Tail.
    g.fillStyle(0xffffff).fillCircle(6, 35, 6);
    // Eye, highlight, nose.
    g.fillStyle(0x1b1f2a).fillCircle(46, 28, 2.6);
    g.fillStyle(0xffffff).fillCircle(46.8, 27.2, 0.9);
    g.fillStyle(pink).fillCircle(53, 33, 2.2);

    g.generateTexture('rabbit', 56, 56);
    g.destroy();
  }
}
