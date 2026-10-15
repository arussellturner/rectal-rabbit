/**
 * Radial deadzone: ignores small stick drift, then rescales so the stick
 * still reaches full speed at the edge. Returns values in -1..1.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone = 0.2): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

export type PadFamily = 'playstation' | 'xbox' | 'nintendo' | 'eightbitdo' | 'generic';

export interface PadInfo {
  name: string;
  family: PadFamily;
}

/** Turn a browser `Gamepad.id` string into a friendly name for the HUD. */
export function describeGamepad(id: string): PadInfo {
  const s = id.toLowerCase();
  // 8BitDo (vendor 2dc8), e.g. the Ultimate 2C. Check first: some modes also
  // mention Xbox or Nintendo in the name. In X-input mode it may just report
  // as an Xbox 360 controller, which has the same button letters anyway.
  if (s.includes('8bitdo') || s.includes('2dc8')) {
    const ultimate2c = /ultimate\s*2c/.test(s);
    return { name: ultimate2c ? '8BitDo Ultimate 2C' : '8BitDo controller', family: 'eightbitdo' };
  }
  if (s.includes('dualsense') || (s.includes('054c') && (s.includes('0ce6') || s.includes('0df2')))) {
    return { name: 'PS5 DualSense', family: 'playstation' };
  }
  if (s.includes('054c') || s.includes('dualshock') || s.includes('playstation')) {
    return { name: 'PlayStation controller', family: 'playstation' };
  }
  if (s.includes('xbox') || s.includes('xinput') || s.includes('045e')) {
    return { name: 'Xbox controller', family: 'xbox' };
  }
  if (s.includes('057e') || s.includes('nintendo') || s.includes('pro controller')) {
    return { name: 'Switch Pro Controller', family: 'nintendo' };
  }
  return { name: 'Gamepad', family: 'generic' };
}

export interface ButtonLabels {
  /** Bottom face button. */
  south: string;
  /** Right face button. */
  east: string;
  /** Left face button. */
  west: string;
  r1: string;
  start: string;
}

/**
 * On-screen labels for the buttons we prompt for, per controller family,
 * spelled out in plain letters so they show up in the 8-bit font.
 * Buttons are by position (the browser's "standard" layout), so the bottom
 * button is always jump, whatever letter is printed on it.
 */
export const BUTTON_LABELS: Record<PadFamily, ButtonLabels> = {
  playstation: { south: 'CROSS', east: 'CIRCLE', west: 'SQUARE', r1: 'R1', start: 'OPTIONS' },
  xbox: { south: 'A', east: 'B', west: 'X', r1: 'RB', start: 'MENU' },
  nintendo: { south: 'B', east: 'A', west: 'Y', r1: 'R', start: '+' },
  // The Ultimate 2C has Xbox-style letters: A at the bottom, B on the right.
  eightbitdo: { south: 'A', east: 'B', west: 'X', r1: 'RB', start: 'START' },
  generic: { south: 'A', east: 'B', west: 'X', r1: 'RB', start: 'START' },
};
