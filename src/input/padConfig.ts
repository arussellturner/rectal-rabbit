import { PAD } from './bindings';
import type { PadFamily } from './gamepadMath';

/** The game actions you can put on any controller button in Controller Setup. */
export const BINDABLE = ['jump', 'eat', 'shoot', 'dropBomb', 'pause'] as const;
export type Bindable = (typeof BINDABLE)[number];

/** Which letters are printed on the buttons. 'auto' guesses from the controller's name. */
export const LABEL_STYLES = ['auto', 'xbox', 'nintendo', 'playstation'] as const;
export type LabelStyle = (typeof LABEL_STYLES)[number];
export type ResolvedStyle = Exclude<LabelStyle, 'auto'>;

export interface PadProfile {
  bindings: Record<Bindable, number[]>;
  labels: LabelStyle;
}

export const DEFAULT_BINDINGS: Readonly<Record<Bindable, readonly number[]>> = {
  jump: [PAD.SOUTH],
  eat: [PAD.WEST],
  shoot: [PAD.R1, PAD.R2],
  // LB / L1 too: handy on controllers with a spare bumper (like the 8BitDo Ultimate 2C).
  dropBomb: [PAD.EAST, PAD.L1],
  pause: [PAD.START],
};

/**
 * The d-pad moves the rabbit, and Select opens Controller Setup, so those
 * can't be given to an action.
 */
const RESERVED = new Set<number>([PAD.DPAD_UP, PAD.DPAD_DOWN, PAD.DPAD_LEFT, PAD.DPAD_RIGHT, PAD.SELECT]);

export function canBind(button: number): boolean {
  return button >= 0 && !RESERVED.has(button);
}

/** Button names, by position in the browser's "standard" layout, for each style of controller. */
const NAMES: Record<ResolvedStyle, string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L-STICK', 'R-STICK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '-', '+', 'L-STICK', 'R-STICK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'],
  playstation: [
    'CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE', 'L1', 'R1', 'L2', 'R2', 'CREATE', 'OPTIONS',
    'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PS',
  ],
};

/** 'auto' → a real style, from what kind of controller it says it is. */
export function resolveStyle(style: LabelStyle, family: PadFamily): ResolvedStyle {
  if (style !== 'auto') return style;
  if (family === 'nintendo') return 'nintendo';
  if (family === 'playstation') return 'playstation';
  return 'xbox'; // Xbox, 8BitDo, and anything else with A at the bottom
}

/** What's printed on button number `index`. Extra buttons (like back paddles) get a number. */
export function buttonName(index: number, style: ResolvedStyle): string {
  return NAMES[style][index] ?? `BUTTON ${index}`;
}

export function styleName(style: LabelStyle): string {
  return { auto: 'AUTO', xbox: 'XBOX / 8BITDO (A B X Y)', nintendo: 'NINTENDO (B A Y X)', playstation: 'PLAYSTATION' }[style];
}

function defaultProfile(): PadProfile {
  const bindings = {} as Record<Bindable, number[]>;
  for (const a of BINDABLE) bindings[a] = [...DEFAULT_BINDINGS[a]];
  return { bindings, labels: 'auto' };
}

/** Somewhere to keep settings between visits (localStorage in the browser). */
export interface SettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'rectal-rabbit.controllers';

/**
 * Button setup for each controller, remembered between visits. Profiles are
 * keyed by the controller's name, so a PS5 pad and an 8BitDo can be set up
 * differently. No Phaser in here, so it can be unit tested.
 */
export class PadConfig {
  private profiles: Record<string, PadProfile> = {};

  constructor(private readonly store: SettingsStore | null) {
    try {
      const raw = store?.getItem(STORAGE_KEY);
      if (raw) this.profiles = JSON.parse(raw) as Record<string, PadProfile>;
    } catch {
      this.profiles = {};
    }
  }

  profile(padId: string): PadProfile {
    const saved = this.profiles[padId];
    const fresh = defaultProfile();
    if (!saved) return fresh;
    // Fill in anything missing (e.g. an action added in a newer version of the game).
    for (const a of BINDABLE) if (Array.isArray(saved.bindings?.[a])) fresh.bindings[a] = saved.bindings[a];
    if (LABEL_STYLES.includes(saved.labels)) fresh.labels = saved.labels;
    return fresh;
  }

  /** Buttons that do `action`. "confirm" (menus) is jump or pause. */
  buttonsFor(padId: string, action: Bindable | 'confirm'): number[] {
    const p = this.profile(padId);
    if (action === 'confirm') return [...p.bindings.jump, ...p.bindings.pause];
    return p.bindings[action];
  }

  /**
   * Put `button` on `action` (replacing what was there). If another action
   * was using that button, it gets this action's old button instead, so
   * nothing is ever left without a button.
   */
  bind(padId: string, action: Bindable, button: number): void {
    if (!canBind(button)) return;
    const p = this.profile(padId);
    const old = p.bindings[action][0];
    for (const other of BINDABLE) {
      if (other === action || !p.bindings[other].includes(button)) continue;
      const rest = p.bindings[other].filter((b) => b !== button);
      p.bindings[other] = rest.length > 0 ? rest : old !== undefined ? [old] : [];
    }
    p.bindings[action] = [button];
    this.save(padId, p);
  }

  setLabels(padId: string, labels: LabelStyle): void {
    const p = this.profile(padId);
    p.labels = labels;
    this.save(padId, p);
  }

  reset(padId: string): void {
    const labels = this.profile(padId).labels;
    this.save(padId, { ...defaultProfile(), labels });
  }

  private save(padId: string, profile: PadProfile): void {
    this.profiles[padId] = profile;
    try {
      this.store?.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
    } catch {
      /* private window etc.: settings last until the page is closed */
    }
  }
}

export const padConfig = new PadConfig(typeof localStorage === 'undefined' ? null : localStorage);
