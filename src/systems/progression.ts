import type { Difficulty, WeaponFamily } from '@/types';
import { TALENTS, talentById, MAX_TALENT_POINTS } from '@/content/talents';
import { equipmentById } from '@/content/equipment';
import type { GameState } from './state';

export const MAX_LEVEL = 30;

/** XP required to go from level L to L+1, exactly as specified. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return 60 + 24 * level + 4 * level * level;
}

/** Total XP required to reach a level from level 1. */
export function xpTotalFor(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) sum += xpToNext(l);
  return sum;
}

export function levelForTotalXp(total: number): number {
  let level = 1;
  let acc = 0;
  while (level < MAX_LEVEL) {
    const need = xpToNext(level);
    if (acc + need > total) break;
    acc += need;
    level++;
  }
  return level;
}

export interface LevelUpResult {
  levels: number;
  newLevel: number;
  talentPoints: number;
  cappedXp: boolean;
}

/**
 * Award XP. The level 30 cap is enforced here and nowhere else, so every source
 * of XP - encounters, objectives, bosses, replays - goes through one gate.
 */
export function grantXp(state: GameState, amount: number): LevelUpResult {
  const before = state.player.level;
  if (before >= MAX_LEVEL) {
    state.player.xp = xpTotalFor(MAX_LEVEL);
    return { levels: 0, newLevel: MAX_LEVEL, talentPoints: 0, cappedXp: true };
  }
  const total = Math.min(xpTotalFor(MAX_LEVEL), state.player.xp + Math.max(0, Math.round(amount)));
  state.player.xp = total;
  const after = levelForTotalXp(total);
  const gained = after - before;
  if (gained > 0) {
    state.player.level = after;
    state.player.talentPoints = Math.min(MAX_TALENT_POINTS, state.player.talentPoints + gained);
  }
  return { levels: gained, newLevel: after, talentPoints: gained, cappedXp: after >= MAX_LEVEL };
}

/** Progress toward the next level, for the HUD. */
export function levelProgress(state: GameState): { current: number; needed: number; ratio: number } {
  const lv = state.player.level;
  if (lv >= MAX_LEVEL) return { current: 1, needed: 1, ratio: 1 };
  const base = xpTotalFor(lv);
  const need = xpToNext(lv);
  const cur = state.player.xp - base;
  return { current: cur, needed: need, ratio: Math.max(0, Math.min(1, cur / need)) };
}

// ------------------------------------------------------------------ stats

export interface DerivedStats {
  maxHealth: number;
  maxStamina: number;
  armour: number;
  attack: number;
  moveSpeed: number;
  attackSpeed: number;
  staminaRegen: number;
  dodgeCost: number;
  dodgeIFrames: number;
  blockReduction: number;
  parryWindow: number;
  parryStagger: number;
  staggerPower: number;
  poiseResist: number;
  guardStaminaCost: number;
  backstabDamage: number;
  chargedShot: number;
  weaponDamage: number;
  ringPower: number;
  ringCooldown: number;
  ringRange: number;
  synergyPower: number;
  synergyIcd: number;
  ringOnHitCdr: number;
  supportPower: number;
  dodgeRefund: number;
  lastStand: number;
  healPower: number;
  burnDamage: number;
  poisonDamage: number;
  shockDamage: number;
  slowPower: number;
  rootDuration: number;
  blockWindow: number;
  darkResist: number;
}

export const BASE_STATS = {
  health: 100,
  stamina: 100,
  healthPerLevel: 8,
  staminaPerLevel: 2,
  moveSpeed: 168,
  attackSpeed: 1,
  staminaRegen: 20,
  staminaDelay: 0.6,
  dodgeCost: 25,
  dodgeIFrames: 0.18,
  dodgeCooldown: 0.45,
} as const;

function emptyStats(): DerivedStats {
  return {
    maxHealth: 0, maxStamina: 0, armour: 0, attack: 0, moveSpeed: 0, attackSpeed: 1,
    staminaRegen: BASE_STATS.staminaRegen, dodgeCost: BASE_STATS.dodgeCost,
    dodgeIFrames: BASE_STATS.dodgeIFrames, blockReduction: 0, parryWindow: 0.16,
    parryStagger: 1, staggerPower: 1, poiseResist: 0, guardStaminaCost: 1,
    backstabDamage: 0, chargedShot: 0, weaponDamage: 0, ringPower: 0, ringCooldown: 0,
    ringRange: 0, synergyPower: 0, synergyIcd: 0, ringOnHitCdr: 0, supportPower: 0,
    dodgeRefund: 0, lastStand: 0, healPower: 0, burnDamage: 0, poisonDamage: 0,
    shockDamage: 0, slowPower: 0, rootDuration: 0, blockWindow: 0, darkResist: 0,
  };
}

/**
 * Every level gives visible health or stamina growth. Odd levels favour health,
 * even levels stamina, so both bars move over the campaign.
 */
export function levelHealth(level: number): number {
  return BASE_STATS.health + Math.floor((level - 1) * BASE_STATS.healthPerLevel);
}

export function levelStamina(level: number): number {
  return BASE_STATS.stamina + Math.floor((level - 1) * BASE_STATS.staminaPerLevel);
}

