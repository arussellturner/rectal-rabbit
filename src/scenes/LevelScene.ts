import Phaser from 'phaser';
import { GAME_WIDTH, NO_LEOPARDS, PIXEL, START_COLUMN, TILE, TUNE } from '../config';
import { TILE_VARIANTS } from '../art/pixelTextures';
import { themeKey } from '../art/themeTextures';
import { SNOW_LEOPARD, type ChaserConfig } from '../data/chasers';
import { LEVELS, type LevelDef } from '../data/levels';
import { THEMES, type Theme } from '../data/themes';
import { progress } from '../systems/save';
import { CarrotPickup } from '../entities/CarrotPickup';
import { Checkpoint } from '../entities/Checkpoint';
import { GrassPatch } from '../entities/GrassPatch';
import { BOMB_COST, MAX_BOMBS, PoopBomb } from '../entities/PoopBomb';
import { PoopPellets } from '../entities/PoopPellets';
import { Rabbit, type RabbitEvents } from '../entities/Rabbit';
import { SnowLeopard } from '../entities/SnowLeopard';
import { TUNING } from '../entities/tuning';
import { input } from '../input/InputManager';
import type { LevelMap, Rect, Spot, World } from '../level/LevelMap';
import { DEFAULT_SPAWNER, LeopardSpawner } from '../systems/LeopardSpawner';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

/** Events the HUD listens for. */
export const LEVEL_EVENTS = {
  EMPTY_SHOT: 'empty-shot',
  BOMB_NOT_READY: 'bomb-not-ready',
  LIFE_LOST: 'life-lost',
} as const;

export const START_LIVES = 3;
/** The camera keeps the rabbit this far from the left edge (it never scrolls back). */
const CAMERA_LEAD = GAME_WIDTH * 0.4;
/** Seconds the rabbit blinks (can't be caught) after losing a life. */
const SAFE_TIME = 2;
/** Gap between the overworld and the burrows, which live off to the right of it. */
const BURROW_GAP = 4 * TILE;
/** Poop pellets thrown out by a poop bomb. */
const SHRAPNEL = 18;

