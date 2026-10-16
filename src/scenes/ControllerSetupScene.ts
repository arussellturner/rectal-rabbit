import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { input } from '../input/InputManager';
import {
  BINDABLE,
  buttonName,
  canBind,
  LABEL_STYLES,
  padConfig,
  resolveStyle,
  styleName,
  type Bindable,
  type ResolvedStyle,
} from '../input/padConfig';
import { textStyle } from './textStyles';

const ACTION_NAMES: Record<Bindable, string> = {
  jump: 'JUMP',
  eat: 'EAT / DIG',
  shoot: 'POOP',
  vomit: 'VOMIT',
  dropBomb: 'POOP BOMB',
  splode: 'POOP-SPLOSION',
  pause: 'PAUSE + HELP',
};

type Row = { kind: 'labels' } | { kind: 'action'; action: Bindable } | { kind: 'reset' } | { kind: 'done' };

const ROWS: Row[] = [
  { kind: 'labels' },
  ...BINDABLE.map((action) => ({ kind: 'action' as const, action })),
  { kind: 'reset' },
  { kind: 'done' },
];

const ROW_Y = 214;
const ROW_H = 42;
const LEFT = 250;
const VALUE_X = 640;
/** Seconds to wait for a button before giving up. */
const LISTEN_TIME = 8;

export interface SetupData {
  /** Scene to go back to. */
  returnTo: string;
  /** 'start' it again (title), or 'wake' it (the pause screen, which is sleeping). */
  how: 'start' | 'wake';
}

/**
 * Controller Setup: pick a control, press the controller button you want for
 * it. Also lets you say which letters are printed on your buttons, so the
 * prompts match (e.g. an 8BitDo in Switch mode still has A at the bottom).
 */
export class ControllerSetupScene extends Phaser.Scene {
  private back!: SetupData;
  private selected = 1;
  private listening: Bindable | null = null;
  private waitForRelease = false;
  private listenLeft = 0;
  private lastMoveY = 0;
  private message = '';
  private messageLeft = 0;
  private flashRow = -1;
  private flashLeft = 0;

  private deviceText!: Phaser.GameObjects.Text;
  private heldText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private rowTexts: { label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Zone }[] = [];

  constructor() {
    super('ControllerSetup');
  }

  init(data: SetupData): void {
    this.back = data?.returnTo ? data : { returnTo: 'Title', how: 'start' };
    this.selected = 1;
    this.listening = null;
    this.message = '';
    this.rowTexts = [];
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0c1a40, 1);
    this.add.text(cx, 56, 'CONTROLLER SETUP', textStyle(40, '#fce0a8')).setOrigin(0.5);
    this.deviceText = this.add.text(cx, 116, '', textStyle(14, '#a4e4fc')).setOrigin(0.5);
    this.heldText = this.add.text(cx, 156, '', textStyle(12, '#b8f818')).setOrigin(0.5);

