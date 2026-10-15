/** When snow leopards come charging in from behind. */
export interface SpawnerConfig {
  /** No leopards until the rabbit gets this far (px): time to learn to eat. */
  startX: number;
  /** No new leopards once the rabbit is this close to home (px). */
  stopX: number;
  /** Seconds between leopards at the start of the level: [min, max]. */
  earlyInterval: [number, number];
  /** Seconds between leopards near the end of the level: [min, max]. */
  lateInterval: [number, number];
  /** Most leopards at once, at the start and at the end of the level. */
  maxEarly: number;
  maxLate: number;
  /** Seconds before the first leopard shows up. */
  firstDelay: number;
}

export const DEFAULT_SPAWNER: SpawnerConfig = {
  startX: 1300,
  stopX: 10000,
  earlyInterval: [7, 10],
  lateInterval: [3.5, 6],
  maxEarly: 1,
  maxLate: 3,
  firstDelay: 1,
};

/**
 * Sends leopards more often, and more at a time, the farther along the
 * level the rabbit gets. No Phaser in here, so it can be unit tested.
 */
export class LeopardSpawner {
  private timer: number | null = null;

  constructor(
    readonly cfg: SpawnerConfig,
    private readonly random: () => number = Math.random,
  ) {}

  /** 0 at the first leopard, 1 near home. */
  progress(rabbitX: number): number {
    const { startX, stopX } = this.cfg;
    return Math.min(1, Math.max(0, (rabbitX - startX) / (stopX - startX)));
  }

  maxActive(rabbitX: number): number {
    const { maxEarly, maxLate } = this.cfg;
    return Math.round(maxEarly + (maxLate - maxEarly) * this.progress(rabbitX));
  }

  /** Returns true when it's time to send a leopard. */
  update(dt: number, rabbitX: number, active: number): boolean {
    if (rabbitX < this.cfg.startX || rabbitX > this.cfg.stopX) return false;
    if (this.timer === null) this.timer = this.cfg.firstDelay;

    this.timer -= dt;
    if (this.timer > 0 || active >= this.maxActive(rabbitX)) return false;
    this.timer = this.nextInterval(rabbitX);
    return true;
  }

  /** Give the rabbit a breather (after being caught or respawning). */
  delay(seconds: number): void {
    this.timer = Math.max(this.timer ?? 0, seconds);
  }

  private nextInterval(rabbitX: number): number {
    const p = this.progress(rabbitX);
    const [eMin, eMax] = this.cfg.earlyInterval;
    const [lMin, lMax] = this.cfg.lateInterval;
    const min = eMin + (lMin - eMin) * p;
    const max = eMax + (lMax - eMax) * p;
    return min + this.random() * (max - min);
  }
}
