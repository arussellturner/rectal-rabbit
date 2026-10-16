import { buildWorld, joinScreens } from '../../level/LevelMap';
import { ROOT_MAZE, ZIGZAG } from './burrows';
import { bridges, roof } from './extraScreens';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 4: Vine Temple. Steamy jungle ruins: swing across swamps ('~') on
 * vines ('='), climb temple blocks ('X') and mossy ledges ('S').
 */

// Screen 1: up the ruined steps to a high mossy ledge.
const screen1 = [
  '',
  '',
  '',
  '',
  '',
  '.................c',
  '',
  '...............SSSSS',
  '',
  '............X',
  '............X',
  '.........X..X',
  '..R..g...X..X..........g',
  '#########################~~~~###',
  '#########################~~~~###',
];

// Screen 2: vines over the swamp, then the first dirt pile.
const screen2 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '.........c',
  '',
  '',
  '...........======',
  '...======',
  '',
  '......................D.....g..O',
  '####~~~~~~~~~~~~################',
  '####~~~~~~~~~~~~################',
];

// Screen 3: checkpoint, over the stepped temple, the first exit hole.
const screen3 = [
  '',
  '',
  '',
  '',
  '.............c',
  '',
  '',
  '',
  '............g',
  '...........XXXX',
  '..........XXXXXX',
  '.........XXXXXXXX',
  '..F.....XXXXXXXXXX',
  GROUND,
  GROUND,
];

// Screen 4: across the canopy above a long swamp; the second dirt pile.
const screen4 = [
  '',
  '',
  '',
  '',
  '',
  '.............c',
  '',
  '',
  '............SSS',
  '',
  '.......SSS.......SSS',
  '',
  '...........................D',
  '######~~~~~~~~~~~~~~~~##########',
  '######~~~~~~~~~~~~~~~~##########',
];

// Screen 5: checkpoint, over a temple wall, the second exit hole.
const screen5 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '............c',
  '',
  '',
  '............XX',
  '............XX',
  '............XX',
  '..F..g.O..X.XX',
  GROUND,
  GROUND,
];

// Screen 6: home, one last little swamp.
const screen6 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.........c.c',
  '',
  '',
  '',
  '...g.................g....H',
  '########~~~#####################',
  '########~~~#####################',
];

export const VINE_TEMPLE: LevelDef = {
  name: 'VINE TEMPLE',
  theme: 'jungle',
  leopardSpeed: 1.05,
  spawner: { earlyInterval: [5.5, 8], lateInterval: [3, 5], maxLate: 3 },
  world: buildWorld(joinScreens(ROWS, SCREEN, [
    screen1,
    screen2,
    roof(),
    screen3,
    screen4,
    screen5,
    bridges({ pit: '~', flag: true }),
    screen6,
  ]), [ROOT_MAZE, ZIGZAG]),
};
