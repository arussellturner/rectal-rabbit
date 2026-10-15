import Phaser from 'phaser';
import { PIXEL } from '../config';

/**
 * All the level art is drawn in code, one chunky pixel at a time, in an
 * NES-style palette. Each art pixel becomes a PIXEL × PIXEL square, so a
 * 16 × 16 tile is 48 × 48 on screen and matches the sprite sheets' pixel size.
 */
export const PAL = {
  black: '#000000',
  white: '#fcfcfc',
  snowShade: '#a4e4fc',
  snowEdge: '#3cbcfc',
  dirt: '#88581c',
  dirtLight: '#ac7c3c',
  dirtDark: '#5c3a10',
  burrow: '#4c2c0c',
  burrowLight: '#6c4418',
  burrowDark: '#2c1804',
  burrowWall: '#24140a',
  root: '#7c5428',
  stone: '#7c7c7c',
  stoneLight: '#bcbcbc',
  stoneDark: '#3c3c3c',
  moss: '#58a838',
  ice: '#3cbcfc',
  iceLight: '#a4e4fc',
  iceDark: '#0078f8',
  iceEdge: '#0000bc',
  green: '#00a800',
  greenLight: '#b8f818',
  greenMid: '#58d854',
  greenDark: '#005800',
  wood: '#ac7c00',
  woodLight: '#fca044',
  woodDark: '#503000',
  red: '#f83800',
  gray: '#7c7c7c',
  grayLight: '#bcbcbc',
  carrot: '#f87800',
  carrotDark: '#c84c0c',
  bubble: '#bcf0fc',
  mountain: '#3c50a8',
  mountainShade: '#283c8c',
  forest: '#1c3470',
} as const;

/** Sky, top to bottom: bands of blue like an NES gradient (no smooth fades on the NES!). */
export const SKY_BANDS = [0x183c8c, 0x24509c, 0x3464b4, 0x4c7ccc, 0x6c98dc, 0x94b8e8];

type Painter = (x: number, y: number, color: string) => void;

/** Make a texture `w × h` art pixels big by calling `set(x, y, color)` for each pixel you want. */
export function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (set: Painter) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w * PIXEL, h * PIXEL);
  if (!tex) return;
  const ctx = tex.context;
  draw((x, y, color) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
  });
  tex.refresh();
}

/** Make a texture from a little text picture: one character per pixel, '.' = see-through. */
export function picture(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, string>): void {
  const w = Math.max(...rows.map((r) => r.length));
  paint(scene, key, w, rows.length, (set) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const c = colors[ch];
        if (c) set(x, y, c);
      });
    });
  });
}

/** Same "random" number every time for the same inputs, so tiles look scattered but never flicker. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How many look-alike versions of the speckled tiles there are (so the ground doesn't repeat). */
export const TILE_VARIANTS = 3;

