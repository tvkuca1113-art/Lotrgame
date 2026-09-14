import type { ResourceBundle, ResourceKey } from '@/types';
import type { GameState } from './state';

export const RESOURCE_KEYS: ResourceKey[] = ['gold', 'wood', 'stone', 'iron', 'shards'];

export function canAfford(state: GameState, cost: ResourceBundle): boolean {
  for (const k of RESOURCE_KEYS) {
    const need = cost[k] ?? 0;
    if (need > 0 && state.resources[k] < need) return false;
  }
  return true;
}

export function missingFor(state: GameState, cost: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const k of RESOURCE_KEYS) {
    const need = (cost[k] ?? 0) - state.resources[k];
    if (need > 0) out[k] = need;
  }
  return out;
}

/**
 * Spend resources atomically. Returns false and changes nothing if the player
 * cannot afford it, so a balance can never go negative and a double-click can
 * never double-charge.
 */
export function spend(state: GameState, cost: ResourceBundle): boolean {
  if (!canAfford(state, cost)) return false;
  for (const k of RESOURCE_KEYS) {
    const need = cost[k] ?? 0;
    if (need) state.resources[k] = Math.max(0, state.resources[k] - need);
  }
  return true;
}

export function grant(state: GameState, bundle: ResourceBundle): ResourceBundle {
  const given: ResourceBundle = {};
  for (const k of RESOURCE_KEYS) {
    const v = bundle[k] ?? 0;
    if (v > 0) {
      state.resources[k] += v;
      given[k] = v;
    }
  }
  return given;
}

export function refund(state: GameState, cost: ResourceBundle): ResourceBundle {
  return grant(state, cost);
}

export function bundleTotal(b: ResourceBundle): number {
  return RESOURCE_KEYS.reduce((s, k) => s + (b[k] ?? 0), 0);
}

export function addBundles(a: ResourceBundle, b: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const k of RESOURCE_KEYS) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (v) out[k] = v;
  }
  return out;
}

export function scaleBundle(b: ResourceBundle, k: number): ResourceBundle {
  const out: ResourceBundle = {};
  for (const key of RESOURCE_KEYS) {
    const v = Math.round((b[key] ?? 0) * k);
    if (v) out[key] = v;
  }
  return out;
}

// ------------------------------------------------------- one-time rewards

/**
 * Every reward carries a stable id. Granting a reward and marking it claimed
 * happen in the same call, which is what makes death, retry and reload unable
 * to duplicate anything.
 */
export function rewardId(...parts: (string | number)[]): string {
  return parts.join(':');
}

export function isClaimed(state: GameState, id: string): boolean {
  return state.campaign.claimedRewards.includes(id);
}

export interface ClaimResult {
  granted: boolean;
  bundle: ResourceBundle;
}

export function claimOnce(state: GameState, id: string, bundle: ResourceBundle): ClaimResult {
  if (isClaimed(state, id)) return { granted: false, bundle: {} };
  state.campaign.claimedRewards.push(id);
  return { granted: true, bundle: grant(state, bundle) };
}

/** Exploration pickups inside a run: banked per-run so a retry cannot re-collect. */
export function claimRunReward(state: GameState, runBanked: string[], id: string, bundle: ResourceBundle): ClaimResult {
  if (runBanked.includes(id) || isClaimed(state, id)) return { granted: false, bundle: {} };
  runBanked.push(id);
  return { granted: true, bundle: grant(state, bundle) };
}

/**
 * Exploration income per stage.
 *
 * Sized by the campaign simulation in tests/economy.test.ts: a main-path player
 * who never repeats a stage must be able to afford the whole settlement track,
 * a full weapon/armour/boot line and one ring taken to rank 10, with headroom
 * left over. An earlier pass left only 0.04% slack, which would have meant
 * grinding; this curve leaves a comfortable margin instead.
 */
export function explorationIncome(stage: number): ResourceBundle {
  return {
    gold: Math.round(60 + 32 * stage),
    wood: Math.round(5 + 1.15 * stage),
    stone: stage < 3 ? 0 : Math.round(1 + 1.25 * stage),
    iron: stage < 8 ? 0 : Math.round(0.6 * stage),
    shards: stage < 2 ? 0 : Math.round(1 + 0.55 * stage),
  };
}

/** Visible replay reward pool for a boss, shown on the mission board. */
export function replayPool(stage: number): ResourceBundle {
  return {
    gold: Math.round((80 + 35 * stage) * 0.4),
    wood: Math.round((9 + stage * 1.7) * 0.5),
    stone: stage < 3 ? 0 : Math.round((2 + stage * 1.9) * 0.5),
    iron: stage < 8 ? 0 : Math.round((1 + stage * 0.95) * 0.5),
    shards: stage < 2 ? 0 : Math.round((2 + stage * 0.75) * 0.6),
  };
}
