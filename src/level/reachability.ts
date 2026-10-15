import type { LevelMap } from './LevelMap';

/**
 * Can the rabbit actually get from A to B? A rough check used by the tests,
 * so a level with an impossible jump gets caught before anyone plays it.
 *
 * It works on tiles: a "spot" is an open tile with something to stand on
 * under it. From a spot the rabbit can walk, drop, or jump to another spot
 * if it's within jumping range (about 4 tiles up, 6 across). It's a little
 * generous (it doesn't know about every low ceiling), so it catches "you
 * can't get there at all" mistakes, not "that jump is a bit tight".
 */

/** How far across (in tiles, spot to spot) you can jump when going up `dy` tiles. */
export function maxAcross(dy: number): number {
  if (dy >= 5) return -1;
  if (dy === 4) return 3;
  if (dy === 3) return 4;
  if (dy >= 1) return 5;
  if (dy >= -2) return 6;
  return 7;
}

export interface Spot {
  col: number;
  row: number;
}

const key = (s: Spot) => `${s.col},${s.row}`;

export function isSpot(map: LevelMap, col: number, row: number): boolean {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows - 1) return false;
  const here = map.tileAt(col, row);
  if (map.isSolid(col, row) || here === '~') return false;
  return map.isFloor(col, row + 1);
}

/** Room to jump straight up `dy` tiles from (col, row) without bonking your head. */
function headroom(map: LevelMap, col: number, row: number, dy: number): boolean {
  for (let r = row - 1; r >= row - dy; r--) if (map.isSolid(col, r)) return false;
  return true;
}

/** Every spot reachable from `start` (which should be a spot) within one map. */
export function reachableSpots(map: LevelMap, start: Spot): Set<string> {
  const seen = new Set<string>([key(start)]);
  const queue: Spot[] = [start];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (let dy = 4; dy >= -map.rows; dy--) {
      const row = s.row - dy;
      if (row < 0 || row >= map.rows) continue;
      const across = maxAcross(dy);
      if (across < 0) continue;
      if (dy > 0 && !headroom(map, s.col, s.row, dy)) continue;
      for (let dx = -across; dx <= across; dx++) {
        const col = s.col + dx;
        if (!isSpot(map, col, row)) continue;
        const k = key({ col, row });
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ col, row });
      }
    }
  }
  return seen;
}

/** The spot where something standing at pixel spot (x, y = surface top) is. */
export function spotOf(p: { x: number; y: number }, tile: number): Spot {
  return { col: Math.floor(p.x / tile), row: Math.round(p.y / tile) - 1 };
}

export function canReach(reachable: Set<string>, s: Spot): boolean {
  return reachable.has(key(s));
}
