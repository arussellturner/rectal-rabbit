import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { BOMB_COST } from '../entities/PoopBomb';
import { MAX_AMMO } from '../entities/tuning';
import { input } from '../input/InputManager';
import { chipRow, type ButtonChip } from './buttonChips';
import { LEVEL_EVENTS, START_LIVES, type LevelScene } from './LevelScene';
import { prompts, type Prompts } from './prompts';
import { textStyle } from './textStyles';

const METER_X = 32;
const METER_Y = 84;
const SLOT_SPACING = 30;
const BAR_X = GAME_WIDTH / 2 - 220;
const BAR_W = 440;
const BAR_Y = 34;
const CONTROL_BAR_H = 44;

/** Drawn on top of the level: hearts, poop meter, bomb, carrots, trip home, and the controls. */
export class HudScene extends Phaser.Scene {
  private padText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Image[] = [];
  private hearts: Phaser.GameObjects.Image[] = [];
  private bombIcon!: Phaser.GameObjects.Image;
  private bombText!: Phaser.GameObjects.Text;
  private carrotText!: Phaser.GameObjects.Text;
  private barFill!: Phaser.GameObjects.Rectangle;
  private barRabbit!: Phaser.GameObjects.Sprite;
  private burrowText!: Phaser.GameObjects.Text;
  private controls: ButtonChip[] = [];
  private controlsKey = '';
  private shownAmmo = 0;
  private bombWasReady = false;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.hearts = Array.from({ length: START_LIVES }, (_, i) =>
      this.add.image(METER_X + i * 34, 30, 'heart').setOrigin(0, 0.5),
    );

