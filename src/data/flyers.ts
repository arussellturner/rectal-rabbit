/**
 * Flying predators that swoop at you from the front. Their art is Marshall's
 * hawk (turnerm5/rectal-rabbit).
 */
export interface FlyerConfig {
  name: string;
  sheet: 'hawk';
  scale: number;
  tint?: number;
  hitbox: { w: number; h: number };
  /** Cruising height above the ground (px): it flies along up here between dives. */
  cruiseHeight: number;
  /** Speed cruising along (px/s). */
  cruiseSpeed: number;
  /** Speed in a dive (px/s). */
  diveSpeed: number;
  /** Speed climbing back up after a dive (px/s). */
  climbSpeed: number;
  /** Starts a dive when it's this close to the rabbit, across (px). */
  diveRange: number;
  /** Dives this many times, then flies off. */
  maxDives: number;
  /** Poop hits to knock it out of the sky. */
  hitsToScare: number;
  /** Seconds it flaps about after a hit that doesn't knock it down. */
  staggerTime: number;
  /** How hard a poop shoves it (px/s). */
  knockback: number;
}

/** Level 4: a hawk. */
export const HAWK: FlyerConfig = {
  name: 'Hawk',
  sheet: 'hawk',
  scale: 1,
  hitbox: { w: 56, h: 36 },
  cruiseHeight: 300,
  cruiseSpeed: 220,
  diveSpeed: 540,
  climbSpeed: 300,
  diveRange: 300,
  maxDives: 3,
  hitsToScare: 1,
  staggerTime: 0.5,
  knockback: 300,
};

/** Level 6: a golden eagle. Bigger, faster, tougher, and it keeps coming back. */
export const GOLDEN_EAGLE: FlyerConfig = {
  name: 'Golden eagle',
  sheet: 'hawk',
  scale: 1.3,
  tint: 0xffd890,
  hitbox: { w: 70, h: 44 },
  cruiseHeight: 330,
  cruiseSpeed: 250,
  diveSpeed: 620,
  climbSpeed: 340,
  diveRange: 320,
  maxDives: 4,
  hitsToScare: 2,
  staggerTime: 0.45,
  knockback: 240,
};
