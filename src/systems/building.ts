import type { ResourceBundle } from '@/types';
import { BUILDINGS, buildingById, HOME_TIERS, homeTier, RING_SOCKET_UNLOCK_STAGE } from '@/content/buildings';
import type { GameState, PlacedBuilding } from './state';
import { canAfford, spend, refund } from './economy';
import { newUid } from './inventory';

export interface Footprint { gx: number; gy: number; w: number; d: number }

/** Rotation swaps width and depth; structures are axis-aligned on the grid. */
export function footprintOf(b: { id: string; gx: number; gy: number; rotation: number }): Footprint {
  const def = buildingById(b.id);
  const w = def?.gridW ?? 1;
  const d = def?.gridD ?? 1;
  const swap = b.rotation % 2 === 1;
  return { gx: b.gx, gy: b.gy, w: swap ? d : w, d: swap ? w : d };
}

export function plotSize(state: GameState): { w: number; d: number } {
  const tier = homeTier(Math.max(0, state.home.tier));
  return { w: tier.plotW, d: tier.plotD };
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return a.gx < b.gx + b.w && a.gx + a.w > b.gx && a.gy < b.gy + b.d && a.gy + a.d > b.gy;
}

export type PlacementProblem = 'outside' | 'overlap' | 'door' | 'unreachable' | 'unique' | 'tier' | 'cost' | null;

/**
 * Door cells must stay clear. A structure the player has to walk up to reserves
 * the row immediately in front of its footprint, so nothing can wall them out
 * of a forge. Walls, gates and decoration have no doorway of their own - a wall
 * run would otherwise be impossible to build.
 */
function hasDoorway(id: string): boolean {
  const def = buildingById(id);
  if (!def) return false;
  return !def.decorative && def.role !== 'wall' && def.role !== 'gate';
}

function doorCells(f: Footprint): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = f.gx; x < f.gx + f.w; x++) out.push({ x, y: f.gy + f.d });
  return out;
}

export interface ValidationContext {
  /** The building being validated is excluded from overlap checks when moving. */
  ignoreUid?: string;
}

export function validatePlacement(
  state: GameState,
  candidate: { id: string; gx: number; gy: number; rotation: number },
  ctx: ValidationContext = {},
): PlacementProblem {
  const def = buildingById(candidate.id);
  if (!def) return 'unique';
  if (def.requiresTier > Math.max(0, state.home.tier)) return 'tier';
  const f = footprintOf(candidate);
  const plot = plotSize(state);
  if (f.gx < 0 || f.gy < 0 || f.gx + f.w > plot.w || f.gy + f.d > plot.d) return 'outside';

  const others = state.home.buildings.filter((b) => b.uid !== ctx.ignoreUid);
  for (const other of others) {
    if (overlaps(f, footprintOf(other))) return 'overlap';
  }

  // Nothing may sit on another structure's doorway...
  for (const other of others) {
    if (!hasDoorway(other.id)) continue;
    for (const c of doorCells(footprintOf(other))) {
      if (c.x >= f.gx && c.x < f.gx + f.w && c.y >= f.gy && c.y < f.gy + f.d) return 'door';
    }
  }
  // ...and this structure's own doorway must stay inside the plot and clear.
  if (hasDoorway(candidate.id)) {
    for (const c of doorCells(f)) {
      if (c.x < 0 || c.y < 0 || c.x >= plot.w || c.y >= plot.d) return 'door';
      for (const other of others) {
        const of2 = footprintOf(other);
        if (c.x >= of2.gx && c.x < of2.gx + of2.w && c.y >= of2.gy && c.y < of2.gy + of2.d) return 'door';
      }
    }
  }

  if (def.unique && others.some((b) => b.id === def.id)) return 'unique';

  // Walls and gates must not seal a workstation away from the plot entrance.
  if (!isReachableAfter(state, candidate, ctx.ignoreUid)) return 'unreachable';
  return null;
}

/**
 * Flood fill from the plot entrance (0, plot.d - 1) across free cells and the
 * doorways of functional structures. Every functional building must remain
 * reachable.
 */
