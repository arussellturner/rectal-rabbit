import { LEVELS } from '../data/levels';
import { Progress } from './Progress';

/** The player's saved progress in this browser. */
export const progress = new Progress(typeof localStorage === 'undefined' ? null : localStorage, LEVELS.length);
