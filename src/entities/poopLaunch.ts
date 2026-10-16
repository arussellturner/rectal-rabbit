import type { PoopTuning } from './tuning';

export type PoopAim = 'normal' | 'lob' | 'drop';

/**
 * Starting velocity of a poop pellet.
 * - normal: fast and nearly flat, out the back (or front, if shootBackwards is off)
 * - lob: hold up for a high, short arc (over a ledge, onto a platform)
 * - drop: hold down in mid-air to drop one straight down (bombs away)
 */
export function poopLaunchVelocity(
  facing: 1 | -1,
  aim: PoopAim,
  rabbitVx: number,
  t: Pick<PoopTuning, 'shootSpeed' | 'shootLift' | 'inheritVelocity' | 'shootBackwards'>,
): { vx: number; vy: number } {
  const inherited = rabbitVx * t.inheritVelocity;
  if (aim === 'drop') return { vx: inherited, vy: 150 };

  const dir = t.shootBackwards ? -facing : facing;
  if (aim === 'lob') return { vx: dir * t.shootSpeed * 0.2 + inherited, vy: -t.shootLift * 2.1 };
  return { vx: dir * t.shootSpeed + inherited, vy: -t.shootLift };
}
