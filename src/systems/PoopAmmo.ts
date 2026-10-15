/** How many poop pellets the rabbit is carrying. One bite of grass = one pellet. */
export class PoopAmmo {
  constructor(
    readonly max: number,
    private amount = 0,
  ) {
    this.amount = Math.min(Math.max(0, amount), max);
  }

  get count(): number {
    return this.amount;
  }

  get isFull(): boolean {
    return this.amount >= this.max;
  }

  get isEmpty(): boolean {
    return this.amount <= 0;
  }

  /** Adds up to `n` pellets; returns how many actually fit. */
  add(n = 1): number {
    const added = Math.min(n, this.max - this.amount);
    this.amount += added;
    return added;
  }

  /** Spends `n` pellets if there are enough. */
  spend(n = 1): boolean {
    if (this.amount < n) return false;
    this.amount -= n;
    return true;
  }
}
