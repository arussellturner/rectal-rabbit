import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { input } from '../input/InputManager';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/** "Home safe!" or "Game over", on top of the level. Press jump to play again. */
export class EndScene extends Phaser.Scene {
  private won = false;
  private carrots = 0;
  private hint!: Phaser.GameObjects.Text;
  private ready = false;

  constructor() {
    super('End');
  }

  init(data: { won: boolean; carrots?: number }): void {
    this.won = data.won;
    this.carrots = data.carrots ?? 0;
    this.ready = false;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, this.won ? 0.45 : 0.7);
    this.add
      .text(cx, cy - 60, this.won ? 'HOME SAFE!' : 'GAME OVER', textStyle(56, this.won ? '#b8f818' : '#f83800'))
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 10, this.won ? 'THE SNOW LEOPARDS GO HUNGRY TODAY.' : 'THE SNOW LEOPARDS GOT YOU.', textStyle(16))
      .setOrigin(0.5);
    if (this.won) {
      this.add.image(cx - 90, cy + 56, 'carrot').setScale(2);
      this.add.text(cx - 60, cy + 56, `CARROTS: ${this.carrots}`, textStyle(16, '#fca044')).setOrigin(0, 0.5);
    }
    this.hint = this.add.text(cx, cy + 120, '', textStyle(16, '#fce0a8')).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    // Don't skip straight past it with a button that was already held.
    this.time.delayedCall(600, () => (this.ready = true));
  }

  update(): void {
    this.hint.setText(`PRESS ${prompts().jump} TO PLAY AGAIN`);
    if (this.ready && (input.justPressed('jump') || input.justPressed('confirm'))) {
      this.scene.start('Level');
    }
  }
}
