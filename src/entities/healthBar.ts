import Phaser from 'phaser';
import { PIXEL } from '../config';

/**
 * A chunky 8-bit health bar over a predator's head: one block per poop hit it
 * can take, green when healthy, going yellow then red. The part just lost
 * flashes white as it drains (`shown` lags behind `health`).
 */
export function drawHealthBar(
  g: Phaser.GameObjects.Graphics,
  visible: boolean,
  centerX: number,
  y0: number,
  blocks: number,
  health: number,
  shown: number,
): void {
  g.clear();
  if (!visible) return;
  const blockW = (blocks > 2 ? 6 : 8) * PIXEL;
  const gap = PIXEL;
  const w = blocks * blockW + (blocks - 1) * gap;
  const h = 3 * PIXEL;
  const x = Math.round(centerX - w / 2);
  const y = Math.round(y0);

  // Black border, dark empty blocks, then the colored fill.
  g.fillStyle(0x000000, 1).fillRect(x - PIXEL, y - PIXEL, w + 2 * PIXEL, h + 2 * PIXEL);
  const color = health > 0.6 ? 0x58d854 : health > 0.3 ? 0xfce048 : 0xf83800;
  for (let i = 0; i < blocks; i++) {
    const bx = x + i * (blockW + gap);
    g.fillStyle(0x3c3c3c, 1).fillRect(bx, y, blockW, h);
    // How much of this block is still full.
    const fill = Phaser.Math.Clamp(shown * blocks - i, 0, 1);
    if (fill <= 0) continue;
    const real = Phaser.Math.Clamp(health * blocks - i, 0, 1);
    if (fill > real) g.fillStyle(0xfcfcfc, 1).fillRect(bx, y, Math.round(blockW * fill), h);
    if (real > 0) g.fillStyle(color, 1).fillRect(bx, y, Math.round(blockW * real), h);
    g.fillStyle(0xffffff, 0.35).fillRect(bx, y, Math.round(blockW * Math.max(fill, real)), PIXEL);
  }
}
