import { describe, expect, it } from 'vitest';
import { TILE } from '../config';
import { LEVELS } from '../data/levels';
import { SPECIALS } from '../data/specials';
import { buildWorld, burrow, joinScreens, mergeRuns, parseLevel, type LevelMap } from './LevelMap';
import { canReach, isSpot, reachableSpots, spotOf } from './reachability';

describe('parseLevel', () => {
  const level = parseLevel([
    '..........',
    '....c.....',
    '..g...==..',
    'R...D....H',
    '###..SS###',
    '###..#####',
  ]);

  it('finds the start, home, grass, carrots and dirt piles', () => {
    expect(level.spawn).toEqual({ x: 0.5 * TILE, y: 4 * TILE });
    expect(level.home).toEqual({ x: 9.5 * TILE, y: 4 * TILE });
    expect(level.grass).toEqual([{ x: 2.5 * TILE, y: 3 * TILE }]);
    expect(level.carrots).toEqual([{ x: 4.5 * TILE, y: 1.5 * TILE }]);
    expect(level.dirtPiles).toEqual([{ x: 4.5 * TILE, y: 4 * TILE }]);
  });

  it('knows what is solid, and what you can stand on', () => {
    expect(level.isSolid(0, 4)).toBe(true);
    expect(level.isSolid(3, 4)).toBe(false); // pit
    expect(level.isSolid(5, 4)).toBe(true); // stone
    expect(level.isSolid(6, 2)).toBe(false); // log bridge
    expect(level.isFloor(6, 2)).toBe(true);
    expect(level.isSolid(4, 3)).toBe(false); // you stand in a dirt pile, not on it
    expect(level.isSolid(-1, 4)).toBe(false); // off the map
  });

  it('merges log bridges into one platform', () => {
    expect(level.oneWays).toEqual([{ x: 6 * TILE, y: 2 * TILE, w: 2 * TILE, h: TILE }]);
  });

  it('rejects unknown tiles and missing start/home', () => {
    expect(() => parseLevel(['R.Z.H', '#####'])).toThrow(/Unknown tile 'Z'/);
    expect(() => parseLevel(['....H', '#####'])).toThrow(/'R'/);
    expect(() => parseLevel(['R....', '#####'])).toThrow(/'H'/);
  });
});

describe('burrows', () => {
  const inside = Array.from({ length: 12 }, () => '');
  inside[1] = '.R';
  inside[10] = '..c.....E';
  inside[11] = '........E';
  const grid = burrow(inside, 11);

  it('get a dirt ceiling, walls and floor, with an exit tunnel through the right wall', () => {
    expect(grid).toHaveLength(15);
    expect(grid[0]).toBe('ddddddddddd');
    expect(grid[2]).toBe('d.R.......d');
    expect(grid[11]).toBe('d..c.....EE');
    expect(grid[13]).toBe('ddddddddddd');
  });

  it('parse with a drop-in spot, carrots and an exit', () => {
    const map = parseLevel(grid, 'burrow');
    expect(map.home).toBeNull();
    expect(map.carrots).toHaveLength(1);
    expect(map.exitTunnels).toEqual([{ x: 9 * TILE, y: 11 * TILE, w: 2 * TILE, h: 2 * TILE }]);
    expect(() => parseLevel(burrow(['.R', ...Array(11).fill('')]), 'burrow')).toThrow(/exit/);
  });

  it('must match up with dirt piles and exit holes', () => {
    const top = ['R.D...O..H', '##########'];
    expect(() => buildWorld(top, [grid])).not.toThrow();
    expect(() => buildWorld(top, [])).toThrow(/needs a burrow/);
    expect(() => buildWorld(['R.O...D..H', '##########'], [grid])).toThrow(/further right/);
  });
});

describe('reachability', () => {
  const map = (rows: string[]) => parseLevel(rows);
  const reachHome = (rows: string[]) => {
    const m = map(rows);
    return canReach(reachableSpots(m, spotOf(m.spawn, TILE)), spotOf(m.home!, TILE));
  };

  it('can jump a 5-wide pit but not an 8-wide one', () => {
    expect(reachHome(['R..........H', '####.....###', '####.....###'])).toBe(true);
    expect(reachHome(['R.............H', '####........###', '####........###'])).toBe(false);
  });

  it('can jump up 4 tiles but not 5', () => {
    const wall = (h: number) => [
      ...Array.from({ length: 6 - h }, () => '......'),
      ...Array.from({ length: h }, (_, i) => (i === 0 ? '...#H.' : '...##.')),
      'R..##.',
      '######',
    ];
    expect(reachHome(wall(3))).toBe(true);
    expect(reachHome(wall(5))).toBe(false);
  });
});

