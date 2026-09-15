import { describe, it, expect } from 'vitest';
import { TILE } from '@/systems/iso';
import {
  newCartState, stepCart, damageCart, patchCart, resetCart,
  ESCORT_LEASH, ESCORT_REPAIR_SECONDS, ESCORT_REPAIR_FRACTION,
} from '@/systems/escort';

const open = () => false;
const DT = 1 / 60;

/** Runs the cart for a number of fixed steps with the player alongside it. */
function escortFor(c: ReturnType<typeof newCartState>, stop: { x: number; y: number }, steps: number, blocked = open) {
  let arrived = false;
  let repaired = false;
  for (let i = 0; i < steps; i++) {
    const r = stepCart(c, DT, stop, { x: c.x + 10, y: c.y + 10 }, blocked);
    arrived = arrived || r.arrived;
    repaired = repaired || r.repaired;
    if (arrived) break;
  }
  return { arrived, repaired };
}

describe('the escort cart', () => {
  it('stays put when the player is out of range', () => {
    const c = newCartState(0, 0, 500);
    for (let i = 0; i < 300; i++) {
      stepCart(c, DT, { x: 1000, y: 0 }, { x: ESCORT_LEASH * 3, y: 0 }, open);
    }
    expect(c.x).toBe(0);
    expect(c.moving).toBe(false);
  });

  it('rolls toward the stop while the player walks beside it', () => {
    const c = newCartState(0, 0, 500);
    const { arrived } = escortFor(c, { x: 600, y: 0 }, 60 * 20);
    expect(arrived).toBe(true);
    expect(c.moving).toBe(true);
  });

  it('starts moving the moment the player comes inside the leash', () => {
    const c = newCartState(0, 0, 500);
    stepCart(c, DT, { x: 600, y: 0 }, { x: ESCORT_LEASH + 1, y: 0 }, open);
    expect(c.moving).toBe(false);
    stepCart(c, DT, { x: 600, y: 0 }, { x: ESCORT_LEASH - 1, y: 0 }, open);
    expect(c.moving).toBe(true);
  });

  it('steers around an obstacle instead of grinding into it', () => {
    // A wall across the direct route, with a gap well off the straight line.
    const wall = (x: number, y: number) => x > 200 && x < 264 && Math.abs(y) < 400;
    const c = newCartState(0, 0, 500);
    const { arrived } = escortFor(c, { x: 600, y: 0 }, 60 * 60, wall);
    expect(arrived).toBe(true);
    expect(c.x).toBeGreaterThan(264);
  });

  it('gives up on one way round and tries the other', () => {
    const c = newCartState(0, 0, 500);
    const blocked = () => true;
    const first = c.skirt;
    for (let i = 0; i < 60 * 13; i++) stepCart(c, DT, { x: 600, y: 0 }, { x: 10, y: 10 }, blocked);
    expect(c.skirt).toBe(first === 1 ? -1 : 1);
    expect(c.x).toBe(0);
  });

  it('breaks when its health runs out, and takes no further damage', () => {
    const c = newCartState(0, 0, 400);
    expect(damageCart(c, 150)).toBe(150);
    expect(c.broken).toBe(false);
    expect(damageCart(c, 900)).toBe(250);
    expect(c.broken).toBe(true);
    expect(c.health).toBe(0);
    expect(damageCart(c, 500)).toBe(0);
  });

  it('never moves while broken, then comes back on its own', () => {
    const c = newCartState(0, 0, 400);
    damageCart(c, 9999);
    const at = { x: c.x, y: c.y };
    let repaired = false;
    for (let i = 0; i < 60 * (ESCORT_REPAIR_SECONDS + 1); i++) {
      const r = stepCart(c, DT, { x: 600, y: 0 }, { x: c.x + 10, y: c.y }, open);
      if (r.repaired) { repaired = true; break; }
      expect(c.x).toBe(at.x);
      expect(c.y).toBe(at.y);
    }
    expect(repaired).toBe(true);
    expect(c.broken).toBe(false);
    expect(c.health).toBe(Math.round(400 * ESCORT_REPAIR_FRACTION));
  });

  it('can still be escorted after being repaired', () => {
    const c = newCartState(0, 0, 400);
    damageCart(c, 9999);
    c.repairIn = 0.01;
    stepCart(c, DT, { x: 600, y: 0 }, { x: 10, y: 0 }, open);
    const { arrived } = escortFor(c, { x: 400, y: 0 }, 60 * 20);
    expect(arrived).toBe(true);
  });

  it('patches up at a stop but never past full', () => {
    const c = newCartState(0, 0, 400);
    damageCart(c, 380);
    patchCart(c);
    expect(c.health).toBe(20 + 140);
    for (let i = 0; i < 10; i++) patchCart(c);
    expect(c.health).toBe(400);
  });

  it('is put back whole at a known stop on a retry', () => {
    const c = newCartState(0, 0, 400);
    damageCart(c, 9999);
    resetCart(c, 5 * TILE, 3 * TILE);
    expect(c).toMatchObject({ x: 5 * TILE, y: 3 * TILE, broken: false, health: 400, repairIn: 0 });
  });
});
