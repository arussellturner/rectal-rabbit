import Phaser from 'phaser';
import { textStyle } from './textStyles';

/**
 * A button prompt like  [A] JUMP : the button's name in a little box, then
 * what it does. Used by the HUD control bar, the pause screen, and the
 * controller check on the title screen.
 */
export class ButtonChip extends Phaser.GameObjects.Container {
  readonly chipWidth: number;
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly keyText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string, label: string, size = 12) {
    super(scene, x, y);
    const pad = Math.round(size * 0.5);
    this.keyText = scene.add.text(pad, 0, key, { ...textStyle(size, '#ffffff'), strokeThickness: 0 }).setOrigin(0, 0.5);
    const boxW = this.keyText.width + pad * 2;
    const boxH = size + pad * 2;
    this.box = scene.add
      .rectangle(0, 0, boxW, boxH, 0x000000, 0.75)
      .setOrigin(0, 0.5)
      .setStrokeStyle(Math.max(2, Math.round(size / 6)), 0xffffff);
    const text = scene.add.text(boxW + pad, 0, label, textStyle(size, '#ffffff')).setOrigin(0, 0.5);
    this.add([this.box, this.keyText, text]);
    this.chipWidth = boxW + pad + text.width;
    scene.add.existing(this);
  }

  /** Light up (for the controller check: "yes, that button works"). */
  setLit(on: boolean): this {
    this.box.setFillStyle(on ? 0x58d854 : 0x000000, on ? 1 : 0.75);
    this.keyText.setColor(on ? '#000000' : '#ffffff');
    return this;
  }
}

/** Lay chips out in a row starting at (x, y). Returns the chips. */
export function chipRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: [key: string, label: string][],
  size = 12,
  gap = 28,
): ButtonChip[] {
  let cx = x;
  return items.map(([key, label]) => {
    const chip = new ButtonChip(scene, cx, y, key, label, size);
    cx += chip.chipWidth + gap;
    return chip;
  });
}
