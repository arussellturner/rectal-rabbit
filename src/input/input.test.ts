import { describe, expect, it } from 'vitest';
import type { Action, SourceReading } from './actions';
import { ActionState, mergeReadings } from './ActionState';
import { applyRadialDeadzone, BUTTON_LABELS, describeGamepad } from './gamepadMath';

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
    expect(BUTTON_LABELS[pad.family]).toMatchObject({ south: 'A', east: 'B', west: 'X', r1: 'RB' });
  });

  it('only uses labels the 8-bit font can draw (plain letters, no symbols)', () => {
    for (const labels of Object.values(BUTTON_LABELS)) {
      for (const label of Object.values(labels)) expect(label).toMatch(/^[A-Z0-9+\- ]+$/);
    }
  });
});
