import Phaser from 'phaser';
import type { Box } from '../ai/geometry';
import { surfaceAt, type Mover, type NavGraph, type Surface } from '../ai/navGraph';
import { Navigator, type NavGoal } from '../ai/Navigator';
import { perceive, type RabbitSnapshot } from '../ai/perception';
import { PredatorBrain, type PredatorState, type Territory } from '../ai/PredatorBrain';
import { SHOW_VISION_CONES } from '../config';
import type { PredatorConfig } from '../data/predators';
import { stunMultiplier } from '../systems/PoopCharge';
import { approach } from './RabbitMotor';
import { textStyle } from '../scenes/textStyles';

/** The rabbit's hitbox half-width, for working out which surface it's on. */
const RABBIT_HALF_WIDTH = 17;
/** How close (px) the navigator's goal must be to the brain's target to count as "arrived there". */
const SAME_TARGET = 16;

/** A species' jumping/running abilities, for building its nav graph. */
export function moverFor(cfg: PredatorConfig, gravity: number): Mover {
  return { halfWidth: cfg.hitbox.w / 2, runSpeed: cfg.chaseSpeed, jumpVelocity: cfg.jumpVelocity, gravity };
}

const CONE_COLORS: Record<PredatorState, { color: number; alpha: number }> = {
  patrol: { color: 0xffffff, alpha: 0.13 },
  suspicious: { color: 0xffd54f, alpha: 0.2 },
  alerted: { color: 0xff5252, alpha: 0.24 },
  chase: { color: 0xff5252, alpha: 0.12 },
  search: { color: 0xffa726, alpha: 0.18 },
  stunned: { color: 0xffffff, alpha: 0 },
};

/**
 * A predator in the level: an Arcade Physics hitbox driven by a PredatorBrain
 * (what to do) and a Navigator (how to get there, jumps and all), plus its
 * art, vision cone, and the "?" / "!" indicator above its head.
 */
export class Predator {
  readonly brain: PredatorBrain;
  readonly nav: Navigator;
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
  /** Set when the brain just changed state (read by the level for rumble etc). */
  justAlerted = false;

  private readonly cone: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Text;
  private readonly meterBar: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Image[];
  private onGround = false;
  private runPhase = 0;
  private time = 0;
  private windingUp = false;

