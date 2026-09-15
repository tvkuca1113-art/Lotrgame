/**
 * Asset build entry point.
 *
 * Every image shipped with THE LAST HEARTH is generated here from the code in
 * tools/art/*. Nothing is downloaded, traced or imported: the pipeline is the
 * provenance record. Run with `npm run assets`.
 *
 * Usage:
 *   node --experimental-strip-types tools/build-assets.ts            (all, parallel)
 *   node --experimental-strip-types tools/build-assets.ts --shard=0/4 (one worker)
 *   node --experimental-strip-types tools/build-assets.ts --only=ui
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Canvas, Rand, setDefaultSS } from './art/raster.ts';
import { buildFigureSheet, packCells, FACINGS, type SheetResult } from './art/sheet.ts';
import { allCharacters } from './art/characters.ts';
import { buildTileSheet } from './art/tiles.ts';
import { SEASONS, type Season } from './art/seasons.ts';
import { REGION_PALETTE, type RegionKey } from './art/palette.ts';
import { PROPS } from './art/props.ts';
import { BUILDINGS } from './art/buildings.ts';
import { VFX } from './art/vfx.ts';
import { RING_LOOKS, drawRingIcon, GLYPHS, drawGlyph, ICON, GLYPH_SIZE, type Rarity } from './art/icons.ts';
import { drawPanel, drawButton, drawBarFrame, drawBarFill, drawStickBase, drawStickKnob, drawTouchButton, drawCooldownSweep, drawTitleLayer, drawFavicon } from './art/ui.ts';
import { emitSheet, emitImage, writeManifest, getManifest, writeJson, OUT_ROOT, type ManifestEntry } from './art/output.ts';
import { rgb } from './art/raster.ts';
import { MAT, BRAND } from './art/palette.ts';

type Job = { group: string; name: string; run: () => void };

const args = process.argv.slice(2);
const shardArg = args.find((a) => a.startsWith('--shard='));
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
const force = args.includes('--force');

/**
 * A fingerprint of everything that decides what the artwork looks like: the
 * generators themselves. If it has not changed and every file the manifest
 * names is still on disk, there is nothing to rebuild.
 *
 * This matters beyond speed. A full build clears the output tree first, so
 * rebuilding when nothing changed leaves a window in which the committed
 * artwork is missing from the working tree.
 */
function sourceFingerprint(): string {
  const hash = createHash('sha256');
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (full.endsWith('.ts')) { hash.update(e.name); hash.update(readFileSync(full)); }
    }
  };
  walk(join(process.cwd(), 'tools', 'art'));
  hash.update(readFileSync(import.meta.filename));
  return hash.digest('hex').slice(0, 16);
}

/** True when the manifest on disk was produced by these sources and is intact. */
function upToDate(fingerprint: string): boolean {
  const manifestPath = join(OUT_ROOT, 'manifest.json');
  if (!existsSync(manifestPath)) return false;
  let m: { sourceHash?: string; bundles?: Record<string, ManifestEntry[]> };
  try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { return false; }
  if (m.sourceHash !== fingerprint) return false;
  for (const list of Object.values(m.bundles ?? {})) {
    for (const e of list) {
      for (const f of [e.image, e.data]) {
        if (f && !existsSync(join(OUT_ROOT, f))) return false;
      }
    }
  }
  return true;
}

// --------------------------------------------------------------- job list

function characterJobs(): Job[] {
  return allCharacters().map((e) => ({
    group: 'characters',
    name: e.key,
    run: () => {
      const sheet = buildFigureSheet({
        key: e.key, spec: e.spec, frameW: e.frameW, frameH: e.frameH,
        scale: e.scale, footRatio: e.footRatio, anims: e.anims,
        outlineWidth: e.outlineWidth,
      });
      emitSheet(sheet, e.bundle, 'characters');
    },
  }));
}

const REGION_SEASON_BUNDLE: Record<RegionKey, string> = {
  farmland: 'farmland', woodland: 'woodland', mountain: 'mountain',
  borderland: 'borderland', winterland: 'winterland', fortress: 'fortress', home: 'core',
};

function tileJobs(): Job[] {
  const jobs: Job[] = [];
  for (const region of Object.keys(REGION_PALETTE) as RegionKey[]) {
    for (const season of SEASONS) {
      jobs.push({
        group: 'tiles',
        name: `tiles_${region}_${season}`,
        run: () => {
          const t = buildTileSheet(region, season, 3);
          const sheet: SheetResult = {
            key: `tiles_${region}_${season}`,
            width: t.width, height: t.height, rgba: t.rgba,
            frames: t.frames, anims: {}, anchorX: 0.5, anchorY: 0.5,
            frameW: 64, frameH: 32,
          };
          emitSheet(sheet, REGION_SEASON_BUNDLE[region], 'tiles');
        },
      });
    }
  }
  return jobs;
}

