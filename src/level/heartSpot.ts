import type { LevelMap } from './LevelMap';

/**
 * Where the bonus heart floats: as near halfway between the start and home as
 * possible, a little above the ground (one hop up), with nothing solid in the
 * way and clear of dirt piles and burrow exits. Returns the heart's center,
 * or null if there's nowhere.
 */
export function heartSpot(map: LevelMap, tile: number): { x: number; y: number } | null {
  const homeX = map.home?.x ?? map.width;
  const mid = Math.floor((map.spawn.x + homeX) / 2 / tile);
  const busy = [...map.dirtPiles, ...map.exitHoles, ...map.checkpoints].map((s) => Math.floor(s.x / tile));
  for (let i = 0; i < 60; i++) {
    // 0, +1, -1, +2, -2, ...
    const col = mid + (i % 2 === 0 ? i / 2 : -(i + 1) / 2);
    if (col < 1 || col >= map.cols - 1 || busy.some((b) => Math.abs(b - col) <= 1)) continue;
    // The ground: the lowest open tile with something to stand on.
    for (let row = map.rows - 2; row >= 3; row--) {
      if (map.isSolid(col, row) || map.tileAt(col, row) === '~' || !map.isFloor(col, row + 1)) continue;
      if (map.isSolid(col, row - 1) || map.isSolid(col, row - 2)) break;
      return { x: (col + 0.5) * tile, y: (row - 0.5) * tile };
    }
  }
  return null;
}