    // Poop meter. A notch after every BOMB_COST slots shows how much a bomb takes.
    this.meter = this.add.container(METER_X, METER_Y);
    this.meter.add(
      this.add
        .rectangle(-8, -18, SLOT_SPACING * MAX_AMMO + 4, 36, 0x000000, 0.45)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0xffffff, 0.7),
    );
    for (let n = BOMB_COST; n < MAX_AMMO; n += BOMB_COST) {
      this.meter.add(this.add.rectangle(n * SLOT_SPACING - 5, 0, 3, 30, 0xfca044));
    }
    this.slots = Array.from({ length: MAX_AMMO }, (_, i) => this.add.image(i * SLOT_SPACING + 12, 0, 'poop').setScale(2));
    this.meter.add(this.slots);

    // Bomb: lights up once you've got enough poop saved.
    const bombX = METER_X + SLOT_SPACING * MAX_AMMO + 24;
    this.bombIcon = this.add.image(bombX + 20, METER_Y + 12, 'poop-bomb').setOrigin(0.5, 1);
    this.bombText = this.add.text(bombX + 46, METER_Y, '', textStyle(12)).setOrigin(0, 0.5);

    this.add.image(METER_X + 10, METER_Y + 46, 'carrot').setScale(1.4);
    this.carrotText = this.add.text(METER_X + 30, METER_Y + 46, '', textStyle(16, '#fca044')).setOrigin(0, 0.5);

    // Trip home: a little rabbit runs along the bar.
    this.add.rectangle(BAR_X, BAR_Y, BAR_W, 14, 0x000000, 0.5).setOrigin(0, 0.5).setStrokeStyle(3, 0xffffff);
    this.barFill = this.add.rectangle(BAR_X, BAR_Y, 0, 8, 0x58d854).setOrigin(0, 0.5);
    this.barRabbit = this.add.sprite(BAR_X, BAR_Y + 6, 'rabbit', 0).setOrigin(0.5, 1).setScale(1.5);
    this.add.text(BAR_X + BAR_W + 14, BAR_Y, 'HOME', textStyle(16, '#fce0a8')).setOrigin(0, 0.5);
    this.burrowText = this.add
      .text(GAME_WIDTH / 2, 150, 'IN A SECRET BURROW: SAFE FROM LEOPARDS!', textStyle(12, '#fca044'))
      .setOrigin(0.5, 0.5);

    this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, CONTROL_BAR_H, 0x000000, 0.55).setOrigin(0, 1);
    this.padText = this.add.text(GAME_WIDTH - 20, 20, '', textStyle(10, '#e8f4ff')).setOrigin(1, 0);
    const lv = this.level;
    this.add.text(GAME_WIDTH - 20, 42, `LEVEL ${lv.levelIndex + 1}: ${lv.def.name}`, textStyle(10, lv.theme.accent)).setOrigin(1, 0);
    if (DEBUG) this.debugText = this.add.text(20, 160, '', textStyle(10, '#fce0a8'));

    this.shownAmmo = this.level.rabbit.ammo.count;
    this.refreshSlots();
    this.controlsKey = '';

    const levelEvents = this.level.events;
    levelEvents.on(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this);
    levelEvents.on(LEVEL_EVENTS.BOMB_NOT_READY, this.onEmptyShot, this);
    levelEvents.on(LEVEL_EVENTS.LIFE_LOST, this.onLifeLost, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      levelEvents.off(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this);
      levelEvents.off(LEVEL_EVENTS.BOMB_NOT_READY, this.onEmptyShot, this);
      levelEvents.off(LEVEL_EVENTS.LIFE_LOST, this.onLifeLost, this);
    });
  }

  update(): void {
    const level = this.level;
    const ammo = level.rabbit.ammo.count;
    if (ammo !== this.shownAmmo) this.onAmmoChanged(ammo);

    this.hearts.forEach((h, i) => h.setTexture(i < level.lives ? 'heart' : 'heart-empty'));
    this.carrotText.setText(`x ${level.carrots}`);

    const k = prompts();
    const ready = ammo >= BOMB_COST;
    this.bombIcon.setAlpha(ready ? 1 : 0.3);
    this.bombText.setText(ready ? `BOMB READY! PRESS ${k.bomb}` : `BOMB: SAVE ${BOMB_COST} POOPS`).setAlpha(ready ? 1 : 0.6);
    if (ready && !this.bombWasReady) {
      this.bombIcon.setScale(1.8);
      this.tweens.add({ targets: this.bombIcon, scale: 1, duration: 300, ease: 'Back.Out' });
    }
    this.bombWasReady = ready;

    const p = level.progress;
    this.barFill.width = BAR_W * p;
    this.barRabbit.x = BAR_X + BAR_W * p;
    this.burrowText.setVisible(level.underground);

    const pad = input.gamepadInfo;
    this.padText.setText(pad ? pad.name.toUpperCase().slice(0, 40) : 'KEYBOARD');
    this.refreshControls(k);

    if (this.debugText) {
      const rabbit = level.rabbit;
      const v = rabbit.body.velocity;
      this.debugText.setText(
        `FPS ${this.game.loop.actualFps.toFixed(0)}  VX ${v.x.toFixed(0)}  VY ${v.y.toFixed(0)}  ` +
          `X ${rabbit.hitbox.x.toFixed(0)}  COL ${Math.floor(rabbit.hitbox.x / 48)}  GROUND ${rabbit.onGround ? 'Y' : 'N'}`,
      );
    }
  }

  /** The row of button prompts along the bottom. Rebuilt when you switch keyboard/controller. */
  private refreshControls(k: Prompts): void {
    const key = JSON.stringify(k);
    if (key === this.controlsKey) return;
    this.controlsKey = key;
    for (const c of this.controls) c.destroy();
    this.controls = chipRow(this, 18, GAME_HEIGHT - CONTROL_BAR_H / 2, [
      [k.move, 'MOVE'],
      [k.jump, 'JUMP'],
      [k.eat, 'EAT / DIG'],
      [k.shoot, 'POOP'],
      [k.bomb, 'BOMB'],
      [k.pause, 'PAUSE + HELP'],
    ]);
  }

  private get level(): LevelScene {
    return this.scene.get('Level') as LevelScene;
  }

  private onAmmoChanged(count: number): void {
    const gained = count > this.shownAmmo;
    // Pop the slot that just filled (or just emptied).
    const slot = this.slots[gained ? count - 1 : count];
    this.shownAmmo = count;
    this.refreshSlots();
    if (!slot) return;
    slot.setScale(gained ? 3 : 1.4);
    this.tweens.add({ targets: slot, scale: 2, duration: 220, ease: 'Back.Out' });
  }

  private onLifeLost(): void {
    const heart = this.hearts[this.level.lives];
    if (!heart) return;
    heart.setScale(1.8);
    this.tweens.add({ targets: heart, scale: 1, duration: 300, ease: 'Back.Out' });
  }

  private onEmptyShot(): void {
    this.tweens.killTweensOf(this.meter);
    this.meter.x = METER_X;
    this.tweens.add({ targets: this.meter, x: METER_X + 8, duration: 45, yoyo: true, repeat: 3 });
    for (const s of this.slots) {
      s.setTint(0xff6666);
      this.time.delayedCall(300, () => s.clearTint());
    }
  }

  private refreshSlots(): void {
    this.slots.forEach((s, i) => s.setAlpha(i < this.shownAmmo ? 1 : 0.25));
  }
}
