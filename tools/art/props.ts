/**
 * World props: vegetation, ruins, camp clutter, hazards and interactables.
 * Each prop draws into a canvas whose anchor is the bottom-centre foot point.
 */
import { Canvas, Rand, mix, shade, withAlpha, rgb, type RGBA, type Vec } from './raster.ts';
import { MAT, INK, BRAND } from './palette.ts';
import { iso, isoBox, faceColors, masonry, TILE_W, TILE_H } from './iso.ts';
import { seasonalFoliage, type Season } from './seasons.ts';

export interface PropCtx { season: Season; variant: number; rnd: Rand }
export interface PropDef {
  w: number;
  h: number;
  /** Fraction of height where the prop touches the ground. */
  anchorY: number;
  bundle: string;
  variants?: number;
  seasonal?: boolean;
  draw: (c: Canvas, ctx: PropCtx) => void;
}

const foot = (d: PropDef) => ({ x: d.w / 2, y: d.h * d.anchorY });

// -------------------------------------------------------------- vegetation

function branch(c: Canvas, x: number, y: number, len: number, ang: number, w: number, depth: number, col: RGBA, rnd: Rand): Vec[] {
  const tips: Vec[] = [];
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  c.capsule(x, y, x2, y2, w, w * 0.68, col, Canvas.lampShader(x - w, y - len * 0.5, len, 0.22, 0.34));
  if (depth <= 0 || len < 4) { tips.push({ x: x2, y: y2 }); return tips; }
  const n = rnd.next() > 0.45 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const a = ang + rnd.range(-0.72, 0.72) + (i - (n - 1) / 2) * 0.32;
    tips.push(...branch(c, x2, y2, len * rnd.range(0.56, 0.74), a, w * 0.64, depth - 1, col, rnd));
  }
  return tips;
}

function foliageCluster(c: Canvas, tips: Vec[], colour: RGBA, r: number, rnd: Rand, season: Season): void {
  if (season === 'winter') {
    for (const t of tips) {
      if (rnd.next() < 0.45) c.ellipse(t.x, t.y, r * 0.42, r * 0.28, withAlpha(MAT.snow, 220));
    }
    return;
  }
  const blobs: { x: number; y: number; r: number }[] = [];
  for (const t of tips) blobs.push({ x: t.x + rnd.range(-r * 0.3, r * 0.3), y: t.y + rnd.range(-r * 0.3, r * 0.2), r: r * rnd.range(0.8, 1.25) });
  blobs.sort((a, b) => b.y - a.y);
  for (const b of blobs) {
    c.ellipse(b.x, b.y, b.r, b.r * 0.82, shade(colour, -0.2));
  }
  for (const b of blobs) {
    c.ellipse(b.x - b.r * 0.16, b.y - b.r * 0.2, b.r * 0.72, b.r * 0.58, colour,
      0, Canvas.combine(Canvas.lampShader(b.x - b.r * 0.4, b.y - b.r * 0.5, b.r * 1.5, 0.28, 0.3), Canvas.grainShader(Math.round(b.x * 7), 0.3, 1.3)));
  }
  if (season === 'autumn') {
    for (let i = 0; i < 8; i++) {
      const b = blobs[Math.floor(rnd.next() * blobs.length)]!;
      c.disc(b.x + rnd.range(-b.r, b.r), b.y + rnd.range(-b.r, b.r * 1.4), rnd.range(0.7, 1.4), mix(colour, [212, 138, 58, 255], 0.7));
    }
  }
}

// ------------------------------------------------------------------ props

