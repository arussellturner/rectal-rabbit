import Phaser from 'phaser';
import { SKY_BANDS } from '../art/pixelTextures';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL, TILE } from '../config';
import type { Action } from '../input/actions';
import { input } from '../input/InputManager';
import { chipRow, type ButtonChip } from './buttonChips';
import { prompts, type Prompts } from './prompts';
import { textStyle } from './textStyles';

/**
 * "Press any button" doubles as the browser's required gamepad wake-up:
 * controllers stay hidden from the page until a button is pressed.
 * Once a controller shows up, its buttons light up here when pressed, so you
 * can check everything works before starting.
 */
export class TitleScene extends Phaser.Scene {
  private startText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private rabbit!: Phaser.GameObjects.Sprite;
  private leopard!: Phaser.GameObjects.Sprite;
  private chips: { chip: ButtonChip; action: Action }[] = [];
  private chipsKey = '';
  private ready = false;

  constructor() {
    super('Title');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const groundY = 13 * TILE;
    const bandH = Math.ceil(GAME_HEIGHT / SKY_BANDS.length);
    SKY_BANDS.forEach((c, i) => this.add.rectangle(0, i * bandH, GAME_WIDTH, bandH, c).setOrigin(0, 0));

    for (let x = 0; x < GAME_WIDTH + 400; x += 380) this.add.image(x + 60, groundY - 20, 'mountain').setOrigin(0.5, 1);
    for (let x = 0; x < GAME_WIDTH; x += 192) this.add.image(x, groundY + 10, 'forest').setOrigin(0, 1);
    for (const [x, y] of [[180, 90], [640, 60], [1060, 120]]) this.add.image(x, y, 'cloud');
    for (let x = 0, i = 0; x < GAME_WIDTH; x += TILE, i++) {
      this.add.image(x, groundY, `tile-dirt-${i % 3}`).setOrigin(0, 0);
      this.add.image(x, groundY + TILE, `tile-dirt-${(i + 1) % 3}`).setOrigin(0, 0);
      this.add.image(x, groundY - 2 * PIXEL, 'snowcap').setOrigin(0, 0);
    }

    this.add.text(cx, 130, 'RECTAL RABBIT', textStyle(64, '#fce0a8')).setOrigin(0.5);
    this.add.text(cx, 205, 'EAT GRASS. POOP AT SNOW LEOPARDS. GET HOME!', textStyle(16)).setOrigin(0.5);

    // A rabbit running for its life, with a snow leopard close behind.
    this.rabbit = this.add.sprite(0, groundY + PIXEL, 'rabbit').setOrigin(0.5, 1).setScale(PIXEL).play('rabbit-run');
    this.leopard = this.add
      .sprite(0, groundY + PIXEL, 'snow-leopard')
      .setOrigin(0.5, 1)
      .setScale(PIXEL)
      .play('snow-leopard-run');

    this.startText = this.add.text(cx, 290, '', textStyle(24, '#ffffff')).setOrigin(0.5);
    this.padText = this.add.text(cx, 350, '', textStyle(12, '#e8f4ff')).setOrigin(0.5);
    this.tweens.add({ targets: this.startText, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    this.chipsKey = '';
    this.ready = false;
    // Ignore the button press that woke the controller up.
    this.time.delayedCall(300, () => (this.ready = true));

    this.input.once('pointerdown', () => this.begin());
  }

  update(time: number): void {
    const k = prompts();
    this.startText.setText(`PRESS ${k.jump} TO START`);

    const pad = input.gamepadInfo;
    this.padText.setText(
      pad
        ? `${pad.name.toUpperCase().slice(0, 48)} CONNECTED${pad.standardMapping ? '' : ' (TRY CHROME OR EDGE)'}\n\nPRESS BUTTONS TO TEST THEM:`
        : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT.',
    ).setAlign('center');
    this.updateChips(k, pad !== null);

    // Loop the chase across the screen.
    const span = GAME_WIDTH + 600;
    const x = ((time * 0.3) % span) - 200;
    this.rabbit.x = Math.round(x + 260);
    this.leopard.x = Math.round(x - 30 + Math.sin(time / 300) * 20);

    if (this.ready && (input.justPressed('confirm') || input.justPressed('jump'))) this.begin();
  }

  /** Controller check: a chip per button, lit while you hold it. */
  private updateChips(k: Prompts, show: boolean): void {
    const key = show ? JSON.stringify(k) : '';
    if (key !== this.chipsKey) {
      this.chipsKey = key;
      for (const c of this.chips) c.chip.destroy();
      this.chips = [];
      if (show) {
        const items: [string, string, Action][] = [
          [k.jump, 'JUMP', 'jump'],
          [k.eat, 'EAT/DIG', 'eat'],
          [k.shoot, 'POOP', 'shoot'],
          [k.bomb, 'BOMB', 'dropBomb'],
          [k.pause, 'PAUSE', 'pause'],
        ];
        const row = chipRow(this, 0, 420, items.map(([b, l]) => [b, l]), 12, 24);
        const width = row.reduce((w, c) => w + c.chipWidth, 0) + 24 * (row.length - 1);
        row.forEach((c, i) => {
          c.x += (GAME_WIDTH - width) / 2;
          this.chips.push({ chip: c, action: items[i][2] });
        });
      }
    }
    for (const { chip, action } of this.chips) chip.setLit(input.isDown(action));
  }

  private begin(): void {
    this.scene.start('Level');
  }
}
