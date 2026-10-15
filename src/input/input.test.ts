import { describe, expect, it } from 'vitest';
import type { Action, SourceReading } from './actions';
import { ActionState, mergeReadings } from './ActionState';
import { applyRadialDeadzone, describeGamepad } from './gamepadMath';
import { buttonName, PadConfig, resolveStyle, type SettingsStore } from './padConfig';

const reading = (held: Action[] = [], moveX = 0, moveY = 0, active = false): SourceReading => ({
  held: new Set(held),
  moveX,
  moveY,
  active,
});

describe('ActionState', () => {
  it('reports just-pressed for one frame, then held, then just-released', () => {
    const s = new ActionState();
    s.apply(reading(['jump']));
    expect(s.justPressed('jump')).toBe(true);
    s.apply(reading(['jump']));
    expect(s.justPressed('jump')).toBe(false);
    expect(s.isDown('jump')).toBe(true);
    s.apply(reading());
    expect(s.justReleased('jump')).toBe(true);
    expect(s.isDown('jump')).toBe(false);
  });
});

describe('mergeReadings', () => {
  it('combines buttons from keyboard and controller', () => {
    const merged = mergeReadings(reading(['jump']), reading(['shoot']));
    expect([...merged.held].sort()).toEqual(['jump', 'shoot']);
  });

  it('uses whichever device is pushing harder', () => {
    expect(mergeReadings(reading([], 1), reading([], -0.3)).moveX).toBe(1);
    expect(mergeReadings(reading([], 0), reading([], -0.6, 0.8)).moveY).toBe(0.8);
  });
});

describe('applyRadialDeadzone', () => {
  it('ignores small stick drift', () => {
    expect(applyRadialDeadzone(0.1, -0.1)).toEqual({ x: 0, y: 0 });
  });

  it('still reaches full speed at the edge', () => {
    expect(applyRadialDeadzone(1, 0).x).toBeCloseTo(1);
    const diag = applyRadialDeadzone(Math.SQRT1_2, Math.SQRT1_2);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
  });
});

describe('describeGamepad', () => {
  it('recognises a PS5 DualSense across browsers', () => {
    expect(describeGamepad('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toEqual({
      name: 'PS5 DualSense',
      family: 'playstation',
    });
    expect(describeGamepad('054c-0ce6-Wireless Controller').name).toBe('PS5 DualSense');
  });

  it('recognises Xbox and falls back to generic', () => {
    expect(describeGamepad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)').family).toBe('xbox');
    expect(describeGamepad('Some Arcade Stick').family).toBe('generic');
  });

  it('recognises an 8BitDo Ultimate 2C, with Xbox-style letters', () => {
    const pad = describeGamepad('8BitDo Ultimate 2C Wireless Controller (STANDARD GAMEPAD Vendor: 2dc8 Product: 310a)');
    expect(pad).toEqual({ name: '8BitDo Ultimate 2C', family: 'eightbitdo' });
    expect(describeGamepad('2dc8-6012-8BitDo Ultimate C').family).toBe('eightbitdo');
    const style = resolveStyle('auto', pad.family);
    expect([0, 1, 2, 3, 5].map((b) => buttonName(b, style))).toEqual(['A', 'B', 'X', 'Y', 'RB']);
  });
});

describe('button names', () => {
  it('follow the chosen letters, so an 8BitDo in Switch mode can still say X', () => {
    expect(buttonName(2, resolveStyle('auto', 'nintendo'))).toBe('Y');
    expect(buttonName(2, resolveStyle('xbox', 'nintendo'))).toBe('X');
    expect(buttonName(0, 'playstation')).toBe('CROSS');
    expect(buttonName(19, 'xbox')).toBe('BUTTON 19');
  });

  it('only use characters the 8-bit font can draw', () => {
    for (const style of ['xbox', 'nintendo', 'playstation'] as const) {
      for (let b = 0; b < 17; b++) expect(buttonName(b, style)).toMatch(/^[A-Z0-9+\- ]+$/);
    }
  });
});

describe('PadConfig (controller setup)', () => {
  const memory = (): SettingsStore & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
  };

  it('starts with the standard layout', () => {
    const c = new PadConfig(null);
    expect(c.buttonsFor('pad', 'jump')).toEqual([0]);
    expect(c.buttonsFor('pad', 'eat')).toEqual([2]);
    expect(c.buttonsFor('pad', 'confirm')).toEqual([0, 9]);
  });

  it('moves an action to the button you press', () => {
    const c = new PadConfig(null);
    c.bind('pad', 'eat', 3);
    expect(c.buttonsFor('pad', 'eat')).toEqual([3]);
  });

  it('swaps when the button already did something else, so nothing is left without a button', () => {
    const c = new PadConfig(null);
    c.bind('pad', 'jump', 2); // X was eat
    expect(c.buttonsFor('pad', 'jump')).toEqual([2]);
    expect(c.buttonsFor('pad', 'eat')).toEqual([0]); // eat gets jump's old button
  });

  it('keeps the other buttons of an action that had two', () => {
    const c = new PadConfig(null);
    c.bind('pad', 'jump', 7); // RT was one of the two poop buttons
    expect(c.buttonsFor('pad', 'shoot')).toEqual([5]);
  });

  it("won't put an action on the d-pad", () => {
    const c = new PadConfig(null);
    c.bind('pad', 'jump', 13);
    expect(c.buttonsFor('pad', 'jump')).toEqual([0]);
  });

  it('remembers each controller separately, between visits', () => {
    const store = memory();
    const a = new PadConfig(store);
    a.bind('8BitDo', 'eat', 3);
    a.setLabels('8BitDo', 'xbox');
    const b = new PadConfig(store);
    expect(b.buttonsFor('8BitDo', 'eat')).toEqual([3]);
    expect(b.profile('8BitDo').labels).toBe('xbox');
    expect(b.buttonsFor('PS5', 'eat')).toEqual([2]);
  });

  it('resets buttons but keeps the letters choice', () => {
    const c = new PadConfig(null);
    c.bind('pad', 'eat', 3);
    c.setLabels('pad', 'nintendo');
    c.reset('pad');
    expect(c.buttonsFor('pad', 'eat')).toEqual([2]);
    expect(c.profile('pad').labels).toBe('nintendo');
  });

  it('survives junk in storage', () => {
    const store = memory();
    store.data['rectal-rabbit.controllers'] = '{not json';
    expect(new PadConfig(store).buttonsFor('pad', 'jump')).toEqual([0]);
  });
});
