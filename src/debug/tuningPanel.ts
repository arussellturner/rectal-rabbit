import GUI from 'lil-gui';
import {
  DEFAULT_POOP_TUNING,
  DEFAULT_TUNING,
  POOP_TUNING,
  TUNING,
  type MotorTuning,
  type PoopTuning,
} from '../entities/tuning';

/** [min, max, step] for each number slider; `null` for checkboxes. */
type Ranges<T> = { [K in keyof T]: T[K] extends number ? [number, number, number] : null };

const MOTOR_RANGES: Ranges<MotorTuning> = {
  runSpeed: [100, 600, 10],
  groundAccel: [200, 6000, 100],
  groundDecel: [200, 6000, 100],
  airAccel: [100, 4000, 50],
  airDecel: [0, 3000, 50],
  turnMultiplier: [1, 4, 0.1],
  jumpVelocity: [300, 1200, 10],
  jumpCutMultiplier: [0, 1, 0.05],
  gravity: [400, 4000, 50],
  fallGravityMultiplier: [1, 3, 0.05],
  maxFallSpeed: [300, 2000, 25],
  coyoteTime: [0, 0.3, 0.01],
  jumpBuffer: [0, 0.3, 0.01],
  dropThroughTime: [0.05, 0.6, 0.01],
};

const POOP_RANGES: Ranges<PoopTuning> = {
  biteTime: [0.05, 1, 0.05],
  regrowInterval: [0.5, 20, 0.5],
  shootCooldown: [0, 1, 0.02],
  shootSpeed: [100, 1600, 10],
  shootLift: [0, 900, 10],
  pelletGravity: [0, 1, 0.05],
  inheritVelocity: [0, 1, 0.05],
  pelletBounce: [0, 1, 0.05],
  pelletLifetime: [0.5, 15, 0.5],
  shootBackwards: null,
};

let gui: GUI | null = null;

/** Live sliders for the tuning values (open the game with `?tune`). Values persist in this browser. */
export function openTuningPanel(): void {
  if (gui) return;
  gui = new GUI({ title: 'Rabbit tuning' });
  addSection(gui, 'Movement', 'rectal-rabbit.tuning', TUNING, DEFAULT_TUNING, MOTOR_RANGES, 'entities/tuning.ts → DEFAULT_TUNING');
  addSection(gui, 'Poop', 'rectal-rabbit.poopTuning', POOP_TUNING, DEFAULT_POOP_TUNING, POOP_RANGES, 'entities/tuning.ts → DEFAULT_POOP_TUNING');
}

function addSection<T extends object>(
  root: GUI,
  title: string,
  storageKey: string,
  live: T,
  defaults: Readonly<T>,
  ranges: Ranges<T>,
  pasteHint: string,
): void {
  load(storageKey, live, defaults);
  const folder = root.addFolder(title);
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(live));
    } catch {
      /* storage unavailable (private window): sliders still work for this session */
    }
  };

  for (const key of Object.keys(ranges) as (keyof T & string)[]) {
    const range = ranges[key] as [number, number, number] | null;
    const controller = range ? folder.add(live, key, ...range) : folder.add(live, key);
    controller.onChange(save);
  }

  const actions = {
    copy: () => {
      const json = JSON.stringify(live, null, 2);
      void navigator.clipboard?.writeText(json);
      console.log(`${title} tuning (paste into src/${pasteHint}):\n`, json);
    },
    reset: () => {
      Object.assign(live, defaults);
      save();
      folder.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
  folder.add(actions, 'copy').name('📋 Copy values');
  folder.add(actions, 'reset').name('↺ Reset to defaults');
}

function load<T extends object>(storageKey: string, live: T, defaults: Readonly<T>): void {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<T>;
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      if (typeof saved[key] === typeof defaults[key]) live[key] = saved[key] as T[keyof T];
    }
  } catch {
    /* ignore bad or unavailable storage */
  }
}
