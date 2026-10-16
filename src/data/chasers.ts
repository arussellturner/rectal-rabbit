import { PIXEL } from '../config';

/**
 * Every chaser species is just data. To add another, copy one of these,
 * change the numbers, and give it a sprite sheet + animations (see
 * src/data/spriteSheets.ts: it needs `-run`, `-idle`, `-air`, `-lunge`,
 * `-hit`, `-fall` and `-leave`).
 */
export interface ChaserConfig {
  name: string;
  /** Sprite sheet key and animation prefix (see src/data/spriteSheets.ts). */
  sheet: string;
  /** How much to scale the sprite up (the snow leopard's art is 1/3 size; Marshall's is 1/2 size and already doubled). */
  scale: number;
  /** Optional color tint (e.g. a pale "ice wolf"). */
  tint?: number;
  /** Physics box (px). Smaller than the art so near-misses feel fair. */
  hitbox: { w: number; h: number };
  /**
   * The art's center is this far behind the body's center (px), because the
   * long tail sticks out the back.
   */
  tailOffset: number;
  /** Its "leave" animation is curled up in a ball (no tail sticking out). */
  curlsUp?: boolean;

  /** Running speed while chasing on screen (px/s). The rabbit runs at 330. */
  chaseSpeed: number;
  /** Speed while still off the edge of the screen, catching up. */
  catchUpSpeed: number;
  accel: number;
  /** Upward speed of a jump (px/s); 0 = can't jump. Jumps over walls, pits, and up to the rabbit. */
  jumpVelocity: number;
  /** Seconds between jumps (stops it bunny-hopping in place against a wall). */
  jumpCooldown: number;
  /** A quick dash at the rabbit when it gets close (a pounce, a snake strike). */
  lunge?: { range: number; speed: number; time: number; cooldown: number };

  /** Poop hits to scare it off. Hits before that make it stagger. */
  hitsToScare: number;
  /** Seconds it stops after a hit that doesn't scare it off. */
  staggerTime: number;
  /** Seconds of the "getting hit" animation before it falls down. */
  hitTime: number;
  /** Seconds it lies there dazed before running (or rolling) away. */
  fallTime: number;
  /** How fast it leaves once scared off (px/s). */
  rollSpeed: number;
  /** After catching the rabbit, it sits for this long (seconds). */
  pauseAfterCatch: number;
  /** How hard a poop shoves it back (px/s). Heavier animals get less. */
  knockback: number;
}

/** The snow leopards that chase you from behind, on every level. */
export const SNOW_LEOPARD: ChaserConfig = {
  name: 'Snow leopard',
  sheet: 'snow-leopard',
  scale: PIXEL,
  hitbox: { w: 96, h: 54 },
  tailOffset: 30,
  curlsUp: true,

  chaseSpeed: 270,
  catchUpSpeed: 420,
  accel: 1500,
  jumpVelocity: 860,
  jumpCooldown: 0.5,

  hitsToScare: 2,
  staggerTime: 0.6,
  hitTime: 0.36,
  fallTime: 0.9,
  rollSpeed: 480,
  pauseAfterCatch: 1.2,
  knockback: 420,
};

/*
 * The special predators that come at you from the FRONT, one kind per level.
 * Their art is Marshall's (turnerm5/rectal-rabbit). They run toward you, so
 * to poop at one you turn around (poop comes out the back) or jump over it.
 */

/** Level 1: a stoat (a small, quick weasel). Small enough to jump over; one poop does it. */
export const STOAT: ChaserConfig = {
  name: 'Stoat',
  sheet: 'weasel',
  scale: 1,
  hitbox: { w: 44, h: 34 },
  tailOffset: 4,
  chaseSpeed: 230,
  catchUpSpeed: 300,
  accel: 1800,
  jumpVelocity: 760,
  jumpCooldown: 0.6,
  hitsToScare: 1,
  staggerTime: 0.5,
  hitTime: 0.3,
  fallTime: 0.6,
  rollSpeed: 420,
  pauseAfterCatch: 1.2,
  knockback: 480,
};

/** Level 2: a red fox. Pounces when it gets close. */
export const FOX: ChaserConfig = {
  name: 'Fox',
  sheet: 'fox',
  scale: 1,
  hitbox: { w: 60, h: 46 },
  tailOffset: 6,
  chaseSpeed: 210,
  catchUpSpeed: 300,
  accel: 1500,
  jumpVelocity: 820,
  jumpCooldown: 0.6,
  lunge: { range: 170, speed: 480, time: 0.3, cooldown: 1.6 },
  hitsToScare: 2,
  staggerTime: 0.6,
  hitTime: 0.35,
  fallTime: 0.8,
  rollSpeed: 440,
  pauseAfterCatch: 1.2,
  knockback: 440,
};

/** Level 3: a desert snake. Slow and low (easy to jump), but it strikes. Can't climb or jump. */
export const SNAKE: ChaserConfig = {
  name: 'Snake',
  sheet: 'snake',
  scale: 1,
  hitbox: { w: 56, h: 30 },
  tailOffset: 0,
  chaseSpeed: 90,
  catchUpSpeed: 160,
  accel: 900,
  jumpVelocity: 0,
  jumpCooldown: 1,
  lunge: { range: 150, speed: 460, time: 0.28, cooldown: 1.4 },
  hitsToScare: 2,
  staggerTime: 0.6,
  hitTime: 0.35,
  fallTime: 0.8,
  rollSpeed: 260,
  pauseAfterCatch: 1.2,
  knockback: 360,
};

/** Level 5: an ice wolf. Big, tough (three poops), and it pounces. */
export const ICE_WOLF: ChaserConfig = {
  name: 'Ice wolf',
  sheet: 'wolf',
  scale: 1,
  tint: 0xc8e8ff,
  hitbox: { w: 80, h: 56 },
  tailOffset: 8,
  chaseSpeed: 230,
  catchUpSpeed: 320,
  accel: 1500,
  jumpVelocity: 860,
  jumpCooldown: 0.5,
  lunge: { range: 200, speed: 520, time: 0.32, cooldown: 1.5 },
  hitsToScare: 3,
  staggerTime: 0.55,
  hitTime: 0.35,
  fallTime: 0.9,
  rollSpeed: 460,
  pauseAfterCatch: 1.2,
  // Heavier: poop shoves it less.
  knockback: 300,
};
