import { ACTIONS, emptyReading, type Action, type SourceReading } from './actions';

/** Should the on-screen touch controls be shown? Phones and tablets, or `?touch` to try them on a computer. */
export function wantsTouchControls(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** Colors for the little pixel-art button icons. */
const ICON_COLORS: Record<string, string> = {
  K: '#140c08', // outline
  D: '#7c5428', // poop
  L: '#ac7c3c', // poop highlight
  G: '#58d854', // green
  g: '#2c8c1c', // dark green
  Y: '#fce048', // spark
  O: '#fca044', // orange
  R: '#f83800', // red
  M: '#6c0c18', // inside a mouth
  V: '#b8f818', // vomit
  v: '#78b800', // darker vomit
  W: '#ffffff',
  B: '#5c3a10', // dirt
};

/** Pixel-art icons, one character per pixel ('.' is see-through). Drawn as crisp SVG. */
const ICONS: Record<string, string[]> = {
  jump: ['....WW....', '...WWWW...', '..WWWWWW..', '.WWWWWWWW.', '....WW....', '....WW....', '....WW....'],
  eat: ['.G....G..G', '.G...Gg..G', '.gG..Gg.Gg', '..G..g.Gg.', '..gGgGgG..', '...gggG...', 'BBBBBBBBBB'],
  poop: ['....KK....', '...KDDK...', '...KDLK...', '..KDDDDK..', '..KDLLDK..', '.KDDDDDDK.', '.KDLLLDDK.', 'KDDDDDDDDK', '.KKKKKKKK.'],
  vomit: ['KK........', 'KMK..V.v..', 'KMMVVVV.V.', 'KMMVvVVVVV', 'KMMVVVVvV.', 'KMK.Vv.V..', 'KK........'],
  bomb: ['.....Y.Y..', '......Y...', '.....G....', '....G.....', '...KDDK...', '..KDLLDK..', '.KDDDDDDK.', 'KDLLDDLLDK', 'KDDDDDDDDK', '.KKKKKKKK.'],
  splode: ['D...D...D', '.D..O..D.', '..OOOOO..', '..O.D.O..', 'DOODDDOOD', '..O.D.O..', '..OOOOO..', '.D..O..D.', 'D...D...D'],
};

function iconSvg(rows: string[]): string {
  const w = Math.max(...rows.map((r) => r.length));
  let rects = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = ICON_COLORS[ch];
      if (fill) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    });
  });
  return `<svg class="icon" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges">${rects}</svg>`;
}

/** The on-screen buttons: what they do, their label, and their icon. */
const BUTTONS: { action: Action; label: string; className: string; icon?: string }[] = [
  { action: 'jump', label: 'JUMP', className: 'rr-jump', icon: 'jump' },
  { action: 'eat', label: 'EAT/DIG', className: 'rr-eat', icon: 'eat' },
  { action: 'shoot', label: 'POOP', className: 'rr-poop', icon: 'poop' },
  { action: 'vomit', label: 'VOMIT', className: 'rr-vomit', icon: 'vomit' },
  { action: 'dropBomb', label: 'BOMB', className: 'rr-bomb', icon: 'bomb' },
  { action: 'splode', label: 'BOOM', className: 'rr-splode', icon: 'splode' },
  { action: 'pause', label: 'II', className: 'rr-pause' },
];

/*
 * Layout. Everything is sized from --b (one button, set by layout() to fit
 * the screen) and --g (the gap). The action buttons are a 2-wide block in
 * the bottom-right corner, with the big JUMP button where your thumb rests:
 *
 *     BOOM   BOMB
 *     VOMIT  POOP
 *     EAT    JUMP
 *
 * and the d-pad is in the bottom-left corner. layout() makes sure the two
 * never overlap, however narrow the phone.
 */
