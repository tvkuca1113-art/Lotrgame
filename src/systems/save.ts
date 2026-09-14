import type { Difficulty, Season } from '@/types';
import { RINGS } from '@/content/rings';
import { EQUIPMENT } from '@/content/equipment';
import { BUILDINGS } from '@/content/buildings';
import { TALENTS } from '@/content/talents';
import {
  SAVE_VERSION, newGameState, defaultSettings, DEFAULT_KEYBINDS,
  type GameState, type SettingsState,
} from './state';
import { MAX_LEVEL, earnedTalentPoints, levelForTotalXp, xpTotalFor } from './progression';
import { isFixtureMode } from './fixtures';

const DB_NAME = 'last-hearth';
const DB_VERSION = 1;
const STORE = 'saves';
export const SLOT_MAIN = 'main';
export const SLOT_BACKUP = 'backup';
export const SLOT_PREVIOUS = 'previous-campaign';

export type SaveStatus = 'ok' | 'unavailable' | 'error';

let dbPromise: Promise<IDBDatabase> | null = null;
let storageBroken = false;
let lastError: string | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return dbPromise;
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    tx.onabort = () => reject(tx.error ?? new Error('write aborted'));
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('read failed'));
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
  });
}

export function storageIsBroken(): boolean { return storageBroken; }
export function lastSaveError(): string | null { return lastError; }

// ------------------------------------------------------------- validation

const RING_IDS = new Set(RINGS.map((r) => r.id));
const EQUIP_IDS = new Set(EQUIPMENT.map((e) => e.id));
const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id));
const TALENT_IDS = new Set(TALENTS.map((t) => t.id));
const SEASON_IDS = new Set<Season>(['spring', 'summer', 'autumn', 'winter']);
const DIFFICULTIES = new Set<Difficulty>(['story', 'adventurer', 'veteran']);

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  return Math.round(num(v, min, max, fallback));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function strArray(v: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === 'string');
  return allowed ? out.filter((x) => allowed.has(x)) : out;
}

function numArray(v: unknown, min: number, max: number): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max).map(Math.round);
}

