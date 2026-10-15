import { input } from '../input/InputManager';
import { BUTTON_LABELS } from '../input/gamepadMath';

export interface Prompts {
  move: string;
  jump: string;
  eat: string;
  shoot: string;
  pause: string;
}

/** Button names for on-screen prompts, matching the device the player is using. */
export function prompts(): Prompts {
  const pad = input.gamepadInfo;
  if (input.lastDevice === 'gamepad' && pad) {
    const labels = BUTTON_LABELS[pad.family];
    return { move: 'Left stick / D-pad', jump: labels.south, eat: labels.west, shoot: labels.r1, pause: labels.start };
  }
  return { move: '← → or A D', jump: 'Space', eat: 'E', shoot: 'J', pause: 'Esc' };
}
