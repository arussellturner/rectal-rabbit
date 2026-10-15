export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** One art pixel is drawn as a PIXEL × PIXEL square on screen: the chunky 8-bit look. */
export const PIXEL = 3;
/** Level tiles are 16 × 16 art pixels (48 × 48 on screen), like the NES. */
export const TILE = 16 * PIXEL;

// Unit tests run without a browser, so there may be no `window`.
const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
/** `?debug` shows physics hitboxes and a speed/ground readout. */
export const DEBUG = params.has('debug');
/** `?tune` opens a slider panel for the rabbit's movement values. */
export const TUNE = params.has('tune');
/** Draw predators' vision cones. Hide them with `?nocones` for a harder game. */
export const SHOW_VISION_CONES = !params.has('nocones');
/** `?calm` turns off the snow leopards, for exploring the level. */
export const NO_LEOPARDS = params.has('calm');
/** `?play` skips the title screen. */
export const SKIP_TITLE = params.has('play');
/** `?level=3` starts on level 3 (skips the title). */
export const START_LEVEL = params.has('level') ? Math.max(1, Number(params.get('level')) || 1) : null;
/** `?at=60` starts the rabbit at that tile column (for testing a later part of the level). */
export const START_COLUMN = params.has('at') ? Number(params.get('at')) || 0 : null;
