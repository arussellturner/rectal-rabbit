import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { LEVELS } from '../data/levels';
import type { Action } from '../input/actions';
import { input } from '../input/InputManager';
import { progress } from '../systems/save';
import { chipRow, type ButtonChip } from './buttonChips';
import type { LevelScene } from './LevelScene';
import { prompts, type Prompts } from './prompts';
import { textStyle } from './textStyles';

/**
 * The title: just the words, over the level itself. LevelScene opens zoomed
 * in on the rabbit at the start of the chosen level and launches this on
 * top; pressing start fades the words away while the level zooms out, and
 * play begins. (The zoom-out is Marshall's idea, from turnerm5/rectal-rabbit.)
 *
 * Left / right picks a level (from the ones you've unlocked): the level
 * behind changes to match. "Press any button" doubles as the browser's
 * required gamepad wake-up: controllers stay hidden until a button is pressed.
 */
export class TitleScene extends Phaser.Scene {
  private startText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private setupText!: Phaser.GameObjects.Text;
  private words: Phaser.GameObjects.GameObject[] = [];
  private chips: { chip: ButtonChip; action: Action }[] = [];
  private chipsKey = '';
  private ready = false;
  private starting = false;
  private heldX = false;
  private levelArrows = false;

  constructor() {
    super('Title');
  }

