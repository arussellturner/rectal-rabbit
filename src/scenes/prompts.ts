import { input } from '../input/InputManager';
import { buttonName, padConfig, resolveStyle, type Bindable } from '../input/padConfig';

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
  /** Vomit out the front. */
  vomit: string;
  bomb: string;
  /** The poop-splosion. */
  splode: string;
  pause: string;
  /** Open Controller Setup. */
  settings: string;
}

/** The name of the (first) controller button that does `action`, in the chosen button-letter style. */
export function padButtonName(action: Bindable): string {
  const pad = input.gamepadInfo;
  if (!pad) return '?';
  const profile = padConfig.profile(pad.id);
  const button = profile.bindings[action][0];
  return button === undefined ? '---' : buttonName(button, resolveStyle(profile.labels, pad.family));
}

/** Button names matching the device the player is using right now. */
export function prompts(): Prompts {
  const pad = input.gamepadInfo;
  if (input.lastDevice === 'gamepad' && pad) {
    return {
      move: 'D-PAD',
      down: 'DOWN',
      up: 'UP',
      jump: padButtonName('jump'),
      eat: padButtonName('eat'),
      shoot: padButtonName('shoot'),
      vomit: padButtonName('vomit'),
      bomb: padButtonName('dropBomb'),
      splode: padButtonName('splode'),
      pause: padButtonName('pause'),
      settings: buttonName(8, resolveStyle(padConfig.profile(pad.id).labels, pad.family)),
    };
  }
  if (input.lastDevice === 'touch') {
    // The on-screen buttons are labelled with what they do.
    return {
      move: 'D-PAD',
      down: 'DOWN',
      up: 'UP',
      jump: 'JUMP',
      eat: 'EAT',
      shoot: 'POOP',
      vomit: 'VOMIT',
      bomb: 'BOMB',
      splode: 'BOOM',
      pause: 'II',
      settings: '-',
    };
  }
  return {
    move: 'ARROWS',
    down: 'DOWN',
    up: 'UP',
    jump: 'SPACE/UP',
    eat: 'DOWN',
    shoot: 'D',
    vomit: 'F',
    bomb: 'S',
    splode: 'A',
    pause: 'P',
    settings: 'C',
  };
}