function propJobs(): Job[] {
  // One sheet per season holding every prop variant, so a region loads in one file.
  const jobs: Job[] = [];
  for (const season of SEASONS) {
    jobs.push({
      group: 'props',
      name: `props_${season}`,
      run: () => {
        const cells: { name: string; canvas: Canvas }[] = [];
        let maxW = 0, maxH = 0;
        for (const def of Object.values(PROPS)) { maxW = Math.max(maxW, def.w); maxH = Math.max(maxH, def.h); }
        const meta: Record<string, { anchorX: number; anchorY: number; variants: number }> = {};
        for (const [key, def] of Object.entries(PROPS)) {
          const variants = def.variants ?? 1;
          for (let v = 0; v < variants; v++) {
            const c = new Canvas(maxW, maxH, 3);
            const sub = new Canvas(def.w, def.h, 3);
            def.draw(sub, { season, variant: v, rnd: new Rand(key.length * 977 + v * 131 + season.length * 17) });
            sub.outline(rgb('#0E1211'), 0.62);
            c.blit(sub, (maxW - def.w) / 2, maxH - def.h);
            cells.push({ name: `${key}_${v}`, canvas: c });
          }
          meta[key] = {
            anchorX: 0.5,
            anchorY: (maxH - def.h + def.h * def.anchorY) / maxH,
            variants,
          };
        }
        const sheet = packCells(`props_${season}`, cells, maxW, maxH, {}, 0.5, 0.9);
        const entry = emitSheet(sheet, 'core', 'props');
        (entry as ManifestEntry & { propMeta?: unknown }).propMeta = meta;
      },
    });
  }
  return jobs;
}

function buildingJobs(): Job[] {
  const jobs: Job[] = [];
  for (const season of SEASONS) {
    jobs.push({
      group: 'buildings',
      name: `buildings_${season}`,
      run: () => {
        setDefaultSS(2);
        const cells: { name: string; canvas: Canvas }[] = [];
        let maxW = 0, maxH = 0;
        for (const def of Object.values(BUILDINGS)) { maxW = Math.max(maxW, def.w); maxH = Math.max(maxH, def.h); }
        const meta: Record<string, { anchorX: number; anchorY: number; gridW: number; gridD: number; variants: number }> = {};
        for (const [key, def] of Object.entries(BUILDINGS)) {
          const variants = key === 'trophy_display' || key === 'monument' || key === 'banner_wall' ? 6 : 1;
          for (let v = 0; v < variants; v++) {
            for (const lit of [true, false]) {
              const c = new Canvas(maxW, maxH, 2);
              const sub = new Canvas(def.w, def.h, 2);
              def.draw(sub, { season, variant: v, lit });
              sub.outline(rgb('#0E1211'), 0.7);
              c.blit(sub, (maxW - def.w) / 2, maxH - def.h);
              cells.push({ name: `${key}_${v}_${lit ? 'lit' : 'dark'}`, canvas: c });
            }
          }
          meta[key] = {
            anchorX: 0.5,
            anchorY: (maxH - def.h + def.h * def.anchorY) / maxH,
            gridW: def.gridW, gridD: def.gridD, variants,
          };
        }
        const sheet = packCells(`buildings_${season}`, cells, maxW, maxH, {}, 0.5, 0.9);
        const entry = emitSheet(sheet, 'core', 'buildings');
        (entry as ManifestEntry & { buildingMeta?: unknown }).buildingMeta = meta;
        setDefaultSS(3);
      },
    });
  }
  return jobs;
}

function vfxJobs(): Job[] {
  return [{
    group: 'vfx', name: 'vfx',
    run: () => {
      const cells: { name: string; canvas: Canvas }[] = [];
      let maxW = 0, maxH = 0;
      for (const d of Object.values(VFX)) { maxW = Math.max(maxW, d.w); maxH = Math.max(maxH, d.h); }
      const anims: SheetResult['anims'] = {};
      const meta: Record<string, { w: number; h: number; anchorX: number; anchorY: number }> = {};
      for (const [key, def] of Object.entries(VFX)) {
        const names: string[] = [];
        for (let f = 0; f < def.frames; f++) {
          const t = def.frames === 1 ? 0 : f / (def.frames - 1);
          const c = new Canvas(maxW, maxH, 3);
          const sub = new Canvas(def.w, def.h, 3);
          def.draw(sub, t, new Rand(key.length * 7919 + f * 131 + 3));
          c.blit(sub, (maxW - def.w) / 2, (maxH - def.h) / 2);
          const name = `${key}_${f}`;
          names.push(name);
          cells.push({ name, canvas: c });
        }
        anims[key] = { frames: names, frameRate: def.fps, repeat: 0 };
        meta[key] = { w: def.w, h: def.h, anchorX: def.anchorX ?? 0.5, anchorY: def.anchorY ?? 0.5 };
      }
      const sheet = packCells('vfx', cells, maxW, maxH, anims, 0.5, 0.5);
      const entry = emitSheet(sheet, 'core', 'vfx');
      (entry as ManifestEntry & { vfxMeta?: unknown }).vfxMeta = meta;
    },
  }];
}

