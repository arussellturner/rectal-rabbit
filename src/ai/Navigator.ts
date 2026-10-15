import { findPath, jumpVelocity, standRange, type Mover, type NavEdge, type NavGraph, type Surface } from './navGraph';

export interface NavSelf {
  x: number;
  feetY: number;
  /** Vertical speed (negative = rising). */
  vy: number;
  /** The surface it's standing on, or null while in the air. */
  surface: Surface | null;
}

export interface NavGoal {
  /** The surface to get to (null if unknown: just move along the current one). */
  surface: Surface | null;
  x: number;
}

export interface NavCommand {
  /** Walk/run toward this x on the ground (null = stand still). */
  targetX: number | null;
  /** Jump right now with this launch velocity (vy is upward speed). */
  jump: { vx: number; vy: number } | null;
  /** While airborne: horizontal speed to hold (null = leave it alone). */
  airVx: number | null;
  /** Is there any way to the goal? */
  reachable: boolean;
  /** At the goal, or as close as it can get to an unreachable one. */
  arrived: boolean;
  /** Crouching for a moment before jumping (gives the player a warning). */
  windingUp: boolean;
}

const ARRIVED = 12;
const AT_TAKEOFF = 10;
const REPLAN_EVERY = 0.4;

/**
 * Follows a path through the nav graph: walk to the takeoff spot, crouch,
 * jump (or walk off the ledge), steer in the air, land, repeat. Re-plans a
 * few times a second because the rabbit keeps moving.
 */
export class Navigator {
  path: NavEdge[] | null = [];
  private edge: NavEdge | null = null;
  private replanIn = 0;
  private goalSurfaceId = -1;
  private windup = 0;

  constructor(
    readonly graph: NavGraph,
    private readonly mover: Mover,
    private readonly windupTime: number,
  ) {}

  /** Is there a way from here to there? */
  canReach(from: Surface, x: number, to: Surface): boolean {
    return findPath(this.graph, from.id, x, to.id) !== null;
  }

  update(dt: number, self: NavSelf, goal: NavGoal | null): NavCommand {
    const cmd: NavCommand = { targetX: null, jump: null, airVx: null, reachable: true, arrived: false, windingUp: false };

    if (!self.surface) {
      this.windup = 0;
      if (this.edge) cmd.airVx = this.airSteer(self, this.edge);
      return cmd;
    }
    if (!goal) {
      this.windup = 0;
      this.edge = null;
      return cmd;
    }

    const here = self.surface;
    if (!goal.surface || goal.surface.id === here.id) {
      this.path = [];
      this.edge = null;
      this.windup = 0;
      return this.walkAlong(here, self.x, goal.x, cmd);
    }

    this.replanIn -= dt;
    if (this.replanIn <= 0 || goal.surface.id !== this.goalSurfaceId || this.path?.[0]?.from !== here.id) {
      this.path = findPath(this.graph, here.id, self.x, goal.surface.id);
      this.replanIn = REPLAN_EVERY;
      this.goalSurfaceId = goal.surface.id;
    }

    if (!this.path || this.path.length === 0) {
      // No way there: get as close as possible on this surface.
      this.edge = null;
      this.windup = 0;
      cmd.reachable = false;
      return this.walkAlong(here, self.x, goal.x, cmd);
    }

    const edge = this.path[0];
    if (edge !== this.edge) this.windup = 0;
    this.edge = edge;

    if (edge.kind === 'drop') {
      cmd.targetX = edge.landX; // just walk off the end
      return cmd;
    }
    if (Math.abs(self.x - edge.takeoffX) > AT_TAKEOFF) {
      cmd.targetX = edge.takeoffX;
      this.windup = 0;
      return cmd;
    }
    cmd.windingUp = true;
    this.windup += dt;
    if (this.windup >= this.windupTime) {
      this.windup = 0;
      cmd.jump = jumpVelocity(edge, here, this.graph.surfaces[edge.to], this.mover);
    }
    return cmd;
  }

  private walkAlong(here: Surface, x: number, goalX: number, cmd: NavCommand): NavCommand {
    const [lo, hi] = standRange(here, this.mover);
    const target = Math.min(hi, Math.max(lo, goalX));
    cmd.arrived = Math.abs(x - target) <= ARRIVED;
    cmd.targetX = cmd.arrived ? null : target;
    return cmd;
  }

  /** Mid-air: head for the landing spot. Climbing onto a block: go straight up until above it. */
  private airSteer(self: NavSelf, edge: NavEdge): number {
    const to = this.graph.surfaces[edge.to];
    if (edge.climb && self.vy < 0 && self.feetY > to.y - 2) return 0;
    const dx = edge.landX - self.x;
    return Math.sign(dx) * Math.min(this.mover.runSpeed, Math.abs(dx) * 6);
  }
}
