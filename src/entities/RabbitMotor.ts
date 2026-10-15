import type { MotorTuning } from './tuning';

export interface MotorBodyState {
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface MotorInput {
  /** -1..1, analog-friendly. */
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface MotorOutput {
  vx: number;
  vy: number;
  /** Extra gravity for this body on top of world gravity (heavier when falling). */
  extraGravity: number;
  jumped: boolean;
  landed: boolean;
}

/** Move `value` toward `target` by at most `maxDelta`. */
export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

/**
 * Platformer movement rules, with no Phaser dependency so it can be unit
 * tested. Each frame: give it the body's current velocity + input, and it
 * returns the velocity to apply. Arcade Physics handles gravity and collisions.
 */
export class RabbitMotor {
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  /** True from takeoff until the jump is cut short or the rabbit starts falling. */
  private rising = false;
  private wasOnGround = false;

  constructor(public tuning: MotorTuning) {}

  step(body: MotorBodyState, input: MotorInput, dt: number): MotorOutput {
    const t = this.tuning;
    const { onGround } = body;

    // Not while rising: right after takeoff the body can still report "on
    // ground" for a frame, and refreshing here would allow a double jump.
    const grounded = onGround && !this.rising;
    this.coyoteTimer = grounded ? t.coyoteTime : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = input.jumpPressed ? t.jumpBuffer : Math.max(0, this.jumpBufferTimer - dt);
    const landed = onGround && !this.wasOnGround;
    this.wasOnGround = onGround;

    // Horizontal: accelerate toward the target speed instead of snapping to it.
    const target = input.moveX * t.runSpeed;
    const steering = Math.abs(input.moveX) > 0.01;
    let rate: number;
    if (!steering || Math.abs(target) < Math.abs(body.vx)) {
      rate = onGround ? t.groundDecel : t.airDecel;
    } else {
      rate = onGround ? t.groundAccel : t.airAccel;
      if (body.vx !== 0 && Math.sign(target) !== Math.sign(body.vx)) rate *= t.turnMultiplier;
    }
    const vx = approach(body.vx, target, rate * dt);

    // Vertical: jumps, short hops, falling.
    let vy = body.vy;
    let jumped = false;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      vy = -t.jumpVelocity;
      jumped = true;
      this.rising = true;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    } else if (this.rising && (!input.jumpHeld || vy >= 0)) {
      if (vy < 0) vy *= t.jumpCutMultiplier;
      this.rising = false;
    }
    vy = Math.min(vy, t.maxFallSpeed);

    const extraGravity = vy > 0 ? t.gravity * (t.fallGravityMultiplier - 1) : 0;
    return { vx, vy, extraGravity, jumped, landed };
  }
}
