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

// Button names for prompts live in padConfig.ts (buttonName), since they
// depend on the button-letters setting in Controller Setup.
