import { ACTIONS, type SourceReading } from './actions';
import { CAPTURED_KEYS, KEY_BINDINGS, MOVE_KEYS } from './bindings';

/**
 * Listens to the window directly (not Phaser's keyboard plugin) so one shared
 * input state works across every scene, including while a scene is paused.
 */
export class KeyboardSource {
  private down = new Set<string>();
  /** Keys pressed since the last read, so a very quick tap is never missed. */
  private tapped = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.tapped.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    // Alt-tabbing away mid-press would otherwise leave a key "stuck" down.
    target.addEventListener('blur', () => {
      this.down.clear();
      this.tapped.clear();
    });
  }

  read(): SourceReading {
    const any = (codes: readonly string[]) => codes.some((c) => this.down.has(c) || this.tapped.has(c));
    const reading: SourceReading = {
      moveX: (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0),
      moveY: (any(MOVE_KEYS.down) ? 1 : 0) - (any(MOVE_KEYS.up) ? 1 : 0),
      held: new Set(ACTIONS.filter((a) => any(KEY_BINDINGS[a]))),
      active: this.tapped.size > 0,
    };
    this.tapped.clear();
    return reading;
  }
}
