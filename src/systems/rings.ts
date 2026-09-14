import type { RingDef, RingSlot, Rarity } from '@/types';
import { RINGS, SYNERGIES, ringById, rarityForRank, ringUpgradeCost, RING_SLOT_UNLOCK } from '@/content/rings';
import type { GameState } from './state';
import type { DerivedStats } from './progression';

export const ACTIVE_SLOTS: RingSlot[] = ['active1', 'active2'];
export const SUPPORT_SLOTS: RingSlot[] = ['support1', 'support2'];
export const ALL_SLOTS: RingSlot[] = ['active1', 'active2', 'support1', 'support2'];

/** Maximum usable rank for a character level, exactly as specified. */
export function maxUsableRank(characterLevel: number): number {
  return Math.min(10, 1 + Math.floor((characterLevel - 1) / 3));
}

/** Base numeric power scaling. */
export function rankPower(rank: number): number {
  return 1 + 0.06 * (rank - 1);
}

/** Effective rank: owned rank clamped by the character-level ceiling. */
export function effectiveRank(state: GameState, ringId: string): number {
  const r = state.rings[ringId];
  if (!r || !r.discovered) return 0;
  return Math.max(1, Math.min(r.rank, maxUsableRank(state.player.level)));
}

export function rarityOf(state: GameState, ringId: string): Rarity {
  return rarityForRank(state.rings[ringId]?.rank ?? 1);
}

export function isSlotUnlocked(state: GameState, slot: RingSlot): boolean {
  const need = RING_SLOT_UNLOCK[slot];
  if (need === 0) return true;
  return state.campaign.cleared.includes(need) || state.campaign.cleared.some((c) => c >= need);
}

export function slotUnlockStage(slot: RingSlot): number {
  return RING_SLOT_UNLOCK[slot];
}

/** A ring can only be in one place at a time: one slot, or one settlement socket. */
export function ringLocation(state: GameState, ringId: string): { kind: 'slot'; slot: RingSlot } | { kind: 'socket'; index: 0 | 1 } | null {
  for (const slot of ALL_SLOTS) if (state.ringSlots[slot] === ringId) return { kind: 'slot', slot };
  if (state.ringSockets[0] === ringId) return { kind: 'socket', index: 0 };
  if (state.ringSockets[1] === ringId) return { kind: 'socket', index: 1 };
  return null;
}

export type EquipResult =
  | { ok: true; displaced?: string | null }
  | { ok: false; reason: 'undiscovered' | 'locked' | 'installed' | 'unknown' };

/**
 * Wear a ring. Exclusivity is enforced here: equipping a ring that is already
 * worn elsewhere moves it, and a ring installed in the settlement must be
 * retrieved first.
 */
export function equipRing(state: GameState, slot: RingSlot, ringId: string | null): EquipResult {
  if (ringId === null) {
    state.ringSlots[slot] = null;
    return { ok: true };
  }
  if (!ringById(ringId)) return { ok: false, reason: 'unknown' };
  if (!state.rings[ringId]?.discovered) return { ok: false, reason: 'undiscovered' };
  if (!isSlotUnlocked(state, slot)) return { ok: false, reason: 'locked' };
  const loc = ringLocation(state, ringId);
  if (loc?.kind === 'socket') return { ok: false, reason: 'installed' };
  const displaced = state.ringSlots[slot];
  if (loc?.kind === 'slot') state.ringSlots[loc.slot] = null;
  state.ringSlots[slot] = ringId;
  return { ok: true, displaced: displaced ?? null };
}

export type SocketResult = { ok: true } | { ok: false; reason: 'locked' | 'undiscovered' | 'worn' | 'unknown' };

