import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { BOMB_COST } from '../entities/PoopBomb';
import { SPLODE_COST, VOMIT_COST } from '../entities/Rabbit';
import { input } from '../input/InputManager';
import { ButtonChip } from './buttonChips';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/** Paused: every control, explained, for whichever device you're using. */
export class PauseScene extends Phaser.Scene {
  private hint!: Phaser.GameObjects.Text;
  private legend: Phaser.GameObjects.GameObject[] = [];
  private legendKey = '';

  constructor() {
    super('Pause');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.88);
    this.add.text(cx, 70, 'PAUSED', textStyle(48)).setOrigin(0.5);
    this.hint = this.add
      .text(cx, GAME_HEIGHT - 50, '', textStyle(14, '#fce0a8'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (input.lastDevice === 'touch') return;
        this.scene.launch('ControllerSetup', { returnTo: 'Pause', how: 'wake' });
        this.scene.sleep();
      });
    this.legendKey = '';
  }

  update(): void {
    const k = prompts();
    const touch = input.lastDevice === 'touch';
    this.hint.setText(touch ? 'TAP II OR JUMP TO KEEP HOPPING' : `${k.pause} OR ${k.jump}: KEEP HOPPING     ${k.settings}: CONTROLLER SETUP`);
    this.drawLegend();
    if (input.justPressed('settings')) {
      this.scene.launch('ControllerSetup', { returnTo: 'Pause', how: 'wake' });
      this.scene.sleep();
      return;
    }
    if (input.justPressed('pause') || input.justPressed('confirm')) {
      this.scene.resume('Level');
      this.scene.stop();
    }
  }

  private drawLegend(): void {
    const k = prompts();
    const pad = input.lastDevice === 'gamepad' ? input.gamepadInfo : null;
    const key = JSON.stringify(k) + (pad?.name ?? '') + input.lastDevice;
    if (key === this.legendKey) return;
    this.legendKey = key;
    for (const o of this.legend) o.destroy();

    const rows: [string, string][] = [
      [k.move, 'RUN LEFT AND RIGHT'],
      [k.jump, 'JUMP (HOLD FOR HIGHER)'],
      [`${k.down} + ${k.jump.split('/')[0]}`, 'DROP THROUGH A LOG BRIDGE'],
      [k.eat.includes('DOWN') ? k.eat : `${k.down} / ${k.eat}`, 'HOLD ON GRASS TO EAT (1 POOP PER BITE)'],
      [k.eat.includes('DOWN') ? k.eat : `${k.down} / ${k.eat}`, 'ON A DIRT PILE: DIG INTO A BURROW'],
      [k.shoot, 'POOP OUT THE BACK AT LEOPARDS'],
      [`${k.up} + ${k.shoot}`, 'HIGH LOB'],
      [k.vomit, `VOMIT OUT THE FRONT (COSTS ${VOMIT_COST} POOP)`],
      [k.bomb, `DROP A POOP BOMB (COSTS ${BOMB_COST} POOPS)`],
      [k.splode, `POOP-SPLOSION + SHIELD (COSTS ${SPLODE_COST} POOPS)`],
      [k.pause, 'PAUSE / THIS SCREEN'],
    ];
    const x = GAME_WIDTH / 2 - 330;
    this.legend = rows.map(([button, label], i) => new ButtonChip(this, x, 150 + i * 46, button, label, 14));

    const device = pad ? `${pad.name.toUpperCase()}` : input.lastDevice === 'touch' ? 'TOUCH SCREEN' : 'KEYBOARD';
    this.legend.push(this.add.text(GAME_WIDTH / 2, 120, `CONTROLS: ${device}`, textStyle(14, '#a4e4fc')).setOrigin(0.5));
    if (pad && !pad.standardMapping) {
      this.legend.push(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 90, 'BUTTONS MIXED UP? TRY CHROME OR EDGE', textStyle(12, '#fcbcb0'))
          .setOrigin(0.5),
      );
    }
  }
}
