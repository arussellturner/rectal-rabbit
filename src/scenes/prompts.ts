import { input } from '../input/InputManager';
import { BUTTON_LABELS } from '../input/gamepadMath';

/** Button names for on-screen prompts. Plain capitals, so the 8-bit font can draw them. */
export interface Prompts {
  move: string;
  /** Pressing down (to dig, or drop through a log). */
  down: string;
  /** Holding up (to lob a poop). */
  up: string;
  jump: string;
  /** Eat grass, or dig on a dirt pile. */
  eat: string;
  shoot: string;
  bomb: string;
  pause: string;
}

/** Button names matching the device the player is using right now. */
export function prompts(): Prompts {
  const pad = input.gamepadInfo;
  if (input.lastDevice === 'gamepad' && pad) {
    const b = BUTTON_LABELS[pad.family];
    return {
      move: 'D-PAD',
      down: 'DOWN',
      up: 'UP',
      jump: b.south,
      eat: b.west,
      shoot: b.r1,
      bomb: b.east,
      pause: b.start,
    };
  }
  return { move: 'ARROWS', down: 'DOWN', up: 'UP', jump: 'SPACE', eat: 'E', shoot: 'J', bomb: 'K', pause: 'ESC' };
}