const CSS = `
.rr-touch { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  font-family: "Press Start 2P", monospace; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; touch-action: none;
  --b: 64px; --g: 10px;
  --right: calc(12px + env(safe-area-inset-right, 0px));
  --left: calc(12px + env(safe-area-inset-left, 0px));
  --bottom: calc(14px + env(safe-area-inset-bottom, 0px)); }
.rr-touch * { box-sizing: border-box; }
.rr-btn { position: absolute; pointer-events: auto; touch-action: none; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: calc(var(--b) * 0.05); text-align: center;
  color: #fff; border: 3px solid var(--c); background: var(--bg); border-radius: 50%;
  font-size: calc(var(--b) * 0.12); text-shadow: 1px 1px #000; opacity: 0.85;
  width: var(--b); height: var(--b); box-shadow: 0 3px 0 rgba(0,0,0,0.5);
  transition: transform 60ms; }
.rr-btn .icon { width: 52%; height: auto; image-rendering: pixelated; }
.rr-btn.on { background: var(--c); transform: scale(0.92); opacity: 1; box-shadow: none; }
.rr-jump   { --c: #58d854; --bg: rgba(24,88,24,0.6); width: calc(var(--b) * 1.3); height: calc(var(--b) * 1.3);
  right: var(--right); bottom: var(--bottom); font-size: calc(var(--b) * 0.15); }
.rr-eat    { --c: #88d800; --bg: rgba(40,76,8,0.6);
  right: calc(var(--right) + var(--b) * 1.3 + var(--g)); bottom: calc(var(--bottom) + var(--b) * 0.15); }
.rr-eat span { font-size: calc(var(--b) * 0.095); }
.rr-poop   { --c: #c89048; --bg: rgba(88,52,18,0.65);
  right: calc(var(--right) + var(--b) * 0.15); bottom: calc(var(--bottom) + var(--b) * 1.3 + var(--g)); }
.rr-vomit  { --c: #b8f818; --bg: rgba(56,84,0,0.6);
  right: calc(var(--right) + var(--b) * 1.3 + var(--g)); bottom: calc(var(--bottom) + var(--b) * 1.15 + var(--g) * 2); }
.rr-bomb   { --c: #fca044; --bg: rgba(96,48,8,0.65);
  right: calc(var(--right) + var(--b) * 0.15); bottom: calc(var(--bottom) + var(--b) * 2.3 + var(--g) * 2); }
.rr-splode { --c: #fc7c44; --bg: rgba(116,36,8,0.65);
  right: calc(var(--right) + var(--b) * 1.3 + var(--g)); bottom: calc(var(--bottom) + var(--b) * 2.15 + var(--g) * 3); }
.rr-pause  { --c: rgba(255,255,255,0.85); --bg: rgba(0,0,0,0.45); width: 48px; height: 48px; border-radius: 12px;
  right: var(--right); top: calc(10px + env(safe-area-inset-top, 0px)); font-size: 14px; }
.rr-pad { position: absolute; left: var(--left); bottom: var(--bottom); width: 168px; height: 168px;
  pointer-events: auto; touch-action: none; opacity: 0.85;
  transform: scale(var(--pad-scale, 1)); transform-origin: bottom left; }
.rr-pad .arm { position: absolute; background: rgba(0,0,0,0.5); border: 4px solid rgba(255,255,255,0.85); }
.rr-pad .h { left: 0; right: 0; top: 56px; height: 56px; border-radius: 10px; }
.rr-pad .v { top: 0; bottom: 0; left: 56px; width: 56px; border-radius: 10px; }
.rr-pad .hub { position: absolute; left: 60px; top: 60px; width: 48px; height: 48px; background: rgba(0,0,0,0.5); }
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
/* Sideways the buttons sit over the game: see through them a bit more. */
@media (orientation: landscape) {
  .rr-btn:not(.on), .rr-pad { opacity: 0.72; }
}
@media (orientation: portrait) {
  .rr-pause { top: calc(56.25vw + 12px); }
  .rr-btn, .rr-pad { opacity: 0.95; }
}
`;

/** The d-pad's drawn size (px) before it's scaled to fit. */
const PAD_SIZE = 168;

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
      el.innerHTML = b.icon ? `${iconSvg(ICONS[b.icon])}<span>${b.label}</span>` : b.label;
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
    this.layout();
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 100));
    // No pinch-zoom, double-tap zoom or page scrolling while playing.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.body.style.touchAction = 'none';
  }

  /**
   * Size the buttons and d-pad to the screen. Upright, they get the space
   * under the game; sideways, they sit over the game and stay small. Either
   * way the d-pad (2.4 buttons wide) and the button block (2.3 buttons plus
   * a gap) must fit side by side without touching.
   */
  private layout(): void {
    if (!this.root) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const portrait = h > w;
    const gap = portrait ? 12 : 8;
    let b = portrait ? Math.min(w * 0.19, 84) : Math.min(h * 0.135, 64);
    // Room for: margins, d-pad, a gap between, the button block.
    const fit = (w - 24 - 24 - gap) / (2.4 + 2.3);
    b = Math.max(40, Math.min(b, fit));
    // Upright: don't let the top buttons climb into the game picture.
    if (portrait) {
      const below = h - w * 0.5625 - 70;
      b = Math.max(40, Math.min(b, (below - gap * 3) / 3.45));
    }
    this.root.style.setProperty('--b', `${Math.round(b)}px`);
    this.root.style.setProperty('--g', `${gap}px`);
    this.root.style.setProperty('--pad-scale', ((b * 2.4) / PAD_SIZE).toFixed(3));
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
