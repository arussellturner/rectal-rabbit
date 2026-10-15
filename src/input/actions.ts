/**
 * Everything the game can ask the player to do. Game code only ever asks
 * "is `jump` pressed?" -- never "is Space / button 0 pressed?" -- so keyboard,
 * PS5, Xbox and Switch controllers all work the same way.
 */
export const ACTIONS = ['jump', 'eat', 'shoot', 'cancel', 'dropBomb', 'pause', 'confirm'] as const;
export type Action = (typeof ACTIONS)[number];

/** One input device's view of the world for a single frame. */
export interface SourceReading {
  /** -1 (left) .. 1 (right) */
  moveX: number;
  /** -1 (up) .. 1 (down) */
  moveY: number;
  held: Set<Action>;
  /** True if the player started pressing something on this device this frame. */
  active: boolean;
}

export function emptyReading(): SourceReading {
  return { moveX: 0, moveY: 0, held: new Set(), active: false };
}
