import Phaser from 'phaser';
import type { Theme } from '../data/themes';
import { hash, makeHome, paint, TILE_VARIANTS } from './pixelTextures';

/**
 * Texture names for one theme's art, e.g. themeKey('desert', 'ledge') →
 * 'desert-ledge'. Made by makeThemeTextures.
 */
export function themeKey(theme: Theme | string, part: string): string {
  return `${typeof theme === 'string' ? theme : theme.id}-${part}`;
}

/** Paint every tile and bit of scenery for one theme, in its colors. */
export function makeThemeTextures(scene: Phaser.Scene, t: Theme): void {
  const k = (part: string) => themeKey(t, part);

  // --- Ground: speckled earth with pebbles and a root. ---
  for (let v = 0; v < TILE_VARIANTS; v++) {
    paint(scene, k(`ground-${v}`), 16, 16, (set) => {
      const [base, light, dark] = t.ground;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = hash(x, y, v);
          set(x, y, n < 0.12 ? dark : n > 0.9 ? light : base);
        }
      }
      const [pl, pm, pd] = t.pebbles;
      for (let i = 0; i < 2; i++) {
        const px = Math.floor(hash(i, v, 7) * 13) + 1;
        const py = Math.floor(hash(v, i, 9) * 13) + 1;
        set(px, py, pl);
        set(px + 1, py, pm);
        set(px, py + 1, pm);
        set(px + 1, py + 1, pd);
      }
      const rx = Math.floor(hash(v, 3, 11) * 10) + 2;
      for (let y = 0; y < 5; y++) set(rx + (y >> 1), 9 + y, t.root);
    });
  }

  // --- The cap on open ground: 16 × 7, drawn a little above the tile top. ---
  paint(scene, k('cap'), 16, 7, (set) => {
    const { main, shade, style } = t.cap;
    for (let x = 0; x < 16; x++) {
      if (style === 'drift') {
        const h = [4, 3, 3, 4, 5, 4, 3, 3, 4, 5, 5, 4, 3, 4, 4, 3][x];
        for (let y = 0; y < h; y++) set(x, y + 2, y === h - 1 ? shade : main);
      } else if (style === 'grass') {
        // A fringe of grass with blades poking up.
        for (let y = 3; y < 6; y++) set(x, y, y === 5 ? shade : main);
        if (x % 3 === 0) set(x, 2, main);
        if (x % 5 === 1) {
          set(x, 1, main);
          set(x, 2, main);
        }
        if (x % 4 === 2) set(x, 6, shade); // drips down the side
      } else if (style === 'sand') {
        const h = 3 + Math.round(Math.sin(x * 0.7) * 0.8);
        for (let y = 0; y < h; y++) set(x, 6 - h + y + 1, y === 0 ? main : shade);
      } else {
        // A jagged crust (ice crystals, cooled ash).
        const h = 2 + ((x * 5) % 3);
        for (let y = 0; y < h; y++) set(x, 6 - h + y, y === 0 ? main : shade);
      }
    }
  });

  // --- 'S' ledges: chunky rock with cracks and an accent creeping down. ---
  paint(scene, k('ledge'), 16, 16, (set) => {
    const { base, light, dark, accent } = t.ledge;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let c = base;
        if (y >= 13 || x === 15) c = dark;
        else if (y <= 1 || x === 0) c = light;
        else if (hash(x, y, 21) < 0.08) c = light;
        set(x, y, c);
      }
    }
    for (const [x, y] of [[5, 3], [6, 4], [6, 5], [7, 6], [11, 8], [12, 9], [12, 10], [3, 10], [4, 11]]) set(x, y, dark);
    for (const [x, y] of [[2, 2], [3, 2], [3, 3], [9, 2], [10, 2], [13, 2], [13, 3]]) set(x, y, accent);
  });

  // --- 'X' blocks. ---
  paint(scene, k('block'), 16, 16, (set) => {
    const { style, base, light, dark, edge, shine } = t.block;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let c = base;
        if (x === 0 || y === 0 || x === 15 || y === 15) c = edge;
        else if (x >= 13 || y >= 13) c = dark;
        else if (x <= 2 || y <= 2) c = light;
        else if (style === 'bevel' && (x + y === 12 || x + y === 13)) c = shine;
        else if (style === 'crate' && (x === y || x + y === 15 || x === y + 1 || x + y === 14)) c = dark;
        else if (style === 'carved' && ((x >= 5 && x <= 10 && (y === 5 || y === 10)) || (y >= 5 && y <= 10 && (x === 5 || x === 10)))) {
          c = dark;
        } else if (style === 'carved' && x >= 7 && x <= 8 && y >= 7 && y <= 8) c = shine;
        set(x, y, c);
      }
    }
  });

  // --- '=' one-way bridges: 16 × 6. ---
  paint(scene, k('bridge'), 16, 6, (set) => {
    const { style, top, base, dark } = t.bridge;
    for (let x = 0; x < 16; x++) {
      if (style === 'vine') {
        const sag = Math.round(Math.sin((x / 16) * Math.PI) * 1);
        set(x, 1 + sag, top);
        set(x, 2 + sag, base);
        set(x, 3 + sag, dark);
        if (x % 4 === 1) set(x, 0 + sag, top); // leaves
        if (x % 5 === 3) set(x, 4 + sag, base);
      } else {
        set(x, 0, top);
        for (let y = 1; y <= 3; y++) set(x, y, (x * 7 + y * 3) % 11 === 0 ? dark : base);
        set(x, 4, dark);
        set(x, 5, '#000000');
      }
    }
    if (style === 'log') for (const x of [0, 8]) for (let y = 0; y < 6; y++) set(x, y, dark);
  });

  // --- '~' water / quicksand / lava: 16 × 16 with a wavy top. ---
  paint(scene, k('liquid'), 16, 16, (set) => {
    const { top, base, deep } = t.liquid;
    for (let x = 0; x < 16; x++) {
      const wave = Math.round(Math.sin((x / 16) * Math.PI * 2) * 1) + 3;
      for (let y = wave; y < 16; y++) {
        let c = base;
        if (y === wave) c = top;
        else if (y > 9 && hash(x, y, 55) < 0.25) c = deep;
        else if (hash(x, y, 56) < 0.05) c = top;
        set(x, y, c);
      }
    }
  });

  // --- Grass tufts: grass-3 (full) down to grass-0 (stubble). ---
  const blades: [number, number, number][] = [
    [7, 11, 0], [4, 9, -1], [10, 10, 1], [2, 6, -1], [13, 7, 1], [5, 7, 0], [9, 8, 0], [12, 5, 1], [1, 4, 0],
  ];
  for (let bites = 0; bites <= 3; bites++) {
    paint(scene, k(`grass-${bites}`), 16, 12, (set) => {
      const growth = bites === 0 ? 0.2 : 0.35 + 0.65 * (bites / 3);
      const count = bites === 0 ? blades.length : 3 + bites * 2;
      blades.slice(0, count).forEach(([x, h, lean], i) => {
        const height = Math.max(1, Math.round(h * growth));
        for (let y = 0; y < height; y++) {
          const bend = y > height * 0.6 ? lean : 0;
          set(x + bend, 11 - y, t.grass[i % 3]);
        }
      });
    });
  }

  // Home, covered in this world's cap (snow, grass, sand...).
  makeHome(scene, k('home'), t.cap.main, t.cap.shade, t.ground[2]);

  makeScenery(scene, t);
  makeWeather(scene, t);
}