type Mode = 'play' | 'won' | 'over';
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
  private checkpoints: Checkpoint[] = [];
  private respawnSpot!: Spot;
  private pellets!: PoopPellets;
  private bombs: PoopBomb[] = [];
  private bombGroup!: Phaser.Physics.Arcade.Group;
  private leopards: SnowLeopard[] = [];
  private leopardGroup!: Phaser.Physics.Arcade.Group;
  private spawner!: LeopardSpawner;
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poopBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dirtBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private weather!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hint!: Phaser.GameObjects.Text;
  private lastProgress = 0;

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

  init(data: { index?: number }): void {
    this.levelIndex = Phaser.Math.Clamp(data?.index ?? 0, 0, LEVELS.length - 1);
    this.def = LEVELS[this.levelIndex];
    this.world = this.def.world;
    this.level = this.world.overworld;
    this.theme = THEMES[this.def.theme];
    const speed = this.def.leopardSpeed;
    this.leopardCfg = { ...SNOW_LEOPARD, chaseSpeed: SNOW_LEOPARD.chaseSpeed * speed, catchUpSpeed: SNOW_LEOPARD.catchUpSpeed * speed };
  }

  create(): void {
    const level = this.level;
    this.mode = 'play';
    this.location = 'overworld';
    this.busy = false;
    this.lives = START_LIVES;
    this.carrots = 0;
    this.leopards = [];
    this.bombs = [];
    this.grass = [];
    this.carrotPickups = [];
    this.lastProgress = 0;
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
    this.physics.add.overlap(this.leopardGroup, this.pellets.group, (h, p) => this.pelletHitLeopard(h, p));
    this.physics.add.overlap(this.leopardGroup, this.bombGroup, (h, b) => {
      const leopard = (h as Phaser.GameObjects.Zone).getData('leopard') as SnowLeopard | undefined;
      const bomb = (b as Phaser.GameObjects.Image).getData('bomb') as PoopBomb | undefined;
      if (leopard && bomb && !bomb.done && !leopard.brain.leaving) this.explode(bomb, leopard);
    });

    const home = level.home ?? level.spawn;
    this.spawner = new LeopardSpawner({ ...DEFAULT_SPAWNER, ...this.def.spawner, stopX: home.x - 14 * TILE });

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

    this.hint = this.add.text(0, 0, '', textStyle(16)).setOrigin(0.5, 1).setDepth(20).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldWidth, level.height);
    cam.setScroll(Phaser.Math.Clamp(this.respawnSpot.x - CAMERA_LEAD, 0, level.width - GAME_WIDTH), 0);
    cam.roundPixels = true;

    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('Hud'));

    this.showIntro();
    if (TUNE) void import('../debug/tuningPanel').then((m) => m.openTuningPanel());
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
    this.tweens.add({ targets: [top, name], alpha: 0, delay: 1800, duration: 600, onComplete: () => (top.destroy(), name.destroy()) });
  }

  update(_time: number, deltaMs: number): void {
    if (this.mode === 'play' && !this.busy && input.justPressed('pause')) {
      this.scene.launch('Pause');
      this.scene.pause();
      return;
    }

    // Cap dt so a hiccup (or a backgrounded tab) can't launch the rabbit.
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.physics.world.gravity.y = TUNING.gravity;

    for (const patch of this.grass) patch.update(dt);
    const underfoot = this.grassUnderfoot();
    const events = this.rabbit.update(dt, underfoot);
    this.handleRabbitEvents(events);
    this.pellets.update(dt);
    for (const b of this.bombs) b.update(dt);
    this.bombs = this.bombs.filter((b) => !b.done);
    this.collectCarrots();
    this.updateCamera();
    this.updateLeopards(dt);

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
   * Up top: follow the rabbit to the right only, and don't let it walk back
   * off screen. In a burrow: keep it in view.
   */
  private updateCamera(): void {
    const cam = this.cameras.main;
    const r = this.rabbit;
    if (this.location !== 'overworld') {
      const b = this.burrows[this.location];
      cam.scrollX = Math.round(Phaser.Math.Clamp(r.hitbox.x - GAME_WIDTH / 2, b.x, b.x + b.map.width - GAME_WIDTH));
      return;
    }
    const maxScroll = this.level.width - GAME_WIDTH;
    cam.scrollX = Math.round(Phaser.Math.Clamp(r.hitbox.x - CAMERA_LEAD, cam.scrollX, maxScroll));
    const body = r.body;
    if (body.left < cam.scrollX) {
      body.position.x = cam.scrollX;
      body.velocity.x = Math.max(0, body.velocity.x);
    }
  }

  private updateLeopards(dt: number): void {
    const r = this.rabbit;
    const cam = this.cameras.main;
    const target = { x: r.hitbox.x, feetY: r.body.bottom };

    if (this.mode === 'play' && !this.busy && !this.underground && !NO_LEOPARDS) {
      const active = this.leopards.filter((l) => !l.brain.leaving).length;
      if (this.spawner.update(dt, r.hitbox.x, active)) this.spawnLeopard();
    }

    for (const leopard of this.leopards) {
      leopard.update(dt, target, this.level, cam);
      if (!leopard.gone && this.inHazard(leopard.body)) {
        leopard.gone = true;
        this.dirtBits.explode(16, leopard.hitbox.x, leopard.body.bottom);
      }
      const canCatch = this.mode === 'play' && !this.busy && leopard.dangerous && !r.invulnerable;
      if (canCatch && this.physics.overlap(r.hitbox, leopard.hitbox)) this.caught(leopard);
    }
    this.removeLeopards((l) => l.gone);
  }

  private removeLeopards(which: (l: SnowLeopard) => boolean): void {
    const going = this.leopards.filter(which);
    if (going.length === 0) return;
    for (const l of going) {
      this.leopardGroup.remove(l.hitbox);
      l.destroy();
    }
    this.leopards = this.leopards.filter((l) => !going.includes(l));
  }

  /** A new snow leopard comes running in from the left, just off screen. */
  private spawnLeopard(): void {
    const cfg = this.leopardCfg;
    const x = this.cameras.main.scrollX - cfg.hitbox.w;
    const startCol = Math.floor(x / TILE);
    // Find solid ground to drop it on, searching backwards past any pit.
    for (let col = startCol; col > startCol - 12 && col >= 0; col--) {
      for (let row = 1; row < this.level.rows; row++) {
        if (!this.level.isSolid(col, row) || this.level.isSolid(col, row - 1)) continue;
        const leopard = new SnowLeopard(this, cfg, Math.min(x, (col + 0.5) * TILE), row * TILE);
        this.leopardGroup.add(leopard.hitbox);
        leopard.hitbox.setData('leopard', leopard);
        this.leopards.push(leopard);
        return;
      }
    }
  }

  private pelletHitLeopard(h: unknown, p: unknown): void {
    const pellet = p as Phaser.Physics.Arcade.Image;
    const leopard = (h as Phaser.GameObjects.Zone).getData('leopard') as SnowLeopard | undefined;
    // Leopards already knocked over let poop fly right past (so bomb poop can reach the others).
    if (!leopard || leopard.brain.leaving || !this.pellets.isFlying(pellet)) return;
    this.poopBits.explode(12, pellet.x, pellet.y);
    const originX = pellet.getData('originX') as number;
    this.pellets.kill(pellet);
    const result = leopard.hit(originX);
    if (result === 'scared') {
      this.floatText(leopard.hitbox.x, leopard.body.top - 40, 'SCARED OFF!', '#fce0a8', 16);
      input.rumble(120, 0.5, 0.4);
    } else if (result === 'stagger') {
      this.floatText(leopard.hitbox.x, leopard.body.top - 40, 'SPLAT!', '#ffffff', 16);
      input.rumble(60, 0.3, 0.2);
    }
  }

  /** KA-POOP! Knocks over the leopard that stepped in it and sprays poop at any others. */
  private explode(bomb: PoopBomb, by: SnowLeopard | null): void {
    const x = bomb.x;
    const y = bomb.y - 18;
    bomb.detonate();
    by?.blast(x);

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

  private caught(by: SnowLeopard): void {
    by.caughtRabbit();
    this.cameras.main.shake(200, 0.008);
    this.cameras.main.flash(200, 248, 56, 0);
    input.rumble(300, 1, 0.8);
    this.floatText(this.rabbit.hitbox.x, this.rabbit.body.top - 30, 'OUCH!', '#f83800', 24);
    if (this.loseLife()) return;
    this.rabbit.invulnerableTimer = SAFE_TIME;
    this.rabbit.knockback(this.rabbit.hitbox.x >= by.hitbox.x ? 1 : -1);
    this.spawner.delay(3);
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
    this.removeLeopards(() => true);
    this.cameras.main.scrollX = Phaser.Math.Clamp(spot.x - CAMERA_LEAD, 0, this.level.width - GAME_WIDTH);
    this.rabbit.respawn(spot.x, spot.y - 30, SAFE_TIME);
    this.spawner.delay(4);
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
    // Every leopard gives up and rolls away.
    for (const l of this.leopards) l.blast(r.hitbox.x);
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
      this.removeLeopards(() => true);
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
      this.pellets.fire(e.shot.x, e.shot.y, e.shot.vx, e.shot.vy);
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
    if (e.bombNotReady) {
      this.floatText(r.hitbox.x, r.body.top - 40, `BOMB NEEDS ${BOMB_COST} POOPS`, '#fcbcb0', 16);
      this.events.emit(LEVEL_EVENTS.BOMB_NOT_READY);
    }
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
        text = r.ammo.isFull ? 'FULL' : input.lastDevice === 'touch' ? 'HOLD EAT' : `HOLD ${k.eat}: EAT`;
        alpha = r.ammo.isFull ? 0.6 : 1;
      }
    }
    this.hint.setVisible(text !== '');
    if (text) this.hint.setText(text).setAlpha(alpha).setPosition(r.hitbox.x, r.body.top - 40);
  }

  private floatText(x: number, y: number, text: string, color: string, size = 16): void {
    const t = this.add.text(x, y, text, textStyle(size, color)).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
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
