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
  runSpeed: 300,
  groundAccel: 2400,
  groundDecel: 2800,
  airAccel: 1600,
  airDecel: 600,
  turnMultiplier: 1.8,

  jumpVelocity: 700,
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
