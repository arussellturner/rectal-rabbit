import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { LEVELS } from '../data/levels';
import { input } from '../input/InputManager';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

interface EndData {
  won: boolean;
  carrots?: number;
  /** Which level just ended (0 = the first). */
  index?: number;
}

/** "Home safe!" or "Game over", on top of the level. On to the next level, or try again. */
export class EndScene extends Phaser.Scene {
  private data_: EndData = { won: false };
  private hint!: Phaser.GameObjects.Text;
  private ready = false;

  constructor() {
    super('End');
  }

  init(data: EndData): void {
    this.data_ = { carrots: 0, index: 0, ...data };
    this.ready = false;
  }

  private get index(): number {
    return this.data_.index ?? 0;
  }

  private get finishedGame(): boolean {
    return this.data_.won && this.index >= LEVELS.length - 1;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const { won } = this.data_;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, won ? 0.5 : 0.7);

    let title = won ? 'HOME SAFE!' : 'GAME OVER';
    let line = won ? 'THE SNOW LEOPARDS GO HUNGRY TODAY.' : 'THE SNOW LEOPARDS GOT YOU.';
    if (this.finishedGame) {
      title = 'YOU DID IT!';
      line = `ALL ${LEVELS.length} LEVELS DONE. WHAT A RABBIT!`;
    } else if (won) {
      line = `LEVEL ${this.index + 1} DONE! NEXT: ${LEVELS[this.index + 1].name}`;
    }
    this.add.text(cx, cy - 70, title, textStyle(56, won ? '#b8f818' : '#f83800')).setOrigin(0.5);
    this.add.text(cx, cy, line, textStyle(16)).setOrigin(0.5);
    if (won) {
      this.add.image(cx - 90, cy + 50, 'carrot').setScale(2);
      this.add.text(cx - 60, cy + 50, `CARROTS: ${this.data_.carrots}`, textStyle(16, '#fca044')).setOrigin(0, 0.5);
    }
    this.hint = this.add.text(cx, cy + 120, '', textStyle(16, '#fce0a8')).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    // Don't skip straight past it with a button that was already held.
    this.time.delayedCall(700, () => (this.ready = true));
  }

  update(): void {
    const k = prompts();
    const what = this.finishedGame ? 'BACK TO THE TITLE' : this.data_.won ? 'NEXT LEVEL' : 'TRY AGAIN';
    this.hint.setText(`PRESS ${k.jump}: ${what}`);
    if (!this.ready || !(input.justPressed('jump') || input.justPressed('confirm'))) return;

    this.scene.stop('Level');
    if (this.finishedGame) this.scene.start('Title');
    else this.scene.start('Level', { index: this.data_.won ? this.index + 1 : this.index });
  }
}
