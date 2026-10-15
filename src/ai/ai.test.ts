import { describe, expect, it } from 'vitest';
import { FOX } from '../data/predators';
import { lineOfSight, segmentHitsBox } from './geometry';
import { NOISE, perceive, type Perception, type RabbitSnapshot, type Viewer } from './perception';
import { PredatorBrain } from './PredatorBrain';

describe('line of sight', () => {
  const wall = { x: 100, y: 0, w: 20, h: 100 };

  it('is blocked by a wall in between', () => {
    expect(segmentHitsBox(0, 50, 200, 50, wall)).toBe(true);
    expect(lineOfSight(0, 50, 200, 50, [wall])).toBe(false);
  });

  it('is clear over, beside, or short of a wall', () => {
    expect(lineOfSight(0, -10, 200, -10, [wall])).toBe(true);
    expect(lineOfSight(0, 50, 90, 50, [wall])).toBe(true);
    expect(lineOfSight(0, 150, 200, 150, [wall])).toBe(true);
  });
});

describe('perceive', () => {
  const fox: Viewer = { x: 0, eyeY: 1050, feetY: 1080, facing: 1 };
  const rabbitAt = (x: number, extra: Partial<RabbitSnapshot> = {}): RabbitSnapshot => ({
    x,
    centerY: 1060,
    topY: 1040,
    feetY: 1080,
    vx: 0,
    onGround: true,
    eating: false,
    ...extra,
  });
  const look = (r: RabbitSnapshot, opts: { walls?: { x: number; y: number; w: number; h: number }[]; chasing?: boolean } = {}) =>
    perceive(fox, r, opts.walls ?? [], FOX, opts.chasing ?? false, false);

  it('sees a rabbit in front, within range', () => {
    const p = look(rabbitAt(200));
    expect(p.sees).toBe(true);
    expect(p.closeness).toBeGreaterThan(0);
  });

  it('does not see behind itself or past its range', () => {
    expect(look(rabbitAt(-100)).sees).toBe(false);
    expect(look(rabbitAt(FOX.sightRange + 50)).sees).toBe(false);
  });

  it('does not see through walls', () => {
    expect(look(rabbitAt(200), { walls: [{ x: 100, y: 900, w: 40, h: 180 }] }).sees).toBe(false);
  });

  it('does not see a rabbit high above, outside its cone', () => {
    expect(look(rabbitAt(60, { centerY: 800, topY: 780, feetY: 820 })).sees).toBe(false);
  });

  it('tracks all around while chasing', () => {
    expect(look(rabbitAt(-200), { chasing: true }).sees).toBe(true);
  });

  it('hears chewing behind it, and through walls', () => {
    const p = look(rabbitAt(-(NOISE.eating - 20), { eating: true }), { walls: [{ x: -100, y: 900, w: 20, h: 180 }] });
    expect(p.sees).toBe(false);
    expect(p.hears).toBe(true);
    expect(look(rabbitAt(-100)).hears).toBe(false);
  });

  it('knows when the rabbit is up out of reach', () => {
    expect(look(rabbitAt(100)).reachable).toBe(true);
    expect(look(rabbitAt(100, { feetY: 960 })).reachable).toBe(false);
  });
});

