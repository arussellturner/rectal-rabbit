import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { MAX_AMMO } from '../entities/tuning';
import { input } from '../input/InputManager';
import { LEVEL_EVENTS, type LevelScene } from './LevelScene';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

const METER_X = 24;
const METER_Y = 58;
const SLOT_SPACING = 30;
const SUPER_TEXT = 'SUPER POOP!';
const SUPER_SHOW_MS = 2200;

/** Drawn on top of the level: controller status, poop meter, control hints. */
export class HudScene extends Phaser.Scene {
  private padText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Image[] = [];
  private chargeGlow!: Phaser.GameObjects.Graphics;
  private chargeLabel!: Phaser.GameObjects.Text;
  private shownAmmo = 0;
  private superLetters: Phaser.GameObjects.Text[] = [];
  private superBornAt = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.padText = this.add.text(20, 14, '', textStyle(20));
    this.hintText = this.add.text(20, GAME_HEIGHT - 12, '', textStyle(18)).setOrigin(0, 1).setLineSpacing(3);
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
    // Drawn over the slots: lights up the poops a SUPER POOP will use.
    this.chargeGlow = this.add.graphics();
    this.meter.add(this.chargeGlow);
    this.chargeLabel = this.add.text(SLOT_SPACING * MAX_AMMO + 8, 0, '', textStyle(24, '#ffd54f')).setOrigin(0, 0.5);
    this.meter.add(this.chargeLabel);

    this.shownAmmo = this.level.rabbit.ammo.count;
    this.refreshSlots();

    const levelEvents = this.level.events;
    levelEvents.on(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this);
    levelEvents.on(LEVEL_EVENTS.SUPER_POOP, this.showSuperPoop, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      levelEvents.off(LEVEL_EVENTS.EMPTY_SHOT, this.onEmptyShot, this);
      levelEvents.off(LEVEL_EVENTS.SUPER_POOP, this.showSuperPoop, this);
    });
  }

  update(time: number): void {
    const rabbit = this.level.rabbit;
    const ammo = rabbit.ammo.count;
    if (ammo !== this.shownAmmo) this.onAmmoChanged(ammo);
    this.drawChargeGlow(time / 1000);
    this.animateSuperPoop(time);

    const pad = input.gamepadInfo;
    this.padText.setText(pad ? `🎮 ${pad.name}` : '⌨️ Keyboard  (press a button on your controller to use it)');

    const p = prompts();
    this.hintText.setText(
      `Eat: hold ${p.eat} on grass     Poop: tap ${p.shoot}  (hold ↑ to lob, ↓ in the air to drop)\n` +
        `SUPER POOP: hold ${p.shoot} to charge, let go to fire  (${p.jump} or ${p.cancel} cancels)\n` +
        `Move: ${p.move}     Jump: ${p.jump}     Drop through: ↓ + ${p.jump}     Pause: ${p.pause}`,
    );

    if (this.debugText) {
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

  /** A pulsing glow over the slots the charged poop will spend. Rainbow when the torrent is ready. */
  private drawChargeGlow(t: number): void {
    const rabbit = this.level.rabbit;
    const amount = rabbit.chargeAmount;
    this.chargeGlow.clear();
    if (amount <= 0) {
      this.chargeLabel.setText('');
      return;
    }

    const ready = rabbit.torrentReady;
    const pulse = 0.5 + 0.5 * Math.sin(t * (ready ? 20 : 12));
    const color = ready ? Phaser.Display.Color.HSVToRGB((t * 1.2) % 1, 0.9, 1).color : 0xffd54f;
    const x0 = -6;
    const width = (amount - 1) * SLOT_SPACING + 28;

    this.chargeGlow.fillStyle(color, 0.22 + 0.25 * pulse).fillRoundedRect(x0, -16, width, 32, 10);
    this.chargeGlow.lineStyle(3, color, 0.6 + 0.4 * pulse).strokeRoundedRect(x0, -16, width, 32, 10);
    // A soft outer halo.
    this.chargeGlow.lineStyle(8, color, 0.12 + 0.12 * pulse).strokeRoundedRect(x0 - 4, -20, width + 8, 40, 14);

    this.chargeLabel
      .setText(ready ? 'TORRENT!' : `×${amount}`)
      .setColor(`#${color.toString(16).padStart(6, '0')}`)
      .setScale(1 + 0.08 * pulse);
  }

  /** Giant bouncing rainbow letters across the middle of the screen. */
  private showSuperPoop(): void {
    for (const l of this.superLetters) l.destroy();
    // Drawn once in white with a dark outline; colored per frame with a tint
    // (re-drawing the text every frame to change its color is slow and glitchy).
    const pad = 12;
    const style = { ...textStyle(120, '#ffffff'), strokeThickness: 16, padding: { x: pad, y: pad } };
    this.superLetters = [...SUPER_TEXT].map((ch) => this.add.text(0, 0, ch, style).setOrigin(0.5).setDepth(50));
    const widths = this.superLetters.map((l) => (l.text === ' ' ? 40 : l.width - 2 * pad - 8));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = GAME_WIDTH / 2 - total / 2;
    this.superLetters.forEach((l, i) => {
      l.setData('x', x + widths[i] / 2);
      x += widths[i];
      l.setScale(0);
      this.tweens.add({ targets: l, scale: 1, duration: 450, delay: i * 40, ease: 'Back.Out' });
    });
    this.superBornAt = this.time.now;
  }

  private animateSuperPoop(time: number): void {
    if (this.superLetters.length === 0) return;
    const age = time - this.superBornAt;
    if (age > SUPER_SHOW_MS) {
      const letters = this.superLetters;
      this.superLetters = [];
      this.tweens.add({
        targets: letters,
        scale: 2.5,
        alpha: 0,
        duration: 350,
        ease: 'Cubic.In',
        onComplete: () => letters.forEach((l) => l.destroy()),
      });
      return;
    }
    this.superLetters.forEach((l, i) => {
      const hue = (time / 900 + i / SUPER_TEXT.length) % 1;
      l.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.85, 1).color)
        // No rotation: rotated, overlapping Text objects clip each other in Phaser 4.
        .setPosition(l.getData('x') as number, GAME_HEIGHT * 0.38 + Math.sin(time / 110 + i * 0.7) * 16);
    });
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
