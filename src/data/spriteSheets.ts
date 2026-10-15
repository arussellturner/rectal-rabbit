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
  ],
};

export const SHEETS = [RABBIT_SHEET, SNOW_LEOPARD_SHEET];