export const PROPS: Record<string, PropDef> = {
  tree_oak: {
    w: 96, h: 118, anchorY: 0.94, bundle: 'core', variants: 3, seasonal: true,
    draw(c, { season, rnd }) {


      const trunk = mix(MAT.wood, MAT.woodDark, 0.4);
      const fx = 48, fy = 111;
      const tips = branch(c, fx, fy, 30, -Math.PI / 2 + rnd.range(-0.1, 0.1), 6.2, 3, trunk, rnd);
      foliageCluster(c, tips, seasonalFoliage(rgb('#3E5C34'), season), 16, rnd, season);
      c.under((u) => { u.ellipse(fx, fy + 2, 15, 5.5, withAlpha(INK, 90)); });
    },
  },
  tree_pine: {
    w: 78, h: 132, anchorY: 0.95, bundle: 'core', variants: 3, seasonal: true,
    draw(c, { season, rnd }) {


      const fx = 39, fy = 125;
      const trunk = mix(MAT.woodDark, MAT.wood, 0.3);
      c.capsule(fx, fy, fx + rnd.range(-2, 2), fy - 96, 4.6, 2.4, trunk, Canvas.lampShader(fx - 4, fy - 60, 40, 0.2, 0.34));
      const col = seasonalFoliage(rgb('#2E4A33'), season === 'autumn' ? 'summer' : season);
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const y = fy - 22 - t * 78;
        const w = 30 * (1 - t * 0.74) + 5;
        c.poly([
          { x: fx - w, y: y + 9 }, { x: fx, y: y - 17 }, { x: fx + w, y: y + 9 },
          { x: fx + w * 0.5, y: y + 5 }, { x: fx, y: y + 12 }, { x: fx - w * 0.5, y: y + 5 },
        ], shade(col, (i % 2 ? 0.08 : -0.08)), Canvas.combine(Canvas.lampShader(fx - w * 0.4, y - 8, w * 1.6, 0.24, 0.34), Canvas.grainShader(i * 31, 0.24, 1.4)));
        if (season === 'winter') {
          c.poly([{ x: fx - w * 0.82, y: y + 6 }, { x: fx, y: y - 12 }, { x: fx + w * 0.82, y: y + 6 }, { x: fx, y: y + 2 }], withAlpha(MAT.snow, 205));
        }
      }
      c.under((u) => { u.ellipse(fx, fy + 2, 12, 4.6, withAlpha(INK, 90)); });
    },
  },
  tree_dead: {
    w: 92, h: 116, anchorY: 0.94, bundle: 'core', variants: 3,
    draw(c, { season, rnd }) {


      const fx = 46, fy = 109;
      const tips = branch(c, fx, fy, 34, -Math.PI / 2 + rnd.range(-0.14, 0.14), 5.4, 3, rgb('#4A423A'), rnd);
      if (season === 'winter') for (const t of tips) c.ellipse(t.x, t.y, 2.6, 1.6, withAlpha(MAT.snow, 200));
      c.under((u) => { u.ellipse(fx, fy + 2, 13, 5, withAlpha(INK, 85)); });
    },
  },
  bush: {
    w: 48, h: 40, anchorY: 0.92, bundle: 'core', variants: 3, seasonal: true,
    draw(c, { season, rnd }) {


      const col = seasonalFoliage(rgb('#3A5433'), season);
      for (let i = 0; i < 5; i++) {
        const x = 24 + rnd.range(-11, 11), y = 32 + rnd.range(-7, 2);
        c.ellipse(x, y, rnd.range(7, 11), rnd.range(5, 8), shade(col, rnd.range(-0.2, 0.18)),
          0, Canvas.lampShader(x - 4, y - 5, 14, 0.24, 0.3));
      }
      c.under((u) => { u.ellipse(24, 37, 13, 4, withAlpha(INK, 80)); });
    },
  },
  reeds: {
    w: 44, h: 46, anchorY: 0.94, bundle: 'core', seasonal: true, variants: 2,
    draw(c, { season, rnd }) {
      const col = seasonalFoliage(rgb('#5E6E42'), season);
      for (let i = 0; i < 11; i++) {
        const x = 22 + rnd.range(-12, 12);
        const h = rnd.range(14, 30);
        c.capsule(x, 43, x + rnd.range(-5, 5), 43 - h, 1.1, 0.4, shade(col, rnd.range(-0.2, 0.2)));
      }
    },
  },
  bramble: {
    w: 62, h: 50, anchorY: 0.92, bundle: 'core', variants: 3,
    draw(c, { rnd }) {


      const col = rgb('#4A3B2E');
      for (let i = 0; i < 9; i++) {
        const x0 = 31 + rnd.range(-20, 20), y0 = 44;
        const x1 = x0 + rnd.range(-16, 16), y1 = y0 - rnd.range(12, 30);
        c.curve({ x: x0, y: y0 }, { x: (x0 + x1) / 2 + rnd.range(-9, 9), y: (y0 + y1) / 2 }, { x: x1, y: y1 }, col, 2.4, 1.1, 8);
        for (let k = 0; k < 3; k++) {
          const t = 0.3 + k * 0.25;
          const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
          c.poly([{ x: px, y: py }, { x: px + rnd.range(-4, 4), y: py - 4 }, { x: px + 1, y: py + 1 }], shade(col, 0.25));
        }
      }
      c.under((u) => { u.ellipse(31, 46, 20, 5, withAlpha(INK, 80)); });
    },
  },
  dry_thicket: {
    w: 62, h: 50, anchorY: 0.92, bundle: 'core', variants: 2,
    draw(c, { rnd }) {


      const col = rgb('#7A6A44');
      for (let i = 0; i < 12; i++) {
        const x0 = 31 + rnd.range(-19, 19);
        c.capsule(x0, 45, x0 + rnd.range(-8, 8), 45 - rnd.range(10, 26), 1.5, 0.5, shade(col, rnd.range(-0.22, 0.24)));
      }
      c.under((u) => { u.ellipse(31, 46, 18, 4.6, withAlpha(INK, 80)); });
    },
  },
  mushrooms: {
    w: 40, h: 30, anchorY: 0.93, bundle: 'woodland', variants: 2,
    draw(c, { rnd }) {
      for (let i = 0; i < 5; i++) {
        const x = 20 + rnd.range(-12, 12), y = 26 + rnd.range(-3, 2);
        const h = rnd.range(5, 10);
        c.capsule(x, y, x, y - h, 1.3, 1.1, MAT.clothCream);
        c.ellipse(x, y - h, rnd.range(3.4, 5.6), rnd.range(2, 3.2), rgb('#9A4A3A'), 0, Canvas.lampShader(x - 2, y - h - 2, 6, 0.3, 0.3));
      }
    },
  },
  // ------------------------------------------------------------ stone work
  rock_small: {
    w: 42, h: 32, anchorY: 0.92, bundle: 'core', variants: 3,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.3) : MAT.stone;
      for (let i = 0; i < 3; i++) {
        const x = 21 + rnd.range(-8, 8), y = 26 + rnd.range(-4, 2), r = rnd.range(5, 9);
        c.poly([
          { x: x - r, y }, { x: x - r * 0.4, y: y - r * 0.9 }, { x: x + r * 0.5, y: y - r * 0.8 },
          { x: x + r, y: y - r * 0.1 }, { x: x + r * 0.3, y: y + r * 0.42 }, { x: x - r * 0.6, y: y + r * 0.4 },
        ], shade(base, rnd.range(-0.2, 0.2)), Canvas.combine(Canvas.lampShader(x - r * 0.4, y - r * 0.6, r * 1.6, 0.26, 0.34), Canvas.grainShader(i * 17, 0.24, 1.2)));
      }
      c.under((u) => { u.ellipse(21, 29, 12, 3.6, withAlpha(INK, 80)); });
    },
  },
  boulder: {
    w: 76, h: 66, anchorY: 0.93, bundle: 'core', variants: 3,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.34) : MAT.stone;
      const cx = 38, cy = 52, r = 25;
      c.poly([
        { x: cx - r, y: cy - 3 }, { x: cx - r * 0.72, y: cy - r * 0.86 }, { x: cx - r * 0.1, y: cy - r * 1.12 },
        { x: cx + r * 0.66, y: cy - r * 0.82 }, { x: cx + r, y: cy - r * 0.1 }, { x: cx + r * 0.56, y: cy + r * 0.34 },
        { x: cx - r * 0.5, y: cy + r * 0.36 },
      ], base, Canvas.combine(Canvas.lampShader(cx - r * 0.4, cy - r * 0.7, r * 1.8, 0.3, 0.38), Canvas.grainShader(9, 0.22, 0.9)));
      for (let i = 0; i < 4; i++) {
        const y = cy - 6 - i * 7;
        c.polyline([{ x: cx - r * 0.7, y: y + rnd.range(-2, 2) }, { x: cx + r * 0.6, y: y + rnd.range(-3, 3) }], shade(base, -0.28), 1.2);
      }
      if (season !== 'winter') c.ellipse(cx - 6, cy - r * 0.88, 9, 4, withAlpha(MAT.moss, 150));
      c.under((u) => { u.ellipse(cx, cy + 10, 24, 6, withAlpha(INK, 90)); });
    },
  },
  ruin_column: {
    w: 52, h: 106, anchorY: 0.95, bundle: 'core', variants: 2,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stonePale, MAT.snow, 0.3) : MAT.stonePale;
      const cx = 26, fy = 100;
      const hgt = rnd.range(58, 82);
      c.ellipse(cx, fy, 16, 6, shade(base, -0.24));
      c.poly([{ x: cx - 12, y: fy }, { x: cx + 12, y: fy }, { x: cx + 10, y: fy - hgt }, { x: cx - 10, y: fy - hgt }],
        base, Canvas.combine(Canvas.lampShader(cx - 8, fy - hgt * 0.6, 26, 0.26, 0.36), Canvas.grainShader(5, 0.2, 0.9)));
      for (let i = 1; i < 5; i++) {
        const y = fy - (hgt * i) / 5;
        c.polyline([{ x: cx - 11, y }, { x: cx + 11, y }], shade(base, -0.26), 1.2);
      }
      c.ellipse(cx, fy - hgt, 11, 4.4, shade(base, 0.22));
      c.under((u) => { u.ellipse(cx, fy + 3, 17, 5, withAlpha(INK, 90)); });
    },
  },
  ruin_arch: {
    w: 112, h: 108, anchorY: 0.95, bundle: 'core', variants: 2,
    draw(c, { season }) {


      const base = season === 'winter' ? mix(MAT.stonePale, MAT.snow, 0.28) : MAT.stonePale;
      const fy = 102;
      for (const x of [22, 90]) {
        masonry(c, [{ x: x - 11, y: fy }, { x: x + 11, y: fy }, { x: x + 9, y: fy - 62 }, { x: x - 9, y: fy - 62 }], base, 7, 6);
      }
      c.curve({ x: 13, y: fy - 62 }, { x: 56, y: fy - 104 }, { x: 99, y: fy - 62 }, base, 17, 17, 16);
      c.curve({ x: 30, y: fy - 62 }, { x: 56, y: fy - 86 }, { x: 82, y: fy - 62 }, [0, 0, 0, 0], 1, 1, 4);
      c.under((u) => { u.ellipse(56, fy + 3, 44, 7, withAlpha(INK, 80)); });
    },
  },
  standing_stone: {
    w: 58, h: 108, anchorY: 0.95, bundle: 'core', variants: 3,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stoneDark, MAT.snow, 0.28) : MAT.stoneDark;
      const cx = 29, fy = 101;
      const h = rnd.range(62, 86), w = rnd.range(11, 16);
      c.poly([
        { x: cx - w, y: fy }, { x: cx + w, y: fy }, { x: cx + w * 0.72, y: fy - h },
        { x: cx - w * 0.2, y: fy - h - 5 }, { x: cx - w * 0.86, y: fy - h * 0.86 },
      ], base, Canvas.combine(Canvas.lampShader(cx - w * 0.5, fy - h * 0.6, w * 3, 0.24, 0.4), Canvas.grainShader(13, 0.26, 1.1)));
      // carved runes
      for (let i = 0; i < 4; i++) {
        const y = fy - 16 - i * (h / 5.2);
        c.polyline([{ x: cx - 5, y }, { x: cx + 3, y: y - 3 }, { x: cx - 2, y: y - 7 }], withAlpha(BRAND.gold, 140), 1.4);
      }
      c.under((u) => { u.ellipse(cx, fy + 3, w + 6, 5, withAlpha(INK, 90)); });
    },
  },
  gravestone: {
    w: 44, h: 56, anchorY: 0.93, bundle: 'winterland', variants: 3,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.35) : MAT.stone;
      const cx = 22, fy = 51, h = rnd.range(24, 34);
      const lean = rnd.range(-3, 3);
      c.poly([{ x: cx - 9, y: fy }, { x: cx + 9, y: fy }, { x: cx + 8 + lean, y: fy - h }, { x: cx - 8 + lean, y: fy - h }],
        base, Canvas.lampShader(cx - 5, fy - h * 0.6, 18, 0.24, 0.36));
      c.ellipse(cx + lean, fy - h, 8, 5, base, 0, Canvas.lampShader(cx - 3, fy - h - 2, 10, 0.3, 0.3));
      c.polyline([{ x: cx - 4 + lean, y: fy - h * 0.6 }, { x: cx + 4 + lean, y: fy - h * 0.6 }], shade(base, -0.34), 1.2);
      c.under((u) => { u.ellipse(cx, fy + 2, 12, 4, withAlpha(INK, 85)); });
    },
  },
  rubble_pile: {
    w: 66, h: 44, anchorY: 0.92, bundle: 'core', variants: 3,
    draw(c, { rnd, season }) {


      const base = season === 'winter' ? mix(MAT.stoneDark, MAT.snow, 0.3) : MAT.stoneDark;
      for (let i = 0; i < 9; i++) {
        const x = 33 + rnd.range(-22, 22), y = 38 + rnd.range(-8, 2), r = rnd.range(3, 7);
        c.poly([{ x: x - r, y }, { x: x - r * 0.3, y: y - r * 0.8 }, { x: x + r * 0.8, y: y - r * 0.5 }, { x: x + r, y: y + r * 0.3 }],
          shade(base, rnd.range(-0.25, 0.25)));
      }
      c.under((u) => { u.ellipse(33, 40, 26, 5, withAlpha(INK, 80)); });
    },
  },
  // -------------------------------------------------------------- camp kit
  campfire: {
    w: 56, h: 52, anchorY: 0.9, bundle: 'core', variants: 4,
    draw(c, { variant }) {
      const cx = 28, fy = 45;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        c.ellipse(cx + Math.cos(a) * 14, fy + Math.sin(a) * 6, 5, 3.4, shade(MAT.stone, (i % 2 ? 0.1 : -0.15)));
      }
      c.capsule(cx - 9, fy - 2, cx + 8, fy - 9, 2.4, 2, MAT.woodDark);
      c.capsule(cx + 9, fy - 2, cx - 7, fy - 10, 2.4, 2, shade(MAT.woodDark, 0.12));
      const k = 1 + variant * 0.12;
      c.ellipse(cx, fy - 13 * k, 7 * k, 12 * k, withAlpha(MAT.emberGlow, 235));
      c.ellipse(cx + (variant % 2 ? 1 : -1), fy - 15 * k, 4 * k, 8 * k, MAT.flame);
      c.ellipse(cx, fy - 17 * k, 2 * k, 4.4 * k, MAT.flameCore);
      c.glow(cx, fy - 12, 34, withAlpha(MAT.emberGlow, 190), 1.1);
    },
  },
  brazier: {
    w: 46, h: 72, anchorY: 0.94, bundle: 'core', variants: 4,
    draw(c, { variant }) {
      const cx = 23, fy = 67;
      c.capsule(cx, fy, cx, fy - 30, 3.4, 2.6, MAT.ironDark);
      for (const s of [-1, 1]) c.capsule(cx, fy - 4, cx + s * 9, fy, 2, 1.4, MAT.ironDark);
      c.poly([{ x: cx - 12, y: fy - 30 }, { x: cx + 12, y: fy - 30 }, { x: cx + 9, y: fy - 42 }, { x: cx - 9, y: fy - 42 }],
        MAT.iron, Canvas.lampShader(cx - 5, fy - 40, 16, 0.4, 0.34));
      c.ellipse(cx, fy - 42, 9.6, 3.4, shade(MAT.iron, 0.24));
      const k = 1 + variant * 0.1;
      c.ellipse(cx, fy - 50 * k * 0.98, 6 * k, 10 * k, withAlpha(MAT.emberGlow, 235));
      c.ellipse(cx, fy - 52, 3 * k, 6 * k, MAT.flameCore);
      c.glow(cx, fy - 48, 30, withAlpha(MAT.emberGlow, 200), 1.15);
    },
  },
  barrel: {
    w: 40, h: 50, anchorY: 0.92, bundle: 'core', variants: 2,
    draw(c) {


      const cx = 20, fy = 45;
      c.poly([{ x: cx - 12, y: fy - 4 }, { x: cx - 14, y: fy - 18 }, { x: cx - 12, y: fy - 32 }, { x: cx + 12, y: fy - 32 }, { x: cx + 14, y: fy - 18 }, { x: cx + 12, y: fy - 4 }],
        MAT.wood, Canvas.combine(Canvas.lampShader(cx - 5, fy - 24, 18, 0.28, 0.4), Canvas.grainShader(3, 0.28, 1.6)));
      c.ellipse(cx, fy - 32, 12, 4.4, shade(MAT.wood, 0.28));
      for (const y of [fy - 10, fy - 26]) c.capsule(cx - 13.4, y, cx + 13.4, y, 1.6, 1.6, MAT.ironDark);
      c.under((u) => { u.ellipse(cx, fy - 2, 14, 4.4, withAlpha(INK, 85)); });
    },
  },
  crate: {
    w: 44, h: 46, anchorY: 0.92, bundle: 'core', variants: 2,
    draw(c) {


      isoBox(c, 22, 20, 0, 0, 0, 0.42, 0.42, 0.42, faceColors(MAT.wood), {
        top: Canvas.grainShader(5, 0.24, 1.4), left: Canvas.grainShader(6, 0.24, 1.4), right: Canvas.grainShader(7, 0.24, 1.4),
      });
      c.under((u) => { u.ellipse(22, 43, 15, 4.4, withAlpha(INK, 85)); });
    },
  },
  cart: {
    w: 84, h: 62, anchorY: 0.92, bundle: 'farmland', variants: 2,
    draw(c) {


      isoBox(c, 42, 24, 0, 0, 0, 0.7, 0.42, 0.3, faceColors(MAT.woodDark));
      for (const x of [22, 58]) {
        c.disc(x, 50, 9, shade(MAT.wood, -0.2));
        c.disc(x, 50, 6.4, MAT.wood, Canvas.lampShader(x - 3, 47, 8, 0.3, 0.3));
        c.disc(x, 50, 2, MAT.ironDark);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          c.capsule(x, 50, x + Math.cos(a) * 6, 50 + Math.sin(a) * 6, 0.8, 0.5, shade(MAT.wood, -0.3));
        }
      }
      c.under((u) => { u.ellipse(42, 56, 32, 5, withAlpha(INK, 80)); });
    },
  },
  fence: {
    w: 68, h: 46, anchorY: 0.9, bundle: 'farmland', variants: 2,
    draw(c, { season }) {


      const wood = season === 'winter' ? mix(MAT.wood, MAT.snow, 0.2) : MAT.wood;
      for (const x of [10, 34, 58]) c.capsule(x, 42, x, 16, 2.6, 2.2, wood, Canvas.grainShader(2, 0.3, 1.8));
      for (const y of [24, 34]) c.capsule(6, y, 62, y - 2, 2, 2, shade(wood, -0.12));
      c.under((u) => { u.ellipse(34, 44, 30, 4, withAlpha(INK, 70)); });
    },
  },
  banner_pole: {
    w: 42, h: 96, anchorY: 0.95, bundle: 'core', variants: 3,
    draw(c, { variant }) {


      const cx = 21, fy = 90;
      c.capsule(cx, fy, cx, fy - 76, 2.4, 1.8, MAT.woodDark);
      const cols = [MAT.clothGreen, MAT.clothRed, BRAND.gold];
      const col = cols[variant % cols.length]!;
      c.poly([{ x: cx + 2, y: fy - 74 }, { x: cx + 20, y: fy - 70 }, { x: cx + 17, y: fy - 36 }, { x: cx + 20, y: fy - 30 }, { x: cx + 2, y: fy - 34 }],
        col, Canvas.combine(Canvas.rampShader(fy - 74, fy - 30, 0.16, -0.36), Canvas.grainShader(11, 0.2, 1.4)));
      c.under((u) => { u.ellipse(cx, fy + 2, 8, 3.4, withAlpha(INK, 85)); });
    },
  },
  tent: {
    w: 92, h: 70, anchorY: 0.93, bundle: 'core', variants: 2,
    draw(c) {


      const cx = 46, fy = 62;
      const cloth = rgb('#7A6A4E');
      c.poly([{ x: cx - 34, y: fy }, { x: cx, y: fy - 44 }, { x: cx + 34, y: fy }],
        cloth, Canvas.combine(Canvas.rampShader(fy - 44, fy, 0.2, -0.4), Canvas.grainShader(19, 0.22, 1.2)));
      c.poly([{ x: cx - 34, y: fy }, { x: cx - 18, y: fy - 3 }, { x: cx, y: fy - 44 }], shade(cloth, 0.12));
      c.poly([{ x: cx - 9, y: fy }, { x: cx, y: fy - 26 }, { x: cx + 9, y: fy }], rgb('#2A241C'));
      c.capsule(cx, fy - 44, cx, fy - 52, 1.6, 1.2, MAT.woodDark);
      c.under((u) => { u.ellipse(cx, fy + 2, 36, 5, withAlpha(INK, 85)); });
    },
  },
  chest: {
    w: 44, h: 42, anchorY: 0.92, bundle: 'core', variants: 2,
    draw(c) {


      isoBox(c, 22, 20, 0, 0, 0, 0.4, 0.32, 0.22, faceColors(MAT.woodDark));
      const lid = iso(0.2, 0.16, 0.22, 22, 20);
      c.ellipse(lid.x, lid.y - 2, 13, 6.4, MAT.wood, 0, Canvas.lampShader(lid.x - 5, lid.y - 6, 14, 0.3, 0.3));
      c.capsule(lid.x - 12, lid.y + 4, lid.x + 12, lid.y + 4, 1.6, 1.6, MAT.goldMetal);
      c.disc(lid.x, lid.y + 5, 2.6, MAT.goldMetal);
      c.under((u) => { u.ellipse(22, 38, 15, 4.4, withAlpha(INK, 85)); });
    },
  },
  cache: {
    w: 46, h: 44, anchorY: 0.92, bundle: 'core', variants: 2,
    draw(c) {
      c.ellipse(23, 36, 16, 7, shade(MAT.stone, -0.24));
      isoBox(c, 23, 18, 0, 0, 0, 0.3, 0.24, 0.2, faceColors(mix(MAT.wood, MAT.stone, 0.3)));
      c.glow(23, 26, 20, withAlpha(BRAND.gold, 130), 0.7);
      c.disc(23, 26, 3.4, BRAND.gold);
    },
  },
  well: {
    w: 66, h: 76, anchorY: 0.93, bundle: 'home', variants: 1,
    draw(c) {


      const cx = 33, fy = 70;
      masonry(c, [{ x: cx - 20, y: fy - 4 }, { x: cx + 20, y: fy - 4 }, { x: cx + 18, y: fy - 22 }, { x: cx - 18, y: fy - 22 }], MAT.stone, 3, 3);
      c.ellipse(cx, fy - 22, 18, 7, shade(MAT.stone, 0.2));
      c.ellipse(cx, fy - 22, 13, 4.6, rgb('#1A2228'));
      for (const s of [-1, 1]) c.capsule(cx + s * 15, fy - 24, cx + s * 13, fy - 52, 2.2, 1.8, MAT.woodDark);
      c.capsule(cx - 16, fy - 52, cx + 16, fy - 52, 2, 2, MAT.woodDark);
      c.poly([{ x: cx - 22, y: fy - 52 }, { x: cx, y: fy - 66 }, { x: cx + 22, y: fy - 52 }], shade(MAT.wood, -0.1));
      c.under((u) => { u.ellipse(cx, fy - 2, 24, 6, withAlpha(INK, 85)); });
    },
  },
  anvil: {
    w: 44, h: 40, anchorY: 0.92, bundle: 'home', variants: 1,
    draw(c) {


      const cx = 22, fy = 36;
      c.poly([{ x: cx - 9, y: fy }, { x: cx + 9, y: fy }, { x: cx + 6, y: fy - 9 }, { x: cx - 6, y: fy - 9 }], MAT.woodDark);
      c.poly([{ x: cx - 5, y: fy - 9 }, { x: cx + 5, y: fy - 9 }, { x: cx + 4, y: fy - 16 }, { x: cx - 4, y: fy - 16 }], MAT.ironDark);
      c.poly([{ x: cx - 13, y: fy - 16 }, { x: cx + 9, y: fy - 16 }, { x: cx + 17, y: fy - 20 }, { x: cx + 8, y: fy - 23 }, { x: cx - 13, y: fy - 23 }],
        MAT.iron, Canvas.lampShader(cx - 4, fy - 22, 16, 0.42, 0.34));
      c.under((u) => { u.ellipse(cx, fy + 2, 14, 4, withAlpha(INK, 85)); });
    },
  },
  // -------------------------------------------------------------- hazards
  web_patch: {
    w: 76, h: 46, anchorY: 0.88, bundle: 'woodland', variants: 3,
    draw(c, { rnd }) {
      const cx = 38, cy = 30;
      const col = withAlpha(rgb('#CFC9B4'), 190);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        c.capsule(cx, cy, cx + Math.cos(a) * 33, cy + Math.sin(a) * 15, 0.9, 0.4, col);
      }
      for (let r = 1; r <= 3; r++) {
        const pts: Vec[] = [];
        for (let i = 0; i <= 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          pts.push({ x: cx + Math.cos(a) * (r * 10 + rnd.range(-1.6, 1.6)), y: cy + Math.sin(a) * (r * 4.6 + rnd.range(-1, 1)) });
        }
        c.polyline(pts, col, 0.8, true);
      }
    },
  },
  egg_sac: {
    w: 46, h: 52, anchorY: 0.92, bundle: 'woodland', variants: 2,
    draw(c) {


      const cx = 23, fy = 46;
      c.ellipse(cx, fy - 16, 14, 17, rgb('#B6AE90'), 0, Canvas.combine(Canvas.lampShader(cx - 5, fy - 24, 18, 0.24, 0.36), Canvas.grainShader(23, 0.26, 1.4)));
      c.ellipse(cx - 3, fy - 21, 5, 6, withAlpha(MAT.venom, 140));
      c.glow(cx, fy - 18, 22, withAlpha(MAT.venom, 90), 0.6);
      c.under((u) => { u.ellipse(cx, fy - 1, 14, 4, withAlpha(INK, 80)); });
    },
  },
  ice_spike: {
    w: 46, h: 68, anchorY: 0.93, bundle: 'winterland', variants: 3,
    draw(c, { rnd }) {


      const cx = 23, fy = 63;
      for (let i = 0; i < 3; i++) {
        const x = cx + rnd.range(-9, 9), h = rnd.range(22, 46), w = rnd.range(4, 8);
        c.poly([{ x: x - w, y: fy }, { x: x + w, y: fy }, { x: x + w * 0.2, y: fy - h }],
          withAlpha(MAT.ice, 225), Canvas.lampShader(x - 2, fy - h * 0.6, w * 3, 0.4, 0.3));
      }
      c.glow(cx, fy - 22, 24, withAlpha(MAT.frost, 90), 0.6);
      c.under((u) => { u.ellipse(cx, fy + 1, 14, 4, withAlpha(INK, 70)); });
    },
  },
  lava_vent: {
    w: 56, h: 40, anchorY: 0.9, bundle: 'fortress', variants: 3,
    draw(c, { variant }) {
      const cx = 28, fy = 34;
      c.ellipse(cx, fy - 4, 20, 8, shade(MAT.ash, -0.2));
      c.ellipse(cx, fy - 5, 13, 5, MAT.emberGlow);
      c.ellipse(cx, fy - 6, 7, 2.6, MAT.flame);
      c.glow(cx, fy - 8 - variant * 2, 30, withAlpha(MAT.emberGlow, 190), 1);
    },
  },
  siege_ladder: {
    w: 60, h: 104, anchorY: 0.95, bundle: 'borderland', variants: 1,
    draw(c) {
      for (const x of [16, 44]) c.capsule(x, 98, x + 6, 12, 2.6, 2.2, MAT.woodDark, Canvas.grainShader(4, 0.28, 1.6));
      for (let i = 0; i < 8; i++) {
        const y = 92 - i * 11;
        c.capsule(16 + i * 0.75, y, 44 + i * 0.75, y, 1.8, 1.8, MAT.wood);
      }
    },
  },
  ballista: {
    w: 96, h: 76, anchorY: 0.93, bundle: 'borderland', variants: 1,
    draw(c) {


      isoBox(c, 48, 34, 0, 0, 0, 0.6, 0.4, 0.22, faceColors(MAT.woodDark));
      c.capsule(30, 40, 78, 26, 3.2, 2.4, MAT.wood);
      c.capsule(60, 12, 60, 44, 2.6, 2.6, MAT.ironDark);
      c.curve({ x: 60, y: 12 }, { x: 44, y: 28 }, { x: 60, y: 44 }, MAT.wood, 3, 3, 10);
      c.line(60, 12, 60, 44, MAT.clothCream, 1.1);
      for (const x of [34, 66]) c.disc(x, 58, 8, shade(MAT.wood, -0.2));
      c.under((u) => { u.ellipse(52, 64, 34, 6, withAlpha(INK, 80)); });
    },
  },
  war_drum: {
    w: 56, h: 52, anchorY: 0.92, bundle: 'borderland', variants: 1,
    draw(c) {


      const cx = 28, fy = 46;
      c.poly([{ x: cx - 16, y: fy - 6 }, { x: cx - 18, y: fy - 22 }, { x: cx + 18, y: fy - 22 }, { x: cx + 16, y: fy - 6 }],
        rgb('#5E4632'), Canvas.grainShader(8, 0.26, 1.4));
      c.ellipse(cx, fy - 22, 18, 7, rgb('#C6B792'), 0, Canvas.lampShader(cx - 6, fy - 26, 20, 0.24, 0.3));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.disc(cx + Math.cos(a) * 15, fy - 22 + Math.sin(a) * 5.6, 1.4, MAT.ironDark);
      }
      c.under((u) => { u.ellipse(cx, fy - 2, 20, 5, withAlpha(INK, 85)); });
    },
  },
  furnace: {
    w: 74, h: 84, anchorY: 0.94, bundle: 'mountain', variants: 2,
    draw(c) {


      const cx = 37, fy = 78;
      masonry(c, [{ x: cx - 24, y: fy }, { x: cx + 24, y: fy }, { x: cx + 20, y: fy - 48 }, { x: cx - 20, y: fy - 48 }], MAT.stoneDark, 11, 5);
      c.poly([{ x: cx - 10, y: fy - 6 }, { x: cx + 10, y: fy - 6 }, { x: cx + 8, y: fy - 26 }, { x: cx - 8, y: fy - 26 }], rgb('#1A1210'));
      c.ellipse(cx, fy - 12, 8, 7, MAT.emberGlow);
      c.glow(cx, fy - 14, 26, withAlpha(MAT.emberGlow, 190), 1);
      c.poly([{ x: cx - 12, y: fy - 48 }, { x: cx + 12, y: fy - 48 }, { x: cx + 9, y: fy - 66 }, { x: cx - 9, y: fy - 66 }], MAT.stone);
      c.under((u) => { u.ellipse(cx, fy + 2, 26, 6, withAlpha(INK, 90)); });
    },
  },
  beacon: {
    w: 74, h: 128, anchorY: 0.95, bundle: 'core', variants: 4,
    draw(c, { variant }) {


      const cx = 37, fy = 122;
      masonry(c, [{ x: cx - 20, y: fy }, { x: cx + 20, y: fy }, { x: cx + 14, y: fy - 62 }, { x: cx - 14, y: fy - 62 }], MAT.stonePale, 23, 7);
      c.ellipse(cx, fy - 62, 16, 6, shade(MAT.stonePale, 0.22));
      for (const s of [-1, 1]) c.capsule(cx + s * 12, fy - 64, cx + s * 10, fy - 80, 2, 1.6, MAT.ironDark);
      c.ellipse(cx, fy - 80, 12, 4.6, MAT.ironDark);
      const lit = variant > 0;
      if (lit) {
        const k = 0.8 + variant * 0.16;
        c.ellipse(cx, fy - 90 * 1.0, 9 * k, 15 * k, withAlpha(MAT.emberGlow, 235));
        c.ellipse(cx, fy - 93, 4.6 * k, 8 * k, MAT.flameCore);
        c.glow(cx, fy - 88, 52, withAlpha(BRAND.gold, 200), 1.2);
      }
      c.under((u) => { u.ellipse(cx, fy + 2, 26, 7, withAlpha(INK, 95)); });
    },
  },
  ring_pedestal: {
    w: 56, h: 66, anchorY: 0.93, bundle: 'core', variants: 3,
    draw(c, { variant }) {


      const cx = 28, fy = 60;
      c.ellipse(cx, fy - 4, 18, 7, shade(MAT.stonePale, -0.2));
      masonry(c, [{ x: cx - 12, y: fy - 4 }, { x: cx + 12, y: fy - 4 }, { x: cx + 9, y: fy - 32 }, { x: cx - 9, y: fy - 32 }], MAT.stonePale, 3, 4);
      c.ellipse(cx, fy - 32, 11, 4.4, shade(MAT.stonePale, 0.24));
      const glowCol = [BRAND.gold, MAT.wardBlue, MAT.emberGlow][variant % 3]!;
      c.disc(cx, fy - 40, 5.4, glowCol);
      c.disc(cx, fy - 40, 2.6, [16, 18, 20, 255]);
      c.glow(cx, fy - 40, 26, withAlpha(glowCol, 190), 1);
      c.under((u) => { u.ellipse(cx, fy - 1, 20, 5, withAlpha(INK, 90)); });
    },
  },
  bridge_plank: {
    w: 68, h: 40, anchorY: 0.82, bundle: 'core', variants: 2,
    draw(c) {
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const x = 8 + t * 52, y = 30 - t * 14;
        c.capsule(x - 8, y + 4, x + 8, y - 4, 3.2, 3.2, MAT.wood, Canvas.grainShader(i * 5, 0.3, 1.4));
      }
    },
  },
  supply_crate: {
    w: 50, h: 50, anchorY: 0.92, bundle: 'core', variants: 1,
    draw(c) {


      isoBox(c, 25, 22, 0, 0, 0, 0.44, 0.44, 0.4, faceColors(mix(MAT.wood, MAT.clothCream, 0.2)));
      const top = iso(0.22, 0.22, 0.4, 25, 22);
      c.capsule(top.x - 14, top.y, top.x + 14, top.y, 1.8, 1.8, MAT.clothRed);
      c.under((u) => { u.ellipse(25, 47, 17, 4.6, withAlpha(INK, 85)); });
    },
  },
  signpost: {
    w: 48, h: 72, anchorY: 0.94, bundle: 'core', variants: 2,
    draw(c) {


      const cx = 24, fy = 67;
      c.capsule(cx, fy, cx, fy - 48, 2.6, 2.2, MAT.woodDark, Canvas.grainShader(3, 0.3, 1.8));
      c.poly([{ x: cx - 4, y: fy - 44 }, { x: cx + 20, y: fy - 42 }, { x: cx + 16, y: fy - 34 }, { x: cx - 4, y: fy - 36 }],
        MAT.wood, Canvas.grainShader(9, 0.24, 1.4));
      c.under((u) => { u.ellipse(cx, fy + 2, 8, 3.2, withAlpha(INK, 85)); });
    },
  },
};

export const PROP_KEYS = Object.keys(PROPS);
export const _pf = { foot, TILE_W, TILE_H };