function sanitiseSettings(v: unknown): SettingsState {
  const d = defaultSettings();
  if (!v || typeof v !== 'object') return d;
  const s = v as Partial<SettingsState>;
  const keybinds: Record<string, string> = { ...DEFAULT_KEYBINDS };
  if (s.keybinds && typeof s.keybinds === 'object') {
    for (const [k, val] of Object.entries(s.keybinds)) {
      if (k in DEFAULT_KEYBINDS && typeof val === 'string' && val.length <= 12) keybinds[k] = val;
    }
  }
  return {
    masterVolume: num(s.masterVolume, 0, 1, d.masterVolume),
    musicVolume: num(s.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: num(s.sfxVolume, 0, 1, d.sfxVolume),
    ambienceVolume: num(s.ambienceVolume, 0, 1, d.ambienceVolume),
    renderScale: num(s.renderScale, 0.5, 1, d.renderScale),
    particleQuality: int(s.particleQuality, 0, 2, d.particleQuality) as 0 | 1 | 2,
    cameraShake: bool(s.cameraShake, d.cameraShake),
    hitStop: bool(s.hitStop, d.hitStop),
    seasonalEffects: int(s.seasonalEffects, 0, 2, d.seasonalEffects) as 0 | 1 | 2,
    highContrast: bool(s.highContrast, d.highContrast),
    keyboardAim: bool(s.keyboardAim, d.keyboardAim),
    leftHanded: bool(s.leftHanded, d.leftHanded),
    aimAssist: num(s.aimAssist, 0, 1, d.aimAssist),
    stickScale: num(s.stickScale, 0.7, 1.6, d.stickScale),
    buttonScale: num(s.buttonScale, 0.7, 1.6, d.buttonScale),
    keybinds,
    locale: typeof s.locale === 'string' ? s.locale : d.locale,
  };
}

export interface ValidationReport {
  ok: boolean;
  repaired: string[];
  fatal?: string;
}

/**
 * Coerce an arbitrary object into a valid GameState.
 *
 * Import validates versions, ids, ranges and resources. Anything unknown is
 * dropped and anything out of range is clamped, and every repair is reported so
 * the player can see what happened.
 */
export function sanitiseState(input: unknown): { state: GameState; report: ValidationReport } {
  const repaired: string[] = [];
  if (!input || typeof input !== 'object') {
    return { state: newGameState(), report: { ok: false, repaired, fatal: 'not an object' } };
  }
  const raw = input as Partial<GameState> & Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > SAVE_VERSION) {
    return { state: newGameState(), report: { ok: false, repaired, fatal: `save version ${version} is newer than this build (${SAVE_VERSION})` } };
  }

  const base = newGameState();
  const s: GameState = base;

  s.version = SAVE_VERSION;
  s.createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
  s.savedAt = typeof raw.savedAt === 'number' ? raw.savedAt : Date.now();
  s.playtimeMs = num(raw.playtimeMs, 0, 1e10, 0);
  s.settings = sanitiseSettings(raw.settings);

  const p = (raw.player ?? {}) as Partial<GameState['player']>;
  s.player.xp = int(p.xp, 0, xpTotalFor(MAX_LEVEL), 0);
  const claimedLevel = int(p.level, 1, MAX_LEVEL, 1);
  const derivedLevel = levelForTotalXp(s.player.xp);
  if (claimedLevel !== derivedLevel) {
    repaired.push(`level recomputed from experience (${claimedLevel} -> ${derivedLevel})`);
  }
  s.player.level = derivedLevel;
  s.player.talents = strArray(p.talents, TALENT_IDS).slice(0, earnedTalentPoints(MAX_LEVEL));
  const budget = earnedTalentPoints(s.player.level);
  if (s.player.talents.length > budget) {
    s.player.talents = s.player.talents.slice(0, budget);
    repaired.push('talent list trimmed to the level budget');
  }
  s.player.talentPoints = Math.max(0, budget - s.player.talents.length);
  s.player.weaponFamily = p.weaponFamily === 'bow' || p.weaponFamily === 'axe' ? p.weaponFamily : 'sword';
  const eq = (p.equipment ?? {}) as Record<string, string>;
  for (const slot of ['weapon', 'armour', 'boots'] as const) {
    const id = eq[slot];
    if (typeof id === 'string' && EQUIP_IDS.has(id)) s.player.equipment[slot] = id;
    else if (id !== undefined) repaired.push(`unknown ${slot} "${id}" reset to starting gear`);
  }
  s.player.flaskMax = int(p.flaskMax, 1, 8, 3);
  s.player.flaskCharges = int(p.flaskCharges, 0, s.player.flaskMax, s.player.flaskMax);
  if (Array.isArray(p.loadouts)) {
    p.loadouts.slice(0, 3).forEach((lo, i) => {
      if (!lo || typeof lo !== 'object' || !s.player.loadouts[i]) return;
      const cur = s.player.loadouts[i]!;
      cur.name = typeof lo.name === 'string' ? lo.name.slice(0, 16) : cur.name;
      cur.talents = strArray(lo.talents, TALENT_IDS);
      cur.weaponFamily = lo.weaponFamily === 'bow' || lo.weaponFamily === 'axe' ? lo.weaponFamily : 'sword';
      if (lo.rings && typeof lo.rings === 'object') {
        for (const slot of ['active1', 'active2', 'support1', 'support2'] as const) {
          const v = (lo.rings as Record<string, unknown>)[slot];
          cur.rings[slot] = typeof v === 'string' && RING_IDS.has(v) ? v : null;
        }
      }
    });
  }
  s.player.activeLoadout = int(p.activeLoadout, 0, 2, 0);

  const res = (raw.resources ?? {}) as Record<string, unknown>;
  for (const k of ['gold', 'wood', 'stone', 'iron', 'shards'] as const) {
    const v = int(res[k], 0, 99_999_999, 0);
    if (typeof res[k] === 'number' && res[k]! < 0) repaired.push(`negative ${k} clamped to zero`);
    s.resources[k] = v;
  }

  const rings = (raw.rings ?? {}) as Record<string, unknown>;
  for (const r of RINGS) {
    const v = rings[r.id] as { discovered?: unknown; rank?: unknown } | undefined;
    s.rings[r.id] = {
      discovered: bool(v?.discovered, false),
      rank: int(v?.rank, 1, 10, 1),
    };
  }
  const slots = (raw.ringSlots ?? {}) as Record<string, unknown>;
  const used = new Set<string>();
  for (const slot of ['active1', 'active2', 'support1', 'support2'] as const) {
    const v = slots[slot];
    if (typeof v === 'string' && RING_IDS.has(v) && s.rings[v]?.discovered && !used.has(v)) {
      s.ringSlots[slot] = v;
      used.add(v);
    } else {
      s.ringSlots[slot] = null;
      if (typeof v === 'string' && v) repaired.push(`ring "${v}" removed from ${slot}`);
    }
  }
  const sockets = Array.isArray(raw.ringSockets) ? raw.ringSockets : [null, null];
  for (let i = 0; i < 2; i++) {
    const v = sockets[i];
    if (typeof v === 'string' && RING_IDS.has(v) && s.rings[v]?.discovered && !used.has(v)) {
      s.ringSockets[i as 0 | 1] = v;
      used.add(v);
    } else {
      s.ringSockets[i as 0 | 1] = null;
      if (typeof v === 'string' && v) repaired.push(`ring "${v}" removed from settlement socket ${i + 1}`);
    }
  }

  const c = (raw.campaign ?? {}) as Partial<GameState['campaign']>;
  s.campaign.difficulty = DIFFICULTIES.has(c.difficulty as Difficulty) ? c.difficulty as Difficulty : 'adventurer';
  s.campaign.cleared = Array.from(new Set(numArray(c.cleared, 1, 30))).sort((a, b) => a - b);
  s.campaign.claimedRewards = strArray(c.claimedRewards).slice(0, 5000);
  s.campaign.endingChosen = c.endingChosen === 'spread' || c.endingChosen === 'concentrate' ? c.endingChosen : null;
  s.campaign.lastStage = int(c.lastStage, 1, 30, 1);
  s.campaign.bestTimes = {};
  if (c.bestTimes && typeof c.bestTimes === 'object') {
    for (const [k, v] of Object.entries(c.bestTimes)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) s.campaign.bestTimes[k] = Math.round(v);
    }
  }
  if (c.checkpoint && typeof c.checkpoint === 'object') {
    const cp = c.checkpoint as Partial<NonNullable<GameState['campaign']['checkpoint']>>;
    const stage = int(cp.stage, 1, 30, 1);
    s.campaign.checkpoint = {
      stage,
      at: cp.at === 'boss' ? 'boss' : 'entrance',
      bankedRewardIds: strArray(cp.bankedRewardIds).slice(0, 500),
      flaskCharges: int(cp.flaskCharges, 0, 8, s.player.flaskMax),
      elapsedMs: num(cp.elapsedMs, 0, 1e9, 0),
    };
  }

  const h = (raw.home ?? {}) as Partial<GameState['home']>;
  s.home.tier = int(h.tier, -1, 4, -1);
  s.home.residents = strArray(h.residents);
  s.home.trophies = Array.from(new Set(numArray(h.trophies, 0, 6)));
  s.home.defenceCleared = int(h.defenceCleared, 0, 999, 0);
  s.home.buildings = [];
  if (Array.isArray(h.buildings)) {
    for (const b of h.buildings.slice(0, 400)) {
      if (!b || typeof b !== 'object') continue;
      const rec = b as unknown as Record<string, unknown>;
      if (typeof rec.id !== 'string' || !BUILDING_IDS.has(rec.id)) {
        repaired.push(`unknown building "${String(rec.id)}" dropped`);
        continue;
      }
      s.home.buildings.push({
        uid: typeof rec.uid === 'string' ? rec.uid : `b${s.home.buildings.length}`,
        id: rec.id,
        gx: int(rec.gx, 0, 64, 0),
        gy: int(rec.gy, 0, 64, 0),
        rotation: int(rec.rotation, 0, 3, 0) as 0 | 1 | 2 | 3,
        variant: int(rec.variant, 0, 8, 0),
      });
    }
  }

  const cal = (raw.calendar ?? {}) as Partial<GameState['calendar']>;
  s.calendar.season = SEASON_IDS.has(cal.season as Season) ? cal.season as Season : 'spring';
  s.calendar.day = int(cal.day, 0, 3, 0);
  s.calendar.totalDays = int(cal.totalDays, 0, 100000, 0);

  const inv = (raw.inventory ?? {}) as Partial<GameState['inventory']>;
  s.inventory.capacity = int(inv.capacity, 10, 200, 40);
  const readItems = (list: unknown) => {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 400).flatMap((it) => {
      if (!it || typeof it !== 'object') return [];
      const rec = it as unknown as Record<string, unknown>;
      if (typeof rec.defId !== 'string' || !EQUIP_IDS.has(rec.defId)) {
        repaired.push(`unknown item "${String(rec.defId)}" dropped`);
        return [];
      }
      return [{
        uid: typeof rec.uid === 'string' ? rec.uid : `i${Math.random().toString(36).slice(2)}`,
        defId: rec.defId,
        locked: bool(rec.locked, false),
      }];
    });
  };
  s.inventory.items = readItems(inv.items);
  s.inventory.stash = readItems(inv.stash);

  const rng = (raw.rng ?? {}) as Partial<GameState['rng']>;
  s.rng.world = int(rng.world, 0, 0xffffffff, base.rng.world) >>> 0;
  s.rng.loot = int(rng.loot, 0, 0xffffffff, base.rng.loot) >>> 0;

  const j = (raw.journal ?? {}) as Partial<GameState['journal']>;
  s.journal.synergies = strArray(j.synergies);
  s.journal.bestiary = strArray(j.bestiary);
  s.journal.storyBeats = strArray(j.storyBeats);
  s.journal.ringSightFound = strArray(j.ringSightFound);

  const rp = (raw.replay ?? {}) as Partial<GameState['replay']>;
  s.replay.challengeCleared = strArray(rp.challengeCleared);
  s.replay.gauntletBest = typeof rp.gauntletBest === 'number' && rp.gauntletBest > 0 ? Math.round(rp.gauntletBest) : null;
  s.replay.banners = strArray(rp.banners);
  s.replay.cloak = typeof rp.cloak === 'string' ? rp.cloak : 'grey';
  s.replay.hardCleared = numArray(rp.hardCleared, 1, 30);

  const tut = (raw.tutorial ?? {}) as Partial<GameState['tutorial']>;
  s.tutorial.step = int(tut.step, 0, 32, 0);
  s.tutorial.done = bool(tut.done, false);

  if (version < SAVE_VERSION) repaired.push(`migrated from save version ${version} to ${SAVE_VERSION}`);

  return { state: s, report: { ok: true, repaired } };
}

