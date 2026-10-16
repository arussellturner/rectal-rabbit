import type { ChaserConfig } from '../data/chasers';

/**
 * CHASE ──(poop hit)──► STAGGER ──► CHASE
 *   │  └──(last poop hit, or a poop bomb)──► KNOCKDOWN (hit, then falls over) ──► ROLL away ──► gone
 *   └──(caught the rabbit)──► PAUSE ──► CHASE
 */
export type ChaserState = 'chase' | 'stagger' | 'knockdown' | 'roll' | 'pause';

export type ChaserAnim = 'run' | 'hit' | 'fall' | 'leave' | 'idle' | 'lunge';

/** What the chaser senses this frame (worked out by the game from the level). */
export interface ChaserSenses {
  selfX: number;
  feetY: number;
  onGround: boolean;
  rabbitX: number;
  rabbitFeetY: number;
  /** A wall or step right in front of it. */
  wallAhead: boolean;
  /** No floor just ahead (a pit). */
  gapAhead: boolean;
  /** Still off the left edge of the screen. */
  offScreen: boolean;
}

export interface ChaserIntent {
  /** Horizontal speed it wants (px/s, signed). */
  vx: number;
  jump: boolean;
  facing: 1 | -1;
  anim: ChaserAnim;
  /** Can it catch the rabbit right now? */
  dangerous: boolean;
}

/**
 * Decision-making for one chaser (snow leopard). No Phaser in here, so it
 * can be unit tested: it takes what the chaser senses and says what to do.
 */
export class ChaserBrain {
  state: ChaserState = 'chase';
  facing: 1 | -1 = 1;
  hits = 0;

  private stateTime = 0;
  private sinceJump = Infinity;
  private rollDir: 1 | -1 = -1;
  /** Seconds left of a lunge (a pounce or a snake strike). */
  private lungeLeft = 0;
  private lungeCooldown = 0;

  constructor(readonly cfg: ChaserConfig) {}

  update(s: ChaserSenses, dt: number): ChaserIntent {
    const c = this.cfg;
    this.stateTime += dt;
    this.sinceJump += dt;
    this.lungeLeft = Math.max(0, this.lungeLeft - dt);
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);

    switch (this.state) {
      case 'stagger':
        if (this.stateTime >= c.staggerTime) this.enter('chase');
        else return this.intent(0, 'hit', false);
        break;
      case 'pause':
        if (this.stateTime >= c.pauseAfterCatch) this.enter('chase');
        else return this.intent(0, 'idle', false);
        break;
      case 'knockdown':
        if (this.stateTime < c.hitTime) return this.intent(0, 'hit', false);
        if (this.stateTime < c.hitTime + c.fallTime) return this.intent(0, 'fall', false);
        this.enter('roll');
        return this.intent(this.rollDir * c.rollSpeed, 'leave', false);
      case 'roll':
        return this.intent(this.rollDir * c.rollSpeed, 'leave', false);
      case 'chase':
        break;
    }

    const dx = s.rabbitX - s.selfX;
    // Can't jump (a snake) and there's a pit just ahead: wait at the edge.
    const stuck = c.jumpVelocity <= 0 && s.gapAhead && s.onGround;
    // Mid-lunge it's committed: straight ahead, fast.
    if (this.lungeLeft > 0 && c.lunge) {
      if (stuck) this.lungeLeft = 0;
      else return { vx: this.facing * c.lunge.speed, jump: false, facing: this.facing, anim: 'lunge', dangerous: true };
    }
    if (Math.abs(dx) > 8) this.facing = dx > 0 ? 1 : -1;
    const speed = s.offScreen ? c.catchUpSpeed : c.chaseSpeed;

    // Close, and on the same level as the rabbit: pounce!
    const level = Math.abs(s.feetY - s.rabbitFeetY) < 40;
    if (!stuck && c.lunge && s.onGround && level && Math.abs(dx) < c.lunge.range && this.lungeCooldown <= 0 && !s.offScreen) {
      this.lungeLeft = c.lunge.time;
      this.lungeCooldown = c.lunge.cooldown;
      return { vx: this.facing * c.lunge.speed, jump: false, facing: this.facing, anim: 'lunge', dangerous: true };
    }

    // Rabbit is up on something right above it: leap up after it.
    const rabbitAbove = s.feetY - s.rabbitFeetY > 40 && Math.abs(dx) < 160;
    const wantsJump = s.wallAhead || s.gapAhead || rabbitAbove;
    const jump = c.jumpVelocity > 0 && wantsJump && s.onGround && this.sinceJump >= c.jumpCooldown;
    if (jump) this.sinceJump = 0;
    if (stuck) return { vx: 0, jump: false, facing: this.facing, anim: 'idle', dangerous: true };

    return { vx: this.facing * speed, jump, facing: this.facing, anim: 'run', dangerous: true };
  }

  /**
   * Hit by a poop pellet coming from `fromX`. Returns 'scared' if that was the
   * hit that sends it rolling away, 'stagger' otherwise, or null if it's
   * already on its way out.
   */
  hit(fromX: number, selfX: number): 'stagger' | 'scared' | null {
    if (this.state === 'knockdown' || this.state === 'roll') return null;
    this.hits++;
    if (this.hits >= this.cfg.hitsToScare) {
      // Roll away from the rabbit, back where it came from.
      this.rollDir = fromX > selfX ? -1 : 1;
      this.enter('knockdown');
      return 'scared';
    }
    this.enter('stagger');
    return 'stagger';
  }

  /** Just caught the rabbit: sit for a moment so it can get away. */
  caughtRabbit(): void {
    this.enter('pause');
  }

  /**
   * Stepped right in a poop bomb: knocked straight over, however many hits
   * it had left. Returns false if it was already on its way out.
   */
  scare(fromX: number, selfX: number): boolean {
    if (this.leaving) return false;
    this.hits = this.cfg.hitsToScare;
    this.rollDir = fromX > selfX ? -1 : 1;
    this.enter('knockdown');
    return true;
  }

  /** How much fight it has left: 1 = never hit, 0 = knocked over. */
  get health(): number {
    return Math.max(0, 1 - this.hits / this.cfg.hitsToScare);
  }

  get leaving(): boolean {
    return this.state === 'knockdown' || this.state === 'roll';
  }

  private enter(state: ChaserState): void {
    this.state = state;
    this.stateTime = 0;
  }

  private intent(vx: number, anim: ChaserAnim, dangerous: boolean): ChaserIntent {
    return { vx, jump: false, facing: this.facing, anim, dangerous };
  }
}
