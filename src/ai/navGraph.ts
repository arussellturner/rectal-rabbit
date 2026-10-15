import type { Box } from './geometry';

/**
 * Platformer pathfinding. A side-view level can't use grid pathfinding
 * (gravity!), so instead:
 *   1. Every walkable top (ground, block tops, planks) becomes a Surface.
 *   2. Surfaces are linked by Edges the mover can physically make: jump up,
 *      jump across, or walk off a ledge and drop.
 *   3. findPath runs Dijkstra over that small graph.
 */

/** Something standable: x0..x1 along the top at height y. */
export interface Surface {
  id: number;
  x0: number;
  x1: number;
  y: number;
  /** A thin plank you can jump up through. */
  oneWay: boolean;
  /** A solid wall rises right at this end (you can't hang over it). */
  wallLeft: boolean;
  wallRight: boolean;
}

export interface NavEdge {
  from: number;
  to: number;
  /** jump: leap at takeoffX. drop: just walk off the ledge. */
  kind: 'jump' | 'drop';
  takeoffX: number;
  landX: number;
  /** Landing on top of a solid block higher up: rise first, then move over it. */
  climb: boolean;
  cost: number;
}

export interface NavGraph {
  surfaces: Surface[];
  edges: NavEdge[];
  /** Edges leaving each surface, by surface id. */
  out: NavEdge[][];
}

/** The physical abilities of whoever is pathfinding. */
export interface Mover {
  halfWidth: number;
  runSpeed: number;
  /** Strongest jump (px/s, upward). */
  jumpVelocity: number;
  gravity: number;
}

const MIN_SURFACE = 24;
/** Extra height a climbing jump clears above the block it lands on. */
const CLIMB_CLEARANCE = 40;

/** Walkable tops, with any part covered by another solid cut away. */
export function buildSurfaces(solids: readonly Box[], oneWays: readonly Box[]): Surface[] {
  const tops = [...solids.map((b) => ({ b, oneWay: false })), ...oneWays.map((b) => ({ b, oneWay: true }))];
  const surfaces: Surface[] = [];

  for (const { b, oneWay } of tops) {
    // Segments of this top, each remembering whether its ends are walls.
    let segs = [{ x0: b.x, x1: b.x + b.w, wallLeft: false, wallRight: false }];
    for (const s of solids) {
      if (s === b) continue;
      // A solid standing on (or through) this top blocks that stretch.
      if (!(s.y < b.y && s.y + s.h >= b.y - 1)) continue;
      const cut0 = s.x;
      const cut1 = s.x + s.w;
      const next: typeof segs = [];
      for (const seg of segs) {
        if (cut1 <= seg.x0 || cut0 >= seg.x1) {
          next.push(seg);
          continue;
        }
        if (cut0 > seg.x0) next.push({ ...seg, x1: cut0, wallRight: true });
        if (cut1 < seg.x1) next.push({ ...seg, x0: cut1, wallLeft: true });
      }
      segs = next;
    }
    for (const seg of segs) {
      if (seg.x1 - seg.x0 >= MIN_SURFACE) surfaces.push({ id: surfaces.length, y: b.y, oneWay, ...seg });
    }
  }
  return surfaces;
}

/** Where a mover's center can stand on this surface. */
export function standRange(s: Surface, m: Mover): [number, number] {
  const lo = s.x0 + (s.wallLeft ? m.halfWidth + 1 : 4);
  const hi = s.x1 - (s.wallRight ? m.halfWidth + 1 : 4);
  return lo <= hi ? [lo, hi] : [(s.x0 + s.x1) / 2, (s.x0 + s.x1) / 2];
}

/** Where a mover should aim to land: at least half its body on, clear of walls. */
function landRange(s: Surface, m: Mover): [number, number] {
  const edgeInset = m.halfWidth * 0.5;
  const lo = s.x0 + (s.wallLeft ? m.halfWidth + 1 : edgeInset);
  const hi = s.x1 - (s.wallRight ? m.halfWidth + 1 : edgeInset);
  return lo <= hi ? [lo, hi] : [(s.x0 + s.x1) / 2, (s.x0 + s.x1) / 2];
}

const maxJumpHeight = (m: Mover) => (m.jumpVelocity * m.jumpVelocity) / (2 * m.gravity);

/** Seconds in the air for a jump at upward speed vy that lands dh higher (dh < 0: lower). */
function airTime(vy: number, dh: number, g: number): number | null {
  const disc = vy * vy - 2 * g * dh;
  if (disc < 0) return null;
  return (vy + Math.sqrt(disc)) / g;
}

