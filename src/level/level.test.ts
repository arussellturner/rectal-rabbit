import { describe, expect, it } from 'vitest';
import { TILE } from '../config';
import { WORLD_1 } from '../data/level1';
import { buildWorld, burrow, joinScreens, mergeRuns, parseLevel } from './LevelMap';

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

describe('world 1', () => {
  const level = WORLD_1.overworld;
  const standingOn = (map: typeof level, x: number, y: number) =>
    map.isFloor(Math.floor(x / TILE), Math.floor(y / TILE));

  it('is one screen tall, with two burrows', () => {
    expect(level.height).toBe(720);
    expect(WORLD_1.burrows).toHaveLength(2);
  });

  it('starts, ends, and has every dirt pile and exit hole on solid ground', () => {
    for (const s of [level.spawn, level.home!, ...level.dirtPiles, ...level.exitHoles, ...level.checkpoints]) {
      expect(standingOn(level, s.x, s.y + 1), `spot at column ${Math.floor(s.x / TILE)}`).toBe(true);
    }
  });

  it('has grass sitting on something', () => {
    for (const g of level.grass) expect(standingOn(level, g.x, g.y + 1)).toBe(true);
  });

  it('has no pit too wide to jump (6 tiles) without something to stand on over it', () => {
    const groundRow = level.rows - 2;
    let run = 0;
    for (let col = 0; col < level.cols; col++) {
      const bridged = Array.from({ length: level.rows }, (_, r) => level.isFloor(col, r)).some(Boolean);
      run = level.isSolid(col, groundRow) || bridged ? 0 : run + 1;
      expect(run, `pit ending at column ${col}`).toBeLessThanOrEqual(5);
    }
  });

  it('has burrows you land in safely, with carrots to find', () => {
    for (const b of WORLD_1.burrows) {
      expect(b.carrots.length).toBeGreaterThanOrEqual(10);
      // Something to land on below the drop-in spot.
      const col = Math.floor(b.spawn.x / TILE);
      const floor = Array.from({ length: b.rows }, (_, r) => r).find((r) => r >= b.spawn.y / TILE && b.isFloor(col, r));
      expect(floor).toBeDefined();
    }
  });
});
