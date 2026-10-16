import Phaser from 'phaser';
import { GAME_WIDTH, NO_LEOPARDS, PIXEL, START_COLUMN, TILE, TUNE } from '../config';
import { TILE_VARIANTS } from '../art/pixelTextures';
import { themeKey } from '../art/themeTextures';
import { SNOW_LEOPARD, type ChaserConfig } from '../data/chasers';
import { LEVELS, type LevelDef } from '../data/levels';
import { SPECIALS, type Special } from '../data/specials';
import { THEMES, type Theme } from '../data/themes';
import { progress } from '../systems/save';
import { CarrotPickup } from '../entities/CarrotPickup';
import { Checkpoint } from '../entities/Checkpoint';
import { GrassPatch } from '../entities/GrassPatch';
import { HeartPickup } from '../entities/HeartPickup';
import { BOMB_COST, MAX_BOMBS, PoopBomb } from '../entities/PoopBomb';
import { PoopPellets } from '../entities/PoopPellets';
import { Rabbit, SPLODE_COST, type RabbitEvents } from '../entities/Rabbit';
import { Chaser } from '../entities/Chaser';
import { Flyer } from '../entities/Flyer';
import { CATCH_TUNING, TUNING } from '../entities/tuning';
import { input } from '../input/InputManager';
import { heartSpot } from '../level/heartSpot';
import type { LevelMap, Rect, Spot, World } from '../level/LevelMap';
import { DEFAULT_SPAWNER, LeopardSpawner } from '../systems/LeopardSpawner';
import { NearMiss } from '../systems/NearMiss';
import { SlowMo } from '../systems/SlowMo';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/** Undo slow motion on a time step (near-miss cooldowns count real seconds). */
function realDtOf(dt: number, scale: number): number {
  return scale > 0 ? dt / scale : dt;
}

/** Events the HUD listens for. */
export const LEVEL_EVENTS = {
  EMPTY_SHOT: 'empty-shot',
  BOMB_NOT_READY: 'bomb-not-ready',
  LIFE_LOST: 'life-lost',
  LIFE_GAINED: 'life-gained',
} as const;

export const START_LIVES = 3;
/** Running right, the camera keeps the rabbit this far from the left edge (more room to see ahead). */
const CAMERA_LEAD = GAME_WIDTH * 0.4;
/** Running back left, it keeps it this far from the left edge (more room to see behind). */
const CAMERA_BACK_LEAD = GAME_WIDTH * 0.6;
/** How quickly the camera slides over when the rabbit turns around (bigger = snappier). */
const CAMERA_EASE = 5;
/** However the camera is sliding, the rabbit never gets closer than this to either edge. */
const CAMERA_EDGE = GAME_WIDTH * 0.2;
/** Seconds the rabbit blinks (can't be caught) after losing a life. */
const SAFE_TIME = 2;
/** Gap between the overworld and the burrows, which live off to the right of it. */
const BURROW_GAP = 4 * TILE;
/** Screen shake when a poop hits a leopard (intensity is a fraction of the screen size). */
const SHAKE = {
  hit: { ms: 130, intensity: 0.005 },
  scared: { ms: 220, intensity: 0.009 },
};
/** A knocked-out predator bursts into flames: flame, smoke and a shockwave. */
const FLAME_COLORS = [0xffffff, 0xfce048, 0xfca044, 0xf83800, 0x881400];
/** Vomit: how far out the front it reaches (px), how long it keeps spewing (s), and its colors. */
const VOMIT = { reach: 190, time: 0.3, colors: [0xd8f878, 0xb8f818, 0x58d854, 0x3c8c00] };
/** Poop pellets thrown out (every way) by a poop-splosion, and how fast. */
const SPLODE_PELLETS = 16;
const SPLODE_SPEED = 560;
/** Poop pellets thrown out by a poop bomb. */
const SHRAPNEL = 18;
/**
 * Under the title screen: zoomed in on the rabbit at the start. Pressing
 * start zooms out to normal and play begins. (Marshall's idea, from
 * turnerm5/rectal-rabbit.)
 */
const INTRO = {
  /** Whole numbers only (pixel art). */
  zoom: 2,
  zoomOutMs: 1500,
};

/** A box in world pixels. */
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** How far apart two boxes are (0 if they touch or overlap). */
function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

type Mode = 'play' | 'won' | 'over';
/** Anything that can catch the rabbit: on foot (snow leopards, stoats, foxes...) or a bird. */
type Enemy = Chaser | Flyer;
/** Where the rabbit is: up top, or down in burrow number N. */
type Location = 'overworld' | number;

interface Burrow {
  map: LevelMap;
  /** Where its left edge is in the world. */
  x: number;
  tunnels: Rect[];
}

/**
 * The level: run right to get home. Snow leopards charge in from behind;
 * eat grass and grab carrots to load up on poop, then fire it back at them,
 * or save up for a poop bomb. Dig into dirt piles to hide in burrows.
 */
export class LevelScene extends Phaser.Scene {
  rabbit!: Rabbit;
  lives = START_LIVES;
  carrots = 0;
  /** Which level (0 = the first). */
  levelIndex = 0;
  def: LevelDef = LEVELS[0];
  world: World = LEVELS[0].world;
  level: LevelMap = LEVELS[0].world.overworld;
  theme: Theme = THEMES.snow;
  private leopardCfg: ChaserConfig = SNOW_LEOPARD;

  private mode: Mode = 'play';
  private location: Location = 'overworld';
  /** In the middle of digging down or popping up. */
  private busy = false;
  private burrows: Burrow[] = [];
  private grass: GrassPatch[] = [];
  private carrotPickups: CarrotPickup[] = [];
  /** The bonus heart halfway through the level. */
  private heartPickup: HeartPickup | null = null;
  private checkpoints: Checkpoint[] = [];
  private respawnSpot!: Spot;
  private pellets!: PoopPellets;
  private bombs: PoopBomb[] = [];
  private bombGroup!: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  /** Predators on foot (they stand on the ground). */
  private leopardGroup!: Phaser.Physics.Arcade.Group;
  /** Birds (no gravity, fly through everything). */
  private flyerGroup!: Phaser.Physics.Arcade.Group;
  private spawner!: LeopardSpawner;
  /** Sends this level's special predator in from the front. */
  private specialSpawner!: LeopardSpawner;
  private special: Special = SPECIALS.stoat;
  /** The first special predator gets a heads-up message. */
  private specialSeen = false;
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poopBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dirtBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** The vomit stream, one emitter per direction (so it shoots in a straight line), and the splat where it hits. */
  private vomitStream!: Record<1 | -1, Phaser.GameObjects.Particles.ParticleEmitter>;
  private vomitSplat!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Vomit spewing right now: which way, how long it has left, and who it's already hit. */
  private spew: { dir: 1 | -1; left: number; hit: Set<Enemy> } | null = null;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private weather!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hint!: Phaser.GameObjects.Text;
  /** Reused pop-up words (see floatText). */
  private floatPool: Phaser.GameObjects.Text[] = [];
  private lastProgress = 0;
  /** Sitting under the title screen, zoomed in, waiting for start. */
  private intro = false;
  private slowMo = new SlowMo();
  /** The jaws are closing (slow motion) on this predator's catch. */
  private catching: { by: Enemy; left: number } | null = null;
  private nearMisses = new Map<Enemy, NearMiss>();
  /** Which way the camera is leading (the way the rabbit last ran), and its exact scroll (before rounding). */
  private cameraDir: 1 | -1 = 1;
  private cameraScroll = 0;