/** Install a ring in one of the two settlement sockets. */
export function installRing(state: GameState, index: 0 | 1, ringId: string | null): SocketResult {
  if (ringId === null) {
    state.ringSockets[index] = null;
    return { ok: true };
  }
  if (!ringById(ringId)) return { ok: false, reason: 'unknown' };
  if (!state.rings[ringId]?.discovered) return { ok: false, reason: 'undiscovered' };
  const loc = ringLocation(state, ringId);
  if (loc?.kind === 'slot') {
    // Switching is free at home: pull it out of the worn slot automatically.
    state.ringSlots[loc.slot] = null;
  } else if (loc?.kind === 'socket' && loc.index !== index) {
    state.ringSockets[loc.index] = null;
  }
  state.ringSockets[index] = ringId;
  return { ok: true };
}

// ------------------------------------------------------------- ring powers

export interface RingPowerView {
  def: RingDef;
  rank: number;
  rarity: Rarity;
  power: number;
  damage: number;
  range: number;
  cooldown: number;
  evolved4: boolean;
  evolved7: boolean;
  crowdControl: number;
}

/**
 * Resolve a ring's live numbers. Range, cooldown reduction and crowd control
 * each clamp against their own cap so no single stat can run away.
 */
export function ringPower(state: GameState, ringId: string, stats?: DerivedStats): RingPowerView | null {
  const def = ringById(ringId);
  if (!def) return null;
  const rank = effectiveRank(state, ringId);
  if (rank === 0) return null;
  const base = rankPower(rank);
  const talentPower = 1 + (stats?.ringPower ?? 0);
  const power = base * talentPower;

  const rangeGrowth = Math.min(def.caps.range, 0.03 * (rank - 1) + (stats?.ringRange ?? 0));
  const cdrRaw = Math.min(def.caps.cooldownReduction, 0.025 * (rank - 1) + Math.abs(stats?.ringCooldown ?? 0));
  const cooldown = Math.max(def.cooldownFloor, def.cooldown * (1 - cdrRaw));
  const cc = Math.min(def.caps.crowdControl, 0.035 * (rank - 1));

  return {
    def,
    rank,
    rarity: rarityForRank(state.rings[ringId]?.rank ?? rank),
    power,
    damage: Math.round(def.baseDamage * power),
    range: Math.round(def.baseRange * (1 + rangeGrowth)),
    cooldown,
    evolved4: rank >= 4,
    evolved7: rank >= 7,
    crowdControl: cc,
  };
}

/** Support effects from the two support slots, capped per ring. */
export function supportBonuses(state: GameState, supportPower = 0): Partial<DerivedStats> {
  const out: Record<string, number> = {};
  for (const slot of SUPPORT_SLOTS) {
    const id = state.ringSlots[slot];
    if (!id) continue;
    const def = ringById(id);
    if (!def) continue;
    const rank = effectiveRank(state, id);
    if (rank === 0) continue;
    const value = Math.min(def.support.cap, def.support.perRank * rank) * (1 + supportPower);
    out[def.support.stat] = (out[def.support.stat] ?? 0) + value;
  }
  return out as Partial<DerivedStats>;
}

/** Home effects from the two settlement sockets, capped per ring. */
export function homeEffects(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.ringSockets) {
    if (!id) continue;
    const def = ringById(id);
    if (!def) continue;
    const rank = effectiveRank(state, id);
    if (rank === 0) continue;
    out[def.home.effect] = (out[def.home.effect] ?? 0) + Math.min(def.home.cap, def.home.perRank * rank);
  }
  return out;
}

// --------------------------------------------------------------- upgrading

export type UpgradeResult =
  | { ok: true; rank: number; spent: { gold: number; shards: number } }
  | { ok: false; reason: 'maxrank' | 'resources' | 'undiscovered' | 'unknown' };

/**
 * Deterministic forge upgrade. Costs are fixed, the ring is never destroyed,
 * and the rank ceiling is the hard cap of 10 (the usable ceiling from character
 * level is applied separately, at use time).
 */
