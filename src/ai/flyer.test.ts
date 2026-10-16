import { describe, expect, it } from 'vitest';
import { HAWK } from '../data/flyers';
import { FlyerBrain, type FlyerSenses } from './FlyerBrain';

const DT = 1 / 60;
const GROUND = 624;
const CRUISE = GROUND - HAWK.cruiseHeight;
const at = (over: Partial<FlyerSenses> = {}): FlyerSenses => ({
  x: 1200,
  y: CRUISE,
  rabbitX: 400,
  rabbitY: GROUND - 22,
  groundY: GROUND,
  ...over,
});

describe('FlyerBrain', () => {
  it('cruises toward the rabbit at cruising height, harmless', () => {
    const b = new FlyerBrain(HAWK);
    const i = b.update(at(), DT);
    expect(b.state).toBe('cruise');
    expect(i.vx).toBe(-HAWK.cruiseSpeed);
    expect(i.dangerous).toBe(false);
  });

  it('dives at the rabbit once close, and is dangerous in the dive', () => {
    const b = new FlyerBrain(HAWK);
    const i = b.update(at({ x: 600 }), DT);
    expect(b.state).toBe('dive');
    expect(i.dangerous).toBe(true);
    expect(i.vx).toBeLessThan(0);
    expect(i.vy).toBeGreaterThan(0);
  });

  it('climbs back up after the dive, then dives again, then leaves', () => {
    const b = new FlyerBrain(HAWK);
    for (let d = 0; d < HAWK.maxDives; d++) {
      b.update(at({ x: 600 }), 1); // (cruising long enough) dive
      expect(b.state).toBe('dive');
      b.update(at({ x: 380, y: GROUND - 20 }), DT); // reached the bottom
      expect(b.state).toBe('climb');
      b.update(at({ x: 200, y: CRUISE - 5 }), DT); // back up
    }
    expect(b.state).toBe('leave');
    expect(b.dives).toBe(HAWK.maxDives);
    expect(b.update(at(), DT).dangerous).toBe(false);
  });

  it('staggers when hit, and falls out of the sky on the last hit', () => {
    const b = new FlyerBrain({ ...HAWK, hitsToScare: 2 });
    expect(b.hit()).toBe('stagger');
    expect(b.update(at(), DT).anim).toBe('hit');
    expect(b.hit()).toBe('scared');
    const fall = b.update(at(), DT);
    expect(fall.gravity).toBe(true);
    expect(fall.dangerous).toBe(false);
    expect(b.hit()).toBeNull();
    expect(b.health).toBe(0);
  });
});
