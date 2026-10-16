import { describe, expect, it } from 'vitest';
import { NearMiss, type NearMissInput } from './NearMiss';
import { SlowMo } from './SlowMo';

const RULES = { nearMissDistance: 16, nearMissCooldown: 1 };
const DT = 1 / 60;

const frame = (gap: number, over: Partial<NearMissInput> = {}): NearMissInput => ({
  attacking: true,
  pouncing: false,
  gap,
  biting: false,
  ...over,
});

describe('NearMiss', () => {
  it('fires once the rabbit gets back out of range after a close call', () => {
    const n = new NearMiss(() => RULES);
    expect(n.update(DT, frame(40))).toBe(false);
    expect(n.update(DT, frame(10))).toBe(false); // close, but not over yet
    expect(n.update(DT, frame(4))).toBe(false);
    expect(n.update(DT, frame(30))).toBe(true); // got away
    expect(n.update(DT, frame(40))).toBe(false);
  });

  it('is not a near miss if it ends in a bite', () => {
    const n = new NearMiss(() => RULES);
    n.update(DT, frame(8));
    expect(n.update(DT, frame(0, { biting: true }))).toBe(false);
    expect(n.update(DT, frame(40))).toBe(false);
  });

  it('ignores closeness when the predator is not attacking', () => {
    const n = new NearMiss(() => RULES);
    n.update(DT, frame(2, { attacking: false }));
    expect(n.update(DT, frame(40, { attacking: false }))).toBe(false);
  });

  it('fires when the attack ends with the rabbit still close', () => {
    const n = new NearMiss(() => RULES);
    n.update(DT, frame(5));
    expect(n.update(DT, frame(5, { attacking: false }))).toBe(true);
  });

  it('fires only once per pounce', () => {
    const n = new NearMiss(() => ({ ...RULES, nearMissCooldown: 0 }));
    n.update(DT, frame(6, { pouncing: true }));
    expect(n.update(DT, frame(30, { pouncing: true }))).toBe(true);
    n.update(DT, frame(6, { pouncing: true }));
    expect(n.update(DT, frame(30, { pouncing: true }))).toBe(false);
    // The next pounce can give another.
    n.update(DT, frame(60));
    n.update(DT, frame(6, { pouncing: true }));
    expect(n.update(DT, frame(30, { pouncing: true }))).toBe(true);
  });

  it('waits out the cooldown between near misses in a chase', () => {
    const n = new NearMiss(() => RULES);
    n.update(DT, frame(6));
    expect(n.update(DT, frame(30))).toBe(true);
    n.update(DT, frame(6));
    expect(n.update(DT, frame(30))).toBe(false); // too soon
    for (let t = 0; t < 1; t += DT) n.update(DT, frame(60));
    n.update(DT, frame(6));
    expect(n.update(DT, frame(30))).toBe(true);
  });

  it('counts the edge of the range as close', () => {
    const n = new NearMiss(() => RULES);
    n.update(DT, frame(16));
    expect(n.update(DT, frame(17))).toBe(true);
  });
});

describe('SlowMo', () => {
  it('slows time for a while, then goes back to normal', () => {
    const s = new SlowMo();
    expect(s.update(DT)).toBe(1);
    s.start(0.25, 0.1);
    expect(s.active).toBe(true);
    expect(s.update(0.05)).toBe(0.25);
    expect(s.update(0.05)).toBe(0.25); // the last slow frame
    expect(s.active).toBe(false);
    expect(s.update(DT)).toBe(1);
  });

  it('keeps the slower scale and the later end when requests overlap', () => {
    const s = new SlowMo();
    s.start(0.25, 0.3);
    s.start(0.5, 0.1);
    expect(s.scale).toBe(0.25);
    s.update(0.2);
    expect(s.active).toBe(true);
    s.update(0.11);
    expect(s.active).toBe(false);
  });

  it('ignores requests that would not slow anything', () => {
    const s = new SlowMo();
    s.start(1, 1);
    s.start(0.5, 0);
    expect(s.active).toBe(false);
    expect(s.scale).toBe(1);
  });
});
