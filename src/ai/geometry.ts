export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Does the segment (x0,y0)→(x1,y1) pass through the box? (Liang–Barsky clipping) */
export function segmentHitsBox(x0: number, y0: number, x1: number, y1: number, b: Box): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - b.x, b.x + b.w - x0, y0 - b.y, b.y + b.h - y0];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel to this edge and outside it
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}

/** True if nothing solid is between the two points. */
export function lineOfSight(x0: number, y0: number, x1: number, y1: number, walls: readonly Box[]): boolean {
  return !walls.some((b) => segmentHitsBox(x0, y0, x1, y1, b));
}
