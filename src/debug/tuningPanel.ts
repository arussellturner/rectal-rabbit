import GUI from 'lil-gui';
import { DEFAULT_TUNING, TUNING, type MotorTuning } from '../entities/tuning';

const STORAGE_KEY = 'rectal-rabbit.tuning';

/** [min, max, step] for each slider. */
const RANGES: Record<keyof MotorTuning, [number, number, number]> = {
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

let gui: GUI | null = null;

/** Live sliders for TUNING (open the game with `?tune`). Values persist in this browser. */
export function openTuningPanel(): void {
  if (gui) return;
  loadSaved();

  gui = new GUI({ title: 'Rabbit tuning' });
  for (const key of Object.keys(RANGES) as (keyof MotorTuning)[]) {
    const [min, max, step] = RANGES[key];
    gui.add(TUNING, key, min, max, step).onChange(save);
  }
  gui.add(
    {
      copy: () => {
        const json = JSON.stringify(TUNING, null, 2);
        void navigator.clipboard?.writeText(json);
        console.log('Rabbit tuning (paste into src/entities/tuning.ts):\n', json);
      },
    },
    'copy',
  ).name('📋 Copy values');
  gui.add(
    {
      reset: () => {
        Object.assign(TUNING, DEFAULT_TUNING);
        save();
        gui?.controllersRecursive().forEach((c) => c.updateDisplay());
      },
    },
    'reset',
  ).name('↺ Reset to defaults');
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TUNING));
  } catch {
    /* storage unavailable (private window): sliders still work for this session */
  }
}

function loadSaved(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<MotorTuning>;
    for (const key of Object.keys(DEFAULT_TUNING) as (keyof MotorTuning)[]) {
      if (typeof saved[key] === 'number') TUNING[key] = saved[key];
    }
  } catch {
    /* ignore bad or unavailable storage */
  }
}
