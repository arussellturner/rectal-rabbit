import Phaser from 'phaser';
import { buildNavGraph, type NavGraph } from '../ai/navGraph';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH, TUNE } from '../config';
import { GREYBOX_LEVEL, type Rect } from '../data/greyboxLevel';
import { PREDATORS } from '../data/predators';
import { GrassPatch } from '../entities/GrassPatch';
import { PoopPellets } from '../entities/PoopPellets';
import { moverFor, Predator } from '../entities/Predator';
import { PracticeTarget } from '../entities/PracticeTarget';
import { Rabbit, type RabbitEvents } from '../entities/Rabbit';
import { TUNING } from '../entities/tuning';
import { input } from '../input/InputManager';
import { prompts } from './prompts';
import { textStyle } from './textStyles';

const COLORS = {
  skyTop: 0x7ec8e3,
  skyBottom: 0xd8f1f7,
  hillsFar: 0xa9d6b5,
  hillsNear: 0x86c19a,
  ground: 0x5b6475,
  grassTop: 0x7cb342,
  plank: 0x9c7a5b,
  plankTop: 0xc49a6c,
};

/** Events the HUD listens for. */
export const LEVEL_EVENTS = {
  EMPTY_SHOT: 'empty-shot',
  /** The full-meter torrent: the HUD shows the giant SUPER POOP! text. */
  SUPER_POOP: 'super-poop',
} as const;

const RAINBOW = [0xff5252, 0xffa726, 0xffeb3b, 0x66bb6a, 0x42a5f5, 0xab47bc, 0xf06292];

export class LevelScene extends Phaser.Scene {
  rabbit!: Rabbit;
  private grass: GrassPatch[] = [];
  private pellets!: PoopPellets;
  private predators: Predator[] = [];
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poopBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eatHint!: Phaser.GameObjects.Text;

  constructor() {
    super('Level');
  }

  create(): void {
    const level = GREYBOX_LEVEL;
    this.physics.world.setBounds(0, 0, level.width, level.height);
    // No floor on the world: falling into a pit sends you back to the start.
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.gravity.y = TUNING.gravity;

    this.drawBackground();

    const solids = this.physics.add.staticGroup();
    for (const r of level.solids) solids.add(this.makeBlock(r, COLORS.ground, COLORS.grassTop, 8));

    const oneWays = this.physics.add.staticGroup();
    for (const r of level.oneWays) {
      const plank = this.makeBlock(r, COLORS.plank, COLORS.plankTop, 4);
      oneWays.add(plank);
      // Only the top face is solid, so you can jump up through it.
      const body = plank.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }

    this.grass = level.grass.map((s) => new GrassPatch(this, s.x, s.y));
    const targets = level.targets.map((s) => new PracticeTarget(this, s.x, s.y));

    this.rabbit = new Rabbit(this, level.spawn.x, level.spawn.y);
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
    for (const target of targets) {
      this.physics.add.overlap(target.hitbox, this.pellets.group, (_t, p) => {
        const pellet = p as Phaser.Physics.Arcade.Image;
        if (!this.pellets.isFlying(pellet)) return;
        const result = target.hit(pellet.x, this.pellets.powerOf(pellet));
        if (!result) return;
        this.poopBits.explode(10, pellet.x, pellet.y);
        this.pellets.kill(pellet);
        this.floatText(target.art.x, target.art.y - 100, result === 'down' ? 'BONK!' : 'Splat!', '#ffe066');
        input.rumble(60, 0.3, 0.2);
      });
    }

    // One nav graph per species (it depends on how far that animal can jump).
    const graphs = new Map<string, NavGraph>();
    this.predators = level.predators.map((d) => {
      const cfg = PREDATORS[d.kind];
      const mover = moverFor(cfg, TUNING.gravity);
      if (!graphs.has(d.kind)) graphs.set(d.kind, buildNavGraph(level.solids, level.oneWays, mover));
      return new Predator(this, cfg, d.x, d.y, d.territory, graphs.get(d.kind)!, mover, level.height);
    });
    if (DEBUG) for (const g of graphs.values()) this.drawNavGraph(g);
    for (const pred of this.predators) {
      this.physics.add.collider(pred.hitbox, solids);
      this.physics.add.collider(pred.hitbox, oneWays);
      this.physics.add.overlap(pred.hitbox, this.pellets.group, (_h, p) => {
        const pellet = p as Phaser.Physics.Arcade.Image;
        if (!this.pellets.isFlying(pellet)) return;
        const power = this.pellets.powerOf(pellet);
        this.poopBits.explode(Math.min(24, 8 + 2 * power), pellet.x, pellet.y);
        const originX = pellet.getData('originX') as number;
        this.pellets.kill(pellet);
        if (pred.stun(originX, power)) {
          const big = power > 1 && power < 4; // (4 = torrent pellets: no text spam)
          this.floatText(pred.hitbox.x, pred.body.top - 50, big ? 'MEGA BONK! 💫' : 'BONK! 💫', '#ffe066', big ? 32 : 26);
          input.rumble(80, 0.4, 0.3);
        }
      });
    }

    this.grassBits = this.add.particles(0, 0, 'grass-bit', {
      speed: { min: 80, max: 180 },
      angle: { min: 220, max: 320 },
      gravityY: 900,
      lifespan: 450,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.4 },
      emitting: false,
    }).setDepth(11);
    this.poopBits = this.add.particles(0, 0, 'poop-bit', {
      speed: { min: 60, max: 200 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 500,
      scale: { start: 1.2, end: 0 },
      emitting: false,
    }).setDepth(11);

    this.confetti = this.add.particles(0, 0, 'star', {
      speed: { min: 150, max: 450 },
      angle: { min: 200, max: 340 },
      gravityY: 700,
      lifespan: 1400,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0.3 },
      tint: RAINBOW,
      emitting: false,
    }).setDepth(12);

