import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { input } from '../input/InputManager';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/**
 * "Press any button" doubles as the browser's required gamepad wake-up:
 * controllers stay hidden from the page until a button is pressed.
 */
export class TitleScene extends Phaser.Scene {
  private startText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;

  constructor() {
    super('Title');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor('#7ec8e3');

    this.add.text(cx, 160, 'RECTAL RABBIT', textStyle(96, '#fff4d6')).setOrigin(0.5);
    this.add.text(cx, 245, 'Eat grass. Poop at predators. Get home.', textStyle(30)).setOrigin(0.5);
    this.add.image(cx, 485, 'rabbit').setScale(3).setOrigin(0.5, 1);

    this.startText = this.add.text(cx, 550, '', textStyle(36, '#ffe066')).setOrigin(0.5);
    this.padText = this.add.text(cx, 640, '', textStyle(22, '#e8f4ff')).setOrigin(0.5);
    this.tweens.add({ targets: this.startText, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.begin());
  }

  update(): void {
    const p = prompts();
    this.startText.setText(`Press ${p.jump} to start`);

    const pad = input.gamepadInfo;
    this.padText.setText(
      pad
        ? `🎮 ${pad.name} connected${pad.standardMapping ? '' : '  (unusual button layout, try Chrome or Edge)'}`
        : 'Using a controller? Press any button on it.',
    );

    if (input.justPressed('confirm') || input.justPressed('jump')) this.begin();
  }

  private begin(): void {
    this.scene.start('Level');
  }
}
