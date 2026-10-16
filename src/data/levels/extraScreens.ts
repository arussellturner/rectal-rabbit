import { GROUND } from './types';

/**
 * Screen layouts that several levels share, to make levels longer. Each is a
 * function so a level can choose what fills the pits ('.' for a drop, '~'
 * for its water / quicksand / lava), whether there's a cave ceiling, and
 * whether there's a checkpoint flag.
 */
interface Options {
  /** What's in the pit: '.' = a drop, '~' = this world's water / quicksand / lava. */
  pit?: '.' | '~';
  /** Rock ceiling across the top two rows (for the cave level). */
  ceiling?: boolean;
  /** A checkpoint flag at the start of the screen. */
  flag?: boolean;
}

function top(o: Options): string[] {
  return o.ceiling ? [GROUND, GROUND] : ['', ''];
}

function bottom(row: string, o: Options): string[] {
  const r = row.replace(/~/g, o.pit ?? '.');
  return [r, r];
}

/** Steps up blocks to a high ledge with a carrot, then a short pit. */
export function steps(o: Options = {}): string[] {
  return [
    ...top(o),
    '',
    '',
    '',
    '.................c',
    '',
    '',
    '..............SSSSS',
    '',
    '..........XX',
    '......XX..XX',
    `..${o.flag ? 'F' : 'g'}...XX..XX..............g`,
    ...bottom('######################~~~~######', o),
  ];
}

/** Two log bridges across a wide gap, a carrot over each. */
export function bridges(o: Options = {}): string[] {
  return [
    ...top(o),
    '',
    '',
    '',
    '',
    '..........c.......c',
    '',
    '',
    '',
    '........=====...=====',
    '',
    `..${o.flag ? 'F' : '.'}g........................g`,
    ...bottom('######~~~~~~~~~~~~~~~~~~########', o),
  ];
}

/** A plateau, a high stone roof to climb onto, and a carrot up top. */
export function roof(o: Options = {}): string[] {
  return [
    ...top(o),
    '',
    '',
    '..............c',
    '',
    '',
    '',
    '...........SSSSSSS',
    '',
    '...#####',
    '...#####',
    `.${o.flag ? 'F' : '.'}.#####.................g`,
    ...bottom(GROUND, o),
  ];
}

/** Hop along pillars of different heights. */
export function pillars(o: Options = {}): string[] {
  return [
    ...top(o),
    '',
    '',
    '',
    '',
    '............c',
    '',
    '',
    '............X',
    '........X...X...X',
    '....X...X...X...X',
    `.${o.flag ? 'F' : '.'}g.X...X...X...X.......g`,
    ...bottom(GROUND, o),
  ];
}