    this.eatHint = this.add.text(0, 0, '', textStyle(18)).setOrigin(0.5, 1).setDepth(20).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, level.width, level.height);
    cam.startFollow(this.rabbit.hitbox, true, 0.12, 0.12, 0, 60);
    cam.setDeadzone(160, 120);

    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('Hud'));

    if (TUNE) void import('../debug/tuningPanel').then((m) => m.openTuningPanel());
  }

  update(_time: number, deltaMs: number): void {
    if (input.justPressed('pause')) {
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
    this.updatePredators(dt);
    this.updateEatHint(underfoot);

    if (this.rabbit.body.top > GREYBOX_LEVEL.height + 100) this.fellInPit();
  }

  private updatePredators(dt: number): void {
    const r = this.rabbit;
    const snapshot = r.snapshot();
    for (const pred of this.predators) {
      const touching = !r.invulnerable && this.physics.overlap(r.hitbox, pred.hitbox);
      pred.update(dt, snapshot, GREYBOX_LEVEL.solids, touching);
      if (pred.justAlerted) {
        pred.justAlerted = false;
        input.rumble(140, 0.5, 0.5); // "you've been spotted"
      }
      if (touching && pred.state === 'chase') {
        this.caught(pred);
        return;
      }
    }
  }

  private caught(by: Predator): void {
    const { x, y } = GREYBOX_LEVEL.spawn;
    this.floatText(by.hitbox.x, by.body.top - 60, `Caught by the ${by.cfg.name.toLowerCase()}!`, '#ff8a80', 28);
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(300, 255, 120, 120);
    input.rumble(300, 1, 0.8);
    for (const pred of this.predators) pred.brain.calmDown();
    this.rabbit.respawn(x, y, 2);
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
      this.floatText(r.hitbox.x, r.body.top - 30, '+1 💩', '#ffffff', 16);
    }
    for (const s of e.shots) {
      this.pellets.fire(s.x, s.y, s.vx, s.vy, { size: s.size, power: s.power, tint: s.tint });
      this.poopBits.explode(e.shots.length > 1 ? 1 : 3 + 2 * s.power, s.x, s.y);
    }
    if (e.bigPoop) {
      const k = e.bigPoop / 10;
      this.floatText(r.hitbox.x, r.body.top - 40, `×${e.bigPoop} SUPER POOP!`, '#ffd54f', 22 + Math.round(16 * k));
      this.cameras.main.shake(120 + 200 * k, 0.003 + 0.008 * k);
    }
    if (e.torrentStarted) {
      const cam = this.cameras.main;
      cam.shake(1700, 0.012);
      cam.flash(200, 255, 230, 120);
      this.confetti.explode(70, r.hitbox.x, r.body.top);
      this.events.emit(LEVEL_EVENTS.SUPER_POOP);
    }
    if (e.chargeCancelled) {
      this.poopBits.explode(4, r.hitbox.x - r.facing * 16, r.body.bottom - 10);
      this.floatText(r.hitbox.x, r.body.top - 30, 'pfft', '#d7ccc8', 18);
    }
    if (e.emptyShot) {
      this.floatText(r.hitbox.x, r.body.top - 30, 'Empty! Eat grass', '#ffb3b3', 18);
      this.events.emit(LEVEL_EVENTS.EMPTY_SHOT);
    }
    if (e.tooFull) this.floatText(r.hitbox.x, r.body.top - 30, 'Too full!', '#ffe066', 18);
  }

  /** "□ eat" bubble over the rabbit's head when standing on grass. */
  private updateEatHint(underfoot: GrassPatch | null): void {
    const r = this.rabbit;
    const show = underfoot !== null && underfoot.hasGrass && !r.eating;
    this.eatHint.setVisible(show);
    if (!show) return;
    this.eatHint
      .setText(r.ammo.isFull ? 'full' : `hold ${prompts().eat} to eat`)
      .setAlpha(r.ammo.isFull ? 0.6 : 1)
      .setPosition(r.hitbox.x, r.body.top - 26);
  }

  private floatText(x: number, y: number, text: string, color: string, size = 22): void {
    const t = this.add.text(x, y, text, textStyle(size, color)).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 800, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  private fellInPit(): void {
    const { x, y } = GREYBOX_LEVEL.spawn;
    this.rabbit.respawn(x, y, 1);
    this.cameras.main.flash(250, 255, 255, 255);
    input.rumble(150, 0.6, 0.3);
  }

  /** ?debug: surfaces (cyan), jumps (yellow arcs) and drops (green) the predators can use. */
  private drawNavGraph(graph: NavGraph): void {
    const g = this.add.graphics().setDepth(30);
    g.lineStyle(4, 0x00e5ff, 0.8);
    for (const s of graph.surfaces) g.lineBetween(s.x0, s.y - 2, s.x1, s.y - 2);
    for (const e of graph.edges) {
      const from = graph.surfaces[e.from];
      const to = graph.surfaces[e.to];
      const color = e.kind === 'jump' ? 0xffd54f : 0x69f0ae;
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(e.takeoffX, from.y - 4),
        new Phaser.Math.Vector2((e.takeoffX + e.landX) / 2, Math.min(from.y, to.y) - 70),
        new Phaser.Math.Vector2(e.landX, to.y - 4),
      );
      g.lineStyle(2, color, 0.6);
      curve.draw(g, 16);
    }
  }

  /** A rectangle with a colored strip on top (grass on ground, light edge on planks). */
  private makeBlock(r: Rect, fill: number, top: number, topHeight: number): Phaser.GameObjects.Rectangle {
    const block = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, fill);
    this.add.rectangle(r.x + r.w / 2, r.y + topHeight / 2, r.w, topHeight, top);
    return block;
  }

  private drawBackground(): void {
    const level = GREYBOX_LEVEL;
    this.add
      .graphics()
      .fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom)
      .fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0);

    // Two layers of hills that scroll slower than the level, for depth.
    const layers = [
      { factor: 0.3, color: COLORS.hillsFar, radius: 260, spacing: 380, baseY: 880 },
      { factor: 0.55, color: COLORS.hillsNear, radius: 200, spacing: 300, baseY: 960 },
    ];
    for (const layer of layers) {
      const g = this.add.graphics().setScrollFactor(layer.factor);
      g.fillStyle(layer.color);
      const span = (level.width - GAME_WIDTH) * layer.factor + GAME_WIDTH + layer.spacing;
      for (let x = -layer.spacing / 2, i = 0; x < span; x += layer.spacing, i++) {
        const r = layer.radius * (0.75 + 0.25 * Math.sin(i * 2.3));
        g.fillCircle(x, layer.baseY, r);
      }
      g.fillRect(-layer.spacing, layer.baseY, span + layer.spacing * 2, 800);
    }
  }
}
