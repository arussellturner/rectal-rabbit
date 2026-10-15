import type { PredatorConfig } from '../data/predators';
import type { Perception } from './perception';

/**
 * PATROL ──(notices something)──► SUSPICIOUS "?" ──(meter full)──► ALERTED "!" ──► CHASE
 *   ▲                                   │                                            │
 *   │                          (meter drains to 0)                         (loses sight of you)
 *   │                                   ▼                                            ▼
 *   └──────────────(gives up)─────────────────────────────────────────────── SEARCH "?"
 *
 * Any state ──(hit by poop)──► STUNNED ──► CHASE (if it can see you) or SEARCH
 */
export type PredatorState = 'patrol' | 'suspicious' | 'alerted' | 'chase' | 'search' | 'stunned';

/** The stretch of ground a predator patrols. It leaves it to chase, but not too far (cfg.leash). */
export interface Territory {
  minX: number;
  maxX: number;
}

/** What the brain wants the body to do this frame. */
export interface Intent {
  /** Walk/run toward this x, or stand still if null. */
  targetX: number | null;
  speed: number;
  facing: 1 | -1;
}

const ARRIVED = 10;

/**
 * Decision-making for one predator. No Phaser in here: it takes what the
 * predator perceived and returns where it wants to go, so it can be unit tested.
 */
export class PredatorBrain {
  state: PredatorState = 'patrol';
  /** Detection meter: 0 = unaware, 1 = spotted you. */
  meter = 0;
  facing: 1 | -1 = -1;
  lastKnownX: number | null = null;
  /** Seconds left of ignoring the rabbit after giving up or catching it. */
  cooldown = 0;
  /** Called whenever the state changes (for "!" pops, rumble, sounds). */
  onEnter?: (state: PredatorState) => void;

  private stateTime = 0;
  private stunFor = 0;
  private sinceStimulus = Infinity;
  private lostSightFor = 0;
  private unreachableFor = 0;
  private patrolTarget: number | null = null;
  private grazeTimer = 0;
  private lookTimer = 0;
  /** "Has the body got to x yet?" Supplied by the navigator each update. */
  private arrivedAt: (x: number) => boolean = () => false;

  constructor(
    readonly cfg: PredatorConfig,
    readonly territory: Territory,
    private readonly random: () => number = Math.random,
  ) {}

  /**
   * @param arrivedAt whether the body has reached x (or got as close as it
   *   can). Defaults to a plain distance check, which is what the tests use.
   */
  update(selfX: number, p: Perception, dt: number, arrivedAt?: (x: number) => boolean): Intent {
    this.arrivedAt = arrivedAt ?? ((x) => Math.abs(selfX - x) <= ARRIVED);
    this.stateTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.state === 'stunned') {
      if (this.stateTime < this.stunFor) return this.stop();
      if (p.sees) {
        this.lastKnownX = p.rabbitX;
        this.enter('chase');
      } else {
        this.enter('search');
      }
    }

