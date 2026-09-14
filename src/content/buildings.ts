import type { BuildingDef, HomeTierDef } from '@/types';

/**
 * Settlement progression: camp -> wooden cottage -> stone house -> fortified
 * courtyard -> small castle. Costs are per-upgrade, not cumulative, exactly as
 * specified. Construction finishes immediately with a short animation; there
 * are no real-time timers.
 */
export const HOME_TIERS: readonly HomeTierDef[] = [
  { tier: 0, id: 'home_camp', nameKey: 'home.tier.camp', art: 'home_camp', unlockStage: 1, cost: { gold: 40, wood: 10, stone: 0, iron: 0 }, plotW: 10, plotD: 10 },
  { tier: 1, id: 'home_cottage', nameKey: 'home.tier.cottage', art: 'home_cottage', unlockStage: 5, cost: { gold: 250, wood: 40, stone: 15, iron: 0 }, plotW: 12, plotD: 12 },
  { tier: 2, id: 'home_stonehouse', nameKey: 'home.tier.stonehouse', art: 'home_stonehouse', unlockStage: 10, cost: { gold: 750, wood: 90, stone: 90, iron: 15 }, plotW: 14, plotD: 14 },
  { tier: 3, id: 'home_courtyard', nameKey: 'home.tier.courtyard', art: 'home_courtyard', unlockStage: 20, cost: { gold: 2400, wood: 180, stone: 220, iron: 70 }, plotW: 16, plotD: 16 },
  { tier: 4, id: 'home_castle', nameKey: 'home.tier.castle', art: 'home_castle', unlockStage: 25, cost: { gold: 5000, wood: 250, stone: 450, iron: 150 }, plotW: 18, plotD: 18 },
] as const;

/**
 * Placeable structures. Every functional structure has an implemented purpose;
 * decorative pieces are flagged so the UI can separate them.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'campfire', nameKey: 'build.campfire.name', descKey: 'build.campfire.desc', art: 'home_camp', gridW: 2, gridD: 2, cost: { gold: 0, wood: 6 }, requiresTier: 0, role: 'rest', unique: true },
  { id: 'bed', nameKey: 'build.bed.name', descKey: 'build.bed.desc', art: 'bed', gridW: 2, gridD: 1, cost: { gold: 30, wood: 12 }, requiresTier: 0, role: 'rest', unique: true },
  { id: 'storage_chest', nameKey: 'build.storage.name', descKey: 'build.storage.desc', art: 'storage_chest', gridW: 1, gridD: 1, cost: { gold: 40, wood: 14 }, requiresTier: 0, role: 'storage', unique: true },
  { id: 'forge', nameKey: 'build.forge.name', descKey: 'build.forge.desc', art: 'forge', gridW: 2, gridD: 2, cost: { gold: 180, wood: 24, stone: 30, iron: 6 }, requiresTier: 1, role: 'forge', unique: true, socket: 0 },
  { id: 'ring_workbench', nameKey: 'build.ringbench.name', descKey: 'build.ringbench.desc', art: 'ring_workbench', gridW: 2, gridD: 2, cost: { gold: 220, wood: 30, stone: 18, iron: 10 }, requiresTier: 1, role: 'ringbench', unique: true, socket: 1 },
  { id: 'garden', nameKey: 'build.garden.name', descKey: 'build.garden.desc', art: 'garden', gridW: 2, gridD: 2, cost: { gold: 90, wood: 18, stone: 8 }, requiresTier: 1, role: 'garden', unique: true },
  { id: 'watchtower', nameKey: 'build.watchtower.name', descKey: 'build.watchtower.desc', art: 'watchtower', gridW: 2, gridD: 2, cost: { gold: 420, wood: 40, stone: 70, iron: 18 }, requiresTier: 2, role: 'watchtower', unique: true },
  { id: 'wall_segment', nameKey: 'build.wall.name', descKey: 'build.wall.desc', art: 'wall_segment', gridW: 1, gridD: 1, cost: { gold: 30, stone: 14 }, requiresTier: 2, role: 'wall' },
  { id: 'gate', nameKey: 'build.gate.name', descKey: 'build.gate.desc', art: 'gate', gridW: 2, gridD: 1, cost: { gold: 160, wood: 20, stone: 34, iron: 8 }, requiresTier: 2, role: 'gate', unique: true },
  { id: 'trophy_display', nameKey: 'build.trophy.name', descKey: 'build.trophy.desc', art: 'trophy_display', gridW: 2, gridD: 1, cost: { gold: 70, wood: 14, stone: 10 }, requiresTier: 1, role: 'trophy' },
  { id: 'monument', nameKey: 'build.monument.name', descKey: 'build.monument.desc', art: 'monument', gridW: 2, gridD: 2, cost: { gold: 0, stone: 0 }, requiresTier: 0, role: 'monument' },
  { id: 'practice_dummy', nameKey: 'build.dummy.name', descKey: 'build.dummy.desc', art: 'practice_dummy', gridW: 1, gridD: 1, cost: { gold: 60, wood: 16 }, requiresTier: 1, role: 'dummy', unique: true },
  { id: 'lantern_post', nameKey: 'build.lantern.name', descKey: 'build.lantern.desc', art: 'lantern_post', gridW: 1, gridD: 1, cost: { gold: 25, wood: 6, iron: 2 }, requiresTier: 0, role: 'decor', decorative: true },
  { id: 'banner_wall', nameKey: 'build.banner.name', descKey: 'build.banner.desc', art: 'banner_wall', gridW: 1, gridD: 1, cost: { gold: 35, wood: 8 }, requiresTier: 1, role: 'decor', decorative: true },
  { id: 'path_stone', nameKey: 'build.path.name', descKey: 'build.path.desc', art: 'path_stone', gridW: 1, gridD: 1, cost: { gold: 8, stone: 3 }, requiresTier: 0, role: 'decor', decorative: true },
] as const;

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function homeTier(tier: number): HomeTierDef {
  return HOME_TIERS[Math.max(0, Math.min(HOME_TIERS.length - 1, tier))]!;
}

/**
 * Residents rescued during the campaign. Each has a service implemented in the
 * home scene and short dialogue lines in the locale file.
 */
