import type { Action } from './actions';
import { ActionState, mergeReadings } from './ActionState';
import { GamepadSource } from './GamepadSource';
import { KeyboardSource } from './KeyboardSource';
import { TouchSource } from './TouchSource';

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

/**
 * The one place the game reads input from. `update()` runs once per frame,
 * before any scene updates (hooked up in main.ts), so every scene sees the
 * same "just pressed" state.
 */
class InputManager {
  private readonly state = new ActionState();
  private readonly keyboard = new KeyboardSource();
  private readonly gamepad = new GamepadSource();
  /** On-screen buttons on phones and tablets. */
  readonly touch = new TouchSource();

  /** Whichever device was used most recently. Drives on-screen button prompts. */
  lastDevice: InputDevice = 'keyboard';

  constructor() {
    // On a phone, show touch button names from the start.
    if (this.touch.enabled) this.lastDevice = 'touch';
  }

  update(): void {
    const k = this.keyboard.read();
    const g = this.gamepad.read();
    const t = this.touch.read();
    if (g.active) this.lastDevice = 'gamepad';
    else if (k.active) this.lastDevice = 'keyboard';
    else if (t.active) this.lastDevice = 'touch';
    this.state.apply(mergeReadings(k, g, t));
  }

  get moveX(): number {
    return this.state.moveX;
  }

  get moveY(): number {
    return this.state.moveY;
  }

  isDown(action: Action): boolean {
    return this.state.isDown(action);
  }

  justPressed(action: Action): boolean {
    return this.state.justPressed(action);
  }

  justReleased(action: Action): boolean {
    return this.state.justReleased(action);
  }

  get gamepadInfo() {
    return this.gamepad.info;
  }

  /** Raw controller buttons held right now (for Controller Setup). */
  get padButtons(): readonly boolean[] {
    return this.gamepad.buttons;
  }

  /** Raw controller buttons that went down this frame (for Controller Setup). */
  get padNewPresses(): readonly number[] {
    return this.gamepad.newPresses;
  }

  rumble(durationMs: number, strong?: number, weak?: number): void {
    this.gamepad.rumble(durationMs, strong, weak);
  }
}

export const input = new InputManager();
