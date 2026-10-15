import { input } from '../input/InputManager';
import { BUTTON_LABELS } from '../input/gamepadMath';

/** Button names for on-screen prompts, matching the device the player is using. */
export function prompts(): { jump: string; pause: string; move: string } {
  const pad = input.gamepadInfo;
  if (input.lastDevice === 'gamepad' && pad) {
    const labels = BUTTON_LABELS[pad.family];
    return { jump: labels.south, pause: labels.start, move: 'Left stick / D-pad' };
  }
  return { jump: 'Space', pause: 'Esc', move: '← → or A D' };
}
