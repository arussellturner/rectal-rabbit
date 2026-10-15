import type { Action, SourceReading } from './actions';

/**
 * Tracks which actions are held this frame vs. last frame, so the game can
 * ask for "just pressed" (jump starts) and "just released" (short hops).
 */
export class ActionState {
  moveX = 0;
  moveY = 0;
  private held = new Set<Action>();
  private prev = new Set<Action>();

  apply(reading: Pick<SourceReading, 'moveX' | 'moveY' | 'held'>): void {
    this.prev = this.held;
    this.held = new Set(reading.held);
    this.moveX = reading.moveX;
    this.moveY = reading.moveY;
  }

  isDown(action: Action): boolean {
    return this.held.has(action);
  }

  justPressed(action: Action): boolean {
    return this.held.has(action) && !this.prev.has(action);
  }

  justReleased(action: Action): boolean {
    return !this.held.has(action) && this.prev.has(action);
  }
}

/** Combine keyboard + gamepad: union of buttons, strongest stick/arrow wins. */
export function mergeReadings(...readings: SourceReading[]): SourceReading {
  const pick = (key: 'moveX' | 'moveY') =>
    readings.reduce((best, r) => (Math.abs(r[key]) > Math.abs(best) ? r[key] : best), 0);
  const held = new Set<Action>();
  for (const r of readings) for (const a of r.held) held.add(a);
  return {
    moveX: pick('moveX'),
    moveY: pick('moveY'),
    held,
    active: readings.some((r) => r.active),
  };
}
