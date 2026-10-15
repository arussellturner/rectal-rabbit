import Phaser from 'phaser';
import { themeKey } from '../art/themeTextures';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL, TILE } from '../config';
import { LEVELS } from '../data/levels';
import { THEMES } from '../data/themes';
import type { Action } from '../input/actions';
import { input } from '../input/InputManager';
import { progress } from '../systems/save';
import { chipRow, type ButtonChip } from './buttonChips';
import { prompts, type Prompts } from './prompts';
import { textStyle } from './textStyles';

/**
 * Title screen: pick a level (left / right, from the ones you've unlocked),
 * open Controller Setup, and check your controller's buttons light up.
 *
 * "Press any button" doubles as the browser's required gamepad wake-up:
 * controllers stay hidden from the page until a button is pressed.
 */
export class TitleScene extends Phaser.Scene {
  private startText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private setupText!: Phaser.GameObjects.Text;
  private rabbit!: Phaser.GameObjects.Sprite;
  private leopard!: Phaser.GameObjects.Sprite;
  private scenery!: Phaser.GameObjects.Container;
  private chips: { chip: ButtonChip; action: Action }[] = [];
  private chipsKey = '';
  private ready = false;
  private selected = 0;
  private shownLevel = -1;
  private heldX = false;

  constructor() {
    super('Title');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.scenery = this.add.container(0, 0);
    // Start on the newest level you've unlocked.
    this.selected = progress.unlockedCount - 1;
    this.shownLevel = -1;

    this.add.text(cx, 110, 'RECTAL RABBIT', textStyle(64, '#fce0a8')).setOrigin(0.5);
    this.add.text(cx, 180, 'EAT GRASS. POOP AT SNOW LEOPARDS. GET HOME!', textStyle(16)).setOrigin(0.5);

    this.levelText = this.add.text(cx, 250, '', textStyle(20, '#ffffff')).setOrigin(0.5).setAlign('center').setLineSpacing(10);
    this.startText = this.add.text(cx, 330, '', textStyle(22, '#ffffff')).setOrigin(0.5);
    this.tweens.add({ targets: this.startText, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
    this.setupText = this.add
      .text(cx, 378, '', textStyle(14, '#a4e4fc'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openSetup());
    this.padText = this.add.text(cx, 430, '', textStyle(12, '#e8f4ff')).setOrigin(0.5).setAlign('center');

    this.rabbit = this.add.sprite(0, 13 * TILE + PIXEL, 'rabbit').setOrigin(0.5, 1).setScale(PIXEL).play('rabbit-run').setDepth(5);
    this.leopard = this.add
      .sprite(0, 13 * TILE + PIXEL, 'snow-leopard')
      .setOrigin(0.5, 1)
      .setScale(PIXEL)
      .play('snow-leopard-run')
      .setDepth(5);

    this.chipsKey = '';
    this.chips = [];
    this.ready = false;
    // Ignore the button press that woke the controller up.
    this.time.delayedCall(300, () => (this.ready = true));
    this.input.on('pointerdown', (_p: unknown, over: unknown[]) => {
      if (over.length === 0) this.begin();
    });
  }

  update(time: number): void {
    const k = prompts();
    this.pickLevel();
    if (this.selected !== this.shownLevel) this.drawScenery();

    const def = LEVELS[this.selected];
    const locked = LEVELS.length - progress.unlockedCount;
    const arrows = progress.unlockedCount > 1 ? ['<  ', '  >'] : ['', ''];
    this.levelText.setText(
      `${arrows[0]}LEVEL ${this.selected + 1}: ${def.name}${arrows[1]}` +
        (locked > 0 ? `\n(${locked} MORE TO UNLOCK)` : ''),
    );
    this.startText.setText(`PRESS ${k.jump} TO START`);
    this.setupText.setText(`${k.settings}: CONTROLLER SETUP`);

    const pad = input.gamepadInfo;
    this.padText.setText(
      pad
        ? `${pad.name.toUpperCase().slice(0, 48)} CONNECTED${pad.standardMapping ? '' : ' (TRY CHROME OR EDGE)'}\n\nPRESS BUTTONS TO TEST THEM:`
        : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT.',
    );
    this.updateChips(k, pad !== null);

    // Loop the chase across the screen.
    const span = GAME_WIDTH + 600;
    const x = ((time * 0.3) % span) - 200;
    this.rabbit.x = Math.round(x + 260);
    this.leopard.x = Math.round(x - 30 + Math.sin(time / 300) * 20);

    if (!this.ready) return;
    if (input.justPressed('settings')) this.openSetup();
    else if (input.justPressed('confirm') || input.justPressed('jump')) this.begin();
  }

  /** Left / right to choose among unlocked levels. */
  private pickLevel(): void {
    const mx = input.moveX;
    if (!this.heldX && Math.abs(mx) > 0.5) {
      const n = progress.unlockedCount;
      this.selected = (this.selected + (mx > 0 ? 1 : -1) + n) % n;
    }
    this.heldX = Math.abs(mx) > 0.5;
  }

  /** The background in the chosen level's colors. */
  private drawScenery(): void {
    this.shownLevel = this.selected;
    this.scenery.removeAll(true);
    const t = THEMES[LEVELS[this.selected].theme];
    const groundY = 13 * TILE;
    const bandH = Math.ceil(GAME_HEIGHT / t.sky.length);
    const add = (o: Phaser.GameObjects.GameObject) => this.scenery.add(o);
    t.sky.forEach((c, i) => add(this.add.rectangle(0, i * bandH, GAME_WIDTH, bandH, c).setOrigin(0, 0)));
    if (t.far.kind !== 'none') {
      for (let x = 0; x < GAME_WIDTH + 400; x += 380) add(this.add.image(x + 60, groundY - 20, themeKey(t, 'far')).setOrigin(0.5, 1));
    }
    const hanging = t.mid.kind === 'stalactites';
    for (let x = 0; x < GAME_WIDTH; x += 192) {
      add(this.add.image(x, hanging ? 0 : groundY + 10, themeKey(t, 'mid')).setOrigin(0, hanging ? 0 : 1));
    }
    if (t.clouds) for (const [x, y] of [[180, 60], [640, 40], [1060, 80]]) add(this.add.image(x, y, themeKey(t, 'cloud')));
    for (let x = 0, i = 0; x < GAME_WIDTH; x += TILE, i++) {
      add(this.add.image(x, groundY, themeKey(t, `ground-${i % 3}`)).setOrigin(0, 0));
      add(this.add.image(x, groundY + TILE, themeKey(t, `ground-${(i + 1) % 3}`)).setOrigin(0, 0));
      add(this.add.image(x, groundY - 3 * PIXEL, themeKey(t, 'cap')).setOrigin(0, 0));
    }
    for (const x of [140, 980]) add(this.add.image(x, groundY, themeKey(t, 'deco')).setOrigin(0.5, 1));
    this.scenery.setDepth(-1);
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
        const row = chipRow(this, 0, 500, items.map(([b, l]) => [b, l]), 12, 24);
        const width = row.reduce((w, c) => w + c.chipWidth, 0) + 24 * (row.length - 1);
        row.forEach((c, i) => {
          c.x += (GAME_WIDTH - width) / 2;
          this.chips.push({ chip: c, action: items[i][2] });
        });
      }
    }
    for (const { chip, action } of this.chips) chip.setLit(input.isDown(action));
  }

  private openSetup(): void {
    this.scene.start('ControllerSetup', { returnTo: 'Title', how: 'start' });
  }

  private begin(): void {
    this.scene.start('Level', { index: this.selected });
  }
}
