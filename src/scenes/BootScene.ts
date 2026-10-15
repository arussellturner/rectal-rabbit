import Phaser from 'phaser';
import { makeLevelTextures } from '../art/pixelTextures';
import { makeThemeTextures } from '../art/themeTextures';
import { THEMES } from '../data/themes';
import { SKIP_TITLE, START_LEVEL } from '../config';
import { SHEETS } from '../data/spriteSheets';
import { PIXEL_FONT } from './textStyles';

/**
 * Loads the character sprite sheets, sets up their animations, and draws
 * the 8-bit level art. Waits for the pixel font so text doesn't flash in
 * the wrong font.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const s of SHEETS) {
      this.load.spritesheet(s.key, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
  }

  create(): void {
    for (const s of SHEETS) {
      for (const a of s.anims) {
        if (this.anims.exists(a.key)) continue;
        this.anims.create({
          key: a.key,
          frames: this.anims.generateFrameNumbers(s.key, { frames: a.frames }),
          frameRate: a.frameRate,
          repeat: a.repeat,
        });
      }
    }
    makeLevelTextures(this);
    for (const theme of Object.values(THEMES)) makeThemeTextures(this, theme);

    const start = () =>
      SKIP_TITLE || START_LEVEL !== null
        ? this.scene.start('Level', { index: (START_LEVEL ?? 1) - 1 })
        : this.scene.start('Title');
    // Fonts load lazily; ask for it now, but don't wait forever if offline.
    Promise.race([document.fonts.load(`16px ${PIXEL_FONT}`), new Promise((r) => setTimeout(r, 1500))]).then(start, start);
  }
}
