import type Phaser from 'phaser';

/** "Press Start 2P": an 8-bit arcade font (bundled via @fontsource, loaded in main.ts). */
export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

/** Text in the pixel font. Sizes that are multiples of 8 look crispest. */
export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: PIXEL_FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(4, Math.round(size / 4)),
  };
}
