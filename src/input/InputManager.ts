import type { Action } from './actions';
import { ActionState, mergeReadings } from './ActionState';
import { GamepadSource } from './GamepadSource';
import { KeyboardSource } from './KeyboardSource';

export type InputDevice = 'keyboard' | 'gamepad';

/**
 * The one place the game reads input from. `update()` runs once per frame,
 * before any scene updates (hooked up in main.ts), so every scene sees the
 * same "just pressed" state.
 */
class InputManager {
  private readonly state = new ActionState();
  private readonly keyboard = new KeyboardSource();
  private readonly gamepad = new GamepadSource();

  /** Whichever device was used most recently. Drives on-screen button prompts. */
  lastDevice: InputDevice = 'keyboard';

  update(): void {
    const k = this.keyboard.read();
    const g = this.gamepad.read();
    if (g.active) this.lastDevice = 'gamepad';
    else if (k.active) this.lastDevice = 'keyboard';
    this.state.apply(mergeReadings(k, g));
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

  rumble(durationMs: number, strong?: number, weak?: number): void {
    this.gamepad.rumble(durationMs, strong, weak);
  }
}

export const input = new InputManager();
