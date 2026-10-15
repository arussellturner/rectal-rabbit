export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const params = new URLSearchParams(window.location.search);
/** `?debug` shows physics hitboxes and a speed/ground readout. */
export const DEBUG = params.has('debug');
/** `?tune` opens a slider panel for the rabbit's movement values. */
export const TUNE = params.has('tune');
/** Draw predators' vision cones. Hide them with `?nocones` for a harder game. */
export const SHOW_VISION_CONES = !params.has('nocones');
