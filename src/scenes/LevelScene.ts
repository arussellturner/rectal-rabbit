import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNE } from '../config';
import { GREYBOX_LEVEL, type Rect } from '../data/greyboxLevel';
import { GrassPatch } from '../entities/GrassPatch';
import { PoopPellets } from '../entities/PoopPellets';
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
} as const;

export class LevelScene extends Phaser.Scene {
  rabbit!: Rabbit;
  private grass: GrassPatch[] = [];
  private pellets!: PoopPellets;
  private grassBits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poopBits!: Phaser.GameObjects.Particles.ParticleEmitter;
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
        const result = target.hit(pellet.x);
        if (!result) return;
        this.poopBits.explode(10, pellet.x, pellet.y);
        this.pellets.kill(pellet);
        this.floatText(target.art.x, target.art.y - 100, result === 'down' ? 'BONK!' : 'Splat!', '#ffe066');
        input.rumble(60, 0.3, 0.2);
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
    this.updateEatHint(underfoot);

    if (this.rabbit.body.top > GREYBOX_LEVEL.height + 100) this.fellInPit();
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
    if (e.shot) {
      this.pellets.fire(e.shot.x, e.shot.y, e.shot.vx, e.shot.vy);
      this.poopBits.explode(3, e.shot.x, e.shot.y);
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
    this.rabbit.respawn(x, y);
    this.cameras.main.flash(250, 255, 255, 255);
    input.rumble(150, 0.6, 0.3);
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
