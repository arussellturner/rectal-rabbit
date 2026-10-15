import { describe, expect, it } from 'vitest';
import { Navigator } from './Navigator';
import { buildNavGraph, buildSurfaces, findPath, jumpVelocity, surfaceAt, type Mover } from './navGraph';

const FOX: Mover = { halfWidth: 29, runSpeed: 255, jumpVelocity: 760, gravity: 1600 }; // jumps ~180 px
const GROUND = 1080;

// Ground with a step block on it, a plank above, a tall wall, and a pit.
const solids = [
  { x: 0, y: GROUND, w: 1000, h: 120 }, // ground A
  { x: 1160, y: GROUND, w: 840, h: 120 }, // ground B, past a 160 px pit
  { x: 2300, y: GROUND, w: 500, h: 120 }, // ground C, past a 300 px pit: too far
  { x: 300, y: 980, w: 100, h: 100 }, // step block (100 high)
  { x: 1600, y: 700, w: 100, h: 380 }, // wall too tall to climb (380)
];
const oneWays = [
  { x: 500, y: 940, w: 200, h: 16 }, // plank 140 up: jump through it
  { x: 500, y: 600, w: 200, h: 16 }, // plank way too high
];

describe('buildSurfaces', () => {
  const surfaces = buildSurfaces(solids, oneWays);

  it('cuts the ground where blocks stand on it, and marks the walls', () => {
    const groundA = surfaces.filter((s) => s.y === GROUND && s.x0 < 1000);
    expect(groundA.map((s) => [s.x0, s.x1])).toEqual([
      [0, 300],
      [400, 1000],
    ]);
    expect(groundA[0].wallRight).toBe(true);
    expect(groundA[1].wallLeft).toBe(true);
  });

  it('finds block tops and planks', () => {
    expect(surfaces.find((s) => s.y === 980)).toMatchObject({ x0: 300, x1: 400, oneWay: false });
    expect(surfaces.filter((s) => s.oneWay)).toHaveLength(2);
  });
});

describe('nav graph + pathfinding', () => {
  const graph = buildNavGraph(solids, oneWays, FOX);
  const at = (x: number, y: number) => surfaceAt(graph, x, y, FOX.halfWidth)!;

  it('climbs onto a step block from the ground beside it', () => {
    const path = findPath(graph, at(100, GROUND).id, 100, at(350, 980).id)!;
    expect(path).toHaveLength(1);
    expect(path[0]).toMatchObject({ kind: 'jump', climb: true });
  });

  it('walks off the block to get back down', () => {
    const path = findPath(graph, at(350, 980).id, 350, at(100, GROUND).id)!;
    expect(path[0].kind).toBe('drop');
  });

  it('jumps up through a plank overhead', () => {
    const path = findPath(graph, at(600, GROUND).id, 600, at(600, 940).id)!;
    expect(path).toHaveLength(1);
    expect(path[0].kind).toBe('jump');
  });

  it('jumps the pit', () => {
    const path = findPath(graph, at(900, GROUND).id, 900, at(1300, GROUND).id)!;
    expect(path).toHaveLength(1);
    expect(path[0].takeoffX).toBeGreaterThan(900);
  });

  it('cannot jump a pit that is too wide', () => {
    expect(findPath(graph, at(1900, GROUND).id, 1900, at(2500, GROUND).id)).toBeNull();
  });

  it('cannot reach a plank that is too high, or the top of the tall wall', () => {
    expect(findPath(graph, at(600, GROUND).id, 600, at(600, 600).id)).toBeNull();
    expect(findPath(graph, at(1300, GROUND).id, 1300, at(1650, 700).id)).toBeNull();
  });

  it('a jump velocity actually lands on the target', () => {
    const from = at(900, GROUND);
    const path = findPath(graph, from.id, 900, at(1300, GROUND).id)!;
    const e = path[0];
    const to = graph.surfaces[e.to];
    const v = jumpVelocity(e, from, to, FOX);
    expect(v.vy).toBeLessThanOrEqual(FOX.jumpVelocity);
    // Simulate the flight.
    let x = e.takeoffX;
    let y = from.y;
    let vy = -v.vy;
    for (let t = 0; t < 3; t += 1 / 120) {
      x += v.vx / 120;
      vy += FOX.gravity / 120;
      y += vy / 120;
      if (vy > 0 && y >= to.y) break;
    }
    expect(x).toBeGreaterThanOrEqual(to.x0);
    expect(x).toBeLessThanOrEqual(to.x1);
  });
});

describe('Navigator', () => {
  const graph = buildNavGraph(solids, oneWays, FOX);
  const at = (x: number, y: number) => surfaceAt(graph, x, y, FOX.halfWidth)!;
  const nav = () => new Navigator(graph, FOX, 0.15);

  it('walks straight to a goal on the same surface, then stops', () => {
    const n = nav();
    const ground = at(600, GROUND);
    expect(n.update(1 / 60, { x: 500, feetY: GROUND, vy: 0, surface: ground }, { surface: ground, x: 800 }).targetX).toBe(800);
    const done = n.update(1 / 60, { x: 795, feetY: GROUND, vy: 0, surface: ground }, { surface: ground, x: 800 });
    expect(done.arrived).toBe(true);
    expect(done.targetX).toBeNull();
  });

  it('goes to the takeoff spot, crouches, then jumps', () => {
    const n = nav();
    const ground = at(900, GROUND);
    const goal = { surface: at(1300, GROUND), x: 1300 };
    const first = n.update(1 / 60, { x: 700, feetY: GROUND, vy: 0, surface: ground }, goal);
    expect(first.jump).toBeNull();
    const takeoff = first.targetX!;
    let cmd = n.update(1 / 60, { x: takeoff, feetY: GROUND, vy: 0, surface: ground }, goal);
    expect(cmd.windingUp).toBe(true);
    for (let i = 0; i < 20 && !cmd.jump; i++) cmd = n.update(1 / 60, { x: takeoff, feetY: GROUND, vy: 0, surface: ground }, goal);
    expect(cmd.jump).not.toBeNull();
  });

  it('waits below an unreachable goal and says so', () => {
    const n = nav();
    const ground = at(600, GROUND);
    const cmd = n.update(1 / 60, { x: 600, feetY: GROUND, vy: 0, surface: ground }, { surface: at(600, 600), x: 600 });
    expect(cmd.reachable).toBe(false);
    expect(cmd.arrived).toBe(true);
  });

  it('steers toward the landing spot in the air, but rises straight up when climbing a block', () => {
    const n = nav();
    const ground = at(100, GROUND);
    const goal = { surface: at(350, 980), x: 350 };
    const takeoff = n.update(1 / 60, { x: 100, feetY: GROUND, vy: 0, surface: ground }, goal).targetX!;
    for (let i = 0; i < 20; i++) n.update(1 / 60, { x: takeoff, feetY: GROUND, vy: 0, surface: ground }, goal);
    expect(n.update(1 / 60, { x: takeoff, feetY: 1040, vy: -400, surface: null }, goal).airVx).toBe(0);
    expect(n.update(1 / 60, { x: takeoff, feetY: 950, vy: -100, surface: null }, goal).airVx).toBeGreaterThan(0);
  });
});
