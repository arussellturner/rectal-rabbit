import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { input } from '../input/InputManager';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

export class PauseScene extends Phaser.Scene {
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Pause');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1b1f2a, 0.6);
    this.add.text(cx, GAME_HEIGHT / 2 - 30, 'Paused', textStyle(72)).setOrigin(0.5);
    this.hint = this.add.text(cx, GAME_HEIGHT / 2 + 50, '', textStyle(28)).setOrigin(0.5);
  }

  update(): void {
    const p = prompts();
    this.hint.setText(`Press ${p.pause} or ${p.jump} to keep hopping`);
    if (input.justPressed('pause') || input.justPressed('confirm')) {
      this.scene.resume('Level');
      this.scene.stop();
    }
  }
}
