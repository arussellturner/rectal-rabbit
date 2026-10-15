/**
 * Hand-placed gray-box level for the prototype. In step 6 this gets
 * replaced by levels drawn in Tiled.
 *
 * Coordinates are in pixels. Ground top is at y=1080.
 * With default tuning the rabbit jumps ~150 px high, so steps up are ≤ 120 px.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Something standing on a surface: x is its center, y is the surface top. */
export interface Spot {
  x: number;
  y: number;
}

export interface GreyboxLevel {
  width: number;
  height: number;
  spawn: Spot;
  /** Solid from every side (top-left corner + size). */
  solids: Rect[];
  /** Jump up through from below, stand on top, ↓ + jump to drop through (like Smash). */
  oneWays: Rect[];
  /** Patches of grass to eat. */
  grass: Spot[];
  /** Practice targets to poop at (until predators arrive in step 3). */
  targets: Spot[];
}

const GROUND_Y = 1080;
const THIN = 16;

export const GREYBOX_LEVEL: GreyboxLevel = {
  width: 4800,
  height: 1200,
  spawn: { x: 160, y: GROUND_Y - 40 },
  solids: [
    // Ground, with two pits to jump over.
    { x: 0, y: GROUND_Y, w: 1400, h: 120 },
    { x: 1560, y: GROUND_Y, w: 1440, h: 120 },
    { x: 3200, y: GROUND_Y, w: 1600, h: 120 },
    // Staircase at the start.
    { x: 420, y: 990, w: 140, h: 90 },
    { x: 560, y: 900, w: 140, h: 180 },
    // A tower too tall to jump straight onto; use the ledge in front of it.
    { x: 2500, y: 860, w: 120, h: 220 },
    // Hill near the end.
    { x: 4300, y: 980, w: 500, h: 100 },
  ],
  oneWays: [
    // Climb up from the staircase and across the first pit.
    { x: 760, y: 800, w: 220, h: THIN },
    { x: 1060, y: 700, w: 200, h: THIN },
    { x: 1380, y: 820, w: 220, h: THIN },
    // Steps up to the tower.
    { x: 1900, y: 980, w: 200, h: THIN },
    { x: 2120, y: 880, w: 200, h: THIN },
    { x: 2340, y: 980, w: 140, h: THIN },
    // Stepping stone in the second pit.
    { x: 3030, y: 1000, w: 140, h: THIN },
    // Smash-style stack: hop up through them, ↓ + jump to drop back down.
    { x: 3500, y: 960, w: 300, h: THIN },
    { x: 3600, y: 840, w: 300, h: THIN },
    { x: 3500, y: 720, w: 300, h: THIN },
    { x: 3600, y: 600, w: 300, h: THIN },
    { x: 4000, y: 960, w: 200, h: THIN },
  ],
  grass: [
    { x: 320, y: GROUND_Y },
    { x: 490, y: 990 },
    { x: 870, y: 800 },
    { x: 1160, y: 700 },
    { x: 1720, y: 1080 },
    { x: 2220, y: 880 },
    { x: 2560, y: 860 },
    { x: 3320, y: 1080 },
    { x: 3750, y: 600 },
    { x: 4450, y: 980 },
    { x: 4680, y: 980 },
  ],
  targets: [
    { x: 1000, y: GROUND_Y },
    { x: 1300, y: GROUND_Y },
    { x: 2050, y: GROUND_Y },
    { x: 2850, y: GROUND_Y },
    { x: 4100, y: GROUND_Y },
  ],
};