// ------------------------------------------------------------------- disk

export interface SaveResult { status: SaveStatus; error?: string }

/**
 * Write the main slot, keeping the previous contents as a last-known-good
 * backup. Reward grants and their claimed flags are part of the same state
 * object, so they always persist together.
 */
export async function saveGame(state: GameState, slot: string = SLOT_MAIN): Promise<SaveResult> {
  // Development fixtures must never touch the player's campaign.
  if (isFixtureMode()) return { status: 'ok' };
  state.savedAt = Date.now();
  state.version = SAVE_VERSION;
  try {
    if (slot === SLOT_MAIN) {
      const prev = await idbGet<GameState>(SLOT_MAIN);
      if (prev) await idbPut(SLOT_BACKUP, prev);
    }
    await idbPut(slot, JSON.parse(JSON.stringify(state)));
    storageBroken = false;
    lastError = null;
    return { status: 'ok' };
  } catch (err) {
    storageBroken = true;
    lastError = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: lastError };
  }
}

export async function loadGame(slot: string = SLOT_MAIN): Promise<{ state: GameState | null; report?: ValidationReport }> {
  try {
    const raw = await idbGet<unknown>(slot);
    if (!raw) return { state: null };
    const { state, report } = sanitiseState(raw);
    if (!report.ok) return { state: null, report };
    return { state, report };
  } catch (err) {
    storageBroken = true;
    lastError = err instanceof Error ? err.message : String(err);
    return { state: null };
  }
}

