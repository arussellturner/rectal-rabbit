import { describe, expect, it } from 'vitest';
import { approach, RabbitMotor, type MotorInput } from './RabbitMotor';
import { DEFAULT_TUNING } from './tuning';

const DT = 1 / 60;
const idle: MotorInput = { moveX: 0, jumpPressed: false, jumpHeld: false };
const motor = () => new RabbitMotor({ ...DEFAULT_TUNING });

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(0, -10, 3)).toBe(-3);
  });
});

describe('RabbitMotor horizontal', () => {
  it('accelerates up to run speed and no further', () => {
    const m = motor();
    let vx = 0;
    for (let i = 0; i < 120; i++) vx = m.step({ vx, vy: 0, onGround: true }, { ...idle, moveX: 1 }, DT).vx;
    expect(vx).toBe(DEFAULT_TUNING.runSpeed);
  });

  it('half-tilting the stick gives half speed', () => {
    const m = motor();
    let vx = 0;
    for (let i = 0; i < 120; i++) vx = m.step({ vx, vy: 0, onGround: true }, { ...idle, moveX: 0.5 }, DT).vx;
    expect(vx).toBe(DEFAULT_TUNING.runSpeed / 2);
  });

  it('stops when the stick is released', () => {
    const m = motor();
    let vx = DEFAULT_TUNING.runSpeed;
    for (let i = 0; i < 60; i++) vx = m.step({ vx, vy: 0, onGround: true }, idle, DT).vx;
    expect(vx).toBe(0);
  });

  it('turns around faster than it accelerates from standstill', () => {
    const fromRest = motor().step({ vx: 0, vy: 0, onGround: true }, { ...idle, moveX: -1 }, DT).vx;
    const turning = motor().step({ vx: 100, vy: 0, onGround: true }, { ...idle, moveX: -1 }, DT).vx;
    expect(100 - turning).toBeGreaterThan(-fromRest);
  });
});

describe('RabbitMotor jumping', () => {
  it('jumps from the ground', () => {
    const out = motor().step({ vx: 0, vy: 0, onGround: true }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    expect(out.jumped).toBe(true);
    expect(out.vy).toBe(-DEFAULT_TUNING.jumpVelocity);
  });

  it('cannot jump again in mid-air', () => {
    const m = motor();
    m.step({ vx: 0, vy: 0, onGround: true }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    for (let i = 0; i < 20; i++) m.step({ vx: 0, vy: -300, onGround: false }, { ...idle, jumpHeld: true }, DT);
    const again = m.step({ vx: 0, vy: -100, onGround: false }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    expect(again.jumped).toBe(false);
  });

  it('does not double jump if the body still reports ground the frame after takeoff', () => {
    const m = motor();
    const vy = m.step({ vx: 0, vy: 0, onGround: true }, { ...idle, jumpPressed: true, jumpHeld: true }, DT).vy;
    // A frame with no physics step: still "on ground", already moving up.
    m.step({ vx: 0, vy, onGround: true }, { ...idle, jumpHeld: false }, DT);
    const mash = m.step({ vx: 0, vy, onGround: false }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    expect(mash.jumped).toBe(false);
  });

  it('allows a jump shortly after running off a ledge (coyote time)', () => {
    const m = motor();
    m.step({ vx: 300, vy: 0, onGround: true }, idle, DT);
    m.step({ vx: 300, vy: 20, onGround: false }, idle, DT * 3);
    const out = m.step({ vx: 300, vy: 40, onGround: false }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    expect(out.jumped).toBe(true);
  });

  it('does not allow a jump long after leaving the ledge', () => {
    const m = motor();
    m.step({ vx: 300, vy: 0, onGround: true }, idle, DT);
    for (let i = 0; i < 15; i++) m.step({ vx: 300, vy: 100, onGround: false }, idle, DT);
    const out = m.step({ vx: 300, vy: 200, onGround: false }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    expect(out.jumped).toBe(false);
  });

  it('remembers a jump pressed just before landing (jump buffer)', () => {
    const m = motor();
    m.step({ vx: 0, vy: 400, onGround: false }, { ...idle, jumpPressed: true, jumpHeld: true }, DT);
    m.step({ vx: 0, vy: 400, onGround: false }, { ...idle, jumpHeld: true }, DT * 3);
    const out = m.step({ vx: 0, vy: 0, onGround: true }, { ...idle, jumpHeld: true }, DT);
    expect(out.jumped).toBe(true);
    expect(out.landed).toBe(true);
  });

  it('cuts the jump short when the button is released early', () => {
    const m = motor();
    const vy = m.step({ vx: 0, vy: 0, onGround: true }, { ...idle, jumpPressed: true, jumpHeld: true }, DT).vy;
    const out = m.step({ vx: 0, vy, onGround: false }, { ...idle, jumpHeld: false }, DT);
    expect(out.vy).toBeCloseTo(vy * DEFAULT_TUNING.jumpCutMultiplier);
  });

  it('falls faster than it rises, capped at max fall speed', () => {
    const m = motor();
    expect(m.step({ vx: 0, vy: -200, onGround: false }, idle, DT).extraGravity).toBe(0);
    expect(m.step({ vx: 0, vy: 200, onGround: false }, idle, DT).extraGravity).toBeGreaterThan(0);
    expect(m.step({ vx: 0, vy: 5000, onGround: false }, idle, DT).vy).toBe(DEFAULT_TUNING.maxFallSpeed);
  });
});
