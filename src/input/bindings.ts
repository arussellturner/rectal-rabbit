import type { Action } from './actions';

/** Keyboard bindings, using `KeyboardEvent.code` (layout-independent). */
export const KEY_BINDINGS: Record<Action, readonly string[]> = {
  // Up jumps too, and Down eats / digs too (they still aim lobs and drop through logs).
  jump: ['Space', 'ArrowUp'],
  eat: ['KeyF', 'ArrowDown'],
  shoot: ['KeyD'],
  dropBomb: ['KeyS'],
  // Esc still works too (handy for backing out of menus).
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'],
  settings: ['KeyC'],
};

/** Arrows only: D and S are poop and bomb, so no WASD. */
export const MOVE_KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
} as const;

/**
 * Button indices in the W3C "standard" gamepad layout. Chrome and Edge report
 * a Bluetooth PS5 DualSense, Xbox and Switch Pro controller this way.
 * Names are by position: SOUTH is the bottom face button.
 */
export const PAD = {
  SOUTH: 0, // ✕ (PS)   A (Xbox)    B (Switch)
  EAST: 1, //  ○         B           A
  WEST: 2, //  □         X           Y
  NORTH: 3, // △         Y           X
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  SELECT: 8, // Create   View        -
  START: 9, //  Options  Menu        +
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16,
} as const;

// Which controller button does which action lives in padConfig.ts, because
// players can change it in Controller Setup.

/** Keys whose browser default (scrolling the page) should be blocked. */
export const CAPTURED_KEYS = new Set<string>([
  ...Object.values(KEY_BINDINGS).flat(),
  ...Object.values(MOVE_KEYS).flat(),
]);
