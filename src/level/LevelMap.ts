import { TILE } from '../config';

/** Rectangle in pixels: top-left corner + size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Something standing on a surface: x is its center, y is the surface top. */
export interface Spot {
  x: number;
  y: number;
}

/**
 * What each character in a level drawing means.
 * Solid tiles block from every side; '=' only from above.
 */
export const LEGEND = {
  '.': 'empty air',
  '#': 'frozen ground (gets snow on top when nothing is above it)',
  S: 'stone ledge',
  X: 'ice block',
  '=': 'log bridge: jump up through it, ↓ + jump to drop down',
  g: 'grass tuft to eat (sits on whatever is below it)',
  c: 'carrot (floating in a bubble above ground, loose in a burrow)',
  D: 'dirt pile: dig here to go down into a burrow',
  O: 'hole where you pop back out of a burrow',
  R: 'where the rabbit starts (or drops into a burrow)',
  F: 'checkpoint flag',
  H: "the rabbit's home: the finish line",
  d: 'packed dirt (burrow walls and floors)',
  E: 'burrow exit tunnel: walk into it to pop back up',
} as const;

const SOLID = new Set(['#', 'S', 'X', 'd']);

export type MapKind = 'overworld' | 'burrow';

export interface LevelMap {
  readonly kind: MapKind;
  readonly cols: number;
  readonly rows: number;
  /** Size in pixels. */
  readonly width: number;
  readonly height: number;
  readonly grid: readonly string[];
  /** Solid tiles, merged into as few rectangles as possible. */
  readonly solids: Rect[];
  readonly oneWays: Rect[];
  readonly spawn: Spot;
  readonly grass: Spot[];
  /** Carrot positions (the center of the cell). */
  readonly carrots: Spot[];
  readonly checkpoints: Spot[];
  readonly dirtPiles: Spot[];
  readonly exitHoles: Spot[];
  /** Burrow exit tunnel cells (pixel rectangles). */
  readonly exitTunnels: Rect[];
  /** Overworld only. */
  readonly home: Spot | null;
  tileAt(col: number, row: number): string;
  isSolid(col: number, row: number): boolean;
  /** Can you stand on top of this tile (solid or log bridge)? */
  isFloor(col: number, row: number): boolean;
}

/** Glue screens side by side. Each screen is a list of rows, padded with '.' to `width`. */
export function joinScreens(rows: number, width: number, screens: string[][]): string[] {
  const out = Array.from({ length: rows }, () => '');
  screens.forEach((screen, s) => {
    if (screen.length !== rows) throw new Error(`Screen ${s + 1} has ${screen.length} rows, needs ${rows}.`);
    screen.forEach((line, r) => {
      if (line.length > width) throw new Error(`Screen ${s + 1}, row ${r} is ${line.length} wide (max ${width}).`);
      out[r] += line.padEnd(width, '.');
    });
  });
  return out;
}

/**
 * Wrap the inside of a burrow in dirt: a ceiling, walls, and a thick floor.
 * Give it the 12 rows in between, each up to `width - 2` wide. A row whose
 * last character is 'E' gets an opening in the right wall: the exit tunnel.
 */
export function burrow(inside: string[], width = 27): string[] {
  const inner = width - 2;
  if (inside.length !== 12) throw new Error(`A burrow needs 12 rows inside, got ${inside.length}.`);
  const wall = 'd'.repeat(width);
  const rows = inside.map((line, r) => {
    if (line.length > inner) throw new Error(`Burrow row ${r + 1} is ${line.length} wide (max ${inner}).`);
    const padded = line.padEnd(inner, '.');
    return 'd' + padded + (padded.endsWith('E') ? 'E' : 'd');
  });
  return [wall, ...rows, wall, wall];
}

