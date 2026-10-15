import { buildWorld, joinScreens } from '../../level/LevelMap';
import { CAVERN, ROOT_MAZE } from './burrows';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 3: Dune Sea. Hot sand, sandstone mesas, and quicksand pools ('~')
 * that swallow rabbits and leopards alike. 'S' is sandstone, 'X' a crate.
 */

// Screen 1: hop a crate up to a sandstone shelf; the first quicksand pool.
const screen1 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '................c',
  '',
  '..............SSSS',
  '',
  '',
  '..R...g....X..............g',
  '####################~~~~########',
  '####################~~~~########',
];

// Screen 2: up onto a flat-topped mesa; the first dirt pile past it.
const screen2 = [
  '',
  '',
  '',
  '',
  '',
  '..........c',
  '',
  '',
  '',
  '........g',
  '......##########',
  '......##########',
  '...X..##########......D',
  '##########################~~~###',
  '##########################~~~###',
];

// Screen 3: checkpoint, sandstone pillars across a quicksand basin, the first exit hole.
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
  '...........S...S',
  '..F.g......S...S............O',
  '########~~~~~~~~~~##############',
  '########~~~~~~~~~~##############',
];

// Screen 4: sandstone steps up to a high carrot; the second dirt pile.
const screen4 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '.........c',
  '',
  '........SSS',
  '',
  '....SSS',
  '',
  '..................g.......D',
  GROUND,
  GROUND,
];

// Screen 5: checkpoint, then the long quicksand crossing on logs and a floating crate.
const screen5 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '',
  '..............XX',
  '........====......===',
  '',
  '..F..........................O',
  '######~~~~~~~~~~~~~~############',
  '######~~~~~~~~~~~~~~############',
];

// Screen 6: home past the cacti.
const screen6 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.....c.....c.....c',
  '',
  '',
  '..........XX',
  '...g......XX......g.......H',
  GROUND,
  GROUND,
];

export const DUNE_SEA: LevelDef = {
  name: 'DUNE SEA',
  theme: 'desert',
  leopardSpeed: 1.03,
  spawner: { earlyInterval: [6, 8.5], lateInterval: [3.5, 5] },
  world: buildWorld(joinScreens(ROWS, SCREEN, [screen1, screen2, screen3, screen4, screen5, screen6]), [CAVERN, ROOT_MAZE]),
};