export function makeLevelTextures(scene: Phaser.Scene): void {
  // --- Overworld tiles (16 × 16) ---
  // Frozen earth: speckled soil with pebbles and bits of root. No bricks.
  for (let v = 0; v < TILE_VARIANTS; v++) {
    paint(scene, `tile-dirt-${v}`, 16, 16, (set) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = hash(x, y, v);
          set(x, y, n < 0.12 ? PAL.dirtDark : n > 0.9 ? PAL.dirtLight : PAL.dirt);
        }
      }
      // A couple of pebbles and a root.
      for (let i = 0; i < 2; i++) {
        const px = Math.floor(hash(i, v, 7) * 13) + 1;
        const py = Math.floor(hash(v, i, 9) * 13) + 1;
        set(px, py, PAL.stoneLight);
        set(px + 1, py, PAL.stone);
        set(px, py + 1, PAL.stone);
        set(px + 1, py + 1, PAL.stoneDark);
      }
      const rx = Math.floor(hash(v, 3, 11) * 10) + 2;
      for (let y = 0; y < 5; y++) set(rx + (y >> 1), 9 + y, PAL.woodDark);
    });
  }

  // Stone ledge: chunky rock with cracks, moss, and a dark underside.
  paint(scene, 'tile-stone', 16, 16, (set) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let c: string = PAL.stone;
        if (y >= 13 || x === 15) c = PAL.stoneDark;
        else if (y <= 1 || x === 0) c = PAL.stoneLight;
        else if (hash(x, y, 21) < 0.08) c = PAL.stoneLight;
        set(x, y, c);
      }
    }
    // Cracks.
    for (const [x, y] of [[5, 3], [6, 4], [6, 5], [7, 6], [11, 8], [12, 9], [12, 10], [3, 10], [4, 11]]) set(x, y, PAL.stoneDark);
    // Moss creeping down from the top.
    for (const [x, y] of [[2, 2], [3, 2], [3, 3], [9, 2], [10, 2], [13, 2], [13, 3]]) set(x, y, PAL.moss);
  });

  paint(scene, 'tile-ice', 16, 16, (set) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let c: string = PAL.ice;
        if (x === 0 || y === 0 || x === 15 || y === 15) c = PAL.iceEdge;
        else if (x >= 13 || y >= 13) c = PAL.iceDark;
        else if (x <= 2 || y <= 2) c = PAL.iceLight;
        else if (x + y === 12 || x + y === 13) c = PAL.white; // shine
        set(x, y, c);
      }
    }
  });

  // Log bridge (one-way platform): 16 × 6.
  paint(scene, 'tile-log', 16, 6, (set) => {
    for (let x = 0; x < 16; x++) {
      set(x, 0, PAL.woodLight);
      for (let y = 1; y <= 3; y++) set(x, y, (x * 7 + y * 3) % 11 === 0 ? PAL.woodDark : PAL.wood);
      set(x, 4, PAL.woodDark);
      set(x, 5, PAL.black);
    }
    for (const x of [0, 8]) for (let y = 0; y < 6; y++) set(x, y, PAL.woodDark);
  });

  // Snow that sits on top of any exposed solid tile: 16 × 6, drawn 2px above the top.
  const drift = [4, 3, 3, 4, 5, 4, 3, 3, 4, 5, 5, 4, 3, 4, 4, 3];
  paint(scene, 'snowcap', 16, 6, (set) => {
    drift.forEach((h, x) => {
      for (let y = 0; y < h; y++) set(x, y, y === h - 1 ? PAL.snowShade : PAL.white);
    });
  });

  // --- Burrow tiles ---
  for (let v = 0; v < TILE_VARIANTS; v++) {
    paint(scene, `tile-burrow-${v}`, 16, 16, (set) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = hash(x, y, v + 40);
          set(x, y, n < 0.15 ? PAL.burrowDark : n > 0.88 ? PAL.burrowLight : PAL.burrow);
        }
      }
      const rx = Math.floor(hash(v, 5, 41) * 10) + 3;
      for (let y = 2; y < 12; y++) set(rx + Math.round(Math.sin(y) * 1.2), y, PAL.root);
    });
  }
  // Packed-dirt surface: a lighter lip on any burrow tile with air above it.
  paint(scene, 'burrow-lip', 16, 3, (set) => {
    for (let x = 0; x < 16; x++) {
      set(x, 0, PAL.dirtLight);
      set(x, 1, x % 5 === 0 ? PAL.burrowLight : PAL.dirt);
      if (x % 3 === 1) set(x, 2, PAL.burrowLight);
    }
  });
  // The far wall of the burrow (behind everything).
  paint(scene, 'burrow-wall', 16, 16, (set) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) set(x, y, hash(x, y, 77) < 0.1 ? PAL.burrowDark : PAL.burrowWall);
    }
  });
  // Root ledge (one-way platform underground): 16 × 6.
  paint(scene, 'tile-roots', 16, 6, (set) => {
    for (let x = 0; x < 16; x++) {
      const wobble = Math.round(Math.sin(x * 0.8) * 0.7);
      set(x, 1 + wobble, PAL.dirtLight);
      set(x, 2 + wobble, PAL.root);
      set(x, 3 + wobble, PAL.woodDark);
      if (x % 6 === 2) set(x, 5, PAL.root); // dangly root hairs
    }
  });

  // --- Grass tufts poking out of the snow: grass-3 (full) to grass-0 (stubble) ---
  const blades: [number, number, number][] = [
    [7, 11, 0], [4, 9, -1], [10, 10, 1], [2, 6, -1], [13, 7, 1], [5, 7, 0], [9, 8, 0], [12, 5, 1], [1, 4, 0],
  ];
  const bladeColors = [PAL.green, PAL.greenMid, PAL.greenDark];
  for (let bites = 0; bites <= 3; bites++) {
    paint(scene, `grass-${bites}`, 16, 12, (set) => {
      const growth = bites === 0 ? 0.2 : 0.35 + 0.65 * (bites / 3);
      const count = bites === 0 ? blades.length : 3 + bites * 2;
      blades.slice(0, count).forEach(([x, h, lean], i) => {
        const height = Math.max(1, Math.round(h * growth));
        for (let y = 0; y < height; y++) {
          const bend = y > height * 0.6 ? lean : 0;
          set(x + bend, 11 - y, bladeColors[i % bladeColors.length]);
        }
      });
    });
  }
  paint(scene, 'grass-bit', 1, 2, (set) => {
    set(0, 0, PAL.greenMid);
    set(0, 1, PAL.green);
  });

  // --- Poop ---
  picture(scene, 'poop', ['.DD.', 'DLDD', 'DDDD', '.DD.'], { D: PAL.woodDark, L: PAL.wood });
  paint(scene, 'poop-bit', 2, 2, (set) => {
    for (let i = 0; i < 4; i++) set(i % 2, i >> 1, PAL.woodDark);
  });
  // The poop bomb: a big swirly pile with a little sprout fuse.
  picture(
    scene,
    'poop-bomb',
    [
      '......GG......',
      '.....G........',
      '......DD......',
      '.....DLLD.....',
      '....DDDDDD....',
      '...DLLDDDLD...',
      '..DDDDDDDDDD..',
      '.DLLDDDDLLDDD.',
      'DDDDDDDDDDDDDD',
      '.DDDDDDDDDDDD.',
    ],
    { D: PAL.woodDark, L: PAL.wood, G: PAL.greenMid },
  );
  paint(scene, 'stink', 1, 1, (set) => set(0, 0, PAL.greenLight));

  // --- Pickups and HUD ---
  const heart = ['.KK...KK.', 'KRWRKRRRK', 'KWRRRRRRK', 'KRRRRRRRK', '.KRRRRRK.', '..KRRRK..', '...KRK...', '....K....'];
  picture(scene, 'heart', heart, { K: PAL.black, R: PAL.red, W: PAL.white });
  picture(scene, 'heart-empty', heart, { K: PAL.black, R: '#3c3c3c', W: '#3c3c3c' });

  picture(
    scene,
    'carrot',
    ['....G.G.', '.....GG.', '....GGG.', '...OOG..', '..OOOO..', '..OdOO..', '.OOOd...', '.OdO....', 'OOO.....', 'O.......'],
    { G: PAL.greenMid, O: PAL.carrot, d: PAL.carrotDark },
  );

  // A see-through bubble ring with a shine, 18 × 18.
  paint(scene, 'bubble', 18, 18, (set) => {
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        const r = Math.hypot(x + 0.5 - 9, y + 0.5 - 9);
        if (r > 8.6 && r <= 9.4) set(x, y, PAL.white);
        else if (r > 7.6 && r <= 8.6) set(x, y, PAL.bubble);
      }
    }
    for (const [x, y] of [[5, 4], [4, 5], [4, 6], [6, 4], [5, 5]]) set(x, y, PAL.white);
  });

  picture(scene, 'star', ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '.YY.YY.', 'Y.....Y'], { Y: '#fce0a8' });

  // --- Checkpoint flag and home ---
  paint(scene, 'pole', 4, 48, (set) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, (x + y) % 3 === 0 ? PAL.white : PAL.carrot);
    for (let y = 4; y < 48; y++) {
      set(1, y, PAL.woodLight);
      set(2, y, PAL.wood);
    }
  });
  // A carrot-orange pennant.
  picture(
    scene,
    'flag',
    ['KKKKKKKKKKK.', 'KOOOOOOOOOOK', 'KOOGGOOOOOK.', 'KOOGOOOOOK..', 'KOOOOOOOK...', 'KOOOOOOK....', 'KOOOOOK.....', 'KKKKKK......'],
    { K: PAL.black, O: PAL.carrot, G: PAL.greenMid },
  );

  // Home: a snowy mound with a round wooden door.
  paint(scene, 'home', 32, 24, (set) => {
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = (x - 15.5) / 16;
        const dy = (y - 24) / 23;
        const r = dx * dx + dy * dy;
        if (r > 1) continue;
        let c: string = r > 0.86 ? PAL.snowEdge : x > 20 && r > 0.5 ? PAL.snowShade : PAL.white;
        const hx = (x - 15.5) / 6.5;
        const hy = (y - 23) / 9;
        const door = hx * hx + hy * hy;
        if (door <= 1) c = door > 0.72 ? PAL.woodDark : x % 3 === 0 ? PAL.woodDark : PAL.wood;
        set(x, y, c);
      }
    }
    set(19, 18, PAL.woodLight); // doorknob
  });

  // Dirt pile (dig here) and exit hole (you pop out here): mounds of loose earth, 32 × 12.
  const mound = (key: string, hole: boolean) =>
    paint(scene, key, 32, 12, (set) => {
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 32; x++) {
          const dx = (x - 15.5) / 15.5;
          const top = 12 - Math.round(11 * (1 - dx * dx));
          if (y < top) continue;
          let c: string = hash(x, y, 90) < 0.2 ? PAL.dirtDark : hash(x, y, 91) > 0.85 ? PAL.dirtLight : PAL.dirt;
          if (y === top) c = PAL.dirtLight;
          if (y === top && hash(x, 0, 92) < 0.35) c = PAL.white; // a little snow
          if (hole) {
            const hx = (x - 15.5) / 6;
            const hy = (y - 6) / 3.5;
            if (hx * hx + hy * hy <= 1) c = hx * hx + hy * hy > 0.6 ? PAL.dirtDark : PAL.black;
          }
          set(x, y, c);
        }
      }
    });
  mound('dirt-pile', false);
  mound('dirt-hole', true);

  // The mouth of a burrow exit tunnel, with an arrow pointing out.
  paint(scene, 'tunnel', 16, 16, (set) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, '#140a04');
  });
  picture(scene, 'arrow', ['..W...', '..WW..', 'WWWWW.', 'WWWWWW', 'WWWWW.', '..WW..', '..W...'], { W: PAL.carrot });

  // --- Background scenery ---
  paint(scene, 'mountain', 80, 48, (set) => {
    for (let y = 0; y < 48; y++) {
      const half = Math.round((y + 1) * (40 / 48));
      const snowLine = 14 + ((y * 7) % 3);
      for (let x = 40 - half; x < 40 + half; x++) {
        const right = x >= 40;
        let c: string = right ? PAL.mountainShade : PAL.mountain;
        if (y < snowLine + Math.round(Math.sin(x * 0.9) * 2)) c = right ? PAL.grayLight : PAL.white;
        set(x, y, c);
      }
    }
  });

  // A dark band of distant pine forest: 64 × 24, tiles side by side.
  paint(scene, 'forest', 64, 24, (set) => {
    const trees = [[4, 16], [11, 20], [18, 14], [26, 22], [33, 17], [40, 21], [47, 15], [55, 19], [61, 16]];
    for (const [cx, h] of trees) {
      for (let y = 24 - h; y < 24; y++) {
        const half = Math.max(1, Math.round(((y - (24 - h)) / h) * 4.5));
        for (let x = cx - half; x <= cx + half; x++) set(((x % 64) + 64) % 64, y, PAL.forest);
      }
    }
    for (let x = 0; x < 64; x++) for (let y = 20; y < 24; y++) set(x, y, PAL.forest);
  });

  // A long, thin wisp of cloud.
  paint(scene, 'cloud', 48, 6, (set) => {
    const rows: [number, number, number][] = [[14, 30, 0], [6, 40, 1], [0, 46, 2], [8, 44, 3], [18, 36, 4]];
    for (const [from, to, y] of rows) for (let x = from; x < to; x++) set(x, y, y >= 3 ? PAL.snowShade : PAL.white);
  });

  // A snowy pine tree: 16 × 32.
  paint(scene, 'pine', 16, 32, (set) => {
    for (let y = 26; y < 32; y++) for (let x = 7; x < 9; x++) set(x, y, PAL.woodDark);
    const tiers: [number, number][] = [[0, 10], [7, 18], [14, 26]];
    for (const [top, bottom] of tiers) {
      for (let y = top; y < bottom; y++) {
        const half = Math.round(((y - top + 1) / (bottom - top)) * 7.5) + (top > 0 ? 1 : 0);
        for (let x = 8 - half; x < 8 + half; x++) {
          const snowy = y - top < 2 || (y === bottom - 1 && x % 3 === 0);
          set(x, y, snowy ? PAL.white : x >= 8 ? PAL.greenDark : PAL.green);
        }
      }
    }
  });

  paint(scene, 'snowflake', 1, 1, (set) => set(0, 0, PAL.white));
}