    this.updateMeter(p, dt);
    this.updateTransitions(selfX, p, dt);
    return this.behave(selfX, p, dt);
  }

  /**
   * Hit by a poop pellet fired from `fromX`. Bigger poops stun for longer
   * (`seconds`); getting hit again while stunned can only make it longer.
   */
  stun(fromX: number, seconds = this.cfg.stunTime): void {
    this.lastKnownX = fromX;
    this.cooldown = 0;
    if (this.state === 'stunned') {
      this.stunFor = Math.max(this.stunFor, this.stateTime + seconds);
      return;
    }
    this.stunFor = seconds;
    this.enter('stunned');
  }

  /** After catching the rabbit: calm down and leave it alone for a moment. */
  calmDown(): void {
    this.meter = 0;
    this.lastKnownX = null;
    this.cooldown = this.cfg.giveUpCooldown;
    this.enter('patrol');
  }

  private updateMeter(p: Perception, dt: number): void {
    const c = this.cfg;
    if (this.state === 'alerted' || this.state === 'chase') {
      this.meter = 1;
      return;
    }

    let gain = 0;
    if (this.cooldown <= 0) {
      if (p.touching || (p.sees && p.closeness >= c.instantCloseness)) {
        this.meter = 1;
        this.lastKnownX = p.rabbitX;
        this.sinceStimulus = 0;
        return;
      }
      if (p.sees) gain += c.detectRate * (0.4 + 1.6 * p.closeness) * (p.rabbitMoving ? 1 : c.stillFactor);
      if (p.hears) gain += c.hearRate;
    }

    if (gain > 0) {
      // Hearing alone makes it suspicious but can't fully spot you.
      const cap = p.sees ? 1 : c.hearingCap;
      this.meter = Math.max(this.meter, Math.min(cap, this.meter + gain * dt));
      this.lastKnownX = p.rabbitX;
      this.sinceStimulus = 0;
    } else {
      this.sinceStimulus += dt;
      if (this.sinceStimulus > c.decayDelay) this.meter = Math.max(0, this.meter - c.decayRate * dt);
    }
  }

  private updateTransitions(selfX: number, p: Perception, dt: number): void {
    const c = this.cfg;
    switch (this.state) {
      case 'patrol':
        if (this.meter >= 1) this.enter('alerted');
        else if (this.meter > 0) this.enter('suspicious');
        break;

      case 'suspicious':
        if (this.meter >= 1) this.enter('alerted');
        else if (this.meter <= 0) this.enter('patrol');
        break;

      case 'alerted':
        if (this.stateTime >= c.alertPause) this.enter('chase');
        break;

      case 'chase': {
        if (p.sees) {
          this.lostSightFor = 0;
          this.lastKnownX = p.rabbitX;
        } else {
          this.lostSightFor += dt;
        }
        // Standing as close as it can get to a rabbit it has no way to reach?
        const atSpot = this.arrivedAt(this.lastKnownX ?? selfX);
        this.unreachableFor = atSpot && !p.reachable ? this.unreachableFor + dt : 0;
        const homeX = (this.territory.minX + this.territory.maxX) / 2;
        const tooFarFromHome = Math.abs(selfX - homeX) > c.leash;

        if (this.unreachableFor >= c.giveUpTime || tooFarFromHome) {
          this.meter = 0;
          this.cooldown = c.giveUpCooldown;
          this.enter('patrol');
        } else if (this.lostSightFor >= c.loseSightTime) {
          this.enter('search');
        }
        break;
      }

      case 'search':
        if (this.meter >= 1) this.enter('alerted');
        else if (this.stateTime >= c.searchTime) {
          this.meter = 0;
          this.enter('patrol');
        }
        break;

      case 'stunned':
        break;
    }
  }

  private behave(selfX: number, p: Perception, dt: number): Intent {
    const c = this.cfg;
    switch (this.state) {
      case 'patrol': {
        if (this.grazeTimer > 0) {
          this.grazeTimer -= dt;
          return this.stop();
        }
        this.patrolTarget ??= this.pickPatrolTarget(selfX);
        if (this.arrivedAt(this.patrolTarget)) {
          this.patrolTarget = null;
          const [min, max] = c.grazeTime;
          this.grazeTimer = min + this.random() * (max - min);
          return this.stop();
        }
        return this.moveTo(selfX, this.patrolTarget, c.walkSpeed);
      }

      case 'suspicious':
        // Freeze and look first, then creep over to investigate.
        if (this.lastKnownX !== null) this.face(selfX, this.lastKnownX);
        if (this.stateTime < 0.7 || this.lastKnownX === null) return this.stop();
        return this.moveTo(selfX, this.lastKnownX, c.creepSpeed);

      case 'alerted':
        if (this.lastKnownX !== null) this.face(selfX, this.lastKnownX);
        return this.stop();

      case 'chase': {
        const target = this.lastKnownX ?? selfX;
        const intent = this.moveTo(selfX, target, c.chaseSpeed);
        // Waiting at the edge or below a platform: keep staring at the rabbit.
        if (intent.targetX === null) this.face(selfX, p.rabbitX);
        return { ...intent, facing: this.facing };
      }

      case 'search': {
        const target = this.lastKnownX ?? selfX;
        const intent = this.moveTo(selfX, target, c.creepSpeed);
        if (intent.targetX !== null) return intent;
        // At the spot: look one way, then the other.
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) {
          this.facing = this.facing === 1 ? -1 : 1;
          this.lookTimer = c.lookAroundInterval;
        }
        return this.stop();
      }

      case 'stunned':
        return this.stop();
    }
  }

  private enter(state: PredatorState): void {
    this.state = state;
    this.stateTime = 0;
    if (state === 'patrol') {
      this.patrolTarget = null;
      this.grazeTimer = 0.6;
    }
    if (state === 'alerted' || state === 'chase') this.meter = 1;
    if (state === 'chase') {
      this.lostSightFor = 0;
      this.unreachableFor = 0;
    }
    if (state === 'search') {
      this.lookTimer = this.cfg.lookAroundInterval;
      // Already on edge: spots you faster than from scratch.
      this.meter = 0.5;
      this.sinceStimulus = 0;
    }
    this.onEnter?.(state);
  }

  /** Head toward x (the navigator works out how, jumps and all); stop when there. */
  private moveTo(selfX: number, x: number, speed: number): Intent {
    if (this.arrivedAt(x)) return this.stop();
    if (Math.abs(x - selfX) > 2) this.facing = x > selfX ? 1 : -1;
    return { targetX: x, speed, facing: this.facing };
  }

  private stop(): Intent {
    return { targetX: null, speed: 0, facing: this.facing };
  }

  private face(selfX: number, x: number): void {
    if (Math.abs(x - selfX) > 2) this.facing = x > selfX ? 1 : -1;
  }

  private pickPatrolTarget(selfX: number): number {
    const { minX, maxX } = this.territory;
    // Somewhere at least a little way off, so it doesn't just shuffle.
    for (let i = 0; i < 5; i++) {
      const x = minX + this.random() * (maxX - minX);
      if (Math.abs(x - selfX) > 120) return x;
    }
    return selfX - minX > maxX - selfX ? minX : maxX;
  }
}