export function isReachableAfter(
  state: GameState,
  candidate: { id: string; gx: number; gy: number; rotation: number } | null,
  ignoreUid?: string,
): boolean {
  const plot = plotSize(state);
  const placed = state.home.buildings.filter((b) => b.uid !== ignoreUid);
  const list = candidate ? [...placed, { ...candidate, uid: '__candidate', variant: 0 } as PlacedBuilding] : placed;

  const solid: boolean[][] = Array.from({ length: plot.d }, () => Array.from({ length: plot.w }, () => false));
  for (const b of list) {
    const def = buildingById(b.id);
    if (!def) continue;
    // Only walls, gates and full structures block movement; paving does not.
    const blocks = def.role !== 'decor' || def.id !== 'path_stone';
    if (!blocks) continue;
    const f = footprintOf(b);
    for (let y = f.gy; y < f.gy + f.d; y++) {
      for (let x = f.gx; x < f.gx + f.w; x++) {
        if (y >= 0 && y < plot.d && x >= 0 && x < plot.w) solid[y]![x] = true;
      }
    }
  }
  // Gates are passable.
  for (const b of list) {
    const def = buildingById(b.id);
    if (def?.role !== 'gate') continue;
    const f = footprintOf(b);
    for (let y = f.gy; y < f.gy + f.d; y++) {
      for (let x = f.gx; x < f.gx + f.w; x++) {
        if (y >= 0 && y < plot.d && x >= 0 && x < plot.w) solid[y]![x] = false;
      }
    }
  }

  const start = { x: 0, y: plot.d - 1 };
  if (solid[start.y]![start.x]) {
    // Entrance blocked outright.
    return false;
  }
  const seen: boolean[][] = Array.from({ length: plot.d }, () => Array.from({ length: plot.w }, () => false));
  const queue = [start];
  seen[start.y]![start.x] = true;
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= plot.w || ny >= plot.d) continue;
      if (seen[ny]![nx] || solid[ny]![nx]) continue;
      seen[ny]![nx] = true;
      queue.push({ x: nx, y: ny });
    }
  }

  for (const b of list) {
    if (!hasDoorway(b.id)) continue;
    const f = footprintOf(b);
    const reachable = doorCells(f).some((c) => c.x >= 0 && c.y >= 0 && c.x < plot.w && c.y < plot.d && seen[c.y]![c.x]);
    if (!reachable) return false;
  }
  return true;
}

export type BuildResult =
  | { ok: true; uid: string; spent: ResourceBundle }
  | { ok: false; reason: PlacementProblem | 'cost' };

export function placeBuilding(
  state: GameState,
  id: string,
  gx: number,
  gy: number,
  rotation: 0 | 1 | 2 | 3 = 0,
  variant = 0,
): BuildResult {
  const def = buildingById(id);
  if (!def) return { ok: false, reason: 'unique' };
  const problem = validatePlacement(state, { id, gx, gy, rotation });
  if (problem) return { ok: false, reason: problem };
  if (!canAfford(state, def.cost)) return { ok: false, reason: 'cost' };
  if (!spend(state, def.cost)) return { ok: false, reason: 'cost' };
  const uid = newUid('b');
  state.home.buildings.push({ uid, id, gx, gy, rotation, variant });
  return { ok: true, uid, spent: def.cost };
}

/** Moving is free. */
export function moveBuilding(
  state: GameState,
  uid: string,
  gx: number,
  gy: number,
  rotation?: 0 | 1 | 2 | 3,
): { ok: boolean; reason?: PlacementProblem } {
  const b = state.home.buildings.find((x) => x.uid === uid);
  if (!b) return { ok: false, reason: 'unique' };
  const rot = rotation ?? b.rotation;
  const problem = validatePlacement(state, { id: b.id, gx, gy, rotation: rot }, { ignoreUid: uid });
  if (problem) return { ok: false, reason: problem };
  b.gx = gx; b.gy = gy; b.rotation = rot;
  return { ok: true };
}

