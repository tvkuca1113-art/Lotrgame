import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { encodeAuto } from './png.ts';
import type { SheetResult } from './sheet.ts';
import { toAtlasJson } from './sheet.ts';

export const OUT_ROOT = join(process.cwd(), 'public', 'assets');

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
  bytes: number;
}

const manifest: ManifestEntry[] = [];

export function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export function writeBinary(relPath: string, data: Uint8Array): number {
  const full = join(OUT_ROOT, relPath);
  ensureDir(dirname(full));
  writeFileSync(full, data);
  return data.length;
}

export function writeJson(relPath: string, value: unknown): number {
  const text = JSON.stringify(value);
  const buf = Buffer.from(text, 'utf8');
  writeBinary(relPath, buf);
  return buf.length;
}

export function emitSheet(sheet: SheetResult, bundle: string, folder: string): ManifestEntry {
  const img = `${folder}/${sheet.key}.png`;
  const json = `${folder}/${sheet.key}.json`;
  const png = encodeAuto(sheet.width, sheet.height, sheet.rgba, {
    text: {
      Software: 'THE LAST HEARTH procedural asset pipeline',
      Source: 'Original artwork generated from tools/art/* in this repository',
      License: 'CC0-1.0 (project-original asset)',
    },
  });
  const bytes = writeBinary(img, png);
  writeJson(json, toAtlasJson(sheet, `${sheet.key}.png`));
  const entry: ManifestEntry = {
    key: sheet.key, type: 'atlas', bundle, image: img, data: json,
    frameW: sheet.frameW, frameH: sheet.frameH,
    anchorX: sheet.anchorX, anchorY: sheet.anchorY,
    anims: sheet.anims, bytes,
  };
  manifest.push(entry);
  return entry;
}

export function emitImage(key: string, bundle: string, folder: string, width: number, height: number, rgba: Uint8Array): ManifestEntry {
  const img = `${folder}/${key}.png`;
  const png = encodeAuto(width, height, rgba, {
    text: {
      Software: 'THE LAST HEARTH procedural asset pipeline',
      Source: 'Original artwork generated from tools/art/* in this repository',
      License: 'CC0-1.0 (project-original asset)',
    },
  });
  const bytes = writeBinary(img, png);
  const entry: ManifestEntry = { key, type: 'image', bundle, image: img, bytes };
  manifest.push(entry);
  return entry;
}

export function addManifestEntry(entry: ManifestEntry): void { manifest.push(entry); }

export function getManifest(): ManifestEntry[] { return manifest; }

export function writeManifest(): void {
  const byBundle: Record<string, ManifestEntry[]> = {};
  for (const e of manifest) (byBundle[e.bundle] ??= []).push(e);
  const totals: Record<string, number> = {};
  for (const [b, list] of Object.entries(byBundle)) totals[b] = list.reduce((s, e) => s + e.bytes, 0);
  writeJson('manifest.json', { version: 1, bundles: byBundle, totals });
}
