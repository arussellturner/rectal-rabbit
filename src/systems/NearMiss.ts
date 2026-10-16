// From Marshall's game (turnerm5/rectal-rabbit), used as-is.
export interface NearMissRules {
  /** How close (px) the rabbit's box has to come to a predator's bite box to count as a near miss. */
  nearMissDistance: number;
  /** Minimum seconds between two near misses from the same predator. */
  nearMissCooldown: number;
}

/** One frame of one predator's attack on the rabbit. */
export interface NearMissInput {
  /** Is it going for the rabbit right now (chasing, and the rabbit can be caught)? */
  attacking: boolean;
  /** Is it in the leap of a pounce? */
  pouncing: boolean;
  /** Distance from the rabbit's box to the bite box (px). See `boxGap`. */
  gap: number;
  /** Is the bite box on the rabbit (a catch, or one about to happen)? */
  biting: boolean;
}

/**
 * Watches one predator for near misses: the rabbit comes within
 * `nearMissDistance` of its bite box and then gets away again without being
 * bitten. It fires when the rabbit gets back out of range (or the attack
 * ends), so a catch is never also a near miss. At most once per pounce, and
 * no more often than `nearMissCooldown` in a plain chase.
 */
export class NearMiss {
  /** The rabbit has been in range since the last near miss (or bite). */
  private close = false;
  /** This pounce already gave a near miss. */
  private spentThisPounce = false;
  private cooldown = 0;

  constructor(private readonly rules: () => NearMissRules) {}

  /** True on the frame a near miss happens. */
  update(dt: number, a: NearMissInput): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    let fired = false;
    if (a.biting) {
      // Caught (or as good as): that's not a miss.
      this.close = false;
    } else if (a.attacking && a.gap <= this.rules().nearMissDistance) {
      this.close = true;
    } else if (this.close) {
      this.close = false;
      if (this.cooldown <= 0 && !(a.pouncing && this.spentThisPounce)) {
        fired = true;
        this.cooldown = this.rules().nearMissCooldown;
        if (a.pouncing) this.spentThisPounce = true;
      }
    }
    if (!a.pouncing) this.spentThisPounce = false;
    return fired;
  }

  /** Forget the attack in progress (after a catch, say). */
  reset(): void {
    this.close = false;
    this.spentThisPounce = false;
  }
}