  constructor() {
    super('Level');
  }

  /** 0 at the start, 1 at home. */
  get progress(): number {
    if (this.location !== 'overworld') return this.lastProgress;
    const { spawn, home } = this.level;
    const homeX = home?.x ?? this.level.width;
    this.lastProgress = Phaser.Math.Clamp((this.rabbit.hitbox.x - spawn.x) / (homeX - spawn.x), 0, 1);
    return this.lastProgress;
  }

  get underground(): boolean {
    return this.location !== 'overworld';
  }

  /** `intro`: open zoomed in, under the title screen. */
  init(data: { index?: number; intro?: boolean }): void {
    this.levelIndex = Phaser.Math.Clamp(data?.index ?? 0, 0, LEVELS.length - 1);
    this.intro = data?.intro ?? false;
    this.def = LEVELS[this.levelIndex];
    this.world = this.def.world;
    this.level = this.world.overworld;
    this.theme = THEMES[this.def.theme];
    const speed = this.def.leopardSpeed;
    this.leopardCfg = { ...SNOW_LEOPARD, chaseSpeed: SNOW_LEOPARD.chaseSpeed * speed, catchUpSpeed: SNOW_LEOPARD.catchUpSpeed * speed };
    this.special = SPECIALS[this.def.special];
  }

  create(): void {
    const level = this.level;
    this.mode = 'play';
    this.location = 'overworld';
    this.busy = false;
    this.lives = START_LIVES;
    this.carrots = 0;
    this.enemies = [];
    this.specialSeen = false;
    this.bombs = [];
    this.grass = [];
    this.carrotPickups = [];
    this.heartPickup = null;
    this.lastProgress = 0;
    this.slowMo = new SlowMo();
    this.catching = null;
    this.nearMisses = new Map();
    this.spew = null;
    this.cameraDir = 1;
    this.respawnSpot = level.spawn;
    // `?at=COLUMN` (testing): drop in from the sky partway through the level.
    if (START_COLUMN !== null) this.respawnSpot = { x: (START_COLUMN + 0.5) * TILE, y: 3 * TILE };

    // Burrows sit side by side to the right of the overworld, out of sight.
    let bx = level.width + BURROW_GAP;
    this.burrows = this.world.burrows.map((map) => {
      const b = { map, x: bx, tunnels: map.exitTunnels.map((t) => ({ ...t, x: t.x + bx })) };
      bx += map.width + BURROW_GAP;
      return b;
    });
    const worldWidth = bx;

    this.physics.world.setBounds(0, 0, worldWidth, level.height);
    // No floor on the world: fall into a pit and you lose a life.
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.gravity.y = TUNING.gravity;

    this.drawBackground();
    const solids = this.physics.add.staticGroup();
    const oneWays = this.physics.add.staticGroup();
    this.buildMap(level, 0, solids, oneWays);
    for (const b of this.burrows) this.buildMap(b.map, b.x, solids, oneWays);
    // A wall at the far right of the overworld so you can't run off the end.
    solids.add(this.add.zone(level.width + TILE / 2, level.height / 2, TILE, level.height));

    this.checkpoints = level.checkpoints.map((s) => new Checkpoint(this, s));
    if (level.home) {
      this.add.image(level.home.x, level.home.y, themeKey(this.theme, 'home')).setOrigin(0.5, 1).setDepth(3);
      this.add.text(level.home.x, level.home.y - 90, 'HOME', textStyle(16, '#fce0a8')).setOrigin(0.5, 1).setDepth(3);
    }
    for (const p of level.dirtPiles) this.add.image(p.x, p.y + PIXEL, 'dirt-pile').setOrigin(0.5, 1).setDepth(5);
    for (const h of level.exitHoles) this.add.image(h.x, h.y + PIXEL, 'dirt-hole').setOrigin(0.5, 1).setDepth(5);

    this.rabbit = new Rabbit(this, this.respawnSpot.x, this.respawnSpot.y - 30);
    this.physics.add.collider(this.rabbit.hitbox, solids);
    this.physics.add.collider(
      this.rabbit.hitbox,
      oneWays,
      () => this.rabbit.touchedOneWay(),
      () => this.rabbit.dropThroughTimer <= 0,
    );

    this.pellets = new PoopPellets(this, level.height);
    this.physics.add.collider(this.pellets.group, solids);
    this.physics.add.collider(this.pellets.group, oneWays);

    this.bombGroup = this.physics.add.group();
    this.physics.add.collider(this.bombGroup, solids);
    this.physics.add.collider(this.bombGroup, oneWays);

    this.leopardGroup = this.physics.add.group();
    this.physics.add.collider(this.leopardGroup, solids);
    this.physics.add.collider(this.leopardGroup, oneWays);
    this.physics.add.overlap(this.leopardGroup, this.pellets.group, (h, p) => this.pelletHitEnemy(h, p));
    this.physics.add.overlap(this.leopardGroup, this.bombGroup, (h, b) => {
      const enemy = (h as Phaser.GameObjects.Zone).getData('enemy') as Enemy | undefined;
      const bomb = (b as Phaser.GameObjects.Image).getData('bomb') as PoopBomb | undefined;
      if (enemy && bomb && !bomb.done && !enemy.gone && !enemy.brain.leaving) this.explode(bomb, enemy);
    });
    // Birds fly through walls and over bombs; only poop can reach them.
    this.flyerGroup = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.flyerGroup, this.pellets.group, (h, p) => this.pelletHitEnemy(h, p));

    const home = level.home ?? level.spawn;
    this.spawner = new LeopardSpawner({ ...DEFAULT_SPAWNER, ...this.def.spawner, stopX: home.x - 14 * TILE });
    const flyer = this.special.type === 'flyer';
    this.specialSpawner = new LeopardSpawner({
      ...DEFAULT_SPAWNER,
      startX: 900,
      earlyInterval: [9, 13],
      lateInterval: [6, 9],
      maxEarly: 1,
      maxLate: flyer ? 1 : 2,
      firstDelay: 2,
      ...this.def.specialSpawner,
      stopX: home.x - 16 * TILE,
    });

    this.grassBits = this.add.particles(0, 0, 'grass-bit', {
      speed: { min: 80, max: 180 },
      angle: { min: 220, max: 320 },
      gravityY: 900,
      lifespan: 450,
      emitting: false,
    }).setDepth(11);
    this.poopBits = this.add.particles(0, 0, 'poop-bit', {
      speed: { min: 60, max: 260 },
      angle: { min: 190, max: 350 },
      gravityY: 900,
      lifespan: 600,
      emitting: false,
    }).setDepth(11);
    this.dirtBits = this.add.particles(0, 0, 'poop-bit', {
      speed: { min: 100, max: 260 },
      angle: { min: 230, max: 310 },
      gravityY: 1100,
      lifespan: 600,
      tint: [0x88581c, 0xac7c3c, 0x5c3a10],
      emitting: false,
    }).setDepth(11);

