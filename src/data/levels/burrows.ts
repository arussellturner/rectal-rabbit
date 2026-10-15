import { burrow } from '../../level/LevelMap';

/*
 * Burrows: one screen each, underground. Draw the 12 rows inside; the dirt
 * ceiling, walls and floor are added for you. 'R' is where you drop in.
 * A row that ends with 'E' in its last (25th) spot opens an exit tunnel in
 * the right wall.
 * Inside a burrow:  d  packed dirt   S  stone   =  root ledge   c  carrot
 *
 * Levels share these; each level picks one per dirt pile.
 */

/** A big mound in the middle, root ledges either side. */
export const CELLAR = burrow([
  '',
  '.R',
  '',
  '..........c.c.c',
  '',
  '.........=======...c.c',
  '...................====',
  '...c.c',
  '..=====....ddd',
  '..........ddddd....c.c.c',
  '.c.......ddddddd........E',
  '.c.c.....ddddddd..c.c...E',
]);

/** Stone blocks and root ledges in a maze, carrots up high. */
export const ROOT_MAZE = burrow([
  '...........c.c.c',
  '.R........======',
  '',
  'SSSS....c.c.c.......c.c',
  '.......=======.....=====',
  '',
  '..c.c..........c.c',
  '.=====........=====',
  '..........c',
  '........SSSSS.......c.c.c',
  '.c.c.c..SSSSS...........E',
  '........SSSSS..c.c.c....E',
]);

/** Zig-zag down from the top left, then out along the floor. */
export const ZIGZAG = burrow([
  '',
  '.R',
  'dddddd...c.c.c',
  '......=========...c.c',
  '..................====',
  '.c.c',
  '=====.....c.c.c',
  '.........=======..c.c.c',
  '.................=======',
  '',
  '.c.c.c....c.c.c.........E',
  '....................c...E',
]);

/** A tall cave: stone shelves and root ledges stacked up to the ceiling. */
export const CAVERN = burrow([
  '..........c.c.c.c',
  '.R.......SSSSSSSSS',
  '',
  'SSS...............c.c.c',
  '....c.c.c.......SSSSSSS',
  '...==========',
  '',
  'c.c............c.c',
  '====..........======',
  '.......c.c.c',
  '.....=========..........E',
  '.c.c....................E',
]);
