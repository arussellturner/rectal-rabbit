import type Phaser from 'phaser';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: '#1b1f2a',
    strokeThickness: Math.max(3, Math.round(size / 7)),
  };
}
