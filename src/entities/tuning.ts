/**
 * Everything that makes the rabbit's movement feel the way it does.
 * Units are pixels and seconds. Open the game with `?tune` to tweak these
 * live with sliders, then paste the values you like back in here.
 */
export interface MotorTuning {
  /** Top running speed (px/s). */
  runSpeed: number;
  /** How fast you reach top speed on the ground (px/s²). */
  groundAccel: number;
  /** How fast you stop on the ground when you let go (px/s²). */
  groundDecel: number;
  /** Steering while in the air (px/s²). */
  airAccel: number;
  /** Slowdown in the air when you let go (px/s²). Low = floaty momentum. */
  airDecel: number;
  /** Extra acceleration when reversing direction. Makes turning snappy. */
  turnMultiplier: number;

  /** Upward launch speed (px/s). Jump height ≈ jumpVelocity² / (2 × gravity). */
  jumpVelocity: number;
  /** Releasing jump early multiplies upward speed by this, for short hops. */
  jumpCutMultiplier: number;
  /** Gravity (px/s²). */
  gravity: number;
  /** Gravity multiplier while falling. Above 1 = snappy, less floaty jumps. */
  fallGravityMultiplier: number;
  /** Terminal falling speed (px/s). */
  maxFallSpeed: number;

  /** Seconds you can still jump after running off a ledge ("coyote time"). */
  coyoteTime: number;
  /** Seconds a too-early jump press is remembered before landing. */
  jumpBuffer: number;
  /** Seconds collisions with jump-through platforms are ignored when dropping down. */
  dropThroughTime: number;
}

export const DEFAULT_TUNING: Readonly<MotorTuning> = {
  runSpeed: 330,
  groundAccel: 2400,
  groundDecel: 2800,
  airAccel: 1600,
  airDecel: 600,
  turnMultiplier: 1.8,

  jumpVelocity: 820,
  jumpCutMultiplier: 0.45,
  gravity: 1600,
  fallGravityMultiplier: 1.6,
  maxFallSpeed: 950,

  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  dropThroughTime: 0.25,
};

/** The live values the game reads every frame (the tuning panel edits this). */
export const TUNING: MotorTuning = { ...DEFAULT_TUNING };

/** Eating and pooping. Also editable live with `?tune`. */
export interface PoopTuning {
  /** Seconds of chewing per bite of grass. Each bite = one poop. */
  biteTime: number;
  /** Seconds for an eaten patch to regrow one bite. */
  regrowInterval: number;
  /** Minimum seconds between shots. */
  shootCooldown: number;
  /** Horizontal launch speed of a pellet (px/s). */
  shootSpeed: number;
  /** Upward launch speed of a pellet (px/s). */
  shootLift: number;
  /** How much gravity pulls on a shot pellet while it flies (1 = full, like everything else). Lower = flatter, farther. */
  pelletGravity: number;
  /** How much of the rabbit's own running speed the pellet keeps (0..1). */
  inheritVelocity: number;
  /** How bouncy pellets are when they land (0 = splat, 1 = superball). */
  pelletBounce: number;
  /** Seconds a landed pellet stays on the ground before fading. */
  pelletLifetime: number;
  /** Poop comes out the back (where chasing predators will be). Untick to fire forward. */
  shootBackwards: boolean;
}

export const MAX_AMMO = 10;
export const BITES_PER_PATCH = 3;

export const DEFAULT_POOP_TUNING: Readonly<PoopTuning> = {
  biteTime: 0.35,
  regrowInterval: 5,
  shootCooldown: 0.22,
  // Fast and low, with light gravity: poop goes a long way, nearly straight out.
  shootSpeed: 1000,
  shootLift: 200,
  pelletGravity: 0.35,
  inheritVelocity: 0.4,
  pelletBounce: 0.35,
  pelletLifetime: 4,
  shootBackwards: true,
};

export const POOP_TUNING: PoopTuning = { ...DEFAULT_POOP_TUNING };

/**
 * Getting caught and near misses: slow motion and a camera punch-in, plus
 * some fairness. (Ideas and numbers from Marshall's turnerm5/rectal-rabbit.)
 */
export interface CatchTuning {
  /** Game speed while the jaws close on a catch (1 = normal, 0.25 = quarter speed). */
  catchSlowMo: number;
  /** Real seconds of that slow motion before the heart is lost. */
  catchSlowMoTime: number;
  /** Camera zoom on a catch (1 = none). */
  catchZoom: number;
  /** How close (px) the rabbit has to get to a leopard and still get away for a "CLOSE!". */
  nearMissDistance: number;
  /** Minimum seconds between near misses from one leopard. */
  nearMissCooldown: number;
  /** Game speed for the blink of slow motion on a near miss. */
  nearMissSlowMo: number;
  /** Real seconds of that slow motion. */
  nearMissSlowMoTime: number;
  /** A leopard that's just landed from a jump can't catch you for this long (s): landing on you isn't an instant catch. */
  landingRecover: number;
  /** In the air the rabbit tucks its feet up: this fraction comes off the bottom of the box leopards can catch. */
  airTuckBottom: number;
  /** …and this many px off each side. */
  airTuckSides: number;
}

export const DEFAULT_CATCH_TUNING: Readonly<CatchTuning> = {
  catchSlowMo: 0.25,
  catchSlowMoTime: 0.4,
  catchZoom: 1.25,
  nearMissDistance: 16,
  nearMissCooldown: 1.5,
  nearMissSlowMo: 0.5,
  nearMissSlowMoTime: 0.12,
  landingRecover: 0.15,
  airTuckBottom: 0.3,
  airTuckSides: 4,
};

export const CATCH_TUNING: CatchTuning = { ...DEFAULT_CATCH_TUNING };
