import type { EquipSlot, ResourceBundle } from '@/types';
import { equipmentById, salvageValue } from '@/content/equipment';
import type { GameState, OwnedItem } from './state';
import { grant, spend, canAfford } from './economy';

let uidCounter = 0;
export function newUid(prefix = 'i'): string {
  uidCounter += 1;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function inventoryCount(state: GameState): number {
  return state.inventory.items.length;
}

export function isFull(state: GameState): boolean {
  return state.inventory.items.length >= state.inventory.capacity;
}

export interface AddResult {
  item: OwnedItem;
  toStash: boolean;
}

/**
 * Add an item. A full inventory never destroys a reward: it goes to the
 * recoverable overflow stash instead and the UI says so.
 */
export function addItem(state: GameState, defId: string, locked = false): AddResult {
  const item: OwnedItem = { uid: newUid(), defId, locked };
  if (isFull(state)) {
    state.inventory.stash.push(item);
    return { item, toStash: true };
  }
  state.inventory.items.push(item);
  return { item, toStash: false };
}

/** Pull items back out of the overflow stash when there is room. */
export function reclaimStash(state: GameState): number {
  let moved = 0;
  while (state.inventory.stash.length > 0 && !isFull(state)) {
    state.inventory.items.push(state.inventory.stash.shift()!);
    moved++;
  }
  return moved;
}

export function findItem(state: GameState, uid: string): OwnedItem | undefined {
  return state.inventory.items.find((i) => i.uid === uid);
}

export function isEquipped(state: GameState, uid: string): boolean {
  const item = findItem(state, uid);
  if (!item) return false;
  return Object.values(state.player.equipment).includes(item.defId);
}

export function equipItem(state: GameState, uid: string): boolean {
  const item = findItem(state, uid);
  if (!item) return false;
  const def = equipmentById(item.defId);
  if (!def) return false;
  state.player.equipment[def.slot] = def.id;
  if (def.slot === 'weapon' && def.family) state.player.weaponFamily = def.family;
  return true;
}

export function equippedDef(state: GameState, slot: EquipSlot) {
  return equipmentById(state.player.equipment[slot]);
}

export function toggleLock(state: GameState, uid: string): boolean {
  const item = findItem(state, uid);
  if (!item) return false;
  item.locked = !item.locked;
  return item.locked;
}

export interface SalvageResult {
  count: number;
  gained: ResourceBundle;
  skipped: number;
}

/** Equipped and locked items are never salvaged, including by bulk salvage. */
export function salvageItems(state: GameState, uids: string[]): SalvageResult {
  let count = 0;
  let skipped = 0;
  const gained: ResourceBundle = {};
  for (const uid of uids) {
    const item = findItem(state, uid);
    if (!item) { skipped++; continue; }
    if (item.locked || isEquipped(state, uid)) { skipped++; continue; }
    const def = equipmentById(item.defId);
    if (!def) { skipped++; continue; }
    const v = salvageValue(def);
    gained.gold = (gained.gold ?? 0) + v.gold;
    gained.wood = (gained.wood ?? 0) + v.wood;
    gained.stone = (gained.stone ?? 0) + v.stone;
    gained.iron = (gained.iron ?? 0) + v.iron;
    state.inventory.items = state.inventory.items.filter((i) => i.uid !== uid);
    count++;
  }
  grant(state, gained);
  return { count, gained, skipped };
}

export function salvageUnlocked(state: GameState): SalvageResult {
  const uids = state.inventory.items
    .filter((i) => !i.locked && !isEquipped(state, i.uid))
    .map((i) => i.uid);
  return salvageItems(state, uids);
}

export type BuyResult = { ok: true; uid: string; toStash: boolean } | { ok: false; reason: 'cost' | 'unknown' | 'locked' | 'owned' };

export function buyEquipment(state: GameState, defId: string): BuyResult {
  const def = equipmentById(defId);
  if (!def) return { ok: false, reason: 'unknown' };
  if (def.requiresStage > 0 && !state.campaign.cleared.some((c) => c >= def.requiresStage)) {
    return { ok: false, reason: 'locked' };
  }
  if (state.inventory.items.some((i) => i.defId === defId)) return { ok: false, reason: 'owned' };
  if (!canAfford(state, def.cost)) return { ok: false, reason: 'cost' };
  if (!spend(state, def.cost)) return { ok: false, reason: 'cost' };
  const added = addItem(state, defId);
  return { ok: true, uid: added.item.uid, toStash: added.toStash };
}

export function sellItem(state: GameState, uid: string): { ok: boolean; gained: ResourceBundle } {
  const item = findItem(state, uid);
  if (!item || item.locked || isEquipped(state, uid)) return { ok: false, gained: {} };
  const def = equipmentById(item.defId);
  if (!def) return { ok: false, gained: {} };
  const gold = Math.floor((def.cost.gold ?? 0) * 0.45);
  state.inventory.items = state.inventory.items.filter((i) => i.uid !== uid);
  grant(state, { gold });
  return { ok: true, gained: { gold } };
}

export interface ComparisonRow {
  label: string;
  current: number;
  candidate: number;
}

export function compareWithEquipped(state: GameState, defId: string): ComparisonRow[] {
  const def = equipmentById(defId);
  if (!def) return [];
  const cur = equippedDef(state, def.slot);
  const rows: ComparisonRow[] = [];
  const keys: (keyof NonNullable<typeof def>['stats'])[] = ['attack', 'armour', 'speed', 'stamina', 'health'];
  for (const k of keys) {
    const a = cur?.stats[k] ?? 0;
    const b = def.stats[k] ?? 0;
    if (a || b) rows.push({ label: k, current: a, candidate: b });
  }
  return rows;
}

export type SortMode = 'slot' | 'tier' | 'name';

export function sortInventory(state: GameState, mode: SortMode): void {
  const order: Record<string, number> = { weapon: 0, armour: 1, boots: 2 };
  state.inventory.items.sort((a, b) => {
    const da = equipmentById(a.defId);
    const db = equipmentById(b.defId);
    if (!da || !db) return 0;
    if (mode === 'slot') return (order[da.slot]! - order[db.slot]!) || (db.tier - da.tier);
    if (mode === 'tier') return db.tier - da.tier;
    return da.id.localeCompare(db.id);
  });
}
