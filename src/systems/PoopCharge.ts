/** What happened with the poop button this frame. */
export type ChargeResult =
  | { kind: 'none' }
  /** Quick press: one normal poop (or an "empty!" if there are none). */
  | { kind: 'tap' }
  /** Held and released: one big poop that costs `amount` poops (2+). */
  | { kind: 'charged'; amount: number }
  /** Held all the way with a completely full meter. */
  | { kind: 'torrent' }
  /** Jump or the other trigger pressed mid-charge: nothing spent. */
  | { kind: 'cancelled' };

export interface ChargeTiming {
  /** Holding longer than this starts a charge instead of a tap (s). */
  tapThreshold: number;
  /** Each extra poop added to the charge takes this long (s). */
  chargePerPoop: number;
}

export interface ChargeInput {
  shootHeld: boolean;
  cancelPressed: boolean;
  /** Poops in the meter right now. */
  available: number;
  /** Charging needs the rabbit standing on something. */
  onGround: boolean;
}

/**
 * Hold the poop button to charge a SUPER POOP. The charge grows one poop at
 * a time up to however many you're carrying. A full meter, fully charged,
 * becomes a torrent. Poops are only spent when it fires, so a cancel is free.
 */
export class PoopCharge {
  private held = false;
  /** Still holding after a cancel: ignore until the button is let go. */
  private locked = false;
  private chargeTime = 0;

  constructor(
    private readonly timing: () => ChargeTiming,
    readonly maxAmmo: number,
  ) {}

  /** Feet planted and the meter glowing. */
  get isCharging(): boolean {
    return this.held && this.chargeTime >= this.timing().tapThreshold;
  }

  /** How many poops the shot would cost if released now (0 if not charging). */
  amountFor(available: number): number {
    if (!this.isCharging) return 0;
    const { tapThreshold, chargePerPoop } = this.timing();
    const steps = 1 + Math.floor((this.chargeTime - tapThreshold) / chargePerPoop);
    return Math.min(available, steps);
  }

  /** Fully charged with a full meter: releasing now unleashes the torrent. */
  torrentReady(available: number): boolean {
    return available >= this.maxAmmo && this.amountFor(available) >= this.maxAmmo;
  }

  update(dt: number, i: ChargeInput): ChargeResult {
    if (this.locked) {
      if (!i.shootHeld) this.locked = false;
      return { kind: 'none' };
    }

    if (!this.held) {
      if (!i.shootHeld) return { kind: 'none' };
      this.held = true;
      this.chargeTime = 0;
    }

    if (i.shootHeld) {
      if (this.isCharging && i.cancelPressed) {
        this.held = false;
        this.locked = true;
        this.chargeTime = 0;
        return { kind: 'cancelled' };
      }
      // Only worth charging with 2+ poops, and only with feet on the ground.
      if (i.available >= 2 && (i.onGround || this.isCharging)) this.chargeTime += dt;
      return { kind: 'none' };
    }

    // Let go.
    const amount = this.amountFor(i.available);
    const torrent = this.torrentReady(i.available);
    this.held = false;
    this.chargeTime = 0;
    if (torrent) return { kind: 'torrent' };
    if (amount >= 2) return { kind: 'charged', amount };
    return { kind: 'tap' };
  }

  reset(): void {
    this.held = false;
    this.locked = false;
    this.chargeTime = 0;
  }
}

/** How much longer a predator stays stunned, by poop power (1 = normal poop). */
export function stunMultiplier(power: number): number {
  return 1 + 0.2 * (Math.max(1, power) - 1);
}
