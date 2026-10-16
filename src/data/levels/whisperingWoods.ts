import { buildWorld, joinScreens } from '../../level/LevelMap';
import { CELLAR, ZIGZAG } from './burrows';
import { roof, steps } from './extraScreens';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 2: Whispering Woods. A leafy forest with a winding river, stacked
 * crates, and log bridges. Same letters as Snowy Ridge (see LEGEND in
 * src/level/LevelMap.ts); here 'X' is a wooden crate and '~' is the river.
 */

// Screen 1: over the river on a log, then a crate to hop.
const screen1 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '...................c',
  '',
  '',
  '.................=====',
  '........XX',
  '..R...g.XX...........g......XX',
  '##############~~~~~~############',
  '##############~~~~~~############',
];

// Screen 2: a grassy hill, a mossy ledge with a carrot, and the first dirt pile.
const screen2 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '.........c',
  '',
  '.......SSSSS',
  '',
  '........g',
  '.....##########',
  '.....##########....D.......g..O',
  GROUND,
  GROUND,
];

// Screen 3: checkpoint, stepping stones across the wide river, the first exit hole.
const screen3 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.............c',
  '',
  '',
  '',
  '..F.g......S....S',
  '########~~~~~~~~~~~~############',
  '########~~~~~~~~~~~~############',
];

// Screen 4: up a tower of crates to a log bridge in the treetops; the second dirt pile.
const screen4 = [
  '',
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '',
  '............=====',
  '........XX',
  '........XX',
  '....XX..XX',
  '....XX..XX..........g.....D',
  GROUND,
  GROUND,
];

// Screen 5: checkpoint, a log over the river, up a hill to the second exit hole.
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
  '',
  '.........========...g',
  '..................######',
  '..F..gO...........######',
  '##########~~~~~~################',
  '##########~~~~~~################',
];

// Screen 6: home through the trees.
const screen6 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '......c...c...c',
  '',
  '',
  '...........XX',
  '...g.......XX......g......H',
  GROUND,
  GROUND,
];

export const WHISPERING_WOODS: LevelDef = {
  name: 'WHISPERING WOODS',
  theme: 'forest',
  special: 'fox',
  leopardSpeed: 1,
  spawner: { earlyInterval: [6.5, 9], lateInterval: [3.5, 5.5] },
  world: buildWorld(joinScreens(ROWS, SCREEN, [
    screen1,
    screen2,
    screen3,
    steps({ pit: '~' }),
    screen4,
    screen5,
    roof({ flag: true }),
    screen6,
  ]), [ZIGZAG, CELLAR]),
};
