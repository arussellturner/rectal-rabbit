export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const params = new URLSearchParams(window.location.search);
/** `?debug` shows physics hitboxes and a speed/ground readout. */
export const DEBUG = params.has('debug');
/** `?tune` opens a slider panel for the rabbit's movement values. */
export const TUNE = params.has('tune');
