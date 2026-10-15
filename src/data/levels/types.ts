import type { World } from '../../level/LevelMap';
import type { SpawnerConfig } from '../../systems/LeopardSpawner';
import type { ThemeId } from '../themes';

export interface LevelDef {
  /** Shown on screen, e.g. "SNOWY RIDGE". */
  name: string;
  theme: ThemeId;
  world: World;
  /** Snow leopard speed, as a multiple of normal (1 = normal; the rabbit is still a bit faster at 1.1). */
  leopardSpeed: number;
  /** Changes to when leopards show up (see systems/LeopardSpawner.ts). */
  spawner?: Partial<SpawnerConfig>;
}

/** Every level is drawn in screens 32 tiles wide and 15 tall. */
export const ROWS = 15;
export const SCREEN = 32;
export const GROUND = '################################';