describe('PredatorBrain', () => {
  const DT = 1 / 60;
  const nothing: Perception = {
    sees: false,
    closeness: 0,
    hears: false,
    rabbitMoving: false,
    reachable: true,
    touching: false,
    rabbitX: 0,
    distance: 9999,
  };
  const seen = (rabbitX: number, closeness = 0.3, extra: Partial<Perception> = {}): Perception => ({
    ...nothing,
    sees: true,
    closeness,
    rabbitMoving: true,
    rabbitX,
    distance: 200,
    ...extra,
  });
  const brain = () => new PredatorBrain(FOX, { minX: 0, maxX: 1000 }, () => 0.5);
  const run = (b: PredatorBrain, x: number, p: Perception, seconds: number) => {
    let intent = b.update(x, p, DT);
    for (let t = DT; t < seconds; t += DT) intent = b.update(x, p, DT);
    return intent;
  };

  it('patrols when it notices nothing', () => {
    const b = brain();
    run(b, 500, nothing, 3);
    expect(b.state).toBe('patrol');
    expect(b.meter).toBe(0);
  });

  it('gets suspicious, then alerted, then chases when it keeps seeing you', () => {
    const b = brain();
    const states = new Set<string>();
    b.onEnter = (s) => states.add(s);
    const intent = run(b, 500, seen(700), 4);
    expect([...states]).toEqual(['suspicious', 'alerted', 'chase']);
    expect(intent.targetX).toBe(700);
    expect(intent.speed).toBe(FOX.chaseSpeed);
  });

  it('spots you instantly up close or on contact', () => {
    const b = brain();
    b.update(500, seen(530, 0.95), DT);
    expect(b.state).toBe('alerted');
    const b2 = brain();
    b2.update(500, { ...nothing, touching: true, rabbitX: 510 }, DT);
    expect(b2.state).toBe('alerted');
  });

  it('notices a still rabbit more slowly than a moving one', () => {
    const moving = brain();
    const still = brain();
    run(moving, 500, seen(700), 0.5);
    run(still, 500, seen(700, 0.3, { rabbitMoving: false }), 0.5);
    expect(still.meter).toBeLessThan(moving.meter);
  });

  it('can only get suspicious from noise, not fully alerted', () => {
    const b = brain();
    const intent = run(b, 500, { ...nothing, hears: true, rabbitX: 300 }, 5);
    expect(b.state).toBe('suspicious');
    expect(b.meter).toBeLessThanOrEqual(FOX.hearingCap);
    expect(intent.targetX).toBe(300); // creeping over to investigate
  });

  it('calms back down to patrol when the meter drains', () => {
    const b = brain();
    run(b, 500, seen(700), 0.3);
    expect(b.state).toBe('suspicious');
    run(b, 500, nothing, 6);
    expect(b.state).toBe('patrol');
  });

  it('searches after losing sight, then gives up', () => {
    const b = brain();
    run(b, 500, seen(700), 4);
    expect(b.state).toBe('chase');
    run(b, 500, nothing, FOX.loseSightTime + 0.1);
    expect(b.state).toBe('search');
    expect(b.lastKnownX).toBe(700);
    run(b, 700, nothing, FOX.searchTime + 0.1);
    expect(b.state).toBe('patrol');
  });

  it('gives up waiting below a rabbit it cannot reach', () => {
    const b = brain();
    run(b, 500, seen(700), 4);
    run(b, 700, seen(700, 0.5, { reachable: false }), FOX.giveUpTime + 0.1);
    expect(b.state).toBe('patrol');
    expect(b.cooldown).toBeGreaterThan(0);
    // …and ignores you for a bit afterwards.
    run(b, 700, seen(700, 0.5, { reachable: false }), 1);
    expect(b.state).toBe('patrol');
  });

  it('patrols inside its territory but leaves it to chase', () => {
    const b = brain();
    for (let i = 0; i < 20; i++) {
      const intent = run(b, 500, nothing, 0.5);
      if (intent.targetX !== null) {
        expect(intent.targetX).toBeGreaterThanOrEqual(0);
        expect(intent.targetX).toBeLessThanOrEqual(1000);
      }
    }
    expect(run(b, 900, seen(1500), 4).targetX).toBe(1500);
  });

  it('gives up a chase that strays too far from home', () => {
    const b = brain();
    run(b, 500, seen(700), 4);
    expect(b.state).toBe('chase');
    b.update(500 + FOX.leash + 10, seen(2200), DT);
    expect(b.state).toBe('patrol');
  });

  it('is stunned by poop, then chases if it can see you', () => {
    const b = brain();
    b.stun(300);
    expect(b.state).toBe('stunned');
    run(b, 500, seen(300), FOX.stunTime - 0.1);
    expect(b.state).toBe('stunned');
    run(b, 500, seen(300), 0.2);
    expect(b.state).toBe('chase');
  });

  it('searches toward where the poop came from if it cannot see you', () => {
    const b = brain();
    b.stun(300);
    const intent = run(b, 500, nothing, FOX.stunTime + 0.1);
    expect(b.state).toBe('search');
    expect(intent.targetX).toBe(300);
  });
});
