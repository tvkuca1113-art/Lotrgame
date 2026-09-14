import type { RingDef, SynergyDef } from '@/types';

/**
 * The twelve lesser rings of the northern valley.
 *
 * These are original artefacts written for this side story. They are not the
 * One Ring and they are not stand-ins for the canonical Great Rings; each is a
 * small hearth-craft working made by the Ashen Regent's apprentices before the
 * beacons were raised.
 *
 * Numbers here are the *initial balance pass* described in the design brief:
 *   power   = 1 + 0.06 * (rank - 1)
 *   maxRank = min(10, 1 + floor((characterLevel - 1) / 3))
 * Range, cooldown reduction and crowd control each carry their own cap so no
 * single stat can run away as ranks climb.
 */
export const RINGS: readonly RingDef[] = [
  {
    id: 'ember',
    nameKey: 'ring.ember.name',
    loreKey: 'ring.ember.lore',
    activeKey: 'ring.ember.active',
    supportKey: 'ring.ember.support',
    homeKey: 'ring.ember.home',
    source: 1,
    cooldown: 8,
    cooldownFloor: 5.2,
    baseDamage: 26,
    baseRange: 210,
    caps: { range: 0.3, cooldownReduction: 0.35, crowdControl: 0.4 },
    evolutions: [
      { rank: 4, key: 'ring.ember.evo4' },
      { rank: 7, key: 'ring.ember.evo7' },
    ],
    support: { stat: 'burnDamage', perRank: 0.04, cap: 0.4 },
    home: { effect: 'winterPrep', perRank: 0.03, cap: 0.3 },
    tags: ['fire', 'arc', 'ignite'],
  },
  {
    id: 'stoneward',
    nameKey: 'ring.stoneward.name',
    loreKey: 'ring.stoneward.lore',
    activeKey: 'ring.stoneward.active',
    supportKey: 'ring.stoneward.support',
    homeKey: 'ring.stoneward.home',
    source: 2,
    cooldown: 14,
    cooldownFloor: 9.1,
    baseDamage: 18,
    baseRange: 130,
    caps: { range: 0.25, cooldownReduction: 0.35, crowdControl: 0.35 },
    evolutions: [
      { rank: 4, key: 'ring.stoneward.evo4' },
      { rank: 7, key: 'ring.stoneward.evo7' },
    ],
    support: { stat: 'armour', perRank: 0.03, cap: 0.3 },
    home: { effect: 'defenceWard', perRank: 0.035, cap: 0.35 },
    tags: ['barrier', 'defence'],
  },
  {
    id: 'windstep',
    nameKey: 'ring.windstep.name',
    loreKey: 'ring.windstep.lore',
    activeKey: 'ring.windstep.active',
    supportKey: 'ring.windstep.support',
    homeKey: 'ring.windstep.home',
    source: 4,
    cooldown: 9,
    cooldownFloor: 5.9,
    baseDamage: 22,
    baseRange: 260,
    caps: { range: 0.3, cooldownReduction: 0.35, crowdControl: 0.3 },
    evolutions: [
      { rank: 4, key: 'ring.windstep.evo4' },
      { rank: 7, key: 'ring.windstep.evo7' },
    ],
    support: { stat: 'moveSpeed', perRank: 0.02, cap: 0.2 },
    home: { effect: 'scouting', perRank: 0.04, cap: 0.4 },
    tags: ['dash', 'mobility', 'wind'],
  },
  {
    id: 'thornwake',
    nameKey: 'ring.thornwake.name',
    loreKey: 'ring.thornwake.lore',
    activeKey: 'ring.thornwake.active',
    supportKey: 'ring.thornwake.support',
    homeKey: 'ring.thornwake.home',
    source: 6,
    cooldown: 13,
    cooldownFloor: 8.5,
    baseDamage: 14,
    baseRange: 190,
    caps: { range: 0.28, cooldownReduction: 0.35, crowdControl: 0.45 },
    evolutions: [
      { rank: 4, key: 'ring.thornwake.evo4' },
      { rank: 7, key: 'ring.thornwake.evo7' },
    ],
    support: { stat: 'rootDuration', perRank: 0.04, cap: 0.4 },
    home: { effect: 'gardenYield', perRank: 0.03, cap: 0.3 },
    tags: ['root', 'control', 'nature'],
  },
  {
    id: 'dawnward',
    nameKey: 'ring.dawnward.name',
    loreKey: 'ring.dawnward.lore',
    activeKey: 'ring.dawnward.active',
    supportKey: 'ring.dawnward.support',
    homeKey: 'ring.dawnward.home',
    source: 8,
    cooldown: 15,
    cooldownFloor: 9.8,
    baseDamage: 30,
    baseRange: 230,
    caps: { range: 0.28, cooldownReduction: 0.35, crowdControl: 0.35 },
    evolutions: [
      { rank: 4, key: 'ring.dawnward.evo4' },
      { rank: 7, key: 'ring.dawnward.evo7' },
    ],
    support: { stat: 'darkResist', perRank: 0.03, cap: 0.3 },
    home: { effect: 'secretClues', perRank: 0.04, cap: 0.4 },
    tags: ['light', 'dispel'],
  },
  {
    id: 'venomcoil',
    nameKey: 'ring.venomcoil.name',
    loreKey: 'ring.venomcoil.lore',
    activeKey: 'ring.venomcoil.active',
    supportKey: 'ring.venomcoil.support',
    homeKey: 'ring.venomcoil.home',
    source: 9,
    cooldown: 7,
    cooldownFloor: 4.6,
    baseDamage: 16,
    baseRange: 300,
    caps: { range: 0.3, cooldownReduction: 0.35, crowdControl: 0.3 },
    evolutions: [
      { rank: 4, key: 'ring.venomcoil.evo4' },
      { rank: 7, key: 'ring.venomcoil.evo7' },
    ],
    support: { stat: 'poisonDamage', perRank: 0.04, cap: 0.4 },
    home: { effect: 'flaskRecovery', perRank: 0.02, cap: 0.2 },
    tags: ['poison', 'projectile'],
  },
  {
    id: 'frostwake',
    nameKey: 'ring.frostwake.name',
    loreKey: 'ring.frostwake.lore',
    activeKey: 'ring.frostwake.active',
    supportKey: 'ring.frostwake.support',
    homeKey: 'ring.frostwake.home',
    source: 11,
    cooldown: 12,
    cooldownFloor: 7.8,
    baseDamage: 24,
    baseRange: 250,
    caps: { range: 0.28, cooldownReduction: 0.35, crowdControl: 0.45 },
    evolutions: [
      { rank: 4, key: 'ring.frostwake.evo4' },
      { rank: 7, key: 'ring.frostwake.evo7' },
    ],
    support: { stat: 'slowPower', perRank: 0.04, cap: 0.4 },
    home: { effect: 'coldPrep', perRank: 0.03, cap: 0.3 },
    tags: ['frost', 'cone', 'slow'],
  },
  {
    id: 'iron_oath',
    nameKey: 'ring.iron_oath.name',
    loreKey: 'ring.iron_oath.lore',
    activeKey: 'ring.iron_oath.active',
    supportKey: 'ring.iron_oath.support',
    homeKey: 'ring.iron_oath.home',
    source: 13,
    cooldown: 11,
    cooldownFloor: 7.2,
    baseDamage: 34,
    baseRange: 120,
    caps: { range: 0.2, cooldownReduction: 0.35, crowdControl: 0.4 },
    evolutions: [
      { rank: 4, key: 'ring.iron_oath.evo4' },
      { rank: 7, key: 'ring.iron_oath.evo7' },
    ],
    support: { stat: 'blockWindow', perRank: 0.035, cap: 0.35 },
    home: { effect: 'barricade', perRank: 0.03, cap: 0.3 },
    tags: ['parry', 'stagger', 'defence'],
  },
  {
    id: 'echo',
    nameKey: 'ring.echo.name',
    loreKey: 'ring.echo.lore',
    activeKey: 'ring.echo.active',
    supportKey: 'ring.echo.support',
    homeKey: 'ring.echo.home',
    source: 14,
    cooldown: 10,
    cooldownFloor: 6.5,
    baseDamage: 0,
    baseRange: 0,
    caps: { range: 0.1, cooldownReduction: 0.35, crowdControl: 0.1 },
    evolutions: [
      { rank: 4, key: 'ring.echo.evo4' },
      { rank: 7, key: 'ring.echo.evo7' },
    ],
    support: { stat: 'weaponDamage', perRank: 0.02, cap: 0.2 },
    home: { effect: 'dummyReadout', perRank: 0.02, cap: 0.2 },
    tags: ['repeat', 'weapon'],
  },
  {
    id: 'stormcall',
    nameKey: 'ring.stormcall.name',
    loreKey: 'ring.stormcall.lore',
    activeKey: 'ring.stormcall.active',
    supportKey: 'ring.stormcall.support',
    homeKey: 'ring.stormcall.home',
    source: 17,
    cooldown: 14,
    cooldownFloor: 9.1,
    baseDamage: 32,
    baseRange: 280,
    caps: { range: 0.3, cooldownReduction: 0.35, crowdControl: 0.35 },
    evolutions: [
      { rank: 4, key: 'ring.stormcall.evo4' },
      { rank: 7, key: 'ring.stormcall.evo7' },
    ],
    support: { stat: 'shockDamage', perRank: 0.035, cap: 0.35 },
    home: { effect: 'watchScouting', perRank: 0.04, cap: 0.4 },
    tags: ['lightning', 'chain'],
  },
  {
    id: 'duskveil',
    nameKey: 'ring.duskveil.name',
    loreKey: 'ring.duskveil.lore',
    activeKey: 'ring.duskveil.active',
    supportKey: 'ring.duskveil.support',
    homeKey: 'ring.duskveil.home',
    source: 21,
    cooldown: 10,
    cooldownFloor: 6.5,
    baseDamage: 20,
    baseRange: 240,
    caps: { range: 0.28, cooldownReduction: 0.35, crowdControl: 0.4 },
    evolutions: [
      { rank: 4, key: 'ring.duskveil.evo4' },
      { rank: 7, key: 'ring.duskveil.evo7' },
    ],
    support: { stat: 'dodgeIFrames', perRank: 0.025, cap: 0.25 },
    home: { effect: 'altRoutes', perRank: 0.04, cap: 0.4 },
    tags: ['blink', 'shadow', 'taunt'],
  },
  {
    id: 'last_hearth',
    nameKey: 'ring.last_hearth.name',
    loreKey: 'ring.last_hearth.lore',
    activeKey: 'ring.last_hearth.active',
    supportKey: 'ring.last_hearth.support',
    homeKey: 'ring.last_hearth.home',
    source: 25,
    cooldown: 18,
    cooldownFloor: 11.7,
    baseDamage: 0,
    baseRange: 160,
    caps: { range: 0.25, cooldownReduction: 0.35, crowdControl: 0.3 },
    evolutions: [
      { rank: 4, key: 'ring.last_hearth.evo4' },
      { rank: 7, key: 'ring.last_hearth.evo7' },
    ],
    support: { stat: 'healPower', perRank: 0.03, cap: 0.3 },
    home: { effect: 'beaconLight', perRank: 0.04, cap: 0.4 },
    tags: ['shelter', 'projectile-block'],
  },
] as const;

