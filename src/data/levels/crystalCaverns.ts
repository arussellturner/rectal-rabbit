import { buildWorld, joinScreens } from '../../level/LevelMap';
import { CAVERN, CELLAR } from './burrows';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 5: Crystal Caverns. Underground, with a rock ceiling overhead (watch
 * your head!), icy pools ('~'), crystal ledges ('S') and ice blocks ('X').
 */

// Screen 1: ice step up to a crystal shelf.
const screen1 = [
  GROUND,
  GROUND,
  '..........##.........###',
  '...........#..........#',
  '',
  '',
  '',
  '...............c',
  '',
  '.............SSSS',
  '',
  '..........X',
  '..R..g....X............g',
  '##########################~~~###',
  '##########################~~~###',
];

// Screen 2: a low tunnel past an icy pool; the first dirt pile.
const screen2 = [
  GROUND,
  GROUND,
  '######......................####',
  '######',
  '######',
  '',
  '',
  '',
  '..........c',
  '',
  '',
  '',
  '....g.................D',
  '########~~~~~###################',
  '########~~~~~###################',
];

// Screen 3: checkpoint, up the ice and crystal steps in a big cavern, the first exit hole.
const screen3 = [
  GROUND,
  GROUND,
  '',
  '....................c',
  '',
  '...................SSS',
  '',
  '',
  '.............SSSS',
  '',
  '..........X',
  '.........XX',
  '..F.g...XXX.................O',
  '######################~~~#######',
  '######################~~~#######',
];

// Screen 4: stalactites overhead, ice bridges over a pool; the second dirt pile.
const screen4 = [
  GROUND,
  GROUND,
  '....##.....###......##',
  '....##......#.......#',
  '.....#',
  '',
  '',
  '...............c',
  '',
  '',
  '........====......====',
  '..............XX',
  '..g.......................D',
  '############~~~~~~##############',
  '############~~~~~~##############',
];

// Screen 5: checkpoint, frozen-waterfall pillars, the second exit hole.
const screen5 = [
  GROUND,
  GROUND,
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '..............X',
  '..............X',
  '.........X....X',
  '.........X....X',
  '..F..g...X....X...........O',
  GROUND,
  GROUND,
];

// Screen 6: home, deep in the caves.
const screen6 = [
  GROUND,
  GROUND,
  '',
  '',
  '',
  '',
  '',
  '',
  '......c.....c',
  '',
  '',
  '',
  '...g..........g...........H',
  GROUND,
  GROUND,
];

export const CRYSTAL_CAVERNS: LevelDef = {
  name: 'CRYSTAL CAVERNS',
  theme: 'cave',
  leopardSpeed: 1.07,
  spawner: { earlyInterval: [5, 7.5], lateInterval: [3, 4.5], maxLate: 3 },
  world: buildWorld(joinScreens(ROWS, SCREEN, [screen1, screen2, screen3, screen4, screen5, screen6]), [CAVERN, CELLAR]),
};
