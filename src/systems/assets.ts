import Phaser from 'phaser';
import type { RegionKey, Season } from '@/types';

/**
 * Manifest-driven asset loading.
 *
 * The core bundle loads at boot; region bundles load on demand when a stage in
 * that chapter is chosen, which keeps the first load small and the total
 * download proportional to how far the player has travelled.
 */

export interface ManifestEntry {
  key: string;
  type: 'atlas' | 'image' | 'audio';
  bundle: string;
  image: string;
  data?: string;
  frameW?: number;
  frameH?: number;
  anchorX?: number;
  anchorY?: number;
  anims?: Record<string, { frames: string[]; frameRate: number; repeat: number }>;
  propMeta?: Record<string, { anchorX: number; anchorY: number; variants: number }>;
  buildingMeta?: Record<string, { anchorX: number; anchorY: number; gridW: number; gridD: number; variants: number }>;
  vfxMeta?: Record<string, { w: number; h: number; anchorX: number; anchorY: number }>;
  bytes: number;
}

export interface Manifest {
  version: number;
  generated?: string;
  bundles: Record<string, ManifestEntry[]>;
  totals: Record<string, number>;
}

export const ASSET_ROOT = 'assets/';

let manifest: Manifest | null = null;
const loadedBundles = new Set<string>();
const entryByKey = new Map<string, ManifestEntry>();

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const res = await fetch(`${ASSET_ROOT}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`asset manifest unavailable (${res.status})`);
  manifest = (await res.json()) as Manifest;
  for (const list of Object.values(manifest.bundles)) {
    for (const e of list) entryByKey.set(e.key, e);
  }
  return manifest;
}

export function getManifest(): Manifest | null { return manifest; }
export function entryFor(key: string): ManifestEntry | undefined { return entryByKey.get(key); }
export function isBundleLoaded(b: string): boolean { return loadedBundles.has(b); }

export function bundleBytes(bundle: string): number {
  return manifest?.totals[bundle] ?? 0;
}

/** Chapter region -> asset bundle name. */
export const REGION_BUNDLE: Record<RegionKey, string> = {
  farmland: 'farmland', woodland: 'woodland', mountain: 'mountain',
  borderland: 'borderland', winterland: 'winterland', fortress: 'fortress',
};

function queueEntry(loader: Phaser.Loader.LoaderPlugin, e: ManifestEntry): void {
  if (loader.textureManager.exists(e.key)) return;
  if (e.type === 'atlas' && e.data) {
    loader.atlas(e.key, ASSET_ROOT + e.image, ASSET_ROOT + e.data);
  } else {
    loader.image(e.key, ASSET_ROOT + e.image);
  }
}

/** Queue a bundle onto a scene's loader. Call `scene.load.start()` afterwards. */
export function queueBundle(scene: Phaser.Scene, bundle: string): number {
  const m = manifest;
  if (!m) return 0;
  const list = m.bundles[bundle];
  if (!list) return 0;
  let queued = 0;
  for (const e of list) {
    if (scene.textures.exists(e.key)) continue;
    queueEntry(scene.load, e);
    queued++;
  }
  return queued;
}

export function markBundleLoaded(bundle: string): void {
  loadedBundles.add(bundle);
}

/** Load a bundle and resolve when it is ready. Reports progress 0..1. */
export function loadBundle(scene: Phaser.Scene, bundle: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loadedBundles.has(bundle)) { resolve(); return; }
    const queued = queueBundle(scene, bundle);
    if (queued === 0) { loadedBundles.add(bundle); resolve(); return; }
    const progress = (p: number) => onProgress?.(p);
    scene.load.on(Phaser.Loader.Events.PROGRESS, progress);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.load.off(Phaser.Loader.Events.PROGRESS, progress);
      loadedBundles.add(bundle);
      registerAnimations(scene, bundle);
      resolve();
    });
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      scene.load.off(Phaser.Loader.Events.PROGRESS, progress);
      reject(new Error(`failed to load ${file.key}`));
    });
    scene.load.start();
  });
}

/**
 * Create Phaser animations for every atlas in a bundle. Animation definitions
 * are produced by the asset pipeline and travel in the manifest, so the game
 * never hard-codes frame counts.
 */
export function registerAnimations(scene: Phaser.Scene, bundle?: string): void {
  const m = manifest;
  if (!m) return;
  const lists = bundle ? [m.bundles[bundle] ?? []] : Object.values(m.bundles);
  for (const list of lists) {
    for (const e of list) {
      if (!e.anims || !scene.textures.exists(e.key)) continue;
      for (const [name, def] of Object.entries(e.anims)) {
        const key = `${e.key}:${name}`;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: def.frames.map((f) => ({ key: e.key, frame: f })),
          frameRate: def.frameRate,
          repeat: def.repeat,
        });
      }
    }
  }
}

export function animKey(sheet: string, anim: string, facing: string): string {
  return `${sheet}:${anim}_${facing}`;
}

export function hasAnim(scene: Phaser.Scene, sheet: string, anim: string, facing: string): boolean {
  return scene.anims.exists(animKey(sheet, anim, facing));
}

export function tilesKey(region: RegionKey | 'home', season: Season): string {
  return `tiles_${region}_${season}`;
}

export function propsKey(season: Season): string { return `props_${season}`; }
export function buildingsKey(season: Season): string { return `buildings_${season}`; }

export function propMeta(season: Season, id: string) {
  return entryFor(propsKey(season))?.propMeta?.[id];
}

export function buildingMeta(season: Season, id: string) {
  return entryFor(buildingsKey(season))?.buildingMeta?.[id];
}

export function vfxMeta(id: string) {
  return entryFor('vfx')?.vfxMeta?.[id];
}

/** Player sheet key for a weapon family and visual gear tier. */
export function playerSheet(family: string, gearTier: number): string {
  return `player_${family}_${gearTier}`;
}

export function gearBundle(gearTier: number): string | null {
  return gearTier === 0 ? null : `gear${gearTier}`;
}

export function missingTextures(scene: Phaser.Scene, keys: string[]): string[] {
  return keys.filter((k) => !scene.textures.exists(k));
}