    this.flames = this.add.particles(0, 0, 'flame-bit', {
      speed: { min: 40, max: 300 },
      angle: { min: 190, max: 350 },
      gravityY: -420,
      lifespan: { min: 450, max: 950 },
      scale: { start: 3, end: 0.4 },
      color: FLAME_COLORS,
      emitting: false,
    }).setDepth(12);
    // A tight, fast, nearly flat stream: straight out the front, about VOMIT.reach long.
    const stream = (angle: { min: number; max: number }) =>
      this.add.particles(0, 0, 'flame-bit', {
        angle,
        speed: { min: 620, max: 700 },
        gravityY: 150,
        lifespan: { min: 250, max: 290 },
        scale: { start: 1.8, end: 1.2 },
        tint: VOMIT.colors,
        emitting: false,
      }).setDepth(11);
    this.vomitStream = { 1: stream({ min: -2, max: 2 }), [-1]: stream({ min: 178, max: 182 }) };
    this.vomitSplat = this.add.particles(0, 0, 'flame-bit', {
      speed: { min: 80, max: 240 },
      gravityY: 900,
      lifespan: { min: 250, max: 450 },
      scale: { start: 1.4, end: 0.6 },
      tint: VOMIT.colors,
      emitting: false,
    }).setDepth(11);
    this.smoke = this.add.particles(0, 0, 'flame-bit', {
      speed: { min: 20, max: 90 },
      angle: { min: 230, max: 310 },
      gravityY: -160,
      lifespan: { min: 700, max: 1100 },
      scale: { start: 2, end: 4.5 },
      alpha: { start: 0.75, end: 0 },
      tint: [0x3c3c3c, 0x5c5c5c, 0x7c7c7c],
      emitting: false,
    }).setDepth(11);

    // The bonus heart, about halfway along.
    const hs = heartSpot(level, TILE);
    if (hs) this.heartPickup = new HeartPickup(this, hs.x, hs.y);

