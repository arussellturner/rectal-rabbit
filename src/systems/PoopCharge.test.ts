import { describe, expect, it } from 'vitest';
import { PoopCharge, stunMultiplier, type ChargeInput, type ChargeResult } from './PoopCharge';

const TIMING = { tapThreshold: 0.2, chargePerPoop: 0.2 };
const DT = 1 / 60;
const charge = () => new PoopCharge(() => TIMING, 10);
const hold = (available = 10, extra: Partial<ChargeInput> = {}): ChargeInput => ({
  shootHeld: true,
  cancelPressed: false,
  available,
  onGround: true,
  ...extra,
});
const release = (available = 10): ChargeInput => ({ ...hold(available), shootHeld: false });

/** Hold for `seconds`, then return the result of letting go. */
function holdFor(c: PoopCharge, seconds: number, available = 10, extra: Partial<ChargeInput> = {}): ChargeResult {
  for (let t = 0; t < seconds; t += DT) c.update(DT, hold(available, extra));
  return c.update(DT, release(available));
}

describe('PoopCharge', () => {
  it('a quick tap is a normal poop', () => {
    expect(holdFor(charge(), 0.1)).toEqual({ kind: 'tap' });
  });

  it('a tap with no poops is still a tap (the rabbit shows "empty!")', () => {
    expect(holdFor(charge(), 0.1, 0)).toEqual({ kind: 'tap' });
  });

  it('holding plants your feet and grows the charge one poop at a time', () => {
    const c = charge();
    c.update(DT, hold());
    expect(c.isCharging).toBe(false);
    for (let t = 0; t < 0.25; t += DT) c.update(DT, hold());
    expect(c.isCharging).toBe(true);
    expect(c.amountFor(10)).toBe(1);
    for (let t = 0; t < 0.4; t += DT) c.update(DT, hold());
    expect(c.amountFor(10)).toBe(3);
  });

  it('releasing a charge costs exactly the charged amount', () => {
    expect(holdFor(charge(), 0.2 + 0.2 * 3 + 0.05)).toEqual({ kind: 'charged', amount: 4 });
  });

  it('never charges past the poops you have', () => {
    const c = charge();
    for (let t = 0; t < 5; t += DT) c.update(DT, hold(4));
    expect(c.amountFor(4)).toBe(4);
    expect(c.update(DT, release(4))).toEqual({ kind: 'charged', amount: 4 });
  });

  it('does not charge with fewer than 2 poops', () => {
    const c = charge();
    for (let t = 0; t < 2; t += DT) c.update(DT, hold(1));
    expect(c.isCharging).toBe(false);
    expect(c.update(DT, release(1))).toEqual({ kind: 'tap' });
  });

  it('a full meter held all the way is a torrent', () => {
    const c = charge();
    for (let t = 0; t < 0.2 + 0.2 * 9 + 0.05; t += DT) c.update(DT, hold());
    expect(c.torrentReady(10)).toBe(true);
    expect(c.update(DT, release())).toEqual({ kind: 'torrent' });
  });

  it('a full charge without a full meter is just a big poop', () => {
    expect(holdFor(charge(), 5, 9)).toEqual({ kind: 'charged', amount: 9 });
  });

  it('cancelling mid-charge spends nothing, and waits for the button to be let go', () => {
    const c = charge();
    for (let t = 0; t < 0.6; t += DT) c.update(DT, hold());
    expect(c.update(DT, hold(10, { cancelPressed: true }))).toEqual({ kind: 'cancelled' });
    expect(c.isCharging).toBe(false);
    // Still holding the button: nothing happens, even on release.
    for (let t = 0; t < 1; t += DT) expect(c.update(DT, hold())).toEqual({ kind: 'none' });
    expect(c.update(DT, release())).toEqual({ kind: 'none' });
    // A fresh press works again.
    expect(holdFor(c, 0.1)).toEqual({ kind: 'tap' });
  });

  it('jumping before the charge starts is not a cancel', () => {
    const c = charge();
    expect(c.update(DT, hold(10, { cancelPressed: true }))).toEqual({ kind: 'none' });
    expect(c.update(DT, release())).toEqual({ kind: 'tap' });
  });

  it('only starts charging on the ground', () => {
    const c = charge();
    for (let t = 0; t < 1; t += DT) c.update(DT, hold(10, { onGround: false }));
    expect(c.isCharging).toBe(false);
  });
});

describe('stunMultiplier', () => {
  it('stuns longer for bigger poops', () => {
    expect(stunMultiplier(1)).toBe(1);
    expect(stunMultiplier(6)).toBeGreaterThan(stunMultiplier(2));
  });
});
