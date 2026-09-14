/** Isometric ground tiles, one set per region, with seasonal dressing. */
import { Canvas, fbm, hashNoise, mix, shade, withAlpha, type RGBA, Rand } from './raster.ts';
import { REGION_PALETTE, MAT, INK_SOFT, type RegionKey } from './palette.ts';
import { TILE_W, TILE_H } from './iso.ts';
import type { Season } from './seasons.ts';
import { seasonalGround } from './seasons.ts';

export type TileKind =
  | 'ground' | 'groundAlt' | 'path' | 'water' | 'rock' | 'floor' | 'rubble'
  | 'lava' | 'ice' | 'bridge' | 'grass' | 'ash' | 'blocked';

export const TILE_KINDS: TileKind[] = ['ground', 'groundAlt', 'path', 'water', 'rock', 'floor', 'rubble', 'lava', 'ice', 'bridge', 'grass', 'ash', 'blocked'];

/** Draws one diamond tile with per-tile texture and a soft bevel. */
export function drawTile(c: Canvas, kind: TileKind, region: RegionKey, season: Season, variant: number): void {
  const pal = REGION_PALETTE[region];
  const cx = TILE_W / 2, cy = TILE_H / 2;
  const rim = -0.75;
  const dia = [
    { x: cx, y: rim },
    { x: TILE_W - rim, y: cy },
    { x: cx, y: TILE_H - rim },
    { x: rim, y: cy },
  ];
  const rnd = new Rand(variant * 7919 + kind.length * 131 + region.length * 17);
  let base: RGBA;
  switch (kind) {
    case 'ground': base = pal.ground; break;
    case 'groundAlt': base = pal.groundAlt; break;
    case 'grass': base = mix(pal.ground, MAT.moss, 0.4); break;
    case 'path': base = pal.dirt; break;
    case 'water': base = mix([78, 112, 130, 255] as RGBA, pal.ground, 0.25); break;
    case 'rock': base = MAT.stone; break;
    case 'floor': base = MAT.stonePale; break;
    case 'rubble': base = mix(MAT.stoneDark, pal.dirt, 0.4); break;
    case 'lava': base = MAT.ash; break;
    case 'ice': base = MAT.ice; break;
    case 'bridge': base = MAT.wood; break;
    case 'ash': base = MAT.ash; break;
    case 'blocked': base = mix(MAT.stoneDark, INK_SOFT, 0.45); break;
    default: base = MAT.stoneDark; break;
  }
  base = seasonalGround(base, kind, season);

  const grainScale = kind === 'floor' || kind === 'bridge' ? 0.9 : 1.6;
  c.poly(dia, base, (x, y, b) => {
    const n = fbm(x * grainScale * 0.34 + variant * 13, y * grainScale * 0.62 + variant * 7, 991 + variant, 3);
    return shade(b, (n - 0.5) * 0.3);
  });

  switch (kind) {
    case 'path':
      for (let i = 0; i < 9; i++) {
        const t = rnd.next(), u = rnd.next();
        const px = cx + (t - 0.5) * TILE_W * 0.62, py = cy + (u - 0.5) * TILE_H * 0.62;
        if (Math.abs(px - cx) / cx + Math.abs(py - cy) / cy > 0.8) continue;
        c.ellipse(px, py, rnd.range(1.4, 3.2), rnd.range(0.8, 1.6), shade(base, rnd.range(-0.3, 0.16)));
      }
      break;
    case 'grass':
      for (let i = 0; i < 12; i++) {
        const px = cx + (rnd.next() - 0.5) * TILE_W * 0.7, py = cy + (rnd.next() - 0.5) * TILE_H * 0.7;
        if (Math.abs(px - cx) / cx + Math.abs(py - cy) / cy > 0.82) continue;
        const hgt = rnd.range(2, 4.6);
        c.capsule(px, py, px + rnd.range(-1.4, 1.4), py - hgt, 0.7, 0.2, seasonalGround(mix(MAT.moss, base, 0.25), 'grass', season));
      }
      break;
    case 'water':
      for (let i = 0; i < 4; i++) {
        const py = cy + (i - 1.5) * 4.6;
        c.capsule(cx - 12 + rnd.range(-3, 3), py, cx + 12 + rnd.range(-3, 3), py + rnd.range(-1, 1), 0.9, 0.9, withAlpha(mix(base, [220, 240, 250, 255], 0.5), 90));
      }
      break;
    case 'ice':
      for (let i = 0; i < 5; i++) {
        const ax = cx + (rnd.next() - 0.5) * TILE_W * 0.6, ay = cy + (rnd.next() - 0.5) * TILE_H * 0.6;
        c.capsule(ax, ay, ax + rnd.range(-7, 7), ay + rnd.range(-3, 3), 0.55, 0.3, withAlpha(MAT.frost, 120));
      }
      break;
    case 'rock':
    case 'rubble':
      for (let i = 0; i < 7; i++) {
        const px = cx + (rnd.next() - 0.5) * TILE_W * 0.66, py = cy + (rnd.next() - 0.5) * TILE_H * 0.66;
        if (Math.abs(px - cx) / cx + Math.abs(py - cy) / cy > 0.78) continue;
        const r = rnd.range(1.6, 3.6);
        c.poly([
          { x: px - r, y: py }, { x: px - r * 0.3, y: py - r * 0.6 },
          { x: px + r * 0.7, y: py - r * 0.4 }, { x: px + r, y: py + r * 0.3 }, { x: px - r * 0.2, y: py + r * 0.5 },
        ], shade(base, rnd.range(-0.28, 0.22)));
      }
      break;
    case 'floor': {
      // flagstones following the diamond
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const px = cx + (a - b) * (TILE_W / 6), py = cy + (a + b) * (TILE_H / 6);
          c.poly([
            { x: px, y: py - TILE_H / 6 + 0.7 }, { x: px + TILE_W / 6 - 0.7, y: py },
            { x: px, y: py + TILE_H / 6 - 0.7 }, { x: px - TILE_W / 6 + 0.7, y: py },
          ], shade(base, hashNoise(a + 4, b + 4, variant * 3 + 5) * 0.28 - 0.14));
        }
      }
      break;
    }
    case 'bridge':
      for (let i = -3; i <= 3; i++) {
        const px = cx + i * (TILE_W / 8), py = cy + i * (TILE_H / 8);
        c.polyline([{ x: px - TILE_W / 4, y: py + TILE_H / 4 }, { x: px + TILE_W / 4, y: py - TILE_H / 4 }], shade(base, hashNoise(i + 8, 1, variant) * 0.3 - 0.18), 2.6);
      }
      break;
    case 'lava':
      for (let i = 0; i < 4; i++) {
        const px = cx + (rnd.next() - 0.5) * TILE_W * 0.5, py = cy + (rnd.next() - 0.5) * TILE_H * 0.5;
        const r = rnd.range(2.4, 5);
        c.ellipse(px, py, r, r * 0.5, MAT.emberGlow);
        c.ellipse(px, py, r * 0.5, r * 0.26, MAT.flame);
        c.glow(px, py, r * 3, withAlpha(MAT.emberGlow, 150), 0.7);
      }
      break;
    case 'ash':
      for (let i = 0; i < 8; i++) {
        const px = cx + (rnd.next() - 0.5) * TILE_W * 0.7, py = cy + (rnd.next() - 0.5) * TILE_H * 0.7;
        c.disc(px, py, rnd.range(0.6, 1.5), shade(base, rnd.range(-0.25, 0.3)));
      }
      break;
    case 'blocked':
      // Broken rock and deep shade, so the impassable mass never reads as floor.
      for (let i = 0; i < 6; i++) {
        const px = cx + (rnd.next() - 0.5) * TILE_W * 0.7, py = cy + (rnd.next() - 0.5) * TILE_H * 0.7;
        const r = rnd.range(2.4, 5);
        c.poly([
          { x: px - r, y: py }, { x: px - r * 0.4, y: py - r * 0.7 },
          { x: px + r * 0.6, y: py - r * 0.5 }, { x: px + r, y: py + r * 0.2 },
        ], shade(base, rnd.range(-0.3, 0.22)));
      }
      c.poly(dia, withAlpha(INK_SOFT, 70));
      break;
    default:
      break;
  }
}

export function buildTileSheet(region: RegionKey, season: Season, variants = 3): {
  width: number; height: number; rgba: Uint8Array; frames: Record<string, { x: number; y: number; w: number; h: number }>;
} {
  const cols = variants;
  const rows = TILE_KINDS.length;
  const width = cols * TILE_W, height = rows * TILE_H;
  const rgba = new Uint8Array(width * height * 4);
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  TILE_KINDS.forEach((kind, r) => {
    for (let v = 0; v < variants; v++) {
      const c = new Canvas(TILE_W, TILE_H, 3);
      drawTile(c, kind, region, season, v);
      const px = c.resolve();
      const ox = v * TILE_W, oy = r * TILE_H;
      for (let y = 0; y < TILE_H; y++) {
        rgba.set(px.subarray(y * TILE_W * 4, (y + 1) * TILE_W * 4), ((oy + y) * width + ox) * 4);
      }
      frames[`${kind}_${v}`] = { x: ox, y: oy, w: TILE_W, h: TILE_H };
    }
  });
  return { width, height, rgba, frames };
}
