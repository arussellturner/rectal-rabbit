import type { FlyerConfig } from '../data/flyers';

/**
 * CRUISE ──(close enough)──► DIVE at the rabbit ──► CLIMB back up ──► CRUISE … (after a few dives) ► LEAVE
 *   any ──(poop hit)──► STAGGER ──► CLIMB
 *   any ──(last poop hit)──► FALLING out of the sky (then gone)
 */
export type FlyerState = 'cruise' | 'dive' | 'climb' | 'stagger' | 'falling' | 'leave';

export type FlyerAnim = 'glide' | 'dive' | 'flap' | 'hit' | 'fall';

export interface FlyerSenses {
  x: number;
  y: number;
  rabbitX: number;
  /** The rabbit's middle. */
  rabbitY: number;
  /** The ground under the rabbit (its feet). */
  groundY: number;
}

export interface FlyerIntent {
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: FlyerAnim;
  /** Can it catch the rabbit right now? */
  dangerous: boolean;
  /** Should gravity pull on it (only once it's knocked out of the sky)? */
  gravity: boolean;
}

/**
 * Decision-making for a swooping bird. No Phaser in here, so it can be unit
 * tested: it takes where things are and says which way to fly.
 */
export class FlyerBrain {
  state: FlyerState = 'cruise';
  facing: 1 | -1 = -1;
  hits = 0;
  dives = 0;

  private stateTime = 0;
  private target = { x: 0, y: 0 };

  constructor(readonly cfg: FlyerConfig) {}

  /** How much fight it has left: 1 = never hit, 0 = knocked down. */
  get health(): number {
    return Math.max(0, 1 - this.hits / this.cfg.hitsToScare);
  }

  get leaving(): boolean {
    return this.state === 'falling' || this.state === 'leave';
  }

  update(s: FlyerSenses, dt: number): FlyerIntent {
    const c = this.cfg;
    this.stateTime += dt;
    const cruiseY = s.groundY - c.cruiseHeight;

    switch (this.state) {
      case 'falling':
        return this.intent(0, 0, 'fall', false, true);

      case 'leave':
        return this.intent(this.facing * c.climbSpeed, -c.climbSpeed * 0.7, 'flap', false);

      case 'stagger':
        if (this.stateTime >= c.staggerTime) this.enter('climb');
        return this.intent(0, -60, 'hit', false);

      case 'climb':
        // Keep going the way it was diving, back up to cruising height.
        if (s.y <= cruiseY) {
          this.enter(this.dives >= c.maxDives ? 'leave' : 'cruise');
          break;
        }
        return this.intent(this.facing * c.climbSpeed * 0.8, -c.climbSpeed, 'flap', false);

      case 'dive': {
        const dx = this.target.x - s.x;
        const dy = this.target.y - s.y;
        const passed = Math.sign(dx) !== this.facing && Math.abs(dx) > 4;
        if (s.y >= this.target.y || passed || this.stateTime > 1.4) {
          this.dives++;
          this.enter('climb');
          break;
        }
        const len = Math.hypot(dx, dy) || 1;
        return this.intent((dx / len) * c.diveSpeed, (dy / len) * c.diveSpeed, 'dive', true);
      }

      case 'cruise':
        break;
    }

    if (this.state !== 'cruise') return this.update(s, 0);

    // Cruise: fly toward the rabbit at cruising height; dive once close enough.
    const dx = s.rabbitX - s.x;
    if (Math.abs(dx) > 8) this.facing = dx > 0 ? 1 : -1;
    // After a dive it cruises on for a moment first, so it swoops back round rather than straight down again.
    const rested = this.dives === 0 || this.stateTime > 0.9;
    if (rested && Math.abs(dx) < c.diveRange && Math.abs(s.y - cruiseY) < 40) {
      // Aim a little past the rabbit, so it swoops through rather than stopping on top.
      this.target = { x: s.rabbitX + this.facing * 40, y: s.rabbitY };
      this.enter('dive');
      return this.update(s, 0);
    }
    const vy = Math.max(-c.climbSpeed, Math.min(c.climbSpeed, (cruiseY - s.y) * 3));
    return this.intent(this.facing * c.cruiseSpeed, vy, 'glide', false);
  }

  /** Hit by a poop. Returns 'scared' if that knocked it out of the sky. */
  hit(): 'stagger' | 'scared' | null {
    if (this.leaving) return null;
    this.hits++;
    if (this.hits >= this.cfg.hitsToScare) {
      this.enter('falling');
      return 'scared';
    }
    this.enter('stagger');
    return 'stagger';
  }

  /** A poop bomb's blast: straight down. */
  scare(): boolean {
    if (this.leaving) return false;
    this.hits = this.cfg.hitsToScare;
    this.enter('falling');
    return true;
  }

  /** Just caught the rabbit: fly back up. */
  caughtRabbit(): void {
    this.dives++;
    this.enter('climb');
  }

  private enter(state: FlyerState): void {
    this.state = state;
    this.stateTime = 0;
  }

  private intent(vx: number, vy: number, anim: FlyerAnim, dangerous: boolean, gravity = false): FlyerIntent {
    return { vx, vy, facing: this.facing, anim, dangerous, gravity };
  }
}