/** Far scenery, closer silhouettes, ground decorations and clouds. */
function makeScenery(scene: Phaser.Scene, t: Theme): void {
  const k = (part: string) => themeKey(t, part);
  const f = t.far;

  if (f.kind === 'peaks' || f.kind === 'volcano') {
    paint(scene, k('far'), 80, 48, (set) => {
      for (let y = 0; y < 48; y++) {
        const crater = f.kind === 'volcano' ? 6 : 0;
        const half = Math.round((y + 1) * (40 / 48)) + crater;
        const capLine = f.kind === 'volcano' ? 3 : 14 + ((y * 7) % 3);
        for (let x = 40 - half; x < 40 + half; x++) {
          const right = x >= 40;
          let c = right ? f.shade : f.color;
          if (y < capLine + Math.round(Math.sin(x * 0.9) * 2)) c = right ? f.capShade : f.cap;
          // Lava streaks running down a volcano.
          if (f.kind === 'volcano' && y > 3 && (x === 34 + Math.round(y / 6) || x === 47 - Math.round(y / 8)) && y < 30) {
            c = f.capShade;
          }
          set(x, y, c);
        }
      }
    });
  } else if (f.kind === 'dunes') {
    paint(scene, k('far'), 96, 24, (set) => {
      for (let x = 0; x < 96; x++) {
        const h = Math.round(12 + Math.sin((x / 96) * Math.PI * 2) * 6 + Math.sin((x / 96) * Math.PI * 6) * 3);
        for (let y = 24 - h; y < 24; y++) set(x, y, y === 24 - h ? f.cap : x % 32 > 16 ? f.shade : f.color);
      }
    });
  }

  // Closer silhouettes, 64 wide; they tile side by side.
  const m = t.mid;
  if (m.kind === 'stalactites') {
    paint(scene, k('mid'), 64, 40, (set) => {
      const spikes = [[4, 30], [12, 18], [20, 36], [29, 22], [37, 14], [45, 32], [53, 20], [60, 26]];
      for (const [cx, h] of spikes) {
        for (let y = 0; y < h; y++) {
          const half = Math.max(0, Math.round((1 - y / h) * 4));
          for (let x = cx - half; x <= cx + half; x++) set(((x % 64) + 64) % 64, y, m.color);
        }
      }
      for (let x = 0; x < 64; x++) for (let y = 0; y < 4; y++) set(x, y, m.color);
    });
  } else {
    paint(scene, k('mid'), 64, 28, (set) => {
      const fill = (x: number, y: number) => set(((x % 64) + 64) % 64, y, m.color);
      if (m.kind === 'pines') {
        for (const [cx, h] of [[4, 16], [11, 20], [18, 14], [26, 22], [33, 17], [40, 21], [47, 15], [55, 19], [61, 16]]) {
          for (let y = 28 - h; y < 28; y++) {
            const half = Math.max(1, Math.round(((y - (28 - h)) / h) * 4.5));
            for (let x = cx - half; x <= cx + half; x++) fill(x, y);
          }
        }
      } else if (m.kind === 'oaks' || m.kind === 'canopy') {
        const trees = m.kind === 'oaks' ? [[6, 14, 6], [20, 18, 7], [34, 12, 5], [46, 17, 7], [58, 13, 6]] : [[4, 20, 9], [18, 24, 10], [32, 19, 9], [46, 25, 11], [60, 21, 9]];
        for (const [cx, top, r] of trees) {
          for (let y = 0; y < 28; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
              if (Math.hypot(x - cx, y - (28 - top)) <= r) fill(x, y);
            }
          }
          for (let y = 28 - top; y < 28; y++) fill(cx, y);
        }
      } else if (m.kind === 'mesas') {
        for (const [from, to, h] of [[2, 20, 14], [26, 38, 20], [44, 60, 11]]) {
          for (let y = 28 - h; y < 28; y++) {
            const slope = Math.round((y - (28 - h)) * 0.4);
            for (let x = from - slope; x <= to + slope; x++) fill(x, y);
          }
        }
      } else {
        // Crags: jagged rocks.
        for (let x = 0; x < 64; x++) {
          const h = 8 + Math.abs(((x * 7) % 13) - 6) + (x % 16 < 4 ? 6 : 0);
          for (let y = 28 - h; y < 28; y++) fill(x, y);
        }
      }
      for (let x = 0; x < 64; x++) for (let y = 24; y < 28; y++) fill(x, y);
    });
  }

  makeDeco(scene, t);

  if (t.clouds) {
    const { main, shade } = t.clouds;
    paint(scene, k('cloud'), 48, 6, (set) => {
      const rows: [number, number, number][] = [[14, 30, 0], [6, 40, 1], [0, 46, 2], [8, 44, 3], [18, 36, 4]];
      for (const [from, to, y] of rows) for (let x = from; x < to; x++) set(x, y, y >= 3 ? shade : main);
    });
  }
}

