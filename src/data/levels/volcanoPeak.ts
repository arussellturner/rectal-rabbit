import { buildWorld, joinScreens } from '../../level/LevelMap';
import { CAVERN, ZIGZAG } from './burrows';
import { bridges, steps } from './extraScreens';
import { GROUND, ROWS, SCREEN, type LevelDef } from './types';

/**
 * Level 6: Volcano Peak. The last and hardest: lava ('~') everywhere,
 * obsidian ledges ('S') and cooled-rock blocks ('X'), and faster leopards.
 */

// Screen 1: up a rock step to an obsidian ledge; a lava pit.
const screen1 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '............SSSS',
  '',
  '.........X',
  '.........X',
  '..R..g...X..................g',
  '######################~~~~######',
  '######################~~~~######',
];

// Screen 2: rock pillars across a lava river; the first dirt pile.
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
  '',
  '...........X',
  '.......X...X...X',
  '.......X...X...X......D.......O',
  '####~~~~~~~~~~~~~~##############',
  '####~~~~~~~~~~~~~~##############',
];

// Screen 3: checkpoint, a high rocky plateau, the first exit hole.
const screen3 = [
  '',
  '',
  '',
  '',
  '',
  '..............c',
  '',
  '',
  '',
  '...........g',
  '........#############',
  '........#############',
  '..F...X.#############',
  GROUND,
  GROUND,
];

// Screen 4: obsidian stepping stones over a lava lake; the second dirt pile.
const screen4 = [
  '',
  '',
  '',
  '',
  '',
  '...........c',
  '',
  '',
  '..........SSS',
  '....................SSS',
  '.....SSS.......SSS',
  '',
  '...........................D',
  '####~~~~~~~~~~~~~~~~~~~~########',
  '####~~~~~~~~~~~~~~~~~~~~########',
];

// Screen 5: checkpoint, a rock staircase, a ledge over lava, the second exit hole.
const screen5 = [
  '',
  '',
  '',
  '',
  '',
  '',
  '................c',
  '',
  '',
  '...............SSS',
  '...........XX',
  '.........XXXX',
  '..F.O...XXXXX',
  '##############~~~~~#############',
  '##############~~~~~#############',
];

// Screen 6: home, at the top of the volcano.
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
  '',
  '...g..............g.......H',
  '##########~~~###################',
  '##########~~~###################',
];

export const VOLCANO_PEAK: LevelDef = {
  name: 'VOLCANO PEAK',
  theme: 'volcano',
  leopardSpeed: 1.1,
  spawner: { earlyInterval: [4.5, 7], lateInterval: [2.5, 4], maxEarly: 2, maxLate: 3 },
  world: buildWorld(joinScreens(ROWS, SCREEN, [
    screen1,
    screen2,
    screen3,
    steps({ pit: '~' }),
    screen4,
    screen5,
    bridges({ pit: '~', flag: true }),
    screen6,
  ]), [ZIGZAG, CAVERN]),
};