export function upgradeRing(state: GameState, ringId: string): UpgradeResult {
  const def = ringById(ringId);
  if (!def) return { ok: false, reason: 'unknown' };
  const rs = state.rings[ringId];
  if (!rs?.discovered) return { ok: false, reason: 'undiscovered' };
  if (rs.rank >= 10) return { ok: false, reason: 'maxrank' };
  const cost = ringUpgradeCost(rs.rank);
  if (state.resources.gold < cost.gold || state.resources.shards < cost.shards) {
    return { ok: false, reason: 'resources' };
  }
  state.resources.gold -= cost.gold;
  state.resources.shards -= cost.shards;
  rs.rank += 1;
  return { ok: true, rank: rs.rank, spent: cost };
}

export function upgradeCostFor(state: GameState, ringId: string): { gold: number; shards: number } | null {
  const rs = state.rings[ringId];
  if (!rs || rs.rank >= 10) return null;
  return ringUpgradeCost(rs.rank);
}

/** Shards awarded when a ring you already own is found again. */
export function duplicateShardValue(rank: number): number {
  return 4 + rank * 2;
}

export interface DiscoveryResult {
  firstTime: boolean;
  shards: number;
}

/** Discovering a ring. A duplicate becomes shards with a clear notification. */
export function discoverRing(state: GameState, ringId: string): DiscoveryResult {
  const rs = state.rings[ringId];
  if (!rs) return { firstTime: false, shards: 0 };
  if (rs.discovered) {
    const shards = duplicateShardValue(rs.rank);
    state.resources.shards += shards;
    return { firstTime: false, shards };
  }
  rs.discovered = true;
  rs.rank = Math.max(1, rs.rank);
  // Auto-wear the first ring so the player immediately has the ability.
  if (!state.ringSlots.active1) state.ringSlots.active1 = ringId;
  return { firstTime: true, shards: 0 };
}

export function discoveredRings(state: GameState): RingDef[] {
  return RINGS.filter((r) => state.rings[r.id]?.discovered);
}

export function undiscoveredRings(state: GameState): RingDef[] {
  return RINGS.filter((r) => !state.rings[r.id]?.discovered);
}

// --------------------------------------------------------------- synergies

export interface ActiveSynergy {
  id: string;
  nameKey: string;
  descKey: string;
  icd: number;
  cap: number;
}

/**
 * Which synergies are live. Every pair requires both rings in the two ACTIVE
 * slots; support slots grant only their stated support effect.
 */
export function activeSynergies(state: GameState, synergyIcdMod = 0): ActiveSynergy[] {
  const worn = new Set([state.ringSlots.active1, state.ringSlots.active2].filter(Boolean) as string[]);
  const out: ActiveSynergy[] = [];
  for (const s of SYNERGIES) {
    if (worn.has(s.rings[0]) && worn.has(s.rings[1])) {
      out.push({
        id: s.id,
        nameKey: s.nameKey,
        descKey: s.descKey,
        icd: Math.max(2, s.icd * (1 + synergyIcdMod)),
        cap: s.cap,
      });
    }
  }
  return out;
}

export function recordSynergyDiscovery(state: GameState, id: string): boolean {
  if (state.journal.synergies.includes(id)) return false;
  state.journal.synergies.push(id);
  return true;
}

/**
 * Synergy-triggered effects are tagged so they can never recursively trigger
 * another synergy, Echo, or a further chain. Combat code passes the source tag
 * through every damage event.
 */
export type EffectSource = 'weapon' | 'ring' | 'synergy' | 'echo' | 'environment' | 'dot';

export function canTriggerSynergy(source: EffectSource): boolean {
  return source === 'weapon' || source === 'ring';
}

export function canTriggerEcho(source: EffectSource): boolean {
  return source === 'weapon';
}

export function canChain(source: EffectSource): boolean {
  return source === 'weapon' || source === 'ring';
}

/** Ring-sight readings available with the currently worn rings. */
export function ringSightAvailable(state: GameState, ring: string): boolean {
  return ALL_SLOTS.some((s) => state.ringSlots[s] === ring) && effectiveRank(state, ring) > 0;
}
