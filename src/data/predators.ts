/**
 * Every predator species is just data. To add one (wolf, hawk, snake…),
 * copy FOX, change the numbers, and give it a texture.
 */
export interface PredatorConfig {
  name: string;
  texture: string;
  hitbox: { w: number; h: number };

  // --- Senses ---
  /** How far it can see in its vision cone (px). */
  sightRange: number;
  /** Half the width of the vision cone, in degrees (35 → a 70° cone). */
  sightHalfAngleDeg: number;
  /** Once chasing, it tracks you all around (not just in front), this far. */
  chaseSightRange: number;
  /** Multiplies how far away it can hear noises (1 = normal ears). */
  hearing: number;

  // --- Detection meter (0 = unaware, 1 = spotted you) ---
  /** Meter fill per second when it sees you (more when you're close). */
  detectRate: number;
  /** Fill multiplier when you're standing still (less noticeable). */
  stillFactor: number;
  /** Meter fill per second from hearing you. */
  hearRate: number;
  /** Hearing alone can only fill the meter this far (suspicious, never alerted). */
  hearingCap: number;
  /** Seconds after the last sight/sound before the meter starts draining. */
  decayDelay: number;
  /** Meter drain per second. */
  decayRate: number;
  /** Seen this close (0..1, 1 = touching) means instantly spotted. */
  instantCloseness: number;

  // --- Movement ---
  walkSpeed: number;
  creepSpeed: number;
  chaseSpeed: number;
  accel: number;
  /** Strongest jump (px/s upward). Jump height ≈ jumpVelocity² / (2 × gravity). */
  jumpVelocity: number;
  /** Crouch this long before each jump: the player's warning (s). */
  jumpWindup: number;
  /** Gives up a chase once this far from the middle of its territory (px). */
  leash: number;

  // --- Timings (seconds) ---
  /** Random pause while grazing between patrol walks: [min, max]. */
  grazeTime: [number, number];
  /** The freeze after "!" before the chase starts: your head start. */
  alertPause: number;
  /** Out of sight this long during a chase → goes searching. */
  loseSightTime: number;
  /** How long it searches before giving up. */
  searchTime: number;
  /** How often it turns around while searching. */
  lookAroundInterval: number;
  /** How long a poop hit stuns it. */
  stunTime: number;
  /** You're out of reach if your feet are more than this far above its feet (px). */
  reachHeight: number;
  /** Waiting below an out-of-reach rabbit this long → gives up. */
  giveUpTime: number;
  /** After giving up (or catching you) it ignores you for this long. */
  giveUpCooldown: number;
}

export const FOX: PredatorConfig = {
  name: 'Fox',
  texture: 'fox',
  hitbox: { w: 58, h: 42 },

  sightRange: 340,
  sightHalfAngleDeg: 32,
  chaseSightRange: 560,
  hearing: 1,

  detectRate: 0.9,
  stillFactor: 0.45,
  hearRate: 0.5,
  hearingCap: 0.85,
  decayDelay: 0.8,
  decayRate: 0.3,
  instantCloseness: 0.8,

  walkSpeed: 70,
  creepSpeed: 120,
  chaseSpeed: 255,
  accel: 1400,
  jumpVelocity: 760, // ~180 px high: can follow you onto any plank in the gray-box level
  jumpWindup: 0.2,
  leash: 1500,

  grazeTime: [1.2, 3],
  alertPause: 0.6,
  loseSightTime: 1.8,
  searchTime: 5,
  lookAroundInterval: 0.9,
  stunTime: 1.8,
  reachHeight: 50,
  giveUpTime: 2.5,
  giveUpCooldown: 3,
};

export const PREDATORS = { fox: FOX } as const;
export type PredatorKind = keyof typeof PREDATORS;
