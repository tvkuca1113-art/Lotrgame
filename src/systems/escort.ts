import { TILE } from '@/systems/iso';

/**
 * The escort cart's rules, with no rendering attached so they can be tested
 * directly.
 *
 * The cart only rolls while the player walks beside it, which makes the escort
 * a matter of pace rather than a chase. It can be broken, but being broken is
 * never a failure state: it stops where it stands, repairs itself, and the
 * safe stops already reached stay reached.
 */

/** How far the player may stray before the cart stops. */
export const ESCORT_LEASH = TILE * 4;
/** How close counts as having reached a stop. */
export const ESCORT_ARRIVE = TILE * 0.8;
/** Seconds a broken cart spends off its wheels. */
export const ESCORT_REPAIR_SECONDS = 8;
/** Fraction of full health a repaired cart comes back with. */
export const ESCORT_REPAIR_FRACTION = 0.5;
/** Fraction of full health restored by reaching a stop. */
export const ESCORT_STOP_PATCH = 0.35;

export interface CartState {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  broken: boolean;
  repairIn: number;
  moving: boolean;
  /** Closest the cart has been to the stop, for the stuck detector. */
  lastDist: number;
  stuckFor: number;
  /** Which way round an obstacle the cart is currently trying. */
  skirt: 1 | -1;
  /** Seconds spent following a wall instead of heading straight for the stop. */
  skirtFor: number;
  speed: number;
}

export function newCartState(x: number, y: number, maxHealth: number, speed = 74): CartState {
  return {
    x, y, health: maxHealth, maxHealth, broken: false, repairIn: 0, moving: false,
    lastDist: Infinity, stuckFor: 0, skirt: 1, skirtFor: 0, speed,
  };
}

export type Blocked = (x: number, y: number) => boolean;

export interface CartStep {
  /** True on the step the cart reaches its stop. */
  arrived: boolean;
  /** True on the step a broken cart comes back. */
  repaired: boolean;
}

export function stepCart(
  c: CartState, dt: number,
  stop: { x: number; y: number } | null,
  player: { x: number; y: number },
  blocked: Blocked,
): CartStep {
  const out: CartStep = { arrived: false, repaired: false };

  if (c.broken) {
    c.repairIn -= dt;
    c.moving = false;
    if (c.repairIn <= 0) {
      c.broken = false;
      c.health = Math.max(1, Math.round(c.maxHealth * ESCORT_REPAIR_FRACTION));
      c.lastDist = Infinity;
      c.stuckFor = 0;
      c.skirtFor = 0;
      out.repaired = true;
    }
    return out;
  }

  if (!stop) { c.moving = false; return out; }
  c.moving = Math.hypot(player.x - c.x, player.y - c.y) < ESCORT_LEASH;
  if (!c.moving) return out;

  const dx = stop.x - c.x, dy = stop.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d < ESCORT_ARRIVE) {
    c.lastDist = Infinity;
    c.stuckFor = 0;
    c.skirtFor = 0;
    out.arrived = true;
    return out;
  }

  const base = Math.atan2(dy, dx);
  const step = c.speed * dt;
  const free = (a: number): { x: number; y: number } | null => {
    const nx = c.x + Math.cos(a) * step;
    const ny = c.y + Math.sin(a) * step;
    return blocked(nx, ny) ? null : { x: nx, y: ny };
  };

  // Straight at the stop whenever that is open and we are not mid-detour.
  const direct = free(base);
  if (c.skirtFor <= 0) {
    if (direct) {
      c.x = direct.x; c.y = direct.y;
      c.lastDist = Math.min(c.lastDist, d);
      return out;
    }
    // Something is in the way: commit to following it round.
    c.skirtFor = 0.001;
    c.lastDist = d;
  }

  // Detour: hug the obstacle by preferring the sideways heading. Going round
  // usually means getting further from the stop for a while, so the only thing
  // that ends a detour is the straight line opening up again.
  if (direct) {
    c.skirtFor = 0;
    c.stuckFor = 0;
    c.x = direct.x; c.y = direct.y;
    c.lastDist = Math.min(c.lastDist, d);
    return out;
  }
  c.skirtFor += dt;
  const half = Math.PI / 2;
  for (const turn of [c.skirt * half, c.skirt * (half / 2), c.skirt * (half * 1.5), c.skirt * Math.PI]) {
    const next = free(base + turn);
    if (next) { c.x = next.x; c.y = next.y; break; }
  }
  // Boxed in on that side for long enough: try the other way round.
  if (c.skirtFor > 12) { c.skirt = c.skirt === 1 ? -1 : 1; c.skirtFor = 0.001; }
  return out;
}

/** Returns the damage actually taken; a broken cart absorbs nothing more. */
export function damageCart(c: CartState, amount: number): number {
  if (c.broken || amount <= 0) return 0;
  const dealt = Math.min(c.health, Math.round(amount));
  c.health -= dealt;
  if (c.health <= 0) {
    c.broken = true;
    c.repairIn = ESCORT_REPAIR_SECONDS;
  }
  return dealt;
}

/** Reaching a safe stop patches the cart up a little. */
export function patchCart(c: CartState): void {
  if (c.broken) return;
  c.health = Math.min(c.maxHealth, c.health + Math.round(c.maxHealth * ESCORT_STOP_PATCH));
}

/** Puts the cart back at a known-good spot, whole, after a retry. */
export function resetCart(c: CartState, x: number, y: number): void {
  c.x = x;
  c.y = y;
  c.broken = false;
  c.repairIn = 0;
  c.health = c.maxHealth;
  c.moving = false;
  c.lastDist = Infinity;
  c.stuckFor = 0;
  c.skirtFor = 0;
}
