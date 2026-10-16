/**
 * The character sprite sheets in public/sprites/, made from the drawings in
 * art/source/ by tools/extract_sprites.py. Frame sizes come from
 * public/sprites/sheets.json (re-run the script if the art changes).
 *
 * Frames are numbered left to right, in the order they appear in the
 * original drawing, row by row.
 */
export interface AnimDef {
  key: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

export interface SheetDef {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  anims: AnimDef[];
}

export const RABBIT_SHEET: SheetDef = {
  key: 'rabbit',
  url: 'sprites/rabbit.png',
  frameWidth: 36,
  frameHeight: 30,
  anims: [
    { key: 'rabbit-idle', frames: [0], frameRate: 1, repeat: 0 },
    { key: 'rabbit-run', frames: [1, 2, 3, 4], frameRate: 12, repeat: -1 },
    { key: 'rabbit-crouch', frames: [5], frameRate: 1, repeat: 0 },
    { key: 'rabbit-air', frames: [6], frameRate: 1, repeat: 0 },
    { key: 'rabbit-land', frames: [7], frameRate: 1, repeat: 0 },
    { key: 'rabbit-poop', frames: [8, 9, 10, 11], frameRate: 20, repeat: 0 },
    // Hand-drawn (tools/rabbit_extra_frames.py): mouth opens, then really wide.
    { key: 'rabbit-vomit', frames: [12, 13], frameRate: 20, repeat: 0 },
  ],
};

export const SNOW_LEOPARD_SHEET: SheetDef = {
  key: 'snow-leopard',
  url: 'sprites/snow-leopard.png',
  frameWidth: 60,
  frameHeight: 39,
  anims: [
    { key: 'snow-leopard-run', frames: [0, 1, 2, 3], frameRate: 12, repeat: -1 },
    { key: 'snow-leopard-idle', frames: [0], frameRate: 1, repeat: 0 },
    { key: 'snow-leopard-hit', frames: [4, 5, 6], frameRate: 9, repeat: 0 },
    { key: 'snow-leopard-fall', frames: [7, 8, 9, 10], frameRate: 8, repeat: 0 },
    { key: 'snow-leopard-roll', frames: [11, 12, 13, 14], frameRate: 14, repeat: -1 },
    { key: 'snow-leopard-leave', frames: [11, 12, 13, 14], frameRate: 14, repeat: -1 },
    // Mid-leap: the stretched-out running frame.
    { key: 'snow-leopard-air', frames: [2], frameRate: 1, repeat: 0 },
    { key: 'snow-leopard-lunge', frames: [0, 1, 2, 3], frameRate: 18, repeat: -1 },
  ],
};

/*
 * The front-coming predators are Marshall's pixel art, from his version of
 * the game (turnerm5/rectal-rabbit, public/assets/sprites). They're drawn at
 * 2 screen pixels per art pixel. Frame numbers are from his sprite manifest.
 */
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

/** Fox, weasel and wolf all share Marshall's four-legged layout. */
function fourLegged(key: string, url: string, frameWidth: number, frameHeight: number): SheetDef {
  return {
    key,
    url,
    frameWidth,
    frameHeight,
    anims: [
      { key: `${key}-run`, frames: range(12, 8), frameRate: 14, repeat: -1 },
      { key: `${key}-idle`, frames: range(0, 4), frameRate: 5, repeat: -1 },
      { key: `${key}-air`, frames: range(27, 4), frameRate: 10, repeat: 0 },
      { key: `${key}-lunge`, frames: range(35, 7), frameRate: 16, repeat: 0 },
      { key: `${key}-hit`, frames: range(60, 4), frameRate: 10, repeat: -1 },
      { key: `${key}-fall`, frames: range(64, 5), frameRate: 10, repeat: 0 },
      // Running away after being scared off.
      { key: `${key}-leave`, frames: range(12, 8), frameRate: 18, repeat: -1 },
    ],
  };
}

export const FOX_SHEET = fourLegged('fox', 'sprites/fox.png', 80, 72);
export const WEASEL_SHEET = fourLegged('weasel', 'sprites/weasel.png', 60, 52);
export const WOLF_SHEET = fourLegged('wolf', 'sprites/wolf.png', 104, 96);

export const SNAKE_SHEET: SheetDef = {
  key: 'snake',
  url: 'sprites/snake.png',
  frameWidth: 76,
  frameHeight: 68,
  anims: [
    { key: 'snake-run', frames: range(26, 8), frameRate: 10, repeat: -1 },
    { key: 'snake-idle', frames: range(0, 4), frameRate: 5, repeat: -1 },
    { key: 'snake-air', frames: range(26, 8), frameRate: 10, repeat: -1 },
    { key: 'snake-lunge', frames: range(14, 5), frameRate: 16, repeat: 0 },
    { key: 'snake-hit', frames: range(34, 4), frameRate: 10, repeat: -1 },
    { key: 'snake-fall', frames: range(38, 5), frameRate: 10, repeat: 0 },
    { key: 'snake-leave', frames: range(26, 8), frameRate: 16, repeat: -1 },
  ],
};

export const HAWK_SHEET: SheetDef = {
  key: 'hawk',
  url: 'sprites/hawk.png',
  frameWidth: 88,
  frameHeight: 80,
  anims: [
    { key: 'hawk-glide', frames: range(0, 4), frameRate: 6, repeat: -1 },
    { key: 'hawk-dive', frames: range(9, 4), frameRate: 10, repeat: -1 },
    { key: 'hawk-flap', frames: range(18, 6), frameRate: 14, repeat: -1 },
    { key: 'hawk-hit', frames: range(24, 4), frameRate: 10, repeat: -1 },
    { key: 'hawk-fall', frames: range(28, 5), frameRate: 10, repeat: 0 },
  ],
};

export const SHEETS = [RABBIT_SHEET, SNOW_LEOPARD_SHEET, FOX_SHEET, WEASEL_SHEET, WOLF_SHEET, SNAKE_SHEET, HAWK_SHEET];
