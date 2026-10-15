import type { SettingsStore } from '../input/padConfig';

const KEY = 'rectal-rabbit.progress';

/** Which levels you've unlocked, remembered between visits. */
export class Progress {
  private unlocked = 1;

  constructor(
    private readonly store: SettingsStore | null,
    readonly levelCount: number,
  ) {
    try {
      const saved = JSON.parse(store?.getItem(KEY) ?? '{}') as { unlocked?: number };
      if (typeof saved.unlocked === 'number') this.unlocked = saved.unlocked;
    } catch {
      /* nothing saved yet */
    }
    this.unlocked = Math.min(Math.max(1, this.unlocked), levelCount);
  }

  /** How many levels you can pick from (1 = just the first). */
  get unlockedCount(): number {
    return this.unlocked;
  }

  /** Finished level `index` (0-based): open up the next one. */
  completed(index: number): void {
    const next = Math.min(index + 2, this.levelCount);
    if (next <= this.unlocked) return;
    this.unlocked = next;
    try {
      this.store?.setItem(KEY, JSON.stringify({ unlocked: this.unlocked }));
    } catch {
      /* private window: progress lasts until the page is closed */
    }
  }
}
