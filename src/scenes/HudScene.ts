import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT } from '../config';
import { MAX_AMMO } from '../entities/tuning';
import { input } from '../input/InputManager';
import { LEVEL_EVENTS, type LevelScene } from './LevelScene';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

const METER_X = 24;
const METER_Y = 58;
const SLOT_SPACING = 30;

/** Drawn on top of the level: controller status, poop meter, control hints. */
export class HudScene extends Phaser.Scene {
  private padText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Image[] = [];
  private shownAmmo = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.padText = this.add.text(20, 14, '', textStyle(20));
    this.hintText = this.add.text(20, GAME_HEIGHT - 16, '', textStyle(19)).setOrigin(0, 1).setLineSpacing(4);
    if (DEBUG) this.debugText = this.add.text(20, 92, '', textStyle(18, '#ffe066'));

    this.meter = this.add.container(METER_X, METER_Y);
    this.meter.add(
      this.add
        .rectangle(-10, -18, SLOT_SPACING * MAX_AMMO + 8, 36, 0x1b1f2a, 0.35)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffffff, 0.25),
    );
    this.slots = Array.from({ length: MAX_AMMO }, (_, i) =>
      this.add.image(i * SLOT_SPACING + 8, 0, 'poop').setScale(1.8),
    );
    this.meter.add(this.slots);

    this.shownAmmo = this.level.rabbit.ammo.count;
    this.refreshSlots();

    const levelEvents = this.level.events;
    levelEvents.on(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => levelEvents.off(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this));
  }

  update(): void {
    const ammo = this.level.rabbit.ammo.count;
    if (ammo !== this.shownAmmo) this.onAmmoChanged(ammo);

    const pad = input.gamepadInfo;
    this.padText.setText(pad ? `🎮 ${pad.name}` : '⌨️ Keyboard  (press a button on your controller to use it)');

    const p = prompts();
    this.hintText.setText(
      `Eat: hold ${p.eat} on grass     Poop: ${p.shoot}  (hold ↑ to lob, ↓ in the air to drop)\n` +
        `Move: ${p.move}     Jump: ${p.jump}     Drop through: ↓ + ${p.jump}     Pause: ${p.pause}`,
    );

    if (this.debugText) {
      const rabbit = this.level.rabbit;
      const v = rabbit.body.velocity;
      this.debugText.setText(
        `fps ${this.game.loop.actualFps.toFixed(0)}   vx ${v.x.toFixed(0)}   vy ${v.y.toFixed(0)}   ` +
          `ground ${rabbit.onGround ? 'yes' : 'no'}   stick ${input.moveX.toFixed(2)}, ${input.moveY.toFixed(2)}`,
      );
    }
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
    slot.setScale(gained ? 2.8 : 1.2);
    this.tweens.add({ targets: slot, scale: 1.8, duration: 220, ease: 'Back.Out' });
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
    this.slots.forEach((s, i) => s.setAlpha(i < this.shownAmmo ? 1 : 0.18));
  }
}
