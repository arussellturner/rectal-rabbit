import '@fontsource/press-start-2p';
import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from './config';
import { TUNING } from './entities/tuning';
import { input } from './input/InputManager';
import { BootScene } from './scenes/BootScene';
import { EndScene } from './scenes/EndScene';
import { HudScene } from './scenes/HudScene';
import { LevelScene } from './scenes/LevelScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  // Crisp, blocky pixels when sprites are scaled up: the 8-bit look.
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: TUNING.gravity }, debug: DEBUG },
  },
  // Keyboard and gamepad are read by our own InputManager instead.
  input: { keyboard: false, gamepad: false },
  scene: [BootScene, TitleScene, LevelScene, HudScene, PauseScene, EndScene],
});

// Read input once per frame, before any scene updates.
game.events.on(Phaser.Core.Events.PRE_STEP, () => input.update());

// Handy in the browser console while developing: `game.scene.getScene('Level').rabbit`
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