export async function hasSave(slot: string = SLOT_MAIN): Promise<boolean> {
  try {
    return (await idbGet<unknown>(slot)) !== undefined;
  } catch {
    return false;
  }
}

export async function deleteSave(slot: string): Promise<void> {
  try { await idbDelete(slot); } catch { /* nothing to do */ }
}

/**
 * Starting a new game never silently erases an existing campaign: the current
 * save is copied into a separate slot the player can restore from Settings.
 */
export async function archiveCurrentCampaign(): Promise<boolean> {
  try {
    const cur = await idbGet<GameState>(SLOT_MAIN);
    if (!cur) return false;
    await idbPut(SLOT_PREVIOUS, cur);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------- export/import

export interface ExportEnvelope {
  game: 'the-last-hearth';
  version: number;
  exportedAt: string;
  state: GameState;
}

export function exportSave(state: GameState): string {
  const env: ExportEnvelope = {
    game: 'the-last-hearth',
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)) as GameState,
  };
  return JSON.stringify(env, null, 2);
}

export interface ImportResult {
  ok: boolean;
  state?: GameState;
  report?: ValidationReport;
  error?: string;
}

export function importSave(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'not an object' };
  const env = parsed as Partial<ExportEnvelope>;
  const payload = env.game === 'the-last-hearth' && env.state ? env.state : parsed;
  const { state, report } = sanitiseState(payload);
  if (!report.ok) return { ok: false, report, error: report.fatal };
  return { ok: true, state, report };
}