/** Sum base stats, equipment, talents and ring support effects. */
export function deriveStats(state: GameState, ringSupport?: Partial<DerivedStats>): DerivedStats {
  const s = emptyStats();
  const lv = state.player.level;
  s.maxHealth = levelHealth(lv);
  s.maxStamina = levelStamina(lv);
  s.moveSpeed = BASE_STATS.moveSpeed;

  for (const slot of ['weapon', 'armour', 'boots'] as const) {
    const def = equipmentById(state.player.equipment[slot]);
    if (!def) continue;
    s.attack += def.stats.attack ?? 0;
    s.armour += def.stats.armour ?? 0;
    s.moveSpeed += def.stats.speed ?? 0;
    s.maxStamina += def.stats.stamina ?? 0;
    s.maxHealth += def.stats.health ?? 0;
  }

  for (const id of state.player.talents) {
    const node = talentById(id);
    if (!node) continue;
    const { stat, value } = node.effect;
    switch (stat) {
      case 'maxHealth': s.maxHealth += value; break;
      case 'maxStamina': s.maxStamina += value; break;
      case 'armour': s.armour += value; break;
      case 'moveSpeed': s.moveSpeed *= 1 + value; break;
      case 'attackSpeed': s.attackSpeed += value; break;
      case 'staminaRegen': s.staminaRegen += value; break;
      case 'dodgeCost': s.dodgeCost += value; break;
      case 'dodgeIFrames': s.dodgeIFrames += value; break;
      case 'blockReduction': s.blockReduction += value; break;
      case 'parryWindow': s.parryWindow += value; break;
      case 'parryStagger': s.parryStagger += value; break;
      case 'staggerPower': s.staggerPower += value; break;
      case 'poiseResist': s.poiseResist += value; break;
      case 'guardStaminaCost': s.guardStaminaCost += value; break;
      case 'backstabDamage': s.backstabDamage += value; break;
      case 'chargedShot': s.chargedShot += value; break;
      case 'weaponDamage': s.weaponDamage += value; break;
      case 'ringPower': s.ringPower += value; break;
      case 'ringCooldown': s.ringCooldown += value; break;
      case 'ringRange': s.ringRange += value; break;
      case 'synergyPower': s.synergyPower += value; break;
      case 'synergyIcd': s.synergyIcd += value; break;
      case 'ringOnHitCdr': s.ringOnHitCdr += value; break;
      case 'supportPower': s.supportPower += value; break;
      case 'dodgeRefund': s.dodgeRefund += value; break;
      case 'lastStand': s.lastStand += value; break;
      default: break;
    }
  }

  if (ringSupport) {
    for (const [k, v] of Object.entries(ringSupport) as [keyof DerivedStats, number][]) {
      if (typeof v !== 'number') continue;
      if (k === 'moveSpeed') s.moveSpeed *= 1 + v;
      else if (k === 'maxHealth' || k === 'maxStamina' || k === 'armour' || k === 'attack') s[k] += v;
      else s[k] = (s[k] as number) + v;
    }
  }

  s.maxHealth = Math.round(s.maxHealth);
  s.maxStamina = Math.round(s.maxStamina);
  s.moveSpeed = Math.round(s.moveSpeed);
  s.dodgeCost = Math.max(8, s.dodgeCost);
  return s;
}

// ---------------------------------------------------------------- talents

export function canSpendTalent(state: GameState, id: string): { ok: boolean; reason?: string } {
  const node = talentById(id);
  if (!node) return { ok: false, reason: 'unknown' };
  if (state.player.talents.includes(id)) return { ok: false, reason: 'owned' };
  if (state.player.talentPoints <= 0) return { ok: false, reason: 'points' };
  if (node.requires && !state.player.talents.includes(node.requires)) return { ok: false, reason: 'requires' };
  return { ok: true };
}

export function spendTalent(state: GameState, id: string): boolean {
  const check = canSpendTalent(state, id);
  if (!check.ok) return false;
  state.player.talents.push(id);
  state.player.talentPoints -= 1;
  return true;
}

/** Free respecialisation. Only ever called at home. */
export function respec(state: GameState): void {
  state.player.talents = [];
  state.player.talentPoints = earnedTalentPoints(state.player.level);
}

/** 29 points across levels 2..30. */
export function earnedTalentPoints(level: number): number {
  return Math.min(MAX_TALENT_POINTS, Math.max(0, level - 1));
}

export function saveLoadout(state: GameState, index: number): void {
  const lo = state.player.loadouts[index];
  if (!lo) return;
  lo.talents = [...state.player.talents];
  lo.weaponFamily = state.player.weaponFamily;
  lo.rings = { ...state.ringSlots };
}

export function loadLoadout(state: GameState, index: number): boolean {
  const lo = state.player.loadouts[index];
  if (!lo) return false;
  const valid = lo.talents.filter((id) => TALENTS.some((t) => t.id === id));
  const budget = earnedTalentPoints(state.player.level);
  if (valid.length > budget) return false;
  state.player.talents = valid;
  state.player.talentPoints = budget - valid.length;
  state.player.weaponFamily = lo.weaponFamily;
  state.player.activeLoadout = index;
  return true;
}

// -------------------------------------------------------------- difficulty

export interface DifficultyProfile {
  incomingDamage: number;
  enemyHealth: number;
  telegraphScale: number;
  flaskBonus: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  story: { incomingDamage: 0.6, enemyHealth: 0.8, telegraphScale: 1.25, flaskBonus: 2 },
  adventurer: { incomingDamage: 1, enemyHealth: 1, telegraphScale: 1, flaskBonus: 0 },
  veteran: { incomingDamage: 1.35, enemyHealth: 1.2, telegraphScale: 0.85, flaskBonus: -1 },
};

export function weaponFamilyOf(state: GameState): WeaponFamily {
  const def = equipmentById(state.player.equipment.weapon);
  return def?.family ?? state.player.weaponFamily;
}

export function difficultyOf(state: GameState): DifficultyProfile {
  return DIFFICULTY[state.campaign.difficulty] ?? DIFFICULTY.adventurer;
}

export function difficultyName(d: Difficulty): string { return `difficulty.${d}`; }