export interface ResidentDef {
  id: string;
  art: string;
  nameKey: string;
  roleKey: string;
  serviceKey: string;
  /** Stage whose completion brings them home. */
  rescuedAt: number;
  service: 'forge' | 'scout' | 'garden' | 'heal' | 'mason' | 'chronicle';
  lines: string[];
}

export const RESIDENTS: readonly ResidentDef[] = [
  { id: 'smith', art: 'npc_smith', nameKey: 'npc.smith.name', roleKey: 'npc.smith.role', serviceKey: 'npc.smith.service', rescuedAt: 2, service: 'forge', lines: ['npc.smith.line1', 'npc.smith.line2', 'npc.smith.line3'] },
  { id: 'scout', art: 'npc_scout', nameKey: 'npc.scout.name', roleKey: 'npc.scout.role', serviceKey: 'npc.scout.service', rescuedAt: 6, service: 'scout', lines: ['npc.scout.line1', 'npc.scout.line2', 'npc.scout.line3'] },
  { id: 'gardener', art: 'npc_gardener', nameKey: 'npc.gardener.name', roleKey: 'npc.gardener.role', serviceKey: 'npc.gardener.service', rescuedAt: 8, service: 'garden', lines: ['npc.gardener.line1', 'npc.gardener.line2', 'npc.gardener.line3'] },
  { id: 'mason', art: 'npc_mason', nameKey: 'npc.mason.name', roleKey: 'npc.mason.role', serviceKey: 'npc.mason.service', rescuedAt: 12, service: 'mason', lines: ['npc.mason.line1', 'npc.mason.line2', 'npc.mason.line3'] },
  { id: 'healer', art: 'npc_healer', nameKey: 'npc.healer.name', roleKey: 'npc.healer.role', serviceKey: 'npc.healer.service', rescuedAt: 23, service: 'heal', lines: ['npc.healer.line1', 'npc.healer.line2', 'npc.healer.line3'] },
  { id: 'chronicler', art: 'npc_chronicler', nameKey: 'npc.chronicler.name', roleKey: 'npc.chronicler.role', serviceKey: 'npc.chronicler.service', rescuedAt: 21, service: 'chronicle', lines: ['npc.chronicler.line1', 'npc.chronicler.line2', 'npc.chronicler.line3'] },
] as const;

/** The two settlement ring sockets, unlocked after stage 10. */
export const RING_SOCKET_UNLOCK_STAGE = 10;
export const RING_SOCKETS = [
  { index: 0 as const, buildingId: 'forge', nameKey: 'home.socket.forge' },
  { index: 1 as const, buildingId: 'ring_workbench', nameKey: 'home.socket.bench' },
];

/** Settlement defence challenge, unlocked after stage 20. Cosmetic rewards only. */
export const DEFENCE_CHALLENGE = {
  unlockStage: 20,
  waves: 8,
  waveEnemies: ['orc_raider', 'orc_axe', 'warg', 'uruk_soldier', 'uruk_crossbow', 'orc_shield', 'warg_alpha', 'uruk_pikeman'],
  rewardKey: 'home.defence.reward',
} as const;
