import type { EquipmentDef, WeaponFamily } from '@/types';

/**
 * Weapons, armour and boots. Three families, three upgrade steps each, so the
 * character silhouette changes visibly (gear tiers 0/1/2 map to the three
 * rendered player sheets).
 */
function weapon(
  id: string, family: WeaponFamily, tier: number, gearTier: 0 | 1 | 2,
  attack: number, gold: number, iron: number, wood: number, requiresStage: number,
  extra: { speed?: number; stamina?: number } = {},
): EquipmentDef {
  return {
    id, slot: 'weapon', family, nameKey: `equip.${id}`, tier, gearTier,
    cost: { gold, iron, wood }, stats: { attack, ...extra }, requiresStage,
  };
}

export const EQUIPMENT: readonly EquipmentDef[] = [
  // Sword and shield: balanced, guard, parry.
  weapon('sword_worn', 'sword', 0, 0, 10, 0, 0, 0, 0),
  weapon('sword_valley', 'sword', 1, 0, 15, 180, 6, 12, 3),
  weapon('sword_warden', 'sword', 2, 1, 22, 620, 22, 18, 9),
  weapon('sword_oathkeeper', 'sword', 3, 1, 31, 1500, 46, 24, 16),
  weapon('sword_hearthlight', 'sword', 4, 2, 43, 3100, 82, 34, 23),

  // Bow: ranged positioning and charged shots.
  weapon('bow_hunting', 'bow', 0, 0, 9, 140, 2, 16, 2, { speed: 4 }),
  weapon('bow_longvale', 'bow', 1, 0, 14, 300, 8, 24, 5, { speed: 4 }),
  weapon('bow_scoutmark', 'bow', 2, 1, 21, 760, 24, 32, 11, { speed: 6 }),
  weapon('bow_stormwind', 'bow', 3, 1, 29, 1700, 48, 40, 18, { speed: 6 }),
  weapon('bow_dawnstring', 'bow', 4, 2, 40, 3300, 84, 52, 24, { speed: 8 }),

  // Two-handed axe: slower, reach, stagger.
  weapon('axe_woodcutter', 'axe', 0, 0, 14, 160, 4, 14, 2, { speed: -6 }),
  weapon('axe_quarry', 'axe', 1, 0, 20, 320, 12, 18, 6, { speed: -6 }),
  weapon('axe_ironroot', 'axe', 2, 1, 29, 820, 30, 26, 12, { speed: -5 }),
  weapon('axe_siegebreaker', 'axe', 3, 1, 40, 1800, 54, 34, 19, { speed: -5 }),
  weapon('axe_lastwinter', 'axe', 4, 2, 55, 3500, 92, 44, 25, { speed: -4 }),

  // Armour
  { id: 'armour_patched', slot: 'armour', nameKey: 'equip.armour_patched', tier: 0, gearTier: 0, cost: {}, stats: { armour: 0, health: 0 }, requiresStage: 0 },
  { id: 'armour_traveller', slot: 'armour', nameKey: 'equip.armour_traveller', tier: 1, gearTier: 0, cost: { gold: 200, wood: 10, iron: 4 }, stats: { armour: 4, health: 10 }, requiresStage: 3 },
  { id: 'armour_mail', slot: 'armour', nameKey: 'equip.armour_mail', tier: 2, gearTier: 1, cost: { gold: 680, iron: 26, stone: 10 }, stats: { armour: 9, health: 22 }, requiresStage: 9 },
  { id: 'armour_warden', slot: 'armour', nameKey: 'equip.armour_warden', tier: 3, gearTier: 1, cost: { gold: 1600, iron: 52, stone: 24 }, stats: { armour: 15, health: 38 }, requiresStage: 16 },
  { id: 'armour_hearthplate', slot: 'armour', nameKey: 'equip.armour_hearthplate', tier: 4, gearTier: 2, cost: { gold: 3200, iron: 90, stone: 40 }, stats: { armour: 23, health: 56 }, requiresStage: 23 },

  // Boots
  { id: 'boots_worn', slot: 'boots', nameKey: 'equip.boots_worn', tier: 0, gearTier: 0, cost: {}, stats: { speed: 0, stamina: 0 }, requiresStage: 0 },
  { id: 'boots_pathwalker', slot: 'boots', nameKey: 'equip.boots_pathwalker', tier: 1, gearTier: 0, cost: { gold: 160, wood: 12 }, stats: { speed: 6, stamina: 8 }, requiresStage: 4 },
  { id: 'boots_scout', slot: 'boots', nameKey: 'equip.boots_scout', tier: 2, gearTier: 1, cost: { gold: 540, wood: 20, iron: 12 }, stats: { speed: 11, stamina: 16 }, requiresStage: 10 },
  { id: 'boots_stormstride', slot: 'boots', nameKey: 'equip.boots_stormstride', tier: 3, gearTier: 1, cost: { gold: 1300, wood: 28, iron: 34 }, stats: { speed: 16, stamina: 24 }, requiresStage: 17 },
  { id: 'boots_snowmarch', slot: 'boots', nameKey: 'equip.boots_snowmarch', tier: 4, gearTier: 2, cost: { gold: 2700, wood: 36, iron: 62 }, stats: { speed: 21, stamina: 34 }, requiresStage: 24 },
] as const;

export function equipmentById(id: string): EquipmentDef | undefined {
  return EQUIPMENT.find((e) => e.id === id);
}

export function equipmentForSlot(slot: EquipmentDef['slot']): EquipmentDef[] {
  return EQUIPMENT.filter((e) => e.slot === slot);
}

export const STARTING_EQUIPMENT = {
  weapon: 'sword_worn',
  armour: 'armour_patched',
  boots: 'boots_worn',
} as const;

/** Salvage returns a fraction of the build cost, never the full price. */
export function salvageValue(def: EquipmentDef): { gold: number; wood: number; stone: number; iron: number } {
  return {
    gold: Math.floor((def.cost.gold ?? 0) * 0.35),
    wood: Math.floor((def.cost.wood ?? 0) * 0.5),
    stone: Math.floor((def.cost.stone ?? 0) * 0.5),
    iron: Math.floor((def.cost.iron ?? 0) * 0.5),
  };
}
