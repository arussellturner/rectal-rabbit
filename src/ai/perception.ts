import type { PredatorConfig } from '../data/predators';
import { lineOfSight, type Box } from './geometry';

/** How far away (px) the rabbit can be heard doing noisy things. */
export const NOISE = {
  eating: 230,
  running: 130,
} as const;

/** A predator's point of view. */
export interface Viewer {
  x: number;
  eyeY: number;
  feetY: number;
  facing: 1 | -1;
}

/** What a predator needs to know about the rabbit. */
export interface RabbitSnapshot {
  x: number;
  centerY: number;
  topY: number;
  feetY: number;
  vx: number;
  onGround: boolean;
  eating: boolean;
}

/** Everything a predator noticed about the rabbit this frame. */
export interface Perception {
  /** Can see the rabbit right now. */
  sees: boolean;
  /** 0 (edge of sight range) .. 1 (right on top of it). 0 if not seen. */
  closeness: number;
  hears: boolean;
  rabbitMoving: boolean;
  /** The rabbit's feet are low enough to catch (not up on a platform). */
  reachable: boolean;
  touching: boolean;
  rabbitX: number;
  distance: number;
}

export type SenseConfig = Pick<
  PredatorConfig,
  'sightRange' | 'sightHalfAngleDeg' | 'chaseSightRange' | 'hearing' | 'reachHeight'
>;

export function noiseRadius(r: RabbitSnapshot): number {
  if (r.eating) return NOISE.eating;
  if (r.onGround && Math.abs(r.vx) > 200) return NOISE.running;
  return 0;
}

/**
 * Vision: a cone in front of the predator, blocked by walls. While chasing
 * it tracks the rabbit all around, further out. Hearing goes through walls.
 */
export function perceive(
  v: Viewer,
  r: RabbitSnapshot,
  walls: readonly Box[],
  cfg: SenseConfig,
  chasing: boolean,
  touching: boolean,
): Perception {
  const dx = r.x - v.x;
  const dy = r.centerY - v.eyeY;
  const distance = Math.hypot(dx, dy);
  const range = chasing ? cfg.chaseSightRange : cfg.sightRange;

  let inView = distance <= range;
  if (inView && !chasing) {
    // 0 = straight ahead, π = directly behind.
    const angle = Math.atan2(Math.abs(dy), dx * v.facing);
    inView = angle <= (cfg.sightHalfAngleDeg * Math.PI) / 180;
  }
  // Seeing either the body or the ear tips counts.
  const sees =
    inView &&
    (lineOfSight(v.x, v.eyeY, r.x, r.centerY, walls) || lineOfSight(v.x, v.eyeY, r.x, r.topY, walls));

  return {
    sees,
    closeness: sees ? Math.max(0, 1 - distance / range) : 0,
    hears: distance <= noiseRadius(r) * cfg.hearing,
    rabbitMoving: Math.abs(r.vx) > 40 || !r.onGround,
    reachable: r.feetY >= v.feetY - cfg.reachHeight,
    touching,
    rabbitX: r.x,
    distance,
  };
}
