/** A patch of grass: a few bites, regrowing one at a time after it's been nibbled. */
export class GrassState {
  bites: number;
  private regrowTimer = 0;

  constructor(
    readonly maxBites: number,
    /** Read every update so live tuning applies. */
    private readonly regrowInterval: () => number,
  ) {
    this.bites = maxBites;
  }

  get hasGrass(): boolean {
    return this.bites > 0;
  }

  bite(): boolean {
    if (this.bites <= 0) return false;
    this.bites--;
    this.regrowTimer = 0;
    return true;
  }

  /** Returns true if a bite grew back this update. */
  update(dt: number): boolean {
    if (this.bites >= this.maxBites) {
      this.regrowTimer = 0;
      return false;
    }
    this.regrowTimer += dt;
    if (this.regrowTimer < this.regrowInterval()) return false;
    this.regrowTimer = 0;
    this.bites++;
    return true;
  }
}
