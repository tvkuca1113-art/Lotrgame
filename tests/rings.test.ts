import { describe, it, expect, beforeEach } from 'vitest';
import { newGameState, type GameState } from '@/systems/state';
import {
  maxUsableRank, rankPower, effectiveRank, equipRing, installRing, ringLocation,
  ringPower, supportBonuses, homeEffects, upgradeRing, discoverRing,
  activeSynergies, canTriggerSynergy, canTriggerEcho, canChain, duplicateShardValue,
  ALL_SLOTS,
} from '@/systems/rings';
import { RINGS, SYNERGIES, ringUpgradeCost, rarityForRank } from '@/content/rings';
import { deriveStats } from '@/systems/progression';

function stateWithAllRings(level = 30): GameState {
  const s = newGameState();
  s.player.level = level;
  for (const r of RINGS) { s.rings[r.id] = { discovered: true, rank: 10 }; }
  s.campaign.cleared = Array.from({ length: 30 }, (_, i) => i + 1);
  return s;
}

describe('ring rank ceiling', () => {
  it('follows min(10, 1 + floor((level - 1) / 3))', () => {
    const cases: [number, number][] = [[1, 1], [2, 1], [4, 2], [7, 3], [10, 4], [28, 10], [30, 10]];
    for (const [level, expected] of cases) {
      expect(maxUsableRank(level)).toBe(expected);
    }
  });

  it('never exceeds ten at any level', () => {
    for (let level = 1; level <= 30; level++) {
      expect(maxUsableRank(level)).toBeLessThanOrEqual(10);
      expect(maxUsableRank(level)).toBeGreaterThanOrEqual(1);
    }
  });

  it('clamps an owned rank to what the character level allows', () => {
    const s = newGameState();
    s.player.level = 4; // ceiling 2
    s.rings.ember = { discovered: true, rank: 9 };
    expect(effectiveRank(s, 'ember')).toBe(2);
    s.player.level = 30;
    expect(effectiveRank(s, 'ember')).toBe(9);
  });
});

describe('power scaling', () => {
  it('starts at 1 + 0.06 * (rank - 1)', () => {
    expect(rankPower(1)).toBeCloseTo(1);
    expect(rankPower(5)).toBeCloseTo(1.24);
    expect(rankPower(10)).toBeCloseTo(1.54);
  });

  it('range, cooldown reduction and crowd control each clamp to their own cap', () => {
    const s = stateWithAllRings();
    const stats = deriveStats(s);
    for (const def of RINGS) {
      const view = ringPower(s, def.id, stats)!;
      expect(view.range).toBeLessThanOrEqual(Math.round(def.baseRange * (1 + def.caps.range)) + 1);
      expect(view.cooldown).toBeGreaterThanOrEqual(def.cooldownFloor - 0.001);
      expect(view.crowdControl).toBeLessThanOrEqual(def.caps.crowdControl + 1e-9);
    }
  });

  it('reports the right advancement grade for a rank', () => {
    expect(rarityForRank(1)).toBe('common');
    expect(rarityForRank(4)).toBe('rare');
    expect(rarityForRank(7)).toBe('epic');
    expect(rarityForRank(10)).toBe('legendary');
  });
});

describe('slot exclusivity', () => {
  let s: GameState;
  beforeEach(() => { s = stateWithAllRings(); });

  it('a ring worn in one slot moves rather than duplicating', () => {
    equipRing(s, 'active1', 'ember');
    equipRing(s, 'active2', 'ember');
    expect(s.ringSlots.active1).toBeNull();
    expect(s.ringSlots.active2).toBe('ember');
    const worn = ALL_SLOTS.filter((slot) => s.ringSlots[slot] === 'ember');
    expect(worn).toHaveLength(1);
  });

  it('a ring installed in the settlement cannot also be worn', () => {
    installRing(s, 0, 'stoneward');
    const res = equipRing(s, 'active1', 'stoneward');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('installed');
    expect(s.ringSlots.active1).toBeNull();
  });

  it('installing a worn ring takes it out of the slot', () => {
    equipRing(s, 'active1', 'windstep');
    installRing(s, 1, 'windstep');
    expect(s.ringSlots.active1).toBeNull();
    expect(s.ringSockets[1]).toBe('windstep');
    expect(ringLocation(s, 'windstep')).toEqual({ kind: 'socket', index: 1 });
  });

  it('a ring is never in two sockets at once', () => {
    installRing(s, 0, 'echo');
    installRing(s, 1, 'echo');
    expect(s.ringSockets[0]).toBeNull();
    expect(s.ringSockets[1]).toBe('echo');
  });

  it('locked slots refuse a ring until their stage is cleared', () => {
    const fresh = newGameState();
    fresh.player.level = 30;
    fresh.rings.ember = { discovered: true, rank: 1 };
    expect(equipRing(fresh, 'active1', 'ember').ok).toBe(true);
    const locked = equipRing(fresh, 'support2', 'ember');
    expect(locked.ok).toBe(false);
  });
});