describe('mergeRuns', () => {
  it('turns stacked identical runs into one tall box, and others into separate boxes', () => {
    const grid = ['##..', '##.#', '####'];
    const rects = mergeRuns(3, 4, (c, r) => grid[r][c] === '#');
    expect(rects).toContainEqual({ x: 0, y: 0, w: 2 * TILE, h: 2 * TILE });
    expect(rects).toContainEqual({ x: 3 * TILE, y: TILE, w: TILE, h: TILE });
    expect(rects).toContainEqual({ x: 0, y: 2 * TILE, w: 4 * TILE, h: TILE });
    expect(rects).toHaveLength(3);
  });
});

describe('joinScreens', () => {
  it('pads short rows and glues screens side by side', () => {
    expect(joinScreens(2, 3, [['a', 'bb'], ['', 'c']])).toEqual(['a.....', 'bb.c..']);
  });

  it('complains about a row that is too long', () => {
    expect(() => joinScreens(1, 2, [['abc']])).toThrow(/Screen 1, row 0/);
  });
});

describe.each(LEVELS.map((l) => [l.name, l] as const))('level: %s', (_name, def) => {
  const level = def.world.overworld;
  const standingOn = (map: typeof level, x: number, y: number) =>
    map.isFloor(Math.floor(x / TILE), Math.floor(y / TILE));

  it('is one screen tall, with a burrow under every dirt pile', () => {
    expect(level.height).toBe(720);
    expect(def.world.burrows.length).toBe(level.dirtPiles.length);
    expect(level.checkpoints.length).toBeGreaterThanOrEqual(1);
  });

  it('starts, ends, and has every dirt pile, exit hole and flag on solid ground', () => {
    for (const s of [level.spawn, level.home!, ...level.dirtPiles, ...level.exitHoles, ...level.checkpoints]) {
      expect(standingOn(level, s.x, s.y + 1), `spot at column ${Math.floor(s.x / TILE)}`).toBe(true);
    }
  });

  it('has grass sitting on something', () => {
    for (const g of level.grass) expect(standingOn(level, g.x, g.y + 1)).toBe(true);
  });

  it('has burrows you land in safely, with carrots to find, and can walk out of', () => {
    for (const b of def.world.burrows) {
      expect(b.carrots.length).toBeGreaterThanOrEqual(10);
      const landing = landingSpot(b, spotOf(b.spawn, TILE));
      expect(landing, 'somewhere to land below the drop-in spot').not.toBeNull();
      const reach = reachableSpots(b, landing!);
      // The bottom of each tunnel, where you'd walk in.
      const exits = b.exitTunnels.map((t) => ({ col: t.x / TILE, row: t.y / TILE + t.h / TILE - 1 }));
      expect(exits.some((e) => canReach(reach, e)), 'can reach the exit tunnel').toBe(true);
    }
  });

  it('can be finished: the rabbit can get from the start to home (maybe via burrows)', () => {
    const reach = reachableSpots(level, spotOf(level.spawn, TILE));
    // Burrows take you further along: add where each one comes out.
    for (let pass = 0; pass < 3; pass++) {
      level.dirtPiles.forEach((pile, i) => {
        if (canReach(reach, spotOf(pile, TILE))) {
          for (const k of reachableSpots(level, spotOf(level.exitHoles[i], TILE))) reach.add(k);
        }
      });
    }
    expect(canReach(reach, spotOf(level.home!, TILE)), 'home is reachable').toBe(true);
    for (const cp of level.checkpoints) expect(canReach(reach, spotOf(cp, TILE)), 'checkpoint reachable').toBe(true);
    level.dirtPiles.forEach((p, i) => expect(canReach(reach, spotOf(p, TILE)), `dirt pile ${i + 1} reachable`).toBe(true));
  });

  it('pops you out of each burrow a little way past its dirt pile', () => {
    level.dirtPiles.forEach((pile, i) => {
      const tiles = (level.exitHoles[i].x - pile.x) / TILE;
      expect(tiles, `burrow ${i + 1}`).toBeGreaterThanOrEqual(4);
      expect(tiles, `burrow ${i + 1}`).toBeLessThanOrEqual(16);
    });
  });

  it('is long enough: at least 8 screens', () => {
    expect(level.cols).toBeGreaterThanOrEqual(8 * 32);
  });

  it('can be finished without using the burrows too', () => {
    const reach = reachableSpots(level, spotOf(level.spawn, TILE));
    expect(canReach(reach, spotOf(level.home!, TILE))).toBe(true);
  });
});

/** Fall straight down from `s` to the first place to stand. */
function landingSpot(map: LevelMap, s: { col: number; row: number }): { col: number; row: number } | null {
  for (let row = s.row; row < map.rows; row++) if (isSpot(map, s.col, row)) return { col: s.col, row };
  return null;
}

describe('special predators', () => {
  it('every level has a special predator that exists, and each level has a different one', () => {
    for (const def of LEVELS) expect(SPECIALS[def.special], def.name).toBeDefined();
    expect(new Set(LEVELS.map((l) => l.special)).size).toBe(LEVELS.length);
  });
});
