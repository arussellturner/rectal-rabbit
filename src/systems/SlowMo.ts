// From Marshall's game (turnerm5/rectal-rabbit), used as-is.
/**
 * Short slow-motion moments. `start` asks for a time scale (0..1, smaller is
 * slower) for some seconds of real time; overlapping requests keep the slower
 * scale and the later end. `update` takes real (unscaled) time.
 */
export class SlowMo {
  private scaleNow = 1;
  private left = 0;

  /** Current time scale: 1 is normal speed. */
  get scale(): number {
    return this.scaleNow;
  }

  get active(): boolean {
    return this.left > 0;
  }

  start(scale: number, seconds: number): void {
    if (seconds <= 0 || scale >= 1) return;
    const s = Math.max(0.01, scale);
    this.scaleNow = this.active ? Math.min(this.scaleNow, s) : s;
    this.left = Math.max(this.left, seconds);
  }

  /** Advance by `realDt` seconds of real time; returns the time scale for this frame. */
  update(realDt: number): number {
    const scale = this.scaleNow;
    if (this.left > 0) {
      this.left -= realDt;
      if (this.left <= 0) this.stop();
    }
    return scale;
  }

  stop(): void {
    this.left = 0;
    this.scaleNow = 1;
  }
}