export const RING_IDS = RINGS.map((r) => r.id);

/**
 * Discoverable pairings. Each needs both rings equipped in the two ACTIVE
 * slots; every synergy carries an internal cooldown and a hard effect cap, and
 * synergy-spawned effects are flagged so they can never re-trigger a synergy,
 * Echo, or another chain.
 */
export const SYNERGIES: readonly SynergyDef[] = [
  {
    id: 'ember_windstep',
    rings: ['ember', 'windstep'],
    nameKey: 'synergy.ember_windstep.name',
    descKey: 'synergy.ember_windstep.desc',
    icd: 6,
    cap: 6,
    slots: 'active-active',
  },
  {
    id: 'frostwake_stormcall',
    rings: ['frostwake', 'stormcall'],
    nameKey: 'synergy.frostwake_stormcall.name',
    descKey: 'synergy.frostwake_stormcall.desc',
    icd: 8,
    cap: 4,
    slots: 'active-active',
  },
  {
    id: 'thornwake_venomcoil',
    rings: ['thornwake', 'venomcoil'],
    nameKey: 'synergy.thornwake_venomcoil.name',
    descKey: 'synergy.thornwake_venomcoil.desc',
    icd: 7,
    cap: 5,
    slots: 'active-active',
  },
  {
    id: 'stoneward_iron_oath',
    rings: ['stoneward', 'iron_oath'],
    nameKey: 'synergy.stoneward_iron_oath.name',
    descKey: 'synergy.stoneward_iron_oath.desc',
    icd: 9,
    cap: 3,
    slots: 'active-active',
  },
  {
    id: 'echo_duskveil',
    rings: ['echo', 'duskveil'],
    nameKey: 'synergy.echo_duskveil.name',
    descKey: 'synergy.echo_duskveil.desc',
    icd: 8,
    cap: 2,
    slots: 'active-active',
  },
  {
    id: 'dawnward_last_hearth',
    rings: ['dawnward', 'last_hearth'],
    nameKey: 'synergy.dawnward_last_hearth.name',
    descKey: 'synergy.dawnward_last_hearth.desc',
    icd: 12,
    cap: 1,
    slots: 'active-active',
  },
] as const;

/** Ring slots and the stage that unlocks each. */
export const RING_SLOT_UNLOCK = {
  active1: 0,
  active2: 5,
  support1: 12,
  support2: 20,
} as const;

/** Visible advancement grades. */
export function rarityForRank(rank: number): 'common' | 'rare' | 'epic' | 'legendary' {
  if (rank >= 10) return 'legendary';
  if (rank >= 7) return 'epic';
  if (rank >= 4) return 'rare';
  return 'common';
}

/** Forge cost to take a ring from `rank` to `rank + 1`. */
export function ringUpgradeCost(rank: number): { gold: number; shards: number } {
  return {
    gold: Math.round(60 + 55 * rank + 14 * rank * rank),
    shards: Math.round(2 + 1.6 * rank + 0.35 * rank * rank),
  };
}

export function ringById(id: string): RingDef | undefined {
  return RINGS.find((r) => r.id === id);
}
