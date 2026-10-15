import { CRYSTAL_CAVERNS } from './crystalCaverns';
import { DUNE_SEA } from './duneSea';
import { SNOWY_RIDGE } from './snowyRidge';
import type { LevelDef } from './types';
import { VINE_TEMPLE } from './vineTemple';
import { VOLCANO_PEAK } from './volcanoPeak';
import { WHISPERING_WOODS } from './whisperingWoods';

export type { LevelDef } from './types';

/** All the levels, in the order you play them. */
export const LEVELS: LevelDef[] = [SNOWY_RIDGE, WHISPERING_WOODS, DUNE_SEA, VINE_TEMPLE, CRYSTAL_CAVERNS, VOLCANO_PEAK];