/** Dismantling refunds the listed construction resources in full. */
export function removeBuilding(state: GameState, uid: string): { ok: boolean; refunded: ResourceBundle } {
  const idx = state.home.buildings.findIndex((b) => b.uid === uid);
  if (idx < 0) return { ok: false, refunded: {} };
  const b = state.home.buildings[idx]!;
  const def = buildingById(b.id);
  state.home.buildings.splice(idx, 1);
  // Removing a structure never deletes a ring: the socket simply empties.
  if (def?.socket !== undefined) {
    const ring = state.ringSockets[def.socket];
    if (ring) state.ringSockets[def.socket] = null;
  }
  const refunded = def ? refund(state, def.cost) : {};
  return { ok: true, refunded };
}

// -------------------------------------------------------------- undo stack

export interface BuildAction {
  kind: 'place' | 'move' | 'remove';
  uid: string;
  before?: PlacedBuilding;
  after?: PlacedBuilding;
}

export class BuildHistory {
  private stack: BuildAction[] = [];
  push(a: BuildAction): void {
    this.stack.push(a);
    if (this.stack.length > 32) this.stack.shift();
  }
  canUndo(): boolean { return this.stack.length > 0; }
  clear(): void { this.stack.length = 0; }

  /** Undo the most recent placement, move or dismantle. */
  undo(state: GameState): BuildAction | null {
    const a = this.stack.pop();
    if (!a) return null;
    if (a.kind === 'place') {
      removeBuilding(state, a.uid);
    } else if (a.kind === 'move' && a.before) {
      const b = state.home.buildings.find((x) => x.uid === a.uid);
      if (b) { b.gx = a.before.gx; b.gy = a.before.gy; b.rotation = a.before.rotation; }
    } else if (a.kind === 'remove' && a.before) {
      const def = buildingById(a.before.id);
      if (def) spend(state, def.cost);
      state.home.buildings.push({ ...a.before });
    }
    return a;
  }
}

// -------------------------------------------------------------- home tiers

export function nextHomeTier(state: GameState) {
  const next = HOME_TIERS[state.home.tier + 1];
  return next ?? null;
}

export type UpgradeHomeResult = { ok: true; tier: number } | { ok: false; reason: 'max' | 'stage' | 'cost' };

export function upgradeHome(state: GameState): UpgradeHomeResult {
  const next = nextHomeTier(state);
  if (!next) return { ok: false, reason: 'max' };
  const highestCleared = state.campaign.cleared.length ? Math.max(...state.campaign.cleared) : 0;
  if (highestCleared < next.unlockStage - (next.tier === 0 ? 1 : 0)) {
    if (next.tier > 0) return { ok: false, reason: 'stage' };
  }
  if (!canAfford(state, next.cost)) return { ok: false, reason: 'cost' };
  if (!spend(state, next.cost)) return { ok: false, reason: 'cost' };
  state.home.tier = next.tier;
  return { ok: true, tier: next.tier };
}

export function availableBuildings(state: GameState) {
  return BUILDINGS.filter((b) => b.requiresTier <= Math.max(0, state.home.tier));
}

export function socketsUnlocked(state: GameState): boolean {
  return state.campaign.cleared.some((c) => c >= RING_SOCKET_UNLOCK_STAGE);
}

export function hasBuilding(state: GameState, id: string): boolean {
  return state.home.buildings.some((b) => b.id === id);
}

/** The next two achievable improvements, shown on the home HUD. */
export function suggestImprovements(state: GameState): { kind: 'home' | 'build'; id: string; cost: ResourceBundle }[] {
  const out: { kind: 'home' | 'build'; id: string; cost: ResourceBundle }[] = [];
  const next = nextHomeTier(state);
  const highestCleared = state.campaign.cleared.length ? Math.max(...state.campaign.cleared) : 0;
  if (next && (next.tier === 0 || highestCleared >= next.unlockStage)) {
    out.push({ kind: 'home', id: next.id, cost: next.cost });
  }
  for (const b of availableBuildings(state)) {
    if (out.length >= 2) break;
    if (b.decorative) continue;
    if (b.unique && hasBuilding(state, b.id)) continue;
    out.push({ kind: 'build', id: b.id, cost: b.cost });
  }
  return out.slice(0, 2);
}