export function parseLevel(grid: readonly string[], kind: MapKind = 'overworld'): LevelMap {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const tileAt = (col: number, row: number): string => grid[row]?.[col] ?? '.';
  const isSolid = (col: number, row: number) => SOLID.has(tileAt(col, row));
  const isFloor = (col: number, row: number) => isSolid(col, row) || tileAt(col, row) === '=';
  // Things that stand on a surface sit on the bottom edge of their cell.
  const spotAt = (col: number, row: number): Spot => ({ x: (col + 0.5) * TILE, y: (row + 1) * TILE });

  const grass: Spot[] = [];
  const carrots: Spot[] = [];
  const checkpoints: Spot[] = [];
  const dirtPiles: Spot[] = [];
  const exitHoles: Spot[] = [];
  let spawn: Spot | null = null;
  let home: Spot | null = null;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const t = tileAt(col, row);
      if (t === 'g') grass.push(spotAt(col, row));
      else if (t === 'c') carrots.push({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE });
      else if (t === 'F') checkpoints.push(spotAt(col, row));
      else if (t === 'D') dirtPiles.push(spotAt(col, row));
      else if (t === 'O') exitHoles.push(spotAt(col, row));
      else if (t === 'R') spawn = spotAt(col, row);
      else if (t === 'H') home = spotAt(col, row);
      else if (!(t in LEGEND)) throw new Error(`Unknown tile '${t}' at column ${col}, row ${row}.`);
    }
  }
  const exitTunnels = mergeRuns(rows, cols, (c, r) => tileAt(c, r) === 'E', true);

  if (!spawn) throw new Error(`The ${kind} needs an 'R' for where the rabbit starts.`);
  if (kind === 'overworld' && !home) throw new Error("The level needs an 'H' for the rabbit's home.");
  if (kind === 'burrow' && exitTunnels.length === 0) throw new Error("A burrow needs an 'E' exit tunnel.");

  return {
    kind,
    cols,
    rows,
    width: cols * TILE,
    height: rows * TILE,
    grid,
    solids: mergeRuns(rows, cols, isSolid),
    oneWays: mergeRuns(rows, cols, (c, r) => tileAt(c, r) === '=', false),
    spawn,
    grass,
    carrots,
    checkpoints,
    dirtPiles,
    exitHoles,
    exitTunnels,
    home,
    tileAt,
    isSolid,
    isFloor,
  };
}

/** A whole level: the overworld plus the burrows under its dirt piles. */
export interface World {
  overworld: LevelMap;
  /** burrows[i] is under the i-th dirt pile, and comes out at the i-th exit hole. */
  burrows: LevelMap[];
}

/** The 1st dirt pile leads to the 1st burrow, which comes out at the 1st exit hole, and so on. */
export function buildWorld(overworld: readonly string[], burrows: readonly string[][]): World {
  const map = parseLevel(overworld, 'overworld');
  const rooms = burrows.map((b) => parseLevel(b, 'burrow'));
  const piles = map.dirtPiles.length;
  if (piles !== rooms.length || piles !== map.exitHoles.length) {
    throw new Error(
      `Every dirt pile (D) needs a burrow and an exit hole (O): found ${piles} piles, ` +
        `${rooms.length} burrows, ${map.exitHoles.length} exit holes.`,
    );
  }
  map.dirtPiles.forEach((pile, i) => {
    if (map.exitHoles[i].x <= pile.x) throw new Error(`Exit hole ${i + 1} should be further right than dirt pile ${i + 1}.`);
  });
  return { overworld: map, burrows: rooms };
}

/**
 * Turns matching tiles into rectangles: first runs along each row, then
 * identical runs stacked in consecutive rows become one tall rectangle.
 * Fewer, bigger bodies means nothing snags on the seams between tiles.
 */
export function mergeRuns(rows: number, cols: number, match: (col: number, row: number) => boolean, stack = true): Rect[] {
  const open = new Map<string, Rect>();
  const done: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const seen = new Set<string>();
    for (let col = 0; col < cols; col++) {
      if (!match(col, row)) continue;
      const start = col;
      while (col + 1 < cols && match(col + 1, row)) col++;
      const key = `${start}:${col}`;
      const above = stack ? open.get(key) : undefined;
      if (above) {
        above.h += TILE;
      } else {
        const rect = { x: start * TILE, y: row * TILE, w: (col - start + 1) * TILE, h: TILE };
        open.set(key, rect);
        done.push(rect);
      }
      seen.add(key);
    }
    // Runs that didn't continue into this row are finished.
    for (const key of [...open.keys()]) if (!seen.has(key)) open.delete(key);
  }
  return done;
}
