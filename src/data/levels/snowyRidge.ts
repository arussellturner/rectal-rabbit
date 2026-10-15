import { buildWorld, joinScreens } from '../../level/LevelMap';
import { CELLAR, ROOT_MAZE } from './burrows';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 1: Snowy Ridge.
 *
 * The level is drawn in text, one screen (32 tiles wide) at a time, glued
 * together left to right. Rows are 0 (top of the sky) to 14 (bottom).
 * Short rows are filled out with '.' automatically, so you only need to type
 * up to the last thing in a row.
 *
 * What the letters mean is in LEGEND in src/level/LevelMap.ts:
 *   #  ground     S  stone ledge     X  ice block     =  log bridge
 *   g  grass      c  carrot in a bubble
 *   D  dirt pile (dig down into a burrow)     O  where you pop back out
 *   R  start      F  checkpoint      H  home (finish)
 *
 * Dirt piles, burrows and exit holes go together in order: the 1st D leads
 * into the 1st burrow below, which comes out at the 1st O.
 *
 * Handy numbers: the rabbit jumps about 4 tiles high and 6 tiles across.
 * The snow leopards jump about 4 high and 5 across.
 */

// Screen 1: rolling ridge. Learn to eat; a carrot bubble over a stone ledge.
const screen1 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '.....................c',
  '',
  '....................SSSS',
  '',
  '.............g',
  '..........########.........g',
  '..R...g...########.......######',
  GROUND,
  GROUND,
];

// Screen 2: a log bridge over the first ravine, then the first dirt pile.
const screen2 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '...........c',
  '',
  '',
  '........................g',
  '.......========.........XX',
  '........................XX',
  '.....g............D.....XX',
  '########......##################',
  '########......##################',
];

// Screen 3: up the plateau, stone steps to a high carrot, then the first exit hole.
const screen3 = [
  '',
  '',
  '',
  '................c',
  '',
  '...............SSS',
  '',
  '...........g',
  '..........SSSS',
  '',
  '',
  '......##########',
  '......##########..g.........O',
  '######################...#######',
  '######################...#######',
];

// Screen 4: checkpoint, then a wide ravine crossed on ice and logs.
const screen4 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '.............====',
  '',
  '.........XX.......XX',
  '',
  '..F..g.....................g',
  '########............############',
  '########............############',
];

// Screen 5: a stone shelter with the second dirt pile under it, then the climb.
const screen5 = [
  '',
  '',
  '',
  '',
  '',
  '........c',
  '',
  '',
  '.......g',
  '....SSSSSSSS..............g',
  '..........................######',
  '......................##########',
  '........D.........##############',
  GROUND,
  GROUND,
];

// Screen 6: checkpoint on the plateau, off the cliff, over a stone ledge, out of the second burrow.
const screen6 = [
  '',
  '',
  '',
  '',
  '',
  '.............c',
  '',
  '',
  '',
  '..F.g......SSSSS',
  '######',
  '######......................XX',
  '######..................O...XX',
  '############...#################',
  '############...#################',
];

// Screen 7: the home stretch, with a row of carrot bubbles.
const screen7 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.......c...c...c',
  '',
  '',
  '',
  '...g..........g...........H',
  GROUND,
  GROUND,
];

export const SNOWY_RIDGE: LevelDef = {
  name: 'SNOWY RIDGE',
  theme: 'snow',
  leopardSpeed: 1,
  world: buildWorld(joinScreens(ROWS, SCREEN, [screen1, screen2, screen3, screen4, screen5, screen6, screen7]), [
    CELLAR,
    ROOT_MAZE,
  ]),
};
