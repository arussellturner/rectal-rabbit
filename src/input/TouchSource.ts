import { ACTIONS, emptyReading, type Action, type SourceReading } from './actions';

/** Should the on-screen touch controls be shown? Phones and tablets, or `?touch` to try them on a computer. */
export function wantsTouchControls(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** The on-screen buttons and what they do. */
const BUTTONS: { action: Action; label: string; className: string }[] = [
  { action: 'jump', label: 'JUMP', className: 'rr-jump' },
  { action: 'eat', label: 'EAT<br>DIG', className: 'rr-eat' },
  { action: 'shoot', label: 'POOP', className: 'rr-poop' },
  { action: 'dropBomb', label: 'BOMB', className: 'rr-bomb' },
  { action: 'splode', label: 'POOP<br>BOOM', className: 'rr-splode' },
  { action: 'pause', label: 'II', className: 'rr-pause' },
];

const CSS = `
.rr-touch { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  font-family: "Press Start 2P", monospace; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; touch-action: none; }
.rr-touch * { box-sizing: border-box; }
.rr-btn { position: absolute; pointer-events: auto; touch-action: none; display: flex;
  align-items: center; justify-content: center; text-align: center; line-height: 1.5;
  color: #fff; background: rgba(0,0,0,0.45); border: 4px solid rgba(255,255,255,0.85);
  border-radius: 50%; font-size: 11px; text-shadow: 2px 2px #000; }
.rr-btn.on { background: rgba(88,216,84,0.75); color: #000; text-shadow: none; opacity: 1; }
.rr-btn, .rr-pad { opacity: 0.7; }
.rr-jump { width: 92px; height: 92px; right: 18px; bottom: 26px; font-size: 13px; }
.rr-eat  { width: 72px; height: 72px; right: 122px; bottom: 18px; font-size: 10px; }
.rr-poop { width: 72px; height: 72px; right: 28px; bottom: 132px; }
.rr-bomb { width: 72px; height: 72px; right: 116px; bottom: 104px; }
.rr-splode { width: 64px; height: 64px; right: 212px; bottom: 116px; font-size: 9px; }
.rr-pause { width: 52px; height: 52px; right: 12px; top: 12px; border-radius: 12px; font-size: 14px; }
.rr-pad { position: absolute; left: 18px; bottom: 18px; width: 168px; height: 168px;
  pointer-events: auto; touch-action: none; }
.rr-pad .arm { position: absolute; background: rgba(0,0,0,0.45); border: 4px solid rgba(255,255,255,0.85); }
.rr-pad .h { left: 0; right: 0; top: 56px; height: 56px; border-radius: 10px; }
.rr-pad .v { top: 0; bottom: 0; left: 56px; width: 56px; border-radius: 10px; }
.rr-pad .hub { position: absolute; left: 60px; top: 60px; width: 48px; height: 48px; background: rgba(0,0,0,0.45); }
.rr-pad .dir { position: absolute; width: 0; height: 0; border: 12px solid transparent; }
.rr-pad .up { left: 72px; top: 8px; border-bottom-color: #fff; }
.rr-pad .down { left: 72px; bottom: 8px; border-top-color: #fff; }
.rr-pad .left { top: 72px; left: 8px; border-right-color: #fff; }
.rr-pad .right { top: 72px; right: 8px; border-left-color: #fff; }
.rr-pad .dir.on.up { border-bottom-color: #58d854; }
.rr-pad .dir.on.down { border-top-color: #58d854; }
.rr-pad .dir.on.left { border-right-color: #58d854; }
.rr-pad .dir.on.right { border-left-color: #58d854; }
/* Portrait: the game is a strip at the top, so put pause just below it. */
@media (orientation: portrait) {
  .rr-pause { top: calc(56.25vw + 14px); }
  .rr-btn, .rr-pad { opacity: 0.9; }
}
@media (max-height: 420px) {
  .rr-pad { transform: scale(0.8); transform-origin: bottom left; }
  .rr-jump, .rr-eat, .rr-poop, .rr-bomb, .rr-splode { transform: scale(0.85); transform-origin: bottom right; }
}
`;

/**
 * On-screen controls for phones and tablets: a d-pad on the left, action
 * buttons on the right, pause at the top. Plain HTML laid over the game, so
 * several fingers can press at once.
 */
export class TouchSource {
  readonly enabled: boolean;
  private readonly held = new Set<Action>();
  /** Pressed since the last read, so a very quick tap is never missed. */
  private readonly tapped = new Set<Action>();
  private moveX = 0;
  private moveY = 0;
  private pressedSinceRead = false;
  private dirEls: Record<'up' | 'down' | 'left' | 'right', HTMLElement> | null = null;
  private root: HTMLElement | null = null;

  constructor() {
    this.enabled = wantsTouchControls();
    if (this.enabled) this.build();
  }

  /** Hide the buttons (e.g. no need for them in a menu that's all tapping). */
  setVisible(on: boolean): void {
    if (this.root) this.root.style.display = on ? '' : 'none';
  }

  read(): SourceReading {
    if (!this.enabled) return emptyReading();
    const reading: SourceReading = {
      moveX: this.moveX,
      moveY: this.moveY,
      held: new Set(ACTIONS.filter((a) => this.held.has(a) || this.tapped.has(a))),
      active: this.pressedSinceRead,
    };
    this.pressedSinceRead = false;
    this.tapped.clear();
    return reading;
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'rr-touch';
    this.root = root;

    for (const b of BUTTONS) {
      const el = document.createElement('div');
      el.className = `rr-btn ${b.className}`;
      el.innerHTML = b.label;
      // Jump also works as "OK" in menus.
      const actions: Action[] = b.action === 'jump' ? ['jump', 'confirm'] : [b.action];
      this.hold(el, (down) => {
        for (const a of actions) {
          if (down) {
            this.held.add(a);
            this.tapped.add(a);
          } else {
            this.held.delete(a);
          }
        }
        el.classList.toggle('on', down);
      });
      root.appendChild(el);
    }

    root.appendChild(this.buildPad());
    document.body.appendChild(root);
    // No pinch-zoom, double-tap zoom or page scrolling while playing.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.body.style.touchAction = 'none';
  }

  /** Press-and-hold behaviour for one element, with multi-touch. */
  private hold(el: HTMLElement, onChange: (down: boolean) => void): void {
    const pointers = new Set<number>();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointers.add(e.pointerId);
      this.pressedSinceRead = true;
      onChange(true);
    });
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size === 0) onChange(false);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** The d-pad: slide your thumb around it to change direction. */
  private buildPad(): HTMLElement {
    const pad = document.createElement('div');
    pad.className = 'rr-pad';
    pad.innerHTML =
      '<div class="arm h"></div><div class="arm v"></div><div class="hub"></div>' +
      '<div class="dir up"></div><div class="dir down"></div><div class="dir left"></div><div class="dir right"></div>';
    this.dirEls = {
      up: pad.querySelector('.up')!,
      down: pad.querySelector('.down')!,
      left: pad.querySelector('.left')!,
      right: pad.querySelector('.right')!,
    };

    let active: number | null = null;
    const aim = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      // A small dead spot in the middle; diagonals count for both.
      this.moveX = dx > 0.3 ? 1 : dx < -0.3 ? -1 : 0;
      this.moveY = dy > 0.45 ? 1 : dy < -0.45 ? -1 : 0;
      this.showDirs();
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      active = e.pointerId;
      this.pressedSinceRead = true;
      aim(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) aim(e);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      this.moveX = 0;
      this.moveY = 0;
      this.showDirs();
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    return pad;
  }

  private showDirs(): void {
    if (!this.dirEls) return;
    this.dirEls.left.classList.toggle('on', this.moveX < 0);
    this.dirEls.right.classList.toggle('on', this.moveX > 0);
    this.dirEls.up.classList.toggle('on', this.moveY < 0);
    this.dirEls.down.classList.toggle('on', this.moveY > 0);
  }
}