  private get level(): LevelScene {
    return this.scene.get('Level') as LevelScene;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.starting = false;
    this.ready = false;
    this.chipsKey = '';
    this.chips = [];
    this.warmUpTextures();

    // A soft dark band behind the words so they read over any level.
    const shade = this.add.rectangle(cx, 250, GAME_WIDTH, 420, 0x000000, 0.35).setAlpha(0);
    const title = this.add.text(cx, 40, 'RECTAL RABBIT', textStyle(64, '#fce0a8')).setOrigin(0.5).setAlpha(0);
    const tagline = this.add.text(cx, 180, 'EAT GRASS. POOP AT SNOW LEOPARDS. GET HOME!', textStyle(16)).setOrigin(0.5).setAlpha(0);
    this.levelText = this.add
      .text(cx, 250, '', textStyle(20, '#ffffff'))
      .setOrigin(0.5)
      .setAlign('center')
      .setLineSpacing(10)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        // Tap the left or right end of the level name to change level (for phones and mice).
        if (this.levelArrows) this.changeLevel(p.x < cx ? -1 : 1);
      });
    this.startText = this.add.text(cx, 330, '', textStyle(22, '#ffffff')).setOrigin(0.5).setAlpha(0);
    this.setupText = this.add
      .text(cx, 378, '', textStyle(14, '#a4e4fc'))
      .setOrigin(0.5)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openSetup());
    this.padText = this.add.text(cx, 425, '', textStyle(12, '#e8f4ff')).setOrigin(0.5).setAlign('center').setAlpha(0);
    this.words = [shade, title, tagline, this.levelText, this.startText, this.setupText, this.padText];

    // The title drops in with a bounce as the level fades up, then bobs gently.
    this.tweens.add({ targets: shade, alpha: 1, duration: 600 });
    this.tweens.add({ targets: title, y: 110, alpha: 1, delay: 400, duration: 700, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, y: 116, delay: 1100, duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    this.tweens.add({ targets: [tagline, this.levelText], alpha: 1, delay: 800, duration: 500 });
    this.tweens.add({ targets: [this.setupText, this.padText], alpha: 1, delay: 1100, duration: 500 });
    this.tweens.add({
      targets: this.startText,
      alpha: 1,
      delay: 1100,
      duration: 400,
      onComplete: () => this.tweens.add({ targets: this.startText, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 }),
    });

    // Ignore the button press that woke the controller up (or came from the last screen).
    this.time.delayedCall(400, () => (this.ready = true));
    this.input.on('pointerdown', (_p: unknown, over: unknown[]) => {
      if (over.length === 0 && this.ready) this.begin();
    });
  }

  update(): void {
    if (this.starting) return;
    const k = prompts();
    const touch = input.lastDevice === 'touch';
    this.pickLevel();

    const index = this.level.levelIndex;
    const def = LEVELS[index];
    const locked = LEVELS.length - progress.unlockedCount;
    this.levelArrows = progress.unlockedCount > 1;
    const arrows = this.levelArrows ? ['<  ', '  >'] : ['', ''];
    this.levelText.setText(
      `${arrows[0]}LEVEL ${index + 1}: ${def.name}${arrows[1]}` + (locked > 0 ? `\n(${locked} MORE TO UNLOCK)` : ''),
    );
    this.startText.setText(touch ? 'TAP TO START' : `PRESS ${k.jump} TO START`);
    // Controller Setup is for controllers; on a phone, only if one's plugged in.
    const setup = touch && !input.gamepadInfo ? '' : `${touch ? 'SELECT' : k.settings}: CONTROLLER SETUP`;
    this.setupText.setText(setup).setVisible(setup !== '');

    const pad = input.gamepadInfo;
    this.padText.setText(
      pad
        ? `${pad.name.toUpperCase().slice(0, 48)} CONNECTED${pad.standardMapping ? '' : ' (TRY CHROME OR EDGE)'}\n\nPRESS BUTTONS TO TEST THEM:`
        : touch
          ? this.levelArrows
            ? 'TAP THE ARROWS TO PICK A LEVEL'
            : ''
          : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT.',
    );
    this.updateChips(k, pad !== null);

    if (!this.ready) return;
    if (input.justPressed('settings')) this.openSetup();
    else if (input.justPressed('confirm') || input.justPressed('jump')) this.begin();
  }

  /** Left / right to choose among unlocked levels. */
  private pickLevel(): void {
    const mx = input.moveX;
    if (!this.heldX && Math.abs(mx) > 0.5 && this.levelArrows) this.changeLevel(mx > 0 ? 1 : -1);
    this.heldX = Math.abs(mx) > 0.5;
  }

  /** Swap the level behind the title for the next / previous unlocked one. */
  private changeLevel(dir: number): void {
    const n = progress.unlockedCount;
    const index = (this.level.levelIndex + dir + n) % n;
    this.level.scene.restart({ index, intro: true });
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
          [k.vomit, 'VOMIT', 'vomit'],
          [k.bomb, 'BOMB', 'dropBomb'],
          [k.splode, 'SPLOSION', 'splode'],
          [k.pause, 'PAUSE', 'pause'],
        ];
        const row = chipRow(this, 0, 495, items.map(([b, l]) => [b, l]), 12, 24);
        const width = row.reduce((w, c) => w + c.chipWidth, 0) + 24 * (row.length - 1);
        row.forEach((c, i) => {
          c.x += (GAME_WIDTH - width) / 2;
          this.chips.push({ chip: c, action: items[i][2] });
        });
      }
    }
    for (const { chip, action } of this.chips) chip.setLit(input.isDown(action));
  }

  /**
   * Draw every sprite sheet once, invisibly. The GPU uploads a texture the
   * first time it's drawn, which can be a visible stutter: this way it
   * happens here, not the moment the first snow leopard shows up.
   * (From Marshall's turnerm5/rectal-rabbit.)
   */
  private warmUpTextures(): void {
    const keys = ['rabbit', 'snow-leopard', 'fox', 'weasel', 'wolf', 'snake', 'hawk', 'poop', 'poop-bomb', 'star', 'carrot', 'bubble'];
    const images = keys
      .filter((k) => this.textures.exists(k))
      // Alpha 0 would be skipped by the renderer; this is drawn but shows nothing.
      .map((k) => this.add.image(0, 0, k, 0).setOrigin(0).setAlpha(0.001));
    this.time.delayedCall(200, () => images.forEach((img) => img.destroy()));
  }

  private openSetup(): void {
    this.scene.start('ControllerSetup', { returnTo: 'Title', how: 'start' });
  }

  /** The words fade away as the level zooms out; this scene ends once play begins. */
  private begin(): void {
    if (this.starting) return;
    this.starting = true;
    for (const w of this.words) this.tweens.killTweensOf(w);
    for (const c of this.chips) c.chip.destroy();
    this.startText.setAlpha(1);
    this.tweens.add({ targets: this.startText, scale: 1.15, duration: 90, yoyo: true });
    this.tweens.add({ targets: this.words, alpha: 0, delay: 150, duration: 600 });
    this.level.beginPlay(() => this.scene.stop());
  }
}
