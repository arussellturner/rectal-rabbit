import { describe, expect, it } from 'vitest';
import { poopLaunchVelocity } from '../entities/poopLaunch';
import { DEFAULT_POOP_TUNING } from '../entities/tuning';
import { GrassState } from './GrassState';
import { PoopAmmo } from './PoopAmmo';

describe('PoopAmmo', () => {
  it('fills up to max and no further', () => {
    const ammo = new PoopAmmo(3);
    expect(ammo.add(2)).toBe(2);
    expect(ammo.add(2)).toBe(1);
    expect(ammo.count).toBe(3);
    expect(ammo.isFull).toBe(true);
  });

  it('only spends what it has', () => {
    const ammo = new PoopAmmo(10, 1);
    expect(ammo.spend()).toBe(true);
    expect(ammo.spend()).toBe(false);
    expect(ammo.isEmpty).toBe(true);
  });
});

describe('GrassState', () => {
  it('runs out after its bites are eaten', () => {
    const g = new GrassState(2, () => 5);
    expect(g.bite()).toBe(true);
    expect(g.bite()).toBe(true);
    expect(g.bite()).toBe(false);
    expect(g.hasGrass).toBe(false);
  });

  it('regrows one bite per interval, up to full', () => {
    const g = new GrassState(2, () => 5);
    g.bite();
    g.bite();
    expect(g.update(4.9)).toBe(false);
    expect(g.update(0.2)).toBe(true);
    expect(g.bites).toBe(1);
    g.update(5);
    g.update(5);
    expect(g.bites).toBe(2);
  });

  it('restarts the regrow timer when nibbled again', () => {
    const g = new GrassState(3, () => 5);
    g.bite();
    g.update(4);
    g.bite();
    expect(g.update(2)).toBe(false);
  });
});

describe('poopLaunchVelocity', () => {
  const t = DEFAULT_POOP_TUNING;

  it('fires out the back and upward by default', () => {
    const v = poopLaunchVelocity(1, 'normal', 0, t);
    expect(v.vx).toBe(-t.shootSpeed);
    expect(v.vy).toBe(-t.shootLift);
  });

  it('fires forward when shootBackwards is off', () => {
    expect(poopLaunchVelocity(1, 'normal', 0, { ...t, shootBackwards: false }).vx).toBe(t.shootSpeed);
  });

  it('keeps some of the rabbit’s running speed', () => {
    const still = poopLaunchVelocity(-1, 'normal', 0, t).vx;
    const running = poopLaunchVelocity(-1, 'normal', -300, t).vx;
    expect(running).toBeCloseTo(still - 300 * t.inheritVelocity);
  });

  it('lobs higher and shorter, and drops straight down', () => {
    const normal = poopLaunchVelocity(1, 'normal', 0, t);
    const lob = poopLaunchVelocity(1, 'lob', 0, t);
    expect(lob.vy).toBeLessThan(normal.vy);
    expect(Math.abs(lob.vx)).toBeLessThan(Math.abs(normal.vx));
    expect(poopLaunchVelocity(1, 'drop', 0, t)).toEqual({ vx: 0, vy: 150 });
  });
});