/** Things that stand on the ground: trees, cacti, crystals. */
function makeDeco(scene: Phaser.Scene, t: Theme): void {
  const key = themeKey(t, 'deco');
  const trunk = '#503000';
  switch (t.deco) {
    case 'pine':
      paint(scene, key, 16, 32, (set) => {
        for (let y = 26; y < 32; y++) for (let x = 7; x < 9; x++) set(x, y, trunk);
        for (const [top, bottom] of [[0, 10], [7, 18], [14, 26]]) {
          for (let y = top; y < bottom; y++) {
            const half = Math.round(((y - top + 1) / (bottom - top)) * 7.5) + (top > 0 ? 1 : 0);
            for (let x = 8 - half; x < 8 + half; x++) {
              const snowy = y - top < 2 || (y === bottom - 1 && x % 3 === 0);
              set(x, y, snowy ? '#fcfcfc' : x >= 8 ? '#005800' : '#00a800');
            }
          }
        }
      });
      break;
    case 'oak':
      paint(scene, key, 24, 32, (set) => {
        for (let y = 18; y < 32; y++) for (let x = 11; x < 14; x++) set(x, y, y > 28 && (x === 10 || x === 14) ? trunk : trunk);
        for (const [cx, cy, r] of [[12, 10, 9], [6, 14, 5], [18, 13, 6]]) {
          for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 24; x++) {
              const d = Math.hypot(x - cx, y - cy);
              if (d <= r) set(x, y, d > r - 1.5 || x > cx + 2 ? '#2c7c1c' : hash(x, y, 3) < 0.15 ? '#7cd04c' : '#3c9c1c');
            }
          }
        }
        for (const [x, y] of [[9, 7], [15, 9], [7, 13], [17, 15]]) set(x, y, '#f87858'); // apples
      });
      break;
    case 'cactus':
      paint(scene, key, 16, 28, (set) => {
        const g = '#3c8c3c';
        const d = '#1c5c24';
        for (let y = 2; y < 28; y++) for (let x = 6; x < 10; x++) set(x, y, x === 9 ? d : g);
        for (let y = 10; y < 16; y++) for (let x = 1; x < 4; x++) set(x, y, g);
        for (let x = 1; x < 7; x++) for (let y = 15; y < 18; y++) set(x, y, g);
        for (let y = 6; y < 13; y++) for (let x = 12; x < 15; x++) set(x, y, d);
        for (let x = 9; x < 15; x++) for (let y = 12; y < 15; y++) set(x, y, d);
        for (let y = 2; y < 4; y++) for (let x = 6; x < 10; x++) set(x, y, g);
        set(7, 1, '#f878b8'); // a flower
        set(8, 1, '#f878b8');
      });
      break;
    case 'palm':
      paint(scene, key, 32, 40, (set) => {
        for (let y = 10; y < 40; y++) {
          const x = 15 + Math.round(Math.sin(y / 9) * 2);
          set(x, y, y % 3 === 0 ? '#5c3a10' : '#8c5c24');
          set(x + 1, y, '#5c3a10');
        }
        const leaves: [number, number][] = [[-1, -0.3], [1, -0.3], [-1, 0.5], [1, 0.5], [-0.4, -1], [0.4, -1]];
        for (const [dx, dy] of leaves) {
          for (let i = 0; i < 14; i++) {
            const x = 16 + Math.round(dx * i);
            const y = 10 + Math.round(dy * i + (i * i) / 30);
            set(x, y, '#1c8c2c');
            set(x, y + 1, '#0c5c14');
          }
        }
        set(15, 11, '#8c5c24');
        set(17, 12, '#8c5c24'); // coconuts
      });
      break;
    case 'crystal':
      paint(scene, key, 20, 24, (set) => {
        const shards: [number, number, number, string, string][] = [
          [10, 0, 3, '#fcb4fc', '#b48cec'],
          [5, 8, 2, '#a4e4fc', '#3cbcfc'],
          [15, 6, 2, '#a4e4fc', '#3cbcfc'],
        ];
        for (const [cx, top, half, light, dark] of shards) {
          for (let y = top; y < 24; y++) {
            const w = Math.min(half, Math.round((y - top) / 2));
            for (let x = cx - w; x <= cx + w; x++) set(x, y, x < cx ? light : dark);
          }
        }
      });
      break;
    case 'deadtree':
      paint(scene, key, 20, 30, (set) => {
        const c = '#1c1414';
        for (let y = 6; y < 30; y++) set(10, y, c), set(11, y, c);
        const branches: [number, number, number, number][] = [[10, 14, -1, -1], [11, 10, 1, -1], [10, 20, -1, -0.5], [11, 18, 1, -0.7]];
        for (const [bx, by, dx, dy] of branches) for (let i = 0; i < 7; i++) set(bx + Math.round(dx * i), by + Math.round(dy * i), c);
      });
      break;
  }
}

/** Little particles for falling snow, leaves, sand, drips or embers. */
function makeWeather(scene: Phaser.Scene, t: Theme): void {
  const key = themeKey(t, 'weather');
  const colors: Record<Theme['weather'], string[]> = {
    snow: ['#fcfcfc'],
    leaves: t.id === 'jungle' ? ['#5cd04c', '#2c8c2c'] : ['#f87800', '#fca044'],
    sand: ['#fce4b0'],
    drips: ['#a4e4fc', '#3cbcfc'],
    embers: ['#fce048', '#f87800'],
  };
  const c = colors[t.weather];
  const size = t.weather === 'leaves' ? [2, 2] : t.weather === 'drips' ? [1, 2] : [1, 1];
  paint(scene, key, size[0], size[1], (set) => {
    for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) set(x, y, c[(x + y) % c.length]);
  });
}