/** Can the mover get from `a` to `b` going in direction `dir` off a's end? */
function sideEdge(a: Surface, b: Surface, dir: 1 | -1, m: Mover): NavEdge | null {
  const [aLo, aHi] = standRange(a, m);
  const [bLo, bHi] = landRange(b, m);
  const end = dir === 1 ? a.x1 : a.x0;
  // b must stick out past a's end in this direction.
  if (dir === 1 ? bHi <= end : bLo >= end) return null;

  const dh = a.y - b.y; // > 0: b is higher
  const g = m.gravity;
  const H = maxJumpHeight(m);
  const climb = dh > 0 && !b.oneWay;
  const landX = dir === 1 ? Math.max(bLo, end + m.halfWidth * 0.5) : Math.min(bHi, end - m.halfWidth * 0.5);
  if (landX < bLo - 0.5 || landX > bHi + 0.5) return null;

  // Walking off the ledge onto something lower, no jump needed?
  if (dh < 0 && !a[dir === 1 ? 'wallRight' : 'wallLeft']) {
    const fall = Math.sqrt((2 * -dh) / g);
    const gap = Math.abs(landX - end);
    if (gap <= m.runSpeed * fall * 0.8) {
      return { from: a.id, to: b.id, kind: 'drop', takeoffX: end, landX, climb: false, cost: gap + -dh * 0.5 + 20 };
    }
  }

  const takeoffX = dir === 1 ? aHi : aLo;
  const gap = Math.abs(landX - takeoffX);
  if (climb) {
    // Rise above the block, then move over: only the time spent above its top counts.
    if (dh + CLIMB_CLEARANCE > H) return null;
    const above = 2 * Math.sqrt((2 * (H - dh)) / g);
    if (gap > m.runSpeed * above * 0.8) return null;
  } else {
    if (dh > H * 0.9) return null;
    const t = airTime(m.jumpVelocity, dh, g);
    if (t === null || gap > m.runSpeed * t * 0.9) return null;
  }
  return { from: a.id, to: b.id, kind: 'jump', takeoffX, landX, climb, cost: gap + Math.abs(dh) * 1.5 + 80 };
}

/** Jump straight up through a plank directly overhead. */
function upThroughEdge(a: Surface, b: Surface, m: Mover): NavEdge | null {
  if (!b.oneWay) return null;
  const dh = a.y - b.y;
  if (dh <= 0 || dh > maxJumpHeight(m) * 0.9) return null;
  const [aLo, aHi] = standRange(a, m);
  const [bLo, bHi] = landRange(b, m);
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  if (lo > hi) return null;
  const x = (lo + hi) / 2;
  return { from: a.id, to: b.id, kind: 'jump', takeoffX: x, landX: x, climb: false, cost: dh * 1.5 + 80 };
}

export function buildNavGraph(solids: readonly Box[], oneWays: readonly Box[], m: Mover): NavGraph {
  const surfaces = buildSurfaces(solids, oneWays);
  const edges: NavEdge[] = [];
  for (const a of surfaces) {
    for (const b of surfaces) {
      if (a === b) continue;
      const candidates = [sideEdge(a, b, 1, m), sideEdge(a, b, -1, m), upThroughEdge(a, b, m)];
      const best = candidates.filter((e): e is NavEdge => e !== null).sort((x, y) => x.cost - y.cost)[0];
      if (best) edges.push(best);
    }
  }
  const out = surfaces.map((s) => edges.filter((e) => e.from === s.id));
  return { surfaces, edges, out };
}

/** The surface whose top is under feet at (x, feetY), or null if in the air. */
export function surfaceAt(graph: NavGraph, x: number, feetY: number, halfWidth: number): Surface | null {
  let best: Surface | null = null;
  let bestDist = Infinity;
  for (const s of graph.surfaces) {
    if (Math.abs(s.y - feetY) > 4) continue;
    if (x < s.x0 - halfWidth || x > s.x1 + halfWidth) continue;
    const d = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0;
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Cheapest list of edges from (start surface, x) to the goal surface, or
 * null if there's no way there. An empty list means "already on it".
 */
export function findPath(graph: NavGraph, startId: number, startX: number, goalId: number): NavEdge[] | null {
  if (startId === goalId) return [];
  const n = graph.surfaces.length;
  const dist = new Array<number>(n).fill(Infinity);
  const entryX = new Array<number>(n).fill(0);
  const via = new Array<NavEdge | null>(n).fill(null);
  const done = new Array<boolean>(n).fill(false);
  dist[startId] = 0;
  entryX[startId] = startX;

  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1) return null;
    if (u === goalId) break;
    done[u] = true;
    for (const e of graph.out[u]) {
      const cost = dist[u] + Math.abs(entryX[u] - e.takeoffX) + e.cost;
      if (cost < dist[e.to]) {
        dist[e.to] = cost;
        entryX[e.to] = e.landX;
        via[e.to] = e;
      }
    }
  }

  const path: NavEdge[] = [];
  for (let at = goalId; at !== startId; ) {
    const e = via[at]!;
    path.unshift(e);
    at = e.from;
  }
  return path;
}

/**
 * Launch velocity for a jump edge (vy is upward speed). Climbs use the full
 * jump; others jump just high and long enough, never more than the mover can.
 */
export function jumpVelocity(edge: NavEdge, from: Surface, to: Surface, m: Mover): { vx: number; vy: number } {
  const dh = from.y - to.y;
  const g = m.gravity;
  const dx = edge.landX - edge.takeoffX;
  if (edge.climb) return { vx: 0, vy: m.jumpVelocity }; // steer over the top once high enough

  // High enough to clear the higher of the two surfaces a little…
  let vy = Math.sqrt(2 * g * (Math.max(dh, 0) + 24));
  // …and long enough in the air to cover the gap at a comfortable speed.
  const tNeeded = Math.abs(dx) / (m.runSpeed * 0.9);
  if (tNeeded > 0) vy = Math.max(vy, (dh + (g * tNeeded * tNeeded) / 2) / tNeeded);
  vy = Math.min(vy, m.jumpVelocity);

  const t = airTime(vy, dh, g) ?? airTime(m.jumpVelocity, dh, g) ?? 1;
  const vx = Math.max(-m.runSpeed * 1.1, Math.min(m.runSpeed * 1.1, dx / t));
  return { vx, vy };
}