function iconJobs(): Job[] {
  return [
    {
      group: 'ui', name: 'rings',
      run: () => {
        const cells: { name: string; canvas: Canvas }[] = [];
        const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
        for (const key of Object.keys(RING_LOOKS)) {
          for (const r of rarities) {
            const c = new Canvas(ICON, ICON, 3);
            drawRingIcon(c, key, r, true);
            cells.push({ name: `${key}_${r}`, canvas: c });
          }
          const s = new Canvas(ICON, ICON, 3);
          drawRingIcon(s, key, 'common', false);
          cells.push({ name: `${key}_unknown`, canvas: s });
        }
        emitSheet(packCells('rings', cells, ICON, ICON, {}, 0.5, 0.5), 'core', 'ui');
      },
    },
    {
      group: 'ui', name: 'glyphs',
      run: () => {
        const cells = GLYPHS.map((g) => {
          const c = new Canvas(GLYPH_SIZE, GLYPH_SIZE, 3);
          drawGlyph(c, g);
          return { name: g, canvas: c };
        });
        emitSheet(packCells('glyphs', cells, GLYPH_SIZE, GLYPH_SIZE, {}, 0.5, 0.5), 'core', 'ui');
      },
    },
    {
      group: 'ui', name: 'frames',
      run: () => {
        // Nine-slice sources and control chrome, packed by name.
        const cells: { name: string; canvas: Canvas }[] = [];
        const P = 96;
        for (const tone of ['parchment', 'dark', 'wood'] as const) {
          const c = new Canvas(P, P, 3);
          drawPanel(c, P, P, { tone });
          cells.push({ name: `panel_${tone}`, canvas: c });
        }
        for (const st of ['idle', 'hover', 'down', 'disabled'] as const) {
          const c = new Canvas(P, 48, 3);
          const pad = new Canvas(P, P, 3);
          drawButton(c, P, 48, st);
          pad.blit(c, 0, (P - 48) / 2);
          cells.push({ name: `button_${st}`, canvas: pad });
        }
        {
          const c = new Canvas(P, P, 3);
          drawBarFrame(c, P, 18);
          cells.push({ name: 'bar_frame', canvas: c });
        }
        for (const [name, a, b] of [
          ['bar_health', rgb('#B8453F'), rgb('#E88A6A')],
          ['bar_stamina', rgb('#6E9E5A'), rgb('#B8D89A')],
          ['bar_boss', rgb('#8A3A34'), rgb('#D07A52')],
          ['bar_xp', BRAND.gold, rgb('#F0DCA0')],
        ] as [string, ReturnType<typeof rgb>, ReturnType<typeof rgb>][]) {
          const c = new Canvas(P, P, 3);
          drawBarFill(c, P, 18, a, b);
          cells.push({ name, canvas: c });
        }
        {
          const c = new Canvas(P, P, 3); drawStickBase(c, P); cells.push({ name: 'stick_base', canvas: c });
          const k = new Canvas(P, P, 3); drawStickKnob(k, 52); cells.push({ name: 'stick_knob', canvas: k });
        }
        for (const st of ['idle', 'down', 'disabled'] as const) {
          const c = new Canvas(P, P, 3);
          drawTouchButton(c, P, st);
          cells.push({ name: `touch_${st}`, canvas: c });
        }
        for (let i = 0; i < 12; i++) {
          const c = new Canvas(P, P, 3);
          drawCooldownSweep(c, P, i / 12);
          cells.push({ name: `cooldown_${i}`, canvas: c });
        }
        emitSheet(packCells('frames', cells, P, P, {}, 0.5, 0.5), 'core', 'ui');
      },
    },
    {
      group: 'ui', name: 'title',
      run: () => {
        setDefaultSS(2);
        const W = 960, H = 540;
        for (const layer of ['sky', 'far', 'mid', 'near'] as const) {
          const c = new Canvas(W, H, 2);
          drawTitleLayer(c, layer, W, H, 0);
          emitImage(`title_${layer}`, 'core', 'ui', W, H, c.resolve());
        }
        // keep animates (window flicker)
        const cells: { name: string; canvas: Canvas }[] = [];
        for (let f = 0; f < 4; f++) {
          const c = new Canvas(W, H, 2);
          drawTitleLayer(c, 'keep', W, H, f);
          cells.push({ name: `keep_${f}`, canvas: c });
        }
        const sheet = packCells('title_keep', cells, W, H, { flicker: { frames: cells.map((c) => c.name), frameRate: 3, repeat: -1 } }, 0.5, 0.5, 2);
        emitSheet(sheet, 'core', 'ui');
        const fav = new Canvas(64, 64, 3);
        drawFavicon(fav, 64);
        emitImage('favicon', 'core', 'ui', 64, 64, fav.resolve());
        setDefaultSS(3);
      },
    },
  ];
}

