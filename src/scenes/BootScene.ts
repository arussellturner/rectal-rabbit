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
    this.makeGrassTextures();
    this.makePoopTextures();
    this.makeTargetTexture();
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

  /** grass-3 (full) down to grass-0 (nibbled to stubble). 48×30 each. */
  private makeGrassTextures(): void {
    // [x, lean, height] for each blade, tallest first so short ones draw on top.
    const blades: [number, number, number][] = [
      [24, 0, 28], [14, -4, 25], [34, 4, 25], [8, -6, 20], [40, 6, 20],
      [19, -2, 22], [29, 2, 22], [4, -5, 14], [44, 5, 14],
    ];
    const colors = [0x5e9e34, 0x7cb342, 0x8bc34a];
    for (let bites = 0; bites <= 3; bites++) {
      const g = this.make.graphics({}, false);
      const growth = bites === 0 ? 0.18 : 0.35 + 0.65 * (bites / 3);
      const count = bites === 0 ? blades.length : 3 + bites * 2;
      blades.slice(0, count).forEach(([x, lean, h], i) => {
        const height = Math.max(3, h * growth);
        g.fillStyle(colors[i % colors.length]).fillTriangle(x - 3, 30, x + 3, 30, x + lean * growth, 30 - height);
      });
      g.generateTexture(`grass-${bites}`, 48, 30);
      g.destroy();
    }

    const bit = this.make.graphics({}, false);
    bit.fillStyle(0x7cb342).fillRect(0, 0, 3, 7);
    bit.generateTexture('grass-bit', 3, 7);
    bit.destroy();
  }

  private makePoopTextures(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(0x5a3a1e).fillCircle(6, 6, 6);
    g.fillStyle(0x7a5230).fillCircle(4.5, 4.5, 2.5);
    g.fillStyle(0xa47a52).fillCircle(4, 4, 1);
    g.generateTexture('poop', 12, 12);
    g.destroy();

    const bit = this.make.graphics({}, false);
    bit.fillStyle(0x5a3a1e).fillRect(0, 0, 4, 4);
    bit.generateTexture('poop-bit', 4, 4);
    bit.destroy();
  }

  /** A bullseye on a post, 48×84, standing on its bottom edge. */
  private makeTargetTexture(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(0x7a5a3c).fillRect(21, 40, 6, 44);
    g.fillStyle(0x6b4e33).fillRect(14, 80, 20, 4);
    const rings = [0xd94040, 0xffffff, 0xd94040, 0xffffff, 0xd94040];
    rings.forEach((color, i) => g.fillStyle(color).fillCircle(24, 24, 22 - i * 4.5));
    g.lineStyle(2, 0x1b1f2a, 0.6).strokeCircle(24, 24, 22);
    g.generateTexture('target', 48, 84);
    g.destroy();
  }
}
