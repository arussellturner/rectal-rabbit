import { ACTIONS, emptyReading, type SourceReading } from './actions';
import { PAD } from './bindings';
import { padConfig } from './padConfig';
import { applyRadialDeadzone, describeGamepad, type PadInfo } from './gamepadMath';

const STICK_DEADZONE = 0.2;
/** How far the stick must move to count as "the player picked up the controller". */
const STICK_ACTIVITY = 0.5;

/** Optional in the DOM typings and missing in some browsers, so typed loosely. */
interface RumbleActuator {
  playEffect?: (
    type: 'dual-rumble',
    params: { duration: number; strongMagnitude: number; weakMagnitude: number },
  ) => Promise<unknown>;
}

/**
 * Polls the browser Gamepad API once per frame.
 *
 * Browsers hide controllers until a button is pressed after the page loads
 * (a privacy rule), so `navigator.getGamepads()` is empty until then.
 */
export class GamepadSource {
  private prevButtons: boolean[] = [];
  private prevStickMag = 0;
  private pad: Gamepad | null = null;
  /** Raw button state this frame, for Controller Setup. */
  buttons: boolean[] = [];
  /** Buttons that went down this frame. */
  newPresses: number[] = [];

  read(): SourceReading {
    this.pad = this.findPad();
    const pad = this.pad;
    if (!pad) {
      this.prevButtons = [];
      this.prevStickMag = 0;
      this.buttons = [];
      this.newPresses = [];
      return emptyReading();
    }

    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    this.buttons = buttons;
    this.newPresses = buttons.flatMap((b, i) => (b && !this.prevButtons[i] ? [i] : []));
    const btn = (i: number) => buttons[i] ?? false;

    const stick = applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEADZONE);
    let moveX = stick.x;
    let moveY = stick.y;
    // The d-pad wins over the stick when pressed.
    const dpadX = (btn(PAD.DPAD_RIGHT) ? 1 : 0) - (btn(PAD.DPAD_LEFT) ? 1 : 0);
    const dpadY = (btn(PAD.DPAD_DOWN) ? 1 : 0) - (btn(PAD.DPAD_UP) ? 1 : 0);
    if (dpadX !== 0) moveX = dpadX;
    if (dpadY !== 0) moveY = dpadY;

    const stickMag = Math.hypot(moveX, moveY);
    const newPress = buttons.some((b, i) => b && !this.prevButtons[i]);
    const active = newPress || (stickMag >= STICK_ACTIVITY && this.prevStickMag < STICK_ACTIVITY);
    this.prevButtons = buttons;
    this.prevStickMag = stickMag;

    return {
      moveX,
      moveY,
      held: new Set(
        ACTIONS.filter((a) => (a === 'settings' ? btn(PAD.SELECT) : padConfig.buttonsFor(pad.id, a).some(btn))),
      ),
      active,
    };
  }

  get info(): (PadInfo & { id: string; standardMapping: boolean }) | null {
    if (!this.pad) return null;
    return { ...describeGamepad(this.pad.id), id: this.pad.id, standardMapping: this.pad.mapping === 'standard' };
  }

  rumble(durationMs: number, strong = 0.5, weak = 0.5): void {
    const actuator = (this.pad as (Gamepad & { vibrationActuator?: RumbleActuator }) | null)?.vibrationActuator;
    actuator
      ?.playEffect?.('dual-rumble', { duration: durationMs, strongMagnitude: strong, weakMagnitude: weak })
      .catch(() => {
        /* Not every browser/controller combo supports rumble. That's fine. */
      });
  }

  /** First connected pad, preferring ones the browser maps to the standard layout. */
  private findPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
    return pads.find((p) => p.mapping === 'standard') ?? pads[0] ?? null;
  }
}