    // Ready-made pop-up words, so the first SPLAT! or CHOMP! doesn't have to build one.
    this.floatPool = Array.from({ length: 10 }, () =>
      this.add.text(0, 0, '', textStyle(16)).setOrigin(0.5).setDepth(21).setVisible(false).setData('style', `16#ffffff`),
    );
    this.hint = this.add.text(0, 0, '', textStyle(16)).setOrigin(0.5, 1).setDepth(20).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldWidth, level.height);
    cam.setScroll(Phaser.Math.Clamp(this.respawnSpot.x - CAMERA_LEAD, 0, level.width - GAME_WIDTH), 0);
    cam.roundPixels = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('Hud'));
    // Scene time, tweens and physics keep their time scale across a restart.
    this.applyTimeScale(1);
    cam.setZoom(1);

    if (this.intro) {
      cam.setZoom(INTRO.zoom);
      cam.centerOn(this.rabbit.hitbox.x, this.rabbit.hitbox.y - 20);
      cam.fadeIn(900);
      this.rabbit.controlsLocked = true;
      if (!this.scene.isActive('Title')) this.scene.launch('Title');
    } else {
      cam.fadeIn(350);
      this.scene.launch('Hud');
      this.showIntro();
    }
    if (TUNE) void import('../debug/tuningPanel').then((m) => m.openTuningPanel());
  }

  /**
   * Start playing (from the title): the camera zooms out to normal, and once
   * it has, the controls and the HUD are handed over. `onDone` runs then.
   */
  beginPlay(onDone?: () => void): void {
    if (!this.intro) return;
    const cam = this.cameras.main;
    const r = this.rabbit;
    const from = { x: cam.midPoint.x, y: cam.midPoint.y };
    const toScroll = Phaser.Math.Clamp(r.hitbox.x - CAMERA_LEAD, 0, this.level.width - GAME_WIDTH);
    const to = { x: toScroll + GAME_WIDTH / 2, y: this.level.height / 2 };
    const p = { t: 0 };
    this.tweens.add({
      targets: p,
      t: 1,
      duration: INTRO.zoomOutMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        cam.setZoom(INTRO.zoom + (1 - INTRO.zoom) * p.t);
        cam.centerOn(from.x + (to.x - from.x) * p.t, from.y + (to.y - from.y) * p.t);
      },
      onComplete: () => {
        cam.setZoom(1);
        cam.setScroll(toScroll, 0);
        this.intro = false;
        r.controlsLocked = false;
        this.scene.launch('Hud');
        onDone?.();
      },
    });
  }

  private applyTimeScale(scale: number): void {
    this.time.timeScale = scale;
    this.tweens.timeScale = scale;
    this.anims.globalTimeScale = scale;
    // Arcade physics' timeScale is the other way round: 2 = half speed.
    this.physics.world.timeScale = 1 / scale;
  }

  /** "LEVEL 2 / WHISPERING WOODS" across the screen for a moment. */
  private showIntro(): void {
    const cx = GAME_WIDTH / 2;
    const top = this.add
      .text(cx, 250, `LEVEL ${this.levelIndex + 1}`, textStyle(24, '#ffffff'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
    const name = this.add.text(cx, 300, this.def.name, textStyle(40, this.theme.accent)).setOrigin(0.5).setScrollFactor(0).setDepth(40);
    const watch = this.add
      .text(cx, 350, `WATCH OUT FOR ${this.special.plural}!`, textStyle(16, '#fcbcb0'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
    this.tweens.add({
      targets: [top, name, watch],
      alpha: 0,
      delay: 2200,
      duration: 600,
      onComplete: () => (top.destroy(), name.destroy(), watch.destroy()),
    });
  }

  update(_time: number, deltaMs: number): void {
    if (this.mode === 'play' && !this.busy && !this.intro && !this.catching && input.justPressed('pause')) {
      this.scene.launch('Pause');
      this.scene.pause();
      return;
    }

    // Cap dt so a hiccup (or a backgrounded tab) can't launch the rabbit.
    const realDt = Math.min(deltaMs / 1000, 1 / 20);
    // Slow motion (a catch, a near miss) slows everything down for a moment.
    const timeScale = this.slowMo.update(realDt);
    this.applyTimeScale(timeScale);
    const dt = realDt * timeScale;
    this.physics.world.gravity.y = TUNING.gravity;
    if (this.catching) {
      this.catching.left -= realDt;
      if (this.catching.left <= 0) this.finishCatch(this.catching.by);
    }

    for (const patch of this.grass) patch.update(dt);
    const underfoot = this.grassUnderfoot();
    const events = this.rabbit.update(dt, underfoot);
    this.handleRabbitEvents(events);
    this.pellets.update(dt);
    for (const b of this.bombs) b.update(dt);
    this.bombs = this.bombs.filter((b) => !b.done);
    this.collectCarrots();
    // Under the title the camera holds still, zoomed in on the rabbit.
    if (this.intro) return;
    this.updateCamera(realDt);
    this.updateEnemies(dt);
    this.updateSpew(dt);

    const pile = this.pileUnderfoot();
    this.updateHint(underfoot, pile);

    if (this.mode !== 'play' || this.busy) return;
    const r = this.rabbit;

    if (this.location !== 'overworld') {
      const burrow = this.burrows[this.location];
      if (burrow.tunnels.some((t) => r.body.right > t.x + 8 && r.body.bottom > t.y && r.body.top < t.y + t.h)) {
        this.popUp(this.location);
      }
      return;
    }

    if (pile !== null && (input.moveY > 0.6 || input.justPressed('eat'))) {
      this.digDown(pile);
      return;
    }
    for (const cp of this.checkpoints) {
      if (!cp.reached && r.hitbox.x >= cp.spot.x - TILE / 2) {
        cp.reach();
        if (cp.spot.x > this.respawnSpot.x) this.respawnSpot = cp.spot;
        this.floatText(cp.spot.x, cp.spot.y - 170, 'CHECKPOINT!', '#fca044', 16);
      }
    }
    const home = this.level.home;
    if (home && Math.abs(r.hitbox.x - home.x) < 30 && Math.abs(r.body.bottom - home.y) < 8) this.reachHome();
    else if (r.body.top > this.level.height + 40) this.fellInPit();
    else if (this.inHazard(r.body)) this.fellInPit(true);
  }

  /**
   * Up top: follow the rabbit both ways. Running right it sits 40% of the way
   * across (more room to see what's coming); running back left it sits at
   * 60% (more room to see behind), and the camera slides smoothly between the
   * two. It goes by which way the rabbit is running, not facing, so turning
   * around for a quick poop doesn't swing the view. In a burrow: keep it in view.
   */
  private updateCamera(dt = 1 / 60): void {
    const cam = this.cameras.main;
    const r = this.rabbit;
    if (this.location !== 'overworld') {
      const b = this.burrows[this.location];
      cam.scrollX = Math.round(Phaser.Math.Clamp(r.hitbox.x - GAME_WIDTH / 2, b.x, b.x + b.map.width - GAME_WIDTH));
      return;
    }
    const maxScroll = this.level.width - GAME_WIDTH;
    const x = r.hitbox.x;
    // Moved by something else (a respawn, a burrow exit, the title zoom): carry on from there.
    if (Math.abs(cam.scrollX - Math.round(this.cameraScroll)) > 1) {
      this.cameraScroll = cam.scrollX;
      this.cameraDir = 1;
    }
    const vx = r.body.velocity.x;
    if (Math.abs(vx) > 60) this.cameraDir = vx > 0 ? 1 : -1;
    const want = x - (this.cameraDir > 0 ? CAMERA_LEAD : CAMERA_BACK_LEAD);
    let scroll = this.cameraScroll + (want - this.cameraScroll) * (1 - Math.exp(-CAMERA_EASE * dt));
    scroll = Phaser.Math.Clamp(scroll, x - (GAME_WIDTH - CAMERA_EDGE), x - CAMERA_EDGE);
    this.cameraScroll = Phaser.Math.Clamp(scroll, 0, maxScroll);
    cam.scrollX = Math.round(this.cameraScroll);
  }

  private isLeopard(e: Enemy): boolean {
    return e.kind === 'chaser' && e.cfg === this.leopardCfg;
  }

  private updateEnemies(dt: number): void {
    const r = this.rabbit;
    const cam = this.cameras.main;
    const target = { x: r.hitbox.x, centerY: r.body.center.y, feetY: r.body.bottom };

    if (this.mode === 'play' && !this.busy && !this.underground && !this.catching && !NO_LEOPARDS) {
      const coming = this.enemies.filter((e) => !e.brain.leaving);
      const leopards = coming.filter((e) => this.isLeopard(e)).length;
      if (this.spawner.update(dt, r.hitbox.x, leopards)) this.spawnLeopard();
      if (this.specialSpawner.update(dt, r.hitbox.x, coming.length - leopards)) this.spawnSpecial();
    }

    for (const enemy of this.enemies) {
      if (enemy.gone) continue;
      if (enemy.kind === 'flyer') {
        enemy.update(dt, target, this.level.height, cam);
      } else {
        enemy.update(dt, target, this.level, cam);
        if (!enemy.gone && this.inHazard(enemy.body)) {
          enemy.gone = true;
          this.dirtBits.explode(16, enemy.hitbox.x, enemy.body.bottom);
        }
      }
      const canCatch = this.mode === 'play' && !this.busy && !this.catching && !r.invulnerable;
      const rb = this.catchBox();
      const lb = enemy.body;
      const gap = boxGap(rb, lb);
      if (canCatch && enemy.canBite && gap === 0) {
        this.caught(enemy);
        continue;
      }
      // Got right up to it and away again: CLOSE!
      if (this.catching) continue;
      let near = this.nearMisses.get(enemy);
      if (!near) this.nearMisses.set(enemy, (near = new NearMiss(() => CATCH_TUNING)));
      const attacking = canCatch && enemy.dangerous;
      if (near.update(realDtOf(dt, this.slowMo.scale), { attacking, pouncing: enemy.airborne, gap, biting: attacking && gap === 0 })) {
        this.nearMiss(enemy);
      }
    }
    for (const e of this.enemies) if (e.gone) this.nearMisses.delete(e);
    this.removeEnemies((e) => e.gone);
  }

  private removeEnemies(which: (e: Enemy) => boolean): void {
    const going = this.enemies.filter(which);
    if (going.length === 0) return;
    for (const e of going) {
      (e.kind === 'flyer' ? this.flyerGroup : this.leopardGroup).remove(e.hitbox);
      e.destroy();
    }
    this.enemies = this.enemies.filter((e) => !going.includes(e));
  }

  private addEnemy(enemy: Enemy): void {
    (enemy.kind === 'flyer' ? this.flyerGroup : this.leopardGroup).add(enemy.hitbox);
    enemy.hitbox.setData('enemy', enemy);
    this.enemies.push(enemy);
  }

  /** The top of the ground in column `col` (the first solid tile with air above it), or null. */
  private groundTop(col: number): number | null {
    for (let row = 1; row < this.level.rows; row++) {
      if (this.level.isSolid(col, row) && !this.level.isSolid(col, row - 1)) return row * TILE;
    }
    return null;
  }

  /** A new snow leopard comes running in from the left, just off screen. */
  private spawnLeopard(): void {
    const cfg = this.leopardCfg;
    const x = this.cameras.main.scrollX - cfg.hitbox.w;
    const startCol = Math.floor(x / TILE);
    // Find solid ground to drop it on, searching backwards past any pit.
    for (let col = startCol; col > startCol - 12 && col >= 0; col--) {
      const feetY = this.groundTop(col);
      if (feetY === null) continue;
      this.addEnemy(new Chaser(this, cfg, Math.min(x, (col + 0.5) * TILE), feetY));
      return;
    }
  }

  /** This level's special predator comes at you from the right, just off screen. */
  private spawnSpecial(): void {
    const special = this.special;
    const camRight = this.cameras.main.scrollX + GAME_WIDTH;
    if (special.type === 'flyer') {
      const x = camRight + 100;
      const col = Phaser.Math.Clamp(Math.floor(this.rabbit.hitbox.x / TILE), 0, this.level.cols - 1);
      const ground = this.groundTop(col) ?? this.rabbit.body.bottom;
      this.addEnemy(new Flyer(this, special.cfg, x, Math.max(150, ground - special.cfg.cruiseHeight)));
    } else {
      const x = camRight + 80;
      const startCol = Math.floor(x / TILE);
      // Find solid ground to drop it on, searching forwards past any pit.
      let placed = false;
      for (let col = startCol; col < startCol + 12 && col < this.level.cols; col++) {
        const feetY = this.groundTop(col);
        if (feetY === null) continue;
        this.addEnemy(new Chaser(this, special.cfg, Math.max(x, (col + 0.5) * TILE), feetY));
        placed = true;
        break;
      }
      if (!placed) return;
    }
    if (!this.specialSeen) {
      this.specialSeen = true;
      const cx = () => this.cameras.main.scrollX + GAME_WIDTH / 2;
      this.floatText(cx(), 230, `${special.cfg.name.toUpperCase()} AHEAD!`, '#f83800', 24);
      this.time.delayedCall(800, () => this.floatText(cx(), 270, 'TURN AROUND TO POOP IT!', '#fce0a8', 16));
    }
  }

  private pelletHitEnemy(h: unknown, p: unknown): void {
    const pellet = p as Phaser.Physics.Arcade.Image;
    const leopard = (h as Phaser.GameObjects.Zone).getData('enemy') as Enemy | undefined;
    // Leopards already knocked over let poop fly right past (so bomb poop can reach the others).
    if (!leopard || leopard.gone || leopard.brain.leaving || !this.pellets.isFlying(pellet)) return;
    this.poopBits.explode(12, pellet.x, pellet.y);
    const originX = pellet.getData('originX') as number;
    this.pellets.kill(pellet);
    const result = leopard.hit(originX, (pellet.body as Phaser.Physics.Arcade.Body).velocity.x);
    this.afterHit(leopard, result, 'SPLAT!');
  }

  /** A poop or vomit hit landed: a little screen shake, and it bursts into flames if that was the last hit. */
  private afterHit(enemy: Enemy, result: 'stagger' | 'scared' | null, word: string): void {
    if (result === 'scared') {
      this.burnUp(enemy);
    } else if (result === 'stagger') {
      this.floatText(enemy.hitbox.x, enemy.body.top - 40, word, '#ffffff', 16);
      this.cameras.main.shake(SHAKE.hit.ms, SHAKE.hit.intensity);
      input.rumble(60, 0.3, 0.2);
    }
  }

  /**
   * BLEURGH! Green vomit sprays out the front of the rabbit for a moment.
   * Every predator it reaches takes one hit (each only once per spew).
   */
  private updateSpew(dt: number): void {
    const spew = this.spew;
    if (!spew) return;
    spew.left -= dt;
    if (spew.left <= 0 || this.mode !== 'play') {
      this.spew = null;
      return;
    }
    const r = this.rabbit;
    const mouthX = r.hitbox.x + spew.dir * 22;
    const mouthY = r.body.top + 14;
    // Straight out the front in a line.
    this.vomitStream[spew.dir].explode(8, mouthX, mouthY + Phaser.Math.Between(-3, 3));

    const box: Box = {
      left: spew.dir > 0 ? r.hitbox.x : r.hitbox.x - VOMIT.reach,
      right: spew.dir > 0 ? r.hitbox.x + VOMIT.reach : r.hitbox.x,
      top: r.body.top - 24,
      bottom: r.body.bottom + 16,
    };
    for (const e of this.enemies) {
      if (e.gone || e.brain.leaving || spew.hit.has(e)) continue;
      if (boxGap(box, e.body) > 0) continue;
      spew.hit.add(e);
      this.vomitSplat.explode(14, e.hitbox.x - spew.dir * 10, mouthY);
      this.afterHit(e, e.hit(r.hitbox.x, spew.dir * 300), 'BLEURGH!');
    }
  }

  /**
   * Knocked out: the predator bursts into flames and is gone (instead of
   * running off). `loud`: its own text and screen shake (a bomb has its own).
   */
  private burnUp(enemy: Enemy, loud = true): void {
    if (enemy.gone) return;
    enemy.gone = true;
    const b = enemy.body;
    const x = b.center.x;
    const y = b.center.y;
    enemy.art.setVisible(false);
    // A few bursts spread over its body, so the whole animal goes up.
    // Burns for a moment: a big burst, then flames keep licking up.
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 55, () => {
        this.flames.explode(i === 0 ? 40 : 16, x + Phaser.Math.Between(-b.width / 2, b.width / 2), y + Phaser.Math.Between(-b.height / 2, b.height / 2));
      });
    }
    this.time.delayedCall(150, () => this.smoke.explode(18, x, y - 10));
    const flash = this.add.circle(x, y, 18, 0xfca044, 0.9).setDepth(12);
    this.tweens.add({ targets: flash, scale: 6, alpha: 0, duration: 320, ease: 'Cubic.Out', onComplete: () => flash.destroy() });
    const core = this.add.circle(x, y, 14, 0xfff4a0, 1).setDepth(13);
    this.tweens.add({ targets: core, scale: 3, alpha: 0, duration: 200, ease: 'Quad.Out', onComplete: () => core.destroy() });
    if (loud) {
      this.floatText(x, b.top - 40, 'KA-BOOM!', '#fca044', 20);
      this.cameras.main.shake(SHAKE.scared.ms, SHAKE.scared.intensity);
      input.rumble(160, 0.6, 0.5);
    }
  }

  /** KA-POOP! Knocks over the leopard that stepped in it and sprays poop at any others. */
  private explode(bomb: PoopBomb, by: Enemy | null): void {
    const x = bomb.x;
    const y = bomb.y - 18;
    bomb.detonate();
    if (by?.blast(x)) this.burnUp(by, false);

    for (let i = 0; i < SHRAPNEL; i++) {
      // Fan out over the top half, from flat-left round to flat-right.
      const a = Phaser.Math.DegToRad(-176 + (172 * i) / (SHRAPNEL - 1));
      const speed = 480 + (i % 3) * 120;
      this.pellets.fire(x, y, Math.cos(a) * speed, Math.sin(a) * speed - 140);
    }
    this.poopBits.explode(50, x, y);
    const ring = this.add.circle(x, y, 12).setStrokeStyle(8, 0x7c5428).setDepth(12);
    this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    this.cameras.main.shake(260, 0.012);
    input.rumble(280, 1, 0.7);
    this.floatText(x, y - 60, 'KA-POOP!', '#fca044', 32);
  }

  /**
   * The part of the rabbit a leopard can catch. In the air it tucks its feet
   * up, so this is a bit smaller: clearing a leopard's head by a hair counts.
   */
  private catchBox(): Box {
    const b = this.rabbit.body;
    if (this.rabbit.onGround) return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    const t = CATCH_TUNING;
    return { left: b.left + t.airTuckSides, right: b.right - t.airTuckSides, top: b.top, bottom: b.bottom - b.height * t.airTuckBottom };
  }

  /** The jaws close: slow motion and a little zoom in, then `finishCatch` takes the heart. */
  private caught(by: Enemy): void {
    this.catching = { by, left: CATCH_TUNING.catchSlowMoTime };
    // A catch is never also a near miss.
    for (const n of this.nearMisses.values()) n.reset();
    if (CATCH_TUNING.catchSlowMoTime > 0) {
      this.slowMo.start(CATCH_TUNING.catchSlowMo, CATCH_TUNING.catchSlowMoTime);
      this.cameras.main.zoomTo(CATCH_TUNING.catchZoom, 120, 'Cubic.easeOut', true);
    }
    by.caughtRabbit();
    this.floatText(by.hitbox.x, by.body.top - 40, 'CHOMP!', '#f83800', 20);
    input.rumble(120, 0.4, 0.2);
    if (CATCH_TUNING.catchSlowMoTime <= 0) this.finishCatch(by);
  }

  /** After the slow-motion bite: back to normal speed, then the usual OUCH and the heart lost. */
  private finishCatch(by: Enemy): void {
    this.catching = null;
    this.slowMo.stop();
    this.applyTimeScale(1);
    if (this.cameras.main.zoom !== 1) this.cameras.main.zoomTo(1, 250, 'Cubic.easeInOut', true);
    for (const n of this.nearMisses.values()) n.reset();
    this.cameras.main.shake(200, 0.008);
    this.cameras.main.flash(200, 248, 56, 0);
    input.rumble(300, 1, 0.8);
    this.floatText(this.rabbit.hitbox.x, this.rabbit.body.top - 30, 'OUCH!', '#f83800', 24);
    if (this.loseLife()) {
      // The game-over screen goes on top; don't leave the camera zoomed.
      this.cameras.main.setZoom(1);
      return;
    }
    this.rabbit.invulnerableTimer = SAFE_TIME;
    this.rabbit.knockback(this.rabbit.hitbox.x >= by.hitbox.x ? 1 : -1);
    this.spawner.delay(3);
    this.specialSpawner.delay(3);
  }

  /** The rabbit got right up to a leopard and away again: SNAP! CLOSE! */
  private nearMiss(by: Enemy): void {
    const r = this.rabbit;
    this.floatText(by.hitbox.x, by.body.top - 40, 'SNAP!', '#fcbcb0', 16);
    this.floatText(r.hitbox.x, r.body.top - 40, 'CLOSE!', '#fce048', 24);
    this.cameras.main.flash(90, 255, 255, 255);
    this.slowMo.start(CATCH_TUNING.nearMissSlowMo, CATCH_TUNING.nearMissSlowMoTime);
    input.rumble(120, 0.7, 0.4);
  }

  /** Is this body touching water / quicksand / lava? */
  private inHazard(b: Phaser.Physics.Arcade.Body): boolean {
    // A little way into it, so just brushing the surface doesn't count.
    return this.level.hazards.some((h) => b.right > h.x + 8 && b.left < h.x + h.w - 8 && b.bottom > h.y + 12);
  }

  private fellInPit(splash = false): void {
    if (splash) {
      const r = this.rabbit;
      this.dirtBits.explode(16, r.hitbox.x, r.body.bottom);
      this.floatText(r.hitbox.x, r.body.top - 30, this.theme.liquid.name === 'LAVA' ? 'HOT HOT HOT!' : 'SPLASH!', '#ffffff', 20);
    }
    this.cameras.main.flash(250, 255, 255, 255);
    input.rumble(150, 0.6, 0.3);
    if (this.loseLife()) return;
    // Back to the last checkpoint, with the leopards cleared away.
    const spot = this.respawnSpot;
    this.removeEnemies(() => true);
    this.cameras.main.scrollX = Phaser.Math.Clamp(spot.x - CAMERA_LEAD, 0, this.level.width - GAME_WIDTH);
    this.rabbit.respawn(spot.x, spot.y - 30, SAFE_TIME);
    this.spawner.delay(4);
    this.specialSpawner.delay(4);
  }

  /** Returns true if that was the last life. */
  private loseLife(): boolean {
    this.lives--;
    this.events.emit(LEVEL_EVENTS.LIFE_LOST);
    if (this.lives > 0) return false;
    this.mode = 'over';
    this.rabbit.controlsLocked = true;
    this.rabbit.art.setVisible(false);
    this.time.delayedCall(700, () => this.scene.launch('End', { won: false, index: this.levelIndex }));
    return true;
  }

  private reachHome(): void {
    this.mode = 'won';
    const r = this.rabbit;
    r.controlsLocked = true;
    r.freezeArt = true;
    r.invulnerableTimer = 999;
    // Every predator still around goes up in flames.
    for (const e of this.enemies) if (!e.gone) this.burnUp(e, false);
    this.tweens.add({
      targets: r.art,
      alpha: 0,
      scaleX: PIXEL * 0.4,
      scaleY: PIXEL * 0.4,
      delay: 250,
      duration: 500,
      onComplete: () => r.art.setVisible(false),
    });
    this.floatText(r.hitbox.x, r.body.top - 60, 'HOME SAFE!', '#b8f818', 24);
    progress.completed(this.levelIndex);
    this.time.delayedCall(1400, () => this.scene.launch('End', { won: true, carrots: this.carrots, index: this.levelIndex }));
  }

  // --- Burrows ---------------------------------------------------------------

  private pileUnderfoot(): number | null {
    const r = this.rabbit;
    if (this.underground || !r.onGround || this.busy) return null;
    const i = this.level.dirtPiles.findIndex((p) => Math.abs(r.hitbox.x - p.x) < 40 && Math.abs(r.body.bottom - p.y) < 8);
    return i < 0 ? null : i;
  }

  /** Dig down into the dirt pile, into burrow `i`. The leopards lose your trail. */
  private digDown(i: number): void {
    const r = this.rabbit;
    const pile = this.level.dirtPiles[i];
    this.busy = true;
    r.controlsLocked = true;
    r.freezeArt = true;
    r.eating = false;
    r.body.setVelocity(0, 0);
    r.art.play('rabbit-run');
    this.time.addEvent({ delay: 90, repeat: 5, callback: () => this.dirtBits.explode(8, pile.x, pile.y - 10) });
    this.tweens.add({ targets: r.art, y: r.art.y + 40, alpha: 0, duration: 550, ease: 'Quad.In' });
    input.rumble(400, 0.3, 0.5);

    const cam = this.cameras.main;
    this.time.delayedCall(500, () => cam.fadeOut(250, 0, 0, 0));
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const burrow = this.burrows[i];
      this.location = i;
      this.removeEnemies(() => true);
      this.weather.setVisible(false);
      this.rabbit.respawn(burrow.x + burrow.map.spawn.x, burrow.map.spawn.y - 30, 0);
      this.endTransition();
      this.updateCamera();
      cam.fadeIn(250, 0, 0, 0);
      this.floatText(this.rabbit.hitbox.x + 200, 200, 'SECRET BURROW!', '#fca044', 24);
    });
  }

  /** Out the exit tunnel of burrow `i`, popping up at its exit hole further along. */
  private popUp(i: number): void {
    const r = this.rabbit;
    this.busy = true;
    r.controlsLocked = true;
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const hole = this.level.exitHoles[i];
      this.location = 'overworld';
      this.weather.setVisible(true);
      cam.scrollX = Phaser.Math.Clamp(hole.x - CAMERA_LEAD, 0, this.level.width - GAME_WIDTH);
      this.rabbit.respawn(hole.x, hole.y - 30, 1);
      this.rabbit.body.setVelocityY(-720);
      this.dirtBits.explode(24, hole.x, hole.y - 10);
      if (hole.x > this.respawnSpot.x) this.respawnSpot = hole;
      this.spawner.delay(5);
      this.specialSpawner.delay(5);
      this.endTransition();
      cam.fadeIn(250, 0, 0, 0);
      input.rumble(150, 0.5, 0.3);
    });
  }

  private endTransition(): void {
    const r = this.rabbit;
    this.busy = false;
    r.controlsLocked = false;
    r.freezeArt = false;
    r.art.setAlpha(1);
  }

  // --- Rabbit ----------------------------------------------------------------

  private collectCarrots(): void {
    const r = this.rabbit;
    const heart = this.heartPickup;
    if (heart?.touches(r.hitbox.x, r.body.top, r.body.bottom)) {
      heart.collect();
      const healed = this.lives < START_LIVES;
      if (healed) this.lives++;
      this.events.emit(LEVEL_EVENTS.LIFE_GAINED);
      this.floatText(heart.x, heart.y - 40, healed ? '+1 HEART!' : 'HEARTS FULL!', '#f83800', healed ? 24 : 16);
      input.rumble(120, 0.3, 0.5);
    }
    for (const c of this.carrotPickups) {
      if (!c.touches(r.hitbox.x, r.body.top, r.body.bottom)) continue;
      c.collect();
      this.carrots++;
      const added = r.ammo.add(c.poops);
      this.floatText(c.x, c.y - 30, added > 0 ? `+${added} POOP` : 'YUM!', '#fca044', 16);
      if (c.inBubble) input.rumble(60, 0.2, 0.3);
    }
  }

  private grassUnderfoot(): GrassPatch | null {
    if (!this.rabbit.onGround) return null;
    const { x } = this.rabbit.hitbox;
    const bottom = this.rabbit.body.bottom;
    return this.grass.find((g) => g.isUnderfoot(x, bottom)) ?? null;
  }

  private handleRabbitEvents(e: RabbitEvents): void {
    const r = this.rabbit;
    if (e.bite) {
      this.grassBits.explode(6, r.hitbox.x + r.facing * 16, r.body.bottom - 4);
      this.floatText(r.hitbox.x, r.body.top - 40, '+1', '#ffffff', 16);
    }
    if (e.shot) {
      this.pellets.fire(e.shot.x, e.shot.y, e.shot.vx, e.shot.vy, e.shot.gravity);
      this.poopBits.explode(3, e.shot.x, e.shot.y);
    }
    if (e.emptyShot) {
      this.floatText(r.hitbox.x, r.body.top - 40, 'EMPTY! EAT GRASS', '#fcbcb0', 16);
      this.events.emit(LEVEL_EVENTS.EMPTY_SHOT);
    }
    if (e.tooFull) this.floatText(r.hitbox.x, r.body.top - 40, 'TOO FULL!', '#fce0a8', 16);
    if (e.bomb) {
      if (this.bombs.length >= MAX_BOMBS) this.bombs.shift()?.fizzle();
      this.bombs.push(new PoopBomb(this, this.bombGroup, e.bomb.x, e.bomb.y));
      this.poopBits.explode(10, e.bomb.x, e.bomb.y - 10);
      this.floatText(r.hitbox.x, r.body.top - 40, 'POOP BOMB!', '#fca044', 16);
    }
    if (e.vomit) {
      this.spew = { dir: e.vomit.dir, left: VOMIT.time, hit: new Set() };
      this.floatText(r.hitbox.x + e.vomit.dir * 60, r.body.top - 40, 'BLEURGH!', '#b8f818', 16);
    }
    if (e.splode) this.poopSplosion(e.splode.x, e.splode.y);
    if (e.splodeNotReady) {
      this.floatText(r.hitbox.x, r.body.top - 40, `SPLOSION NEEDS ${SPLODE_COST} POOPS`, '#fcbcb0', 16);
      this.events.emit(LEVEL_EVENTS.BOMB_NOT_READY);
    }
    if (e.bombNotReady) {
      this.floatText(r.hitbox.x, r.body.top - 40, `BOMB NEEDS ${BOMB_COST} POOPS`, '#fcbcb0', 16);
      this.events.emit(LEVEL_EVENTS.BOMB_NOT_READY);
    }
  }

  /** POOP-SPLOSION: poop pellets fly out from the rabbit in every direction. */
  private poopSplosion(x: number, y: number): void {
    for (let i = 0; i < SPLODE_PELLETS; i++) {
      const a = (Math.PI * 2 * i) / SPLODE_PELLETS;
      const speed = SPLODE_SPEED * (i % 2 === 0 ? 1 : 0.8);
      this.pellets.fire(x + Math.cos(a) * 12, y + Math.sin(a) * 12, Math.cos(a) * speed, Math.sin(a) * speed - 120);
    }
    this.poopBits.explode(40, x, y);
    const ring = this.add.circle(x, y, 16).setStrokeStyle(8, 0x7c5428).setDepth(12);
    this.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    this.cameras.main.shake(220, 0.01);
    const cam = this.cameras.main;
    // Keep the words on screen even right at the edge.
    this.floatText(Phaser.Math.Clamp(x, cam.scrollX + 200, cam.scrollX + GAME_WIDTH - 200), y - 70, 'POOP-SPLOSION!', '#fca044', 24);
  }

  /** A hint over the rabbit's head: dig here, or eat here. */
  private updateHint(underfoot: GrassPatch | null, pile: number | null): void {
    const r = this.rabbit;
    const k = prompts();
    let text = '';
    let alpha = 1;
    if (this.mode === 'play' && !this.busy) {
      // (On the keyboard, the eat key name already says DOWN.)
      if (pile !== null) text = k.eat.includes('DOWN') ? `${k.eat}: DIG` : `${k.down} OR ${k.eat}: DIG`;
      else if (underfoot?.hasGrass && !r.eating) {
        const eat = k.eat.includes('DOWN') ? k.eat : `${k.eat}/${k.down}`;
        text = r.ammo.isFull ? 'FULL' : input.lastDevice === 'touch' ? 'HOLD EAT/DOWN' : `HOLD ${eat}: EAT`;
        alpha = r.ammo.isFull ? 0.6 : 1;
      }
    }
    this.hint.setVisible(text !== '');
    if (text) this.hint.setText(text).setAlpha(alpha).setPosition(r.hitbox.x, r.body.top - 40);
  }

  /**
   * Words that pop up and float away (SPLAT!, CHOMP!, +1 POOP...). The text
   * objects are reused: making a new one each time (a fresh canvas and GPU
   * texture) caused little hitches when a lot happened at once.
   */
  private floatText(x: number, y: number, text: string, color: string, size = 16): void {
    let t = this.floatPool.find((f) => !f.visible);
    if (!t) {
      t = this.add.text(0, 0, '', textStyle(size, color)).setOrigin(0.5).setDepth(21);
      this.floatPool.push(t);
    }
    const style = `${size}${color}`;
    if (t.getData('style') !== style) {
      t.setStyle(textStyle(size, color));
      t.setData('style', style);
    }
    if (t.text !== text) t.setText(text);
    t.setPosition(x, y).setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(t);
    const ft = t;
    this.tweens.add({ targets: ft, y: y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => ft.setVisible(false) });
  }

  // --- Building the level ----------------------------------------------------

  /** Tiles, physics, grass and carrots for one map (the overworld, or a burrow at x = `ox`). */
  private buildMap(
    map: LevelMap,
    ox: number,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneWays: Phaser.Physics.Arcade.StaticGroup,
  ): void {
    const under = map.kind === 'burrow';
    for (const r of map.solids) solids.add(this.add.zone(ox + r.x + r.w / 2, r.y + r.h / 2, r.w, r.h));
    for (const r of map.oneWays) {
      const zone = this.add.zone(ox + r.x + r.w / 2, r.y + 8, r.w, 16);
      oneWays.add(zone);
      // Only the top face is solid, so you can jump up through it.
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }

    if (under) {
      // The far wall of the burrow, behind everything (and hiding the sky).
      for (let row = 0; row < map.rows; row++) {
        for (let col = 0; col < map.cols; col++) {
          this.add.image(ox + col * TILE, row * TILE, 'burrow-wall').setOrigin(0, 0).setDepth(1.5);
        }
      }
    }

    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const t = map.tileAt(col, row);
        const x = ox + col * TILE;
        const y = row * TILE;
        const variant = (col * 7 + row * 13) % TILE_VARIANTS;
        const openAbove = !map.isSolid(col, row - 1) && map.tileAt(col, row - 1) !== 'E' && map.tileAt(col, row - 1) !== '~';
        const th = (part: string) => themeKey(this.theme, part);
        let key: string | null = null;
        if (t === '#') key = th(`ground-${variant}`);
        else if (t === 'd') key = `tile-burrow-${variant}`;
        else if (t === 'S') key = th('ledge');
        else if (t === 'X') key = th('block');
        else if (t === '=') this.add.image(x, y, under ? 'tile-roots' : th('bridge')).setOrigin(0, 0).setDepth(4);
        else if (t === 'E') this.add.image(x, y, 'tunnel').setOrigin(0, 0).setDepth(2);
        else if (t === '~') {
          // Only the top row of a pool gets the wavy surface; below it is solid color.
          const top = map.tileAt(col, row - 1) !== '~';
          const img = this.add.image(x, y, th('liquid')).setOrigin(0, 0).setDepth(4.6);
          if (!top) img.setCrop(0, 9 * PIXEL, TILE, TILE - 9 * PIXEL).setY(y - 9 * PIXEL);
          else this.tweens.add({ targets: img, y: y + 3, duration: 700 + (col % 3) * 150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        }
        if (!key) continue;
        this.add.image(x, y, key).setOrigin(0, 0).setDepth(4);
        if (openAbove && row > 0) {
          if (under && t === 'd') this.add.image(x, y, 'burrow-lip').setOrigin(0, 0).setDepth(4.5);
          else if (!under) this.add.image(x, y - 3 * PIXEL, th('cap')).setOrigin(0, 0).setDepth(4.5);
        }
      }
    }

    // Exit tunnel signs.
    for (const t of map.exitTunnels) {
      const ax = ox + t.x + t.w / 2;
      const arrow = this.add.image(ax - TILE / 2, t.y + t.h / 2, 'arrow').setDepth(3);
      this.tweens.add({ targets: arrow, x: arrow.x + 10, duration: 400, yoyo: true, repeat: -1 });
      this.add.text(ax - TILE / 2, t.y - 10, 'EXIT', textStyle(12, '#fca044')).setOrigin(0.5, 1).setDepth(3);
    }

    const grassKey = themeKey(this.theme, 'grass');
    this.grass.push(...map.grass.map((s) => new GrassPatch(this, ox + s.x, s.y, grassKey)));
    this.carrotPickups.push(...map.carrots.map((c) => new CarrotPickup(this, ox + c.x, c.y, !under)));

    if (!under) this.addDecorations(map);
  }

  /** Trees, cacti or crystals here and there on open ground. */
  private addDecorations(map: LevelMap): void {
    const key = themeKey(this.theme, 'deco');
    for (let col = 3; col < map.cols - 3; col++) {
      const hash = (col * 7919) % 23;
      if (hash > 3) continue;
      // Find the ground surface in this column (below any ceiling).
      let row = map.rows - 3;
      while (row > 0 && map.isSolid(col, row)) row--;
      while (row < map.rows && !map.isSolid(col, row)) row++;
      if (row >= map.rows || map.tileAt(col, row) !== '#') continue;
      if (map.tileAt(col, row - 1) !== '.' || map.tileAt(col, row - 2) !== '.') continue;
      const spot = { x: (col + 0.5) * TILE, y: row * TILE };
      const near = (s: Spot) => Math.abs(s.x - spot.x) < 3 * TILE;
      if ((map.home && near(map.home)) || map.dirtPiles.some(near) || map.exitHoles.some(near)) continue;
      this.add
        .image(spot.x, spot.y, key)
        .setOrigin(0.5, 1)
        .setDepth(2)
        .setScale(hash === 0 ? 1.0 : 0.8);
    }
  }

  /** Banded sky, far scenery, closer silhouettes, clouds, and weather, all from the theme. */
  private drawBackground(): void {
    const level = this.level;
    const t = this.theme;
    const bandH = Math.ceil(level.height / t.sky.length);
    t.sky.forEach((color, i) => {
      this.add.rectangle(0, i * bandH, GAME_WIDTH, bandH, color).setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    });

    const groundY = (level.rows - 2) * TILE;
    const span = (factor: number, extra: number) => (level.width - GAME_WIDTH) * factor + GAME_WIDTH + extra;
    if (t.far.kind !== 'none') {
      const farKey = themeKey(t, 'far');
      const w = this.textures.get(farKey).getSourceImage().width;
      const step = t.far.kind === 'dunes' ? w : 380;
      for (let x = -200, i = 0; x < span(0.15, 400); x += step, i++) {
        const jitter = t.far.kind === 'dunes' ? 0 : ((i * 137) % 5) * 30;
        this.add
          .image(Math.round(x + jitter), groundY - 20, farKey)
          .setOrigin(0.5, 1)
          .setScrollFactor(0.15, 0)
          .setDepth(0);
      }
    }
    const midKey = themeKey(t, 'mid');
    const midW = this.textures.get(midKey).getSourceImage().width;
    const hanging = t.mid.kind === 'stalactites';
    for (let x = 0; x < span(0.4, midW); x += midW) {
      this.add
        .image(x, hanging ? 0 : groundY + 10, midKey)
        .setOrigin(0, hanging ? 0 : 1)
        .setScrollFactor(0.4, 0)
        .setDepth(1);
    }
    if (t.clouds) {
      for (let x = 80, i = 0; x < span(0.25, 200); x += 300 + ((i * 97) % 4) * 70, i++) {
        this.add
          .image(x, 50 + ((i * 53) % 5) * 34, themeKey(t, 'cloud'))
          .setScrollFactor(0.25, 0)
          .setDepth(1);
      }
    }

    const weather: Record<Theme['weather'], Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
      snow: { x: { min: 0, max: GAME_WIDTH }, y: -10, lifespan: 9000, speedY: { min: 30, max: 70 }, speedX: { min: -25, max: 15 }, frequency: 140 },
      leaves: { x: { min: 0, max: GAME_WIDTH }, y: -10, lifespan: 9000, speedY: { min: 40, max: 80 }, speedX: { min: -60, max: -10 }, frequency: 260, rotate: { min: 0, max: 360 } },
      sand: { x: GAME_WIDTH + 10, y: { min: 100, max: 700 }, lifespan: 4000, speedX: { min: -420, max: -260 }, speedY: { min: -10, max: 20 }, frequency: 50 },
      drips: { x: { min: 0, max: GAME_WIDTH }, y: 100, lifespan: 1400, speedY: { min: 300, max: 420 }, frequency: 220 },
      embers: { x: { min: 0, max: GAME_WIDTH }, y: 730, lifespan: 6000, speedY: { min: -90, max: -40 }, speedX: { min: -20, max: 20 }, frequency: 120 },
    };
    this.weather = this.add
      .particles(0, 0, themeKey(t, 'weather'), { ...weather[t.weather], alpha: { start: 0.9, end: 0.3 } })
      .setScrollFactor(0)
      .setDepth(6);
  }
}
