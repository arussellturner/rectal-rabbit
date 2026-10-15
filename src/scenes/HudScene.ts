import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT } from '../config';
import { input } from '../input/InputManager';
import type { LevelScene } from './LevelScene';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/** Drawn on top of the level. Will hold the grass/poop/bomb meters later. */
export class HudScene extends Phaser.Scene {
  private padText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.padText = this.add.text(20, 16, '', textStyle(20));
    this.hintText = this.add.text(20, GAME_HEIGHT - 20, '', textStyle(20)).setOrigin(0, 1);
    if (DEBUG) this.debugText = this.add.text(20, 48, '', textStyle(18, '#ffe066'));
  }

  update(): void {
    const pad = input.gamepadInfo;
    this.padText.setText(pad ? `🎮 ${pad.name}` : '⌨️ Keyboard  (press a button on your controller to use it)');

    const p = prompts();
    this.hintText.setText(`Move: ${p.move}    Jump: ${p.jump} (hold = higher)    Drop through: ↓ + ${p.jump}    Pause: ${p.pause}`);

    if (this.debugText) {
      const rabbit = (this.scene.get('Level') as LevelScene).rabbit;
      const v = rabbit.body.velocity;
      this.debugText.setText(
        `fps ${this.game.loop.actualFps.toFixed(0)}   vx ${v.x.toFixed(0)}   vy ${v.y.toFixed(0)}   ` +
          `ground ${rabbit.onGround ? 'yes' : 'no'}   stick ${input.moveX.toFixed(2)}, ${input.moveY.toFixed(2)}`,
      );
    }
  }
}
