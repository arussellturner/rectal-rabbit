/**
 * Every chaser species is just data. To add another (wolf, eagle…), copy
 * SNOW_LEOPARD, change the numbers, and give it a sprite sheet + animations.
 */
export interface ChaserConfig {
  name: string;
  /** Sprite sheet key and animation prefix (see src/data/spriteSheets.ts). */
  sheet: 'snow-leopard';
  /** Physics box (px). Smaller than the art so near-misses feel fair. */
  hitbox: { w: number; h: number };
  /**
   * The art's center is this far behind the body's center (px), because the
   * long tail sticks out the back.
   */
  tailOffset: number;

  /** Running speed while chasing on screen (px/s). The rabbit runs at 330. */
  chaseSpeed: number;
  /** Speed while still off the left edge of the screen, catching up. */
  catchUpSpeed: number;
  accel: number;
  /** Upward speed of a jump (px/s). Jumps over walls, pits, and up to the rabbit. */
  jumpVelocity: number;
  /** Seconds between jumps (stops it bunny-hopping in place against a wall). */
  jumpCooldown: number;

  /** Poop hits to scare it off. Hits before that make it stagger. */
  hitsToScare: number;
  /** Seconds it stops after a hit that doesn't scare it off. */
  staggerTime: number;
  /** Seconds of the "getting hit" animation before it falls down. */
  hitTime: number;
  /** Seconds it lies there dazed before rolling away. */
  fallTime: number;
  /** How fast it rolls away, back where it came from (px/s). */
  rollSpeed: number;
  /** After catching the rabbit, it sits for this long (seconds). */
  pauseAfterCatch: number;
  /** How hard a poop shoves it back (px/s). Heavier animals would get less. */
  knockback: number;
}

export const SNOW_LEOPARD: ChaserConfig = {
  name: 'Snow leopard',
  sheet: 'snow-leopard',
  hitbox: { w: 96, h: 54 },
  tailOffset: 30,

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