    ROWS.forEach((row, i) => {
      const y = ROW_Y + i * ROW_H + (i > BINDABLE.length ? 16 : 0);
      const label = this.add.text(LEFT, y, '', textStyle(18)).setOrigin(0, 0.5);
      const value = this.add.text(VALUE_X, y, '', textStyle(18, '#fca044')).setOrigin(0, 0.5);
      const hit = this.add.zone(GAME_WIDTH / 2, y, GAME_WIDTH - 360, ROW_H - 6).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.selected = i;
        this.activate(row, 1);
      });
      this.rowTexts.push({ label, value, hit });
    });

    this.messageText = this.add.text(cx, GAME_HEIGHT - 116, '', textStyle(14, '#fcbcb0')).setOrigin(0.5);
    this.helpText = this.add
      .text(cx, GAME_HEIGHT - 52, '', textStyle(11, '#e8f4ff'))
      .setOrigin(0.5)
      .setAlign('center')
      .setLineSpacing(8);
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const pad = input.gamepadInfo;
    const style: ResolvedStyle | null = pad ? resolveStyle(padConfig.profile(pad.id).labels, pad.family) : null;
    const presses = input.padNewPresses;

    if (this.listening) this.listen(dt, presses);
    else this.navigate(presses);

    // --- draw ---
    this.deviceText.setText(
      pad
        ? `${pad.name.toUpperCase().slice(0, 44)}${pad.standardMapping ? '' : '  (UNUSUAL LAYOUT: TRY CHROME)'}`
        : 'NO CONTROLLER YET: PRESS ANY BUTTON ON IT',
    );
    const held = input.padButtons.flatMap((b, i) => (b && style ? [buttonName(i, style)] : []));
    this.heldText.setText(pad ? `HOLDING: ${held.length > 0 ? held.join('  ') : '(NOTHING)'}` : '');

    const profile = pad ? padConfig.profile(pad.id) : null;
    ROWS.forEach((row, i) => {
      const { label, value } = this.rowTexts[i];
      const isSel = i === this.selected;
      const flashing = i === this.flashRow && this.flashLeft > 0;
      label.setColor(isSel ? '#fca044' : '#ffffff');
      let l = '';
      let v = '';
      if (row.kind === 'labels') {
        l = 'BUTTON LETTERS';
        v = profile ? `< ${styleName(profile.labels)} >` : '---';
      } else if (row.kind === 'action') {
        l = ACTION_NAMES[row.action];
        if (this.listening === row.action) v = Math.floor(this.listenLeft * 3) % 2 === 0 ? 'PRESS A BUTTON...' : '';
        else v = profile && style ? profile.bindings[row.action].map((b) => buttonName(b, style)).join(' + ') || '---' : '---';
      } else if (row.kind === 'reset') {
        l = 'RESET BUTTONS';
      } else {
        l = 'DONE';
      }
      label.setText(`${isSel ? '> ' : '  '}${l}`);
      value.setText(v).setColor(flashing ? '#b8f818' : '#fca044');
    });
    this.flashLeft = Math.max(0, this.flashLeft - dt);

    this.messageLeft = Math.max(0, this.messageLeft - dt);
    this.messageText.setText(this.messageLeft > 0 ? this.message : '');
    this.helpText.setText(
      this.listening
        ? `PRESS THE CONTROLLER BUTTON YOU WANT FOR ${ACTION_NAMES[this.listening]}\n(ESC OR WAIT TO CANCEL)`
        : 'CLICK A CONTROL, OR PICK ONE WITH THE D-PAD / ARROWS AND PRESS ANY BUTTON.\n' +
            'THEN PRESS THE BUTTON YOU WANT FOR IT.  ESC: DONE\n' +
            "LETTERS ON SCREEN DON'T MATCH YOUR BUTTONS? CHANGE BUTTON LETTERS (LEFT / RIGHT).",
    );
  }

  /** Not waiting for a button: move the cursor and pick rows. */
  private navigate(presses: readonly number[]): void {
    // Select (or C on the keyboard) closes this screen, same as it opened it.
    if (input.justPressed('settings')) {
      this.leave();
      return;
    }
    const my = input.moveY;
    if (my > 0.5 && this.lastMoveY <= 0.5) this.move(1);
    if (my < -0.5 && this.lastMoveY >= -0.5) this.move(-1);
    this.lastMoveY = my;

    const row = ROWS[this.selected];
    if (row.kind === 'labels') {
      if (input.moveX > 0.5 && !this.heldX) this.cycleLabels(1);
      if (input.moveX < -0.5 && !this.heldX) this.cycleLabels(-1);
    }
    this.heldX = Math.abs(input.moveX) > 0.5;

    // Any controller button picks the row (the d-pad is for moving the cursor).
    const pick = presses.find(canBind);
    if (pick !== undefined) {
      this.activate(row, 1);
      return;
    }
    // Keyboard: Enter / Space picks, Esc leaves. (Only when no controller button was pressed this frame.)
    if (presses.length === 0 && input.lastDevice === 'keyboard') {
      if (input.justPressed('confirm')) this.activate(row, 1);
      else if (input.justPressed('pause')) this.leave();
    }
  }

  private heldX = false;

  private move(dir: number): void {
    this.selected = (this.selected + dir + ROWS.length) % ROWS.length;
  }

  private activate(row: Row, dir: number): void {
    const pad = input.gamepadInfo;
    if (row.kind === 'done') return this.leave();
    if (!pad) {
      this.say('CONNECT A CONTROLLER FIRST: PRESS ANY BUTTON ON IT');
      return;
    }
    if (row.kind === 'labels') return this.cycleLabels(dir);
    if (row.kind === 'reset') {
      padConfig.reset(pad.id);
      this.say('BUTTONS RESET');
      return;
    }
    this.listening = row.action;
    this.listenLeft = LISTEN_TIME;
    // Don't take the press that picked this row: wait until everything's let go.
    this.waitForRelease = true;
  }

  /** Waiting for the player to press the button they want. */
  private listen(dt: number, presses: readonly number[]): void {
    const pad = input.gamepadInfo;
    this.listenLeft -= dt;
    const keyboardCancel = presses.length === 0 && input.lastDevice === 'keyboard' && input.justPressed('pause');
    if (!pad || this.listenLeft <= 0 || keyboardCancel) {
      this.listening = null;
      return;
    }
    if (this.waitForRelease) {
      if (!input.padButtons.some(Boolean)) this.waitForRelease = false;
      return;
    }
    const button = presses[0];
    if (button === undefined) return;
    if (!canBind(button)) {
      this.say(button === 8 ? 'SELECT OPENS THIS SCREEN. PICK ANOTHER BUTTON.' : 'THE D-PAD IS FOR RUNNING. PICK ANOTHER BUTTON.');
      return;
    }
    const action = this.listening!;
    padConfig.bind(pad.id, action, button);
    this.listening = null;
    this.flashRow = ROWS.findIndex((r) => r.kind === 'action' && r.action === action);
    this.flashLeft = 0.6;
    const style = resolveStyle(padConfig.profile(pad.id).labels, pad.family);
    this.say(`${ACTION_NAMES[action]} IS NOW ${buttonName(button, style)}`);
    input.rumble(80, 0.3, 0.3);
  }

  private cycleLabels(dir: number): void {
    const pad = input.gamepadInfo;
    if (!pad) return;
    const current = padConfig.profile(pad.id).labels;
    const i = LABEL_STYLES.indexOf(current);
    padConfig.setLabels(pad.id, LABEL_STYLES[(i + dir + LABEL_STYLES.length) % LABEL_STYLES.length]);
  }

  private say(text: string): void {
    this.message = text;
    this.messageLeft = 2.5;
  }

  private leave(): void {
    const { returnTo, how } = this.back;
    if (how === 'wake') {
      this.scene.wake(returnTo);
      this.scene.stop();
    } else {
      this.scene.start(returnTo);
    }
  }
}