  private readonly home: { x: number; y: number; surface: Surface | null };
  /** Where the rabbit was last standing (kept while it's mid-jump). */
  private rabbitSurface: Surface | null = null;
  /** Where the rabbit was standing when last seen or heard. */
  private lastKnownSurface: Surface | null = null;
  private canReachRabbit = true;
  private reachCheckIn = 0;
  private navArrived = false;
  private navGoalX = NaN;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly cfg: PredatorConfig,
    x: number,
    groundY: number,
    territory: Territory,
    graph: NavGraph,
    mover: Mover,
    private readonly worldHeight: number,
  ) {
    this.brain = new PredatorBrain(cfg, territory);
    this.brain.onEnter = (state) => this.onStateChange(state);
    this.nav = new Navigator(graph, mover, cfg.jumpWindup);
    this.home = { x, y: groundY, surface: surfaceAt(graph, x, groundY, cfg.hitbox.w / 2) };

    this.cone = scene.add.graphics().setDepth(4);
    this.hitbox = scene.add.zone(x, groundY - cfg.hitbox.h / 2, cfg.hitbox.w, cfg.hitbox.h);
    scene.physics.add.existing(this.hitbox);
    this.art = scene.add.image(x, groundY, cfg.texture).setOrigin(0.5, 1).setDepth(9);
    this.marker = scene.add.text(x, 0, '', textStyle(34)).setOrigin(0.5, 1).setDepth(20);
    this.meterBar = scene.add.graphics().setDepth(20);
    this.stars = [0, 1, 2].map(() => scene.add.image(x, 0, 'star').setDepth(20).setVisible(false));
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.hitbox.body as Phaser.Physics.Arcade.Body;
  }

  get state(): PredatorState {
    return this.brain.state;
  }

  update(dt: number, rabbit: RabbitSnapshot, walls: readonly Box[], touchingRabbit: boolean): void {
    this.time += dt;
    const body = this.body;
    const x = this.hitbox.x;
    this.onGround = body.blocked.down || body.touching.down;
    const graph = this.nav.graph;
    const here = this.onGround ? surfaceAt(graph, x, body.bottom, this.cfg.hitbox.w / 2) : null;

    // Missed a jump and fell in a pit? Back home, a bit embarrassed.
    if (body.top > this.worldHeight) {
      this.goHome();
      return;
    }

    if (rabbit.onGround) this.rabbitSurface = surfaceAt(graph, rabbit.x, rabbit.feetY, RABBIT_HALF_WIDTH) ?? this.rabbitSurface;
    // Is there any way to get to the rabbit? (A path search, so only a few times a second.)
    this.reachCheckIn -= dt;
    if (this.reachCheckIn <= 0 && here && this.rabbitSurface) {
      this.canReachRabbit = this.nav.canReach(here, x, this.rabbitSurface);
      this.reachCheckIn = 0.3;
    }

    const p = {
      ...perceive(
        { x, eyeY: body.top + 8, feetY: body.bottom, facing: this.brain.facing },
        rabbit,
        walls,
        this.cfg,
        this.brain.state === 'chase',
        touchingRabbit,
      ),
      reachable: this.canReachRabbit,
    };
    if ((p.sees || p.hears) && this.rabbitSurface) this.lastKnownSurface = this.rabbitSurface;

    const intent = this.brain.update(x, p, dt, (tx) => this.navArrived && Math.abs(this.navGoalX - tx) <= SAME_TARGET);

    // Turn "go to x" into a goal on a surface for the navigator.
    let goal: NavGoal | null = null;
    if (intent.targetX !== null) {
      const s = this.brain.state;
      const surface =
        s === 'patrol' ? this.home.surface : s === 'chase' ? (this.rabbitSurface ?? this.lastKnownSurface) : this.lastKnownSurface;
      goal = { surface, x: intent.targetX };
    }
    const cmd = this.nav.update(dt, { x, feetY: body.bottom, vy: body.velocity.y, surface: here }, goal);
    if (goal) {
      // (When standing still, keep the last answer so the brain knows it's still there.)
      this.navArrived = cmd.arrived;
      this.navGoalX = goal.x;
    }
    this.windingUp = cmd.windingUp;

    if (cmd.jump && this.onGround) {
      body.setVelocity(cmd.jump.vx, -cmd.jump.vy);
      this.art.setScale(1);
      this.scene.tweens.add({ targets: this.art, scaleY: 1.15, scaleX: 0.9, duration: 100, yoyo: true });
    } else if (!this.onGround) {
      if (cmd.airVx !== null) body.setVelocityX(cmd.airVx);
    } else {
      // Ease off near the target so it stops on the spot instead of overshooting.
      const dx = cmd.targetX === null ? 0 : cmd.targetX - x;
      const desired = Math.sign(dx) * Math.min(intent.speed, Math.abs(dx) * 8);
      body.setVelocityX(approach(body.velocity.x, desired, this.cfg.accel * dt));
    }
    // Look where it's going (the navigator may lead it away from the target first).
    if (Math.abs(body.velocity.x) > 30 && this.brain.state !== 'stunned') this.brain.facing = body.velocity.x > 0 ? 1 : -1;

    this.updateArt(dt);
    this.drawCone();
    this.drawIndicator();
  }

  /**
   * Hit by a poop pellet of the given power (1 = normal). Bigger poops stun
   * longer and knock it back. Returns true if this hit newly stunned it.
   */
  stun(fromX: number, power = 1): boolean {
    const wasStunned = this.brain.state === 'stunned';
    this.brain.stun(fromX, this.cfg.stunTime * stunMultiplier(power));
    const away = this.hitbox.x >= fromX ? 1 : -1;
    this.body.setVelocityX(power > 1 ? away * Math.min(450, 120 + 40 * power) : 0);
    return !wasStunned;
  }

  private goHome(): void {
    this.body.reset(this.home.x, this.home.y - this.cfg.hitbox.h / 2);
    this.brain.calmDown();
    this.navArrived = false;
  }

  private onStateChange(state: PredatorState): void {
    if (state === 'alerted') {
      this.justAlerted = true;
      // A startled little hop.
      this.scene.tweens.add({ targets: this.art, scaleY: 1.2, scaleX: 0.85, duration: 90, yoyo: true });
      this.marker.setScale(1.8);
      this.scene.tweens.add({ targets: this.marker, scale: 1, duration: 250, ease: 'Back.Out' });
    }
  }

  private updateArt(dt: number): void {
    const speed = Math.abs(this.body.velocity.x);
    let bob = 0;
    if (this.onGround && speed > 20) {
      this.runPhase += dt * (6 + speed / 25);
      bob = -Math.abs(Math.sin(this.runPhase)) * (speed > 150 ? 6 : 2);
    }
    const stunned = this.brain.state === 'stunned';
    this.art
      .setPosition(this.hitbox.x, this.body.bottom + bob)
      .setFlipX(this.brain.facing < 0)
      .setAngle(stunned ? Math.sin(this.time * 9) * 8 : 0);
    // Crouch before a jump, so the player can see it coming.
    if (this.windingUp) this.art.setScale(1.12, 0.8);
    else if (!this.scene.tweens.isTweening(this.art)) this.art.setScale(1);

    const headX = this.hitbox.x + this.brain.facing * 22;
    const headY = this.body.top - 8;
    this.stars.forEach((star, i) => {
      const a = this.time * 5 + (i * Math.PI * 2) / 3;
      star
        .setVisible(stunned)
        .setPosition(headX + Math.cos(a) * 18, headY + Math.sin(a) * 6)
        .setAngle(this.time * 300);
    });
  }

  private drawCone(): void {
    this.cone.clear();
    const { color, alpha } = CONE_COLORS[this.brain.state];
    if (!SHOW_VISION_CONES || alpha === 0) return;

    const eyeX = this.hitbox.x + this.brain.facing * 20;
    const eyeY = this.body.top + 8;
    const half = Phaser.Math.DegToRad(this.cfg.sightHalfAngleDeg);
    const dir = this.brain.facing === 1 ? 0 : Math.PI;
    this.cone.fillStyle(color, alpha);
    this.cone.beginPath();
    this.cone.moveTo(eyeX, eyeY);
    this.cone.arc(eyeX, eyeY, this.cfg.sightRange, dir - half, dir + half, false);
    this.cone.closePath();
    this.cone.fillPath();
  }

  /** "?" with a filling meter while it's unsure, "!" once it has spotted you. */
  private drawIndicator(): void {
    const s = this.brain.state;
    const x = this.hitbox.x;
    const y = this.body.top - 14;
    this.meterBar.clear();

    let text = '';
    let color = '#ffffff';
    if (s === 'alerted' || s === 'chase') {
      text = '!';
      color = '#ff5252';
    } else if (s === 'suspicious' || s === 'search' || (s === 'patrol' && this.brain.meter > 0)) {
      text = '?';
      color = s === 'search' ? '#ffa726' : '#ffd54f';
    }
    this.marker.setText(text).setColor(color).setPosition(x, y - 10);

    if (text === '?') {
      const w = 44;
      this.meterBar.fillStyle(0x1b1f2a, 0.6).fillRect(x - w / 2 - 2, y - 2, w + 4, 8);
      this.meterBar.fillStyle(s === 'search' ? 0xffa726 : 0xffd54f).fillRect(x - w / 2, y, w * this.brain.meter, 4);
    }
  }
}