function allJobs(): Job[] {
  const jobs = [
    ...characterJobs(),
    ...tileJobs(),
    ...propJobs(),
    ...buildingJobs(),
    ...vfxJobs(),
    ...iconJobs(),
  ];
  return only ? jobs.filter((j) => only.includes(j.group) || only.includes(j.name)) : jobs;
}

// ----------------------------------------------------------------- runner

async function runShard(index: number, total: number): Promise<void> {
  const jobs = allJobs().filter((_, i) => i % total === index);
  const t0 = Date.now();
  for (const job of jobs) {
    const s = Date.now();
    job.run();
    process.stdout.write(`  [${index}] ${job.name} ${((Date.now() - s) / 1000).toFixed(1)}s\n`);
  }
  writeJson(`manifest.shard-${index}.json`, getManifest());
  process.stdout.write(`  [${index}] done ${jobs.length} jobs in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}

async function runParallel(): Promise<void> {
  const total = Math.max(1, Math.min(6, cpus().length));
  const t0 = Date.now();
  const fingerprint = sourceFingerprint();
  if (!only && !force && upToDate(fingerprint)) {
    console.log(`Assets are current (sources ${fingerprint}); nothing to build. Use --force to rebuild anyway.`);
    return;
  }
  console.log(`Building assets with ${total} workers...`);
  // Only a full build clears the output tree; partial builds overwrite in place.
  if (!only && existsSync(OUT_ROOT)) rmSync(OUT_ROOT, { recursive: true, force: true });
  await Promise.all(
    Array.from({ length: total }, (_, i) => new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', import.meta.filename, `--shard=${i}/${total}`, ...(only ? [`--only=${only.join(',')}`] : [])], { stdio: 'inherit' });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`shard ${i} failed with code ${code}`))));
    })),
  );
  // merge shard manifests
  const merged: ManifestEntry[] = [];
  for (let i = 0; i < total; i++) {
    const p = join(OUT_ROOT, `manifest.shard-${i}.json`);
    if (!existsSync(p)) continue;
    merged.push(...(JSON.parse(readFileSync(p, 'utf8')) as ManifestEntry[]));
    rmSync(p);
  }
  if (only) {
    // Keep entries for assets this partial build did not regenerate.
    const prev = join(OUT_ROOT, 'manifest.json');
    if (existsSync(prev)) {
      const old = JSON.parse(readFileSync(prev, 'utf8')) as { bundles: Record<string, ManifestEntry[]> };
      const fresh = new Set(merged.map((e) => e.key));
      for (const list of Object.values(old.bundles ?? {})) {
        for (const e of list) if (!fresh.has(e.key)) merged.push(e);
      }
    }
  }
  merged.sort((a, b) => a.key.localeCompare(b.key));
  const byBundle: Record<string, ManifestEntry[]> = {};
  for (const e of merged) (byBundle[e.bundle] ??= []).push(e);
  const totals: Record<string, number> = {};
  for (const [b, list] of Object.entries(byBundle)) totals[b] = list.reduce((s, e) => s + e.bytes, 0);
  writeJson('manifest.json', {
    version: 1, generated: new Date().toISOString().slice(0, 10),
    sourceHash: fingerprint, bundles: byBundle, totals,
  });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`\nAssets: ${merged.length} files, ${(grand / 1024 / 1024).toFixed(2)} MB total, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const [b, v] of Object.entries(totals).sort((a, b2) => b2[1] - a[1])) {
    console.log(`  ${b.padEnd(12)} ${(v / 1024 / 1024).toFixed(2)} MB`);
  }
}

if (shardArg) {
  const [i, n] = shardArg.slice('--shard='.length).split('/').map(Number);
  await runShard(i!, n!);
} else {
  await runParallel();
}

export { writeManifest, MAT, FACINGS };
export type { Season };
