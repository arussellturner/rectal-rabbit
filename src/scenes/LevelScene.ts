import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNE } from '../config';
import { GREYBOX_LEVEL, type Rect } from '../data/greyboxLevel';
import { Rabbit } from '../entities/Rabbit';
import { TUNING } from '../entities/tuning';
import { input } from '../input/InputManager';

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

export class LevelScene extends Phaser.Scene {
  rabbit!: Rabbit;

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

    this.rabbit = new Rabbit(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.rabbit.hitbox, solids);
    this.physics.add.collider(
      this.rabbit.hitbox,
      oneWays,
      () => this.rabbit.touchedOneWay(),
      () => this.rabbit.dropThroughTimer <= 0,
    );

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
    this.rabbit.update(dt);

    if (this.rabbit.body.top > GREYBOX_LEVEL.height + 100) this.fellInPit();
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