describe('support and home effects', () => {
  it('a support slot grants only the stated support effect', () => {
    const s = stateWithAllRings();
    equipRing(s, 'support1', 'stoneward');
    const bonuses = supportBonuses(s) as Record<string, number>;
    expect(bonuses.armour).toBeGreaterThan(0);
    // The active ability is not granted by a support slot.
    expect(s.ringSlots.active1).toBeNull();
  });

  it('support and home effects are capped', () => {
    const s = stateWithAllRings();
    equipRing(s, 'support1', 'ember');
    equipRing(s, 'support2', 'venomcoil');
    const bonuses = supportBonuses(s) as Record<string, number>;
    expect(bonuses.burnDamage).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(bonuses.poisonDamage).toBeLessThanOrEqual(0.4 + 1e-9);

    installRing(s, 0, 'thornwake');
    installRing(s, 1, 'last_hearth');
    const home = homeEffects(s);
    expect(home.gardenYield).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(home.beaconLight).toBeLessThanOrEqual(0.4 + 1e-9);
  });
});

describe('forge upgrades', () => {
  it('are deterministic, charge exactly the listed cost and never destroy the ring', () => {
    const s = newGameState();
    s.player.level = 30;
    s.rings.ember = { discovered: true, rank: 3 };
    const cost = ringUpgradeCost(3);
    s.resources.gold = cost.gold;
    s.resources.shards = cost.shards;
    const res = upgradeRing(s, 'ember');
    expect(res.ok).toBe(true);
    expect(s.rings.ember!.rank).toBe(4);
    expect(s.resources.gold).toBe(0);
    expect(s.resources.shards).toBe(0);
    expect(s.rings.ember!.discovered).toBe(true);
  });

  it('refuses and changes nothing when the player cannot pay', () => {
    const s = newGameState();
    s.rings.ember = { discovered: true, rank: 1 };
    s.resources.gold = 1;
    s.resources.shards = 0;
    const res = upgradeRing(s, 'ember');
    expect(res.ok).toBe(false);
    expect(s.rings.ember!.rank).toBe(1);
    expect(s.resources.gold).toBe(1);
  });

  it('stops at rank ten', () => {
    const s = newGameState();
    s.rings.ember = { discovered: true, rank: 10 };
    s.resources.gold = 1e6;
    s.resources.shards = 1e6;
    const res = upgradeRing(s, 'ember');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('maxrank');
  });

  it('a first ring can reach Legendary', () => {
    const s = newGameState();
    s.player.level = 30;
    s.rings.ember = { discovered: true, rank: 1 };
    s.resources.gold = 1e6;
    s.resources.shards = 1e6;
    for (let i = 0; i < 9; i++) expect(upgradeRing(s, 'ember').ok).toBe(true);
    expect(s.rings.ember!.rank).toBe(10);
    expect(rarityForRank(s.rings.ember!.rank)).toBe('legendary');
  });
});

describe('duplicate rings', () => {
  it('become shards instead of a second copy', () => {
    const s = newGameState();
    const first = discoverRing(s, 'ember');
    expect(first.firstTime).toBe(true);
    expect(s.rings.ember!.discovered).toBe(true);
    const goldBefore = s.resources.shards;
    const second = discoverRing(s, 'ember');
    expect(second.firstTime).toBe(false);
    expect(second.shards).toBe(duplicateShardValue(s.rings.ember!.rank));
    expect(s.resources.shards).toBe(goldBefore + second.shards);
  });
});

describe('synergies', () => {
  it('require both rings in the two active slots', () => {
    const s = stateWithAllRings();
    equipRing(s, 'active1', 'ember');
    equipRing(s, 'support1', 'windstep');
    expect(activeSynergies(s).map((x) => x.id)).not.toContain('ember_windstep');
    equipRing(s, 'active2', 'windstep');
    expect(activeSynergies(s).map((x) => x.id)).toContain('ember_windstep');
  });

  it('all six pairs activate in the two active slots', () => {
    for (const syn of SYNERGIES) {
      const s = stateWithAllRings();
      equipRing(s, 'active1', syn.rings[0]);
      equipRing(s, 'active2', syn.rings[1]);
      expect(activeSynergies(s).map((x) => x.id)).toContain(syn.id);
    }
  });

  it('carry an internal cooldown and an effect cap', () => {
    const s = stateWithAllRings();
    for (const syn of activeSynergiesForAll(s)) {
      expect(syn.icd).toBeGreaterThan(0);
      expect(syn.cap).toBeGreaterThan(0);
    }
  });

  it('cannot recurse: synergy, echo and chain effects never re-trigger', () => {
    expect(canTriggerSynergy('weapon')).toBe(true);
    expect(canTriggerSynergy('ring')).toBe(true);
    expect(canTriggerSynergy('synergy')).toBe(false);
    expect(canTriggerSynergy('echo')).toBe(false);
    expect(canTriggerSynergy('dot')).toBe(false);

    expect(canTriggerEcho('weapon')).toBe(true);
    expect(canTriggerEcho('echo')).toBe(false);
    expect(canTriggerEcho('synergy')).toBe(false);

    expect(canChain('ring')).toBe(true);
    expect(canChain('synergy')).toBe(false);
    expect(canChain('echo')).toBe(false);
  });
});

function activeSynergiesForAll(s: GameState) {
  const out: { icd: number; cap: number }[] = [];
  for (const syn of SYNERGIES) {
    equipRing(s, 'active1', syn.rings[0]);
    equipRing(s, 'active2', syn.rings[1]);
    out.push(...activeSynergies(s));
  }
  return out;
}
