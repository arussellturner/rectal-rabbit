import { describe, expect, it } from 'vitest';
import { SNOW_LEOPARD } from '../data/chasers';
import { DEFAULT_SPAWNER, LeopardSpawner } from '../systems/LeopardSpawner';
import { ChaserBrain, type ChaserSenses } from './ChaserBrain';

const DT = 1 / 60;
const senses = (over: Partial<ChaserSenses> = {}): ChaserSenses => ({
  selfX: 0,
  feetY: 624,
  onGround: true,
  rabbitX: 500,
  rabbitFeetY: 624,
  wallAhead: false,
  gapAhead: false,
  offScreen: false,
  ...over,
});

describe('ChaserBrain', () => {
  it('runs at the rabbit, faster while still off screen', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    expect(brain.update(senses(), DT).vx).toBe(SNOW_LEOPARD.chaseSpeed);
    expect(brain.update(senses({ offScreen: true }), DT).vx).toBe(SNOW_LEOPARD.catchUpSpeed);
    const back = brain.update(senses({ rabbitX: -500 }), DT);
    expect(back.vx).toBe(-SNOW_LEOPARD.chaseSpeed);
    expect(back.facing).toBe(-1);
  });

  it('jumps walls and pits, but only from the ground and not every frame', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    expect(brain.update(senses({ wallAhead: true }), DT).jump).toBe(true);
    expect(brain.update(senses({ wallAhead: true }), DT).jump).toBe(false); // cooldown
    const later = new ChaserBrain(SNOW_LEOPARD);
    expect(later.update(senses({ gapAhead: true, onGround: false }), DT).jump).toBe(false);
    expect(later.update(senses({ gapAhead: true }), DT).jump).toBe(true);
  });

  it('leaps up at a rabbit standing on something right above it', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    expect(brain.update(senses({ rabbitX: 60, rabbitFeetY: 480 }), DT).jump).toBe(true);
  });

  it('staggers on the first poop, then falls, rolls away from the rabbit, and is harmless', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    expect(brain.hit(-300, 0)).toBe('stagger');
    const dazed = brain.update(senses(), DT);
    expect(dazed.vx).toBe(0);
    expect(dazed.dangerous).toBe(false);
    expect(dazed.anim).toBe('hit');

    expect(brain.hit(-300, 0)).toBe('scared');
    expect(brain.hit(-300, 0)).toBeNull(); // already on its way out
    expect(brain.update(senses(), DT).anim).toBe('hit');
    expect(brain.update(senses(), SNOW_LEOPARD.hitTime).anim).toBe('fall');

    const roll = brain.update(senses(), SNOW_LEOPARD.fallTime);
    expect(roll.anim).toBe('roll');
    expect(roll.vx).toBe(SNOW_LEOPARD.rollSpeed); // rabbit was to the left: rolls right
    expect(roll.dangerous).toBe(false);
  });

  it('sits still for a moment after catching the rabbit', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    brain.caughtRabbit();
    expect(brain.update(senses(), DT).dangerous).toBe(false);
    expect(brain.update(senses(), SNOW_LEOPARD.pauseAfterCatch).dangerous).toBe(true);
  });

  it('is knocked straight over by a poop bomb, rolling away from the blast', () => {
    const brain = new ChaserBrain(SNOW_LEOPARD);
    expect(brain.scare(100, 0)).toBe(true);
    expect(brain.leaving).toBe(true);
    expect(brain.scare(100, 0)).toBe(false); // already going
    expect(brain.hit(100, 0)).toBeNull();
    brain.update(senses(), SNOW_LEOPARD.hitTime + SNOW_LEOPARD.fallTime);
    expect(brain.update(senses(), DT).vx).toBe(-SNOW_LEOPARD.rollSpeed);
  });
});

describe('LeopardSpawner', () => {
  const cfg = { ...DEFAULT_SPAWNER, startX: 1000, stopX: 9000 };

  it('waits until the rabbit is far enough in, and stops near home', () => {
    const s = new LeopardSpawner(cfg, () => 0.5);
    expect(s.update(10, 500, 0)).toBe(false);
    expect(s.update(10, 9500, 0)).toBe(false);
    expect(s.update(cfg.firstDelay + 0.01, 1000, 0)).toBe(true);
  });

  it('never sends more than the limit at once', () => {
    const s = new LeopardSpawner(cfg, () => 0.5);
    expect(s.update(100, 1000, cfg.maxEarly)).toBe(false);
  });

  it('sends more leopards, more often, farther along', () => {
    const s = new LeopardSpawner(cfg, () => 0.5);
    expect(s.maxActive(1000)).toBe(cfg.maxEarly);
    expect(s.maxActive(9000)).toBe(cfg.maxLate);

    const early = new LeopardSpawner(cfg, () => 0.5);
    early.update(cfg.firstDelay + 0.01, 1000, 0);
    let t = 0;
    while (!early.update(0.1, 1000, 0)) t += 0.1;
    const late = new LeopardSpawner(cfg, () => 0.5);
    late.update(cfg.firstDelay + 0.01, 9000, 0);
    let u = 0;
    while (!late.update(0.1, 9000, 0)) u += 0.1;
    expect(u).toBeLessThan(t);
  });

  it('can be told to give the rabbit a breather', () => {
    const s = new LeopardSpawner(cfg, () => 0.5);
    s.update(cfg.firstDelay + 0.01, 1000, 0);
    s.delay(30);
    expect(s.update(20, 1000, 0)).toBe(false);
  });
});
