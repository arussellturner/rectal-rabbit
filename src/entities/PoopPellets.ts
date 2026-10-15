import Phaser from 'phaser';
import { POOP_TUNING } from './tuning';

type Pellet = Phaser.Physics.Arcade.Image;

const FADE_TIME = 0.5;

/**
 * Pool of poop pellets. They fly in an arc, bounce a little, sit on the
 * ground for a few seconds, then fade. Only pellets still flying can hit things.
 */
export class PoopPellets {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    private readonly worldHeight: number,
  ) {
    this.group = scene.physics.add.group({ classType: Phaser.Physics.Arcade.Image, defaultKey: 'poop', maxSize: 60 });
  }

  fire(x: number, y: number, vx: number, vy: number): void {
    const pellet = (this.group.get(x, y) as Pellet | null) ?? this.recycleOldest();
    if (!pellet) return;
    pellet.setActive(true).setVisible(true).setAlpha(1).setAngle(0).setDepth(8);
    const body = pellet.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    body.setCircle(7, -1, -1); // a little bigger than it looks: near-misses count
    body.setVelocity(vx, vy);
    body.setBounce(POOP_TUNING.pelletBounce, POOP_TUNING.pelletBounce);
    // originX: where it was fired from, so a hit predator knows where to look.
    pellet.setData({ flying: true, landedFor: 0, originX: x });
  }

  isFlying(pellet: Phaser.GameObjects.GameObject): boolean {
    return pellet.active && pellet.getData('flying') === true;
  }

  kill(pellet: Pellet): void {
    this.group.killAndHide(pellet);
    const body = pellet.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }

  update(dt: number): void {
    for (const obj of this.group.getChildren()) {
      const pellet = obj as Pellet;
      if (!pellet.active) continue;
      const body = pellet.body as Phaser.Physics.Arcade.Body;

      if (pellet.y > this.worldHeight + 50) {
        this.kill(pellet);
        continue;
      }

      if (body.blocked.down || body.touching.down) {
        pellet.setData('flying', false);
        body.velocity.x *= Math.exp(-10 * dt); // ground friction
        if (Math.abs(body.velocity.y) < 40) body.setBounce(0, 0); // done bouncing: settle
      }

      if (pellet.getData('flying')) {
        pellet.angle += body.velocity.x * dt * 2;
        continue;
      }

      const landedFor = (pellet.getData('landedFor') as number) + dt;
      pellet.setData('landedFor', landedFor);
      const fade = landedFor - POOP_TUNING.pelletLifetime;
      if (fade > FADE_TIME) this.kill(pellet);
      else if (fade > 0) pellet.setAlpha(1 - fade / FADE_TIME);
    }
  }

  private recycleOldest(): Pellet | null {
    let oldest: Pellet | null = null;
    for (const obj of this.group.getChildren()) {
      const p = obj as Pellet;
      if (p.active && !this.isFlying(p) && (!oldest || p.getData('landedFor') > oldest.getData('landedFor'))) oldest = p;
    }
    if (oldest) this.kill(oldest);
    return oldest ? (this.group.get(0, 0) as Pellet | null) : null;
  }
}
