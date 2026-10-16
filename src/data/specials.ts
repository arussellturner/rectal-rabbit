import { FOX, ICE_WOLF, SNAKE, STOAT, type ChaserConfig } from './chasers';
import { GOLDEN_EAGLE, HAWK, type FlyerConfig } from './flyers';

/**
 * Each level's special predator, which comes at you from the FRONT (the
 * snow leopards keep coming from behind). Art: Marshall's turnerm5/rectal-rabbit.
 */
export type Special =
  | { type: 'ground'; cfg: ChaserConfig; plural: string }
  | { type: 'flyer'; cfg: FlyerConfig; plural: string };

export const SPECIALS = {
  stoat: { type: 'ground', cfg: STOAT, plural: 'STOATS' },
  fox: { type: 'ground', cfg: FOX, plural: 'FOXES' },
  snake: { type: 'ground', cfg: SNAKE, plural: 'SNAKES' },
  hawk: { type: 'flyer', cfg: HAWK, plural: 'HAWKS' },
  iceWolf: { type: 'ground', cfg: ICE_WOLF, plural: 'ICE WOLVES' },
  goldenEagle: { type: 'flyer', cfg: GOLDEN_EAGLE, plural: 'GOLDEN EAGLES' },
} satisfies Record<string, Special>;

export type SpecialId = keyof typeof SPECIALS;
