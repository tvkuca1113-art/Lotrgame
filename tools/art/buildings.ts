/**
 * Settlement architecture. The home tier progression (camp -> cottage ->
 * stone house -> fortified courtyard -> small castle) plus every functional
 * structure the player can place.
 */
import { Canvas, mix, shade, withAlpha, rgb, type RGBA } from './raster.ts';
import { MAT, INK, BRAND } from './palette.ts';
import { iso, isoBox, isoRoof, isoGable, isoWindow, isoDoor, faceColors, masonry } from './iso.ts';
import type { Season } from './seasons.ts';

export interface BuildingCtx { season: Season; variant: number; lit: boolean }
export interface BuildingDef {
  w: number;
  h: number;
  anchorY: number;
  /** Footprint in tiles - the placement grid uses this. */
  gridW: number;
  gridD: number;
  bundle: string;
  draw: (c: Canvas, ctx: BuildingCtx) => void;
}

const WARM = rgb('#F2C87A');
const THATCH = rgb('#9A8352');
const TIMBER = rgb('#5E4632');
const PLASTER = rgb('#B7A986');

function snowCap(c: Canvas, ox: number, oy: number, x: number, z: number, y: number, w: number, d: number, season: Season): void {
  if (season !== 'winter') return;
  const P = (px: number, pz: number, py: number) => iso(px, pz, py, ox, oy);
  c.poly([P(x - 0.1, z - 0.1, y), P(x + w + 0.1, z - 0.1, y), P(x + w + 0.1, z + d + 0.1, y), P(x - 0.1, z + d + 0.1, y)], withAlpha(MAT.snow, 200));
}

export const BUILDINGS: Record<string, BuildingDef> = {
  // ------------------------------------------------------------ home tiers
  home_camp: {
    w: 168, h: 132, anchorY: 0.88, gridW: 3, gridD: 3, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 84, oy = 44;
      // trodden ground ring
      c.ellipse(ox, oy + 40, 64, 30, withAlpha(mix(MAT.leatherDark, MAT.stone, 0.4), 70));
      // lean-to shelter
      const cloth = season === 'winter' ? mix(rgb('#7A6A4E'), MAT.snow, 0.18) : rgb('#7A6A4E');
      const a = iso(0, 0, 0, ox, oy), b = iso(1.6, 0, 0, ox, oy), d = iso(0, 1.5, 0, ox, oy), e = iso(1.6, 1.5, 0, ox, oy);
      const rt = iso(0.8, 0.75, 1.05, ox, oy);
      c.poly([a, b, rt], shade(cloth, 0.12));
      c.poly([b, e, rt], shade(cloth, -0.26));
      c.poly([a, d, rt], shade(cloth, 0.02));
      c.polyline([a, rt], shade(cloth, -0.4), 1.6);
      c.polyline([b, rt], shade(cloth, -0.4), 1.6);
      c.capsule(rt.x, rt.y, rt.x, rt.y - 10, 1.8, 1.4, MAT.woodDark);
      // bedroll and packs
      const bp = iso(0.5, 1.9, 0, ox, oy);
      c.ellipse(bp.x, bp.y, 15, 6, rgb('#6A5A44'));
      c.ellipse(bp.x - 8, bp.y - 2, 5, 3.6, rgb('#4A3E30'));
      // fire pit
      const fp = iso(2.3, 1.2, 0, ox, oy);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        c.ellipse(fp.x + Math.cos(ang) * 15, fp.y + Math.sin(ang) * 7, 4.6, 3, shade(MAT.stone, i % 2 ? 0.1 : -0.16));
      }
      c.capsule(fp.x - 8, fp.y - 2, fp.x + 7, fp.y - 8, 2.2, 1.8, MAT.woodDark);
      if (lit) {
        c.ellipse(fp.x, fp.y - 12, 7, 12, withAlpha(MAT.emberGlow, 235));
        c.ellipse(fp.x, fp.y - 15, 3.4, 6, MAT.flameCore);
        c.glow(fp.x, fp.y - 11, 44, withAlpha(MAT.emberGlow, 190), 1.1);
      }
      snowCap(c, ox, oy, 0, 0, 0.02, 1.6, 1.5, season);
    },
  },
  home_cottage: {
    w: 196, h: 178, anchorY: 0.9, gridW: 3, gridD: 3, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 98, oy = 56;
      const wall = season === 'winter' ? mix(PLASTER, MAT.snow, 0.12) : PLASTER;
      isoBox(c, ox, oy, 0, 0, 0, 2.2, 1.8, 1.0, faceColors(wall), {
        left: Canvas.grainShader(21, 0.16, 1.1), right: Canvas.grainShader(22, 0.16, 1.1),
      });
      // exposed timber frame
      const fl = [iso(0, 0, 1, ox, oy), iso(0, 1.8, 1, ox, oy), iso(0, 1.8, 0, ox, oy), iso(0, 0, 0, ox, oy)];
      c.strokePoly(fl, TIMBER, 2.2);
      for (let i = 1; i < 3; i++) {
        const t = i / 3;
        c.polyline([iso(0, 1.8 * t, 1, ox, oy), iso(0, 1.8 * t, 0, ox, oy)], TIMBER, 2);
      }
      const fr = [iso(0, 1.8, 1, ox, oy), iso(2.2, 1.8, 1, ox, oy), iso(2.2, 1.8, 0, ox, oy), iso(0, 1.8, 0, ox, oy)];
      c.strokePoly(fr, TIMBER, 2.2);
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        c.polyline([iso(2.2 * t, 1.8, 1, ox, oy), iso(2.2 * t, 1.8, 0, ox, oy)], TIMBER, 2);
      }
      isoRoof(c, ox, oy, 0, 0, 1, 2.2, 1.8, 0.78, season === 'winter' ? mix(THATCH, MAT.snow, 0.45) : THATCH, 0.2);
      isoDoor(c, iso(1.5, 1.82, 0, ox, oy), 22, 34, MAT.woodDark, MAT.iron);
      isoWindow(c, iso(0.6, 1.82, 0.42, ox, oy), 18, 18, WARM, TIMBER, lit);
      isoWindow(c, iso(-0.02, 0.7, 0.42, ox, oy), 16, 18, WARM, TIMBER, lit);
      // chimney
      isoBox(c, ox, oy, 1.7, 0.3, 1.5, 0.36, 0.36, 0.5, faceColors(MAT.stone));
      if (lit) {
        const ch = iso(1.88, 0.48, 2.0, ox, oy);
        for (let i = 0; i < 4; i++) c.ellipse(ch.x + i * 2.4, ch.y - 8 - i * 9, 5 + i * 1.6, 3.4 + i, withAlpha(rgb('#8A8A88'), 70 - i * 12));
      }
      c.ellipse(ox, oy + 58, 78, 22, withAlpha(INK, 70));
    },
  },
  home_stonehouse: {
    w: 232, h: 216, anchorY: 0.9, gridW: 4, gridD: 4, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 116, oy = 66;
      const stone = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.16) : MAT.stone;
      isoBox(c, ox, oy, 0, 0, 0, 2.8, 2.2, 1.45, faceColors(stone));
      masonry(c, [iso(0, 0, 1.45, ox, oy), iso(0, 2.2, 1.45, ox, oy), iso(0, 2.2, 0, ox, oy), iso(0, 0, 0, ox, oy)], shade(stone, -0.06), 31, 7);
      masonry(c, [iso(0, 2.2, 1.45, ox, oy), iso(2.8, 2.2, 1.45, ox, oy), iso(2.8, 2.2, 0, ox, oy), iso(0, 2.2, 0, ox, oy)], shade(stone, -0.3), 33, 7);
      isoGable(c, ox, oy, 0, 0, 1.45, 2.8, 2.2, 0.95, season === 'winter' ? mix(rgb('#6A5F52'), MAT.snow, 0.42) : rgb('#6A5F52'), 0.18);
      isoDoor(c, iso(1.9, 2.24, 0, ox, oy), 26, 42, MAT.woodDark, MAT.iron);
      isoWindow(c, iso(0.7, 2.24, 0.5, ox, oy), 20, 22, WARM, MAT.stoneDark, lit);
      isoWindow(c, iso(2.5, 2.24, 0.82, ox, oy), 16, 18, WARM, MAT.stoneDark, lit);
      isoWindow(c, iso(-0.03, 0.8, 0.6, ox, oy), 18, 22, WARM, MAT.stoneDark, lit);
      isoBox(c, ox, oy, 2.3, 0.2, 2.1, 0.42, 0.42, 0.7, faceColors(shade(stone, -0.08)));
      // porch step
      isoBox(c, ox, oy, 1.55, 2.2, 0, 0.7, 0.36, 0.12, faceColors(shade(stone, 0.1)));
      if (lit) {
        const lp = iso(1.35, 2.3, 0.72, ox, oy);
        c.disc(lp.x, lp.y, 4.4, WARM);
        c.glow(lp.x, lp.y, 30, withAlpha(WARM, 170), 0.9);
      }
      c.ellipse(ox, oy + 74, 96, 26, withAlpha(INK, 72));
    },
  },
  home_courtyard: {
    w: 300, h: 250, anchorY: 0.9, gridW: 5, gridD: 5, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 150, oy = 62;
      const stone = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.16) : MAT.stone;
      // back wall run
      isoBox(c, ox, oy, 0, 0, 0, 4.2, 0.4, 1.35, faceColors(shade(stone, -0.04)));
      isoBox(c, ox, oy, 0, 0, 0, 0.4, 3.4, 1.35, faceColors(shade(stone, 0.02)));
      // crenellations
      for (let i = 0; i < 8; i++) {
        isoBox(c, ox, oy, i * 0.52, 0, 1.35, 0.3, 0.4, 0.26, faceColors(shade(stone, 0.06)));
      }
      for (let i = 0; i < 6; i++) {
        isoBox(c, ox, oy, 0, 0.5 + i * 0.5, 1.35, 0.4, 0.28, 0.26, faceColors(shade(stone, 0.02)));
      }
      // main hall inside the yard
      isoBox(c, ox, oy, 1.1, 0.7, 0, 2.4, 1.9, 1.35, faceColors(shade(stone, 0.04)));
      isoGable(c, ox, oy, 1.1, 0.7, 1.35, 2.4, 1.9, 0.9, season === 'winter' ? mix(rgb('#5E5448'), MAT.snow, 0.4) : rgb('#5E5448'), 0.16);
      isoDoor(c, iso(2.8, 2.64, 0, ox, oy), 26, 42, MAT.woodDark, MAT.iron);
      isoWindow(c, iso(1.7, 2.64, 0.5, ox, oy), 20, 22, WARM, MAT.stoneDark, lit);
      // gatehouse
      isoBox(c, ox, oy, 3.8, 2.6, 0, 0.9, 0.9, 1.7, faceColors(shade(stone, -0.02)));
      isoBox(c, ox, oy, 3.8, 2.6, 1.7, 0.9, 0.9, 0.2, faceColors(shade(stone, 0.12)));
      isoDoor(c, iso(4.25, 3.54, 0, ox, oy), 28, 46, rgb('#4A3A28'), MAT.iron);
      if (lit) {
        for (const p of [iso(3.7, 3.56, 1.05, ox, oy), iso(4.85, 3.56, 1.05, ox, oy)]) {
          c.disc(p.x, p.y, 4, MAT.flame);
          c.glow(p.x, p.y, 30, withAlpha(MAT.emberGlow, 170), 0.95);
        }
      }
      c.ellipse(ox + 10, oy + 92, 130, 30, withAlpha(INK, 70));
    },
  },
  home_castle: {
    w: 344, h: 320, anchorY: 0.92, gridW: 6, gridD: 6, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 172, oy = 74;
      const stone = season === 'winter' ? mix(MAT.stonePale, MAT.snow, 0.2) : MAT.stonePale;
      // curtain walls
      isoBox(c, ox, oy, 0, 0, 0, 5.0, 0.44, 1.6, faceColors(shade(stone, -0.08)));
      isoBox(c, ox, oy, 0, 0, 0, 0.44, 4.2, 1.6, faceColors(shade(stone, -0.02)));
      for (let i = 0; i < 9; i++) isoBox(c, ox, oy, i * 0.55, 0, 1.6, 0.32, 0.44, 0.3, faceColors(shade(stone, 0.08)));
      for (let i = 0; i < 7; i++) isoBox(c, ox, oy, 0, 0.55 + i * 0.55, 1.6, 0.44, 0.3, 0.3, faceColors(shade(stone, 0.02)));
      // keep
      isoBox(c, ox, oy, 1.2, 0.9, 0, 2.5, 2.2, 2.7, faceColors(stone));
      masonry(c, [iso(1.2, 0.9, 2.7, ox, oy), iso(1.2, 3.1, 2.7, ox, oy), iso(1.2, 3.1, 0, ox, oy), iso(1.2, 0.9, 0, ox, oy)], shade(stone, -0.06), 41, 12);
      masonry(c, [iso(1.2, 3.1, 2.7, ox, oy), iso(3.7, 3.1, 2.7, ox, oy), iso(3.7, 3.1, 0, ox, oy), iso(1.2, 3.1, 0, ox, oy)], shade(stone, -0.3), 43, 12);
      for (let i = 0; i < 5; i++) isoBox(c, ox, oy, 1.2 + i * 0.5, 0.9, 2.7, 0.3, 2.2, 0.3, faceColors(shade(stone, 0.12)));
      isoGable(c, ox, oy, 1.4, 1.05, 3.0, 2.1, 1.9, 1.0, season === 'winter' ? mix(rgb('#4E5A5E'), MAT.snow, 0.4) : rgb('#4E5A5E'), 0.14);
      // corner towers
      for (const [tx, tz] of [[0.0, 0.0], [4.6, 0.0], [0.0, 3.9]] as [number, number][]) {
        isoBox(c, ox, oy, tx, tz, 0, 0.85, 0.85, 2.4, faceColors(shade(stone, 0.02)));
        isoBox(c, ox, oy, tx - 0.08, tz - 0.08, 2.4, 1.0, 1.0, 0.22, faceColors(shade(stone, 0.14)));
        const cone = [iso(tx - 0.08, tz - 0.08, 2.62, ox, oy), iso(tx + 0.92, tz - 0.08, 2.62, ox, oy), iso(tx + 0.92, tz + 0.92, 2.62, ox, oy), iso(tx - 0.08, tz + 0.92, 2.62, ox, oy)];
        const apex = iso(tx + 0.42, tz + 0.42, 3.5, ox, oy);
        const roof = season === 'winter' ? mix(rgb('#4E5A5E'), MAT.snow, 0.35) : rgb('#4E5A5E');
        c.poly([cone[0]!, cone[1]!, apex], shade(roof, 0.14));
        c.poly([cone[1]!, cone[2]!, apex], shade(roof, -0.3));
        c.poly([cone[3]!, cone[0]!, apex], shade(roof, -0.02));
        c.poly([cone[2]!, cone[3]!, apex], shade(roof, -0.2));
        if (lit) {
          const w = iso(tx + 0.44, tz + 0.88, 1.5, ox, oy);
          c.disc(w.x, w.y, 3.4, WARM);
          c.glow(w.x, w.y, 24, withAlpha(WARM, 150), 0.8);
        }
      }
      // gate
      isoBox(c, ox, oy, 4.1, 3.4, 0, 1.2, 1.0, 2.0, faceColors(shade(stone, -0.04)));
      isoDoor(c, iso(4.7, 4.44, 0, ox, oy), 34, 54, rgb('#3E3022'), MAT.iron);
      isoWindow(c, iso(2.4, 3.14, 1.5, ox, oy), 20, 24, WARM, MAT.stoneDark, lit);
      isoWindow(c, iso(3.2, 3.14, 0.7, ox, oy), 18, 22, WARM, MAT.stoneDark, lit);
      // banners
      for (const [bx, bz] of [[1.6, 3.12], [3.2, 3.12]] as [number, number][]) {
        const p = iso(bx, bz, 2.1, ox, oy);
        c.poly([{ x: p.x - 8, y: p.y }, { x: p.x + 8, y: p.y + 3 }, { x: p.x + 7, y: p.y + 32 }, { x: p.x, y: p.y + 26 }, { x: p.x - 7, y: p.y + 32 }],
          BRAND.gold, Canvas.rampShader(p.y, p.y + 32, 0.16, -0.4));
      }
      c.ellipse(ox + 12, oy + 122, 150, 34, withAlpha(INK, 70));
    },
  },

  // ----------------------------------------------------- functional pieces
  forge: {
    w: 148, h: 136, anchorY: 0.9, gridW: 2, gridD: 2, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 74, oy = 44;
      const stone = season === 'winter' ? mix(MAT.stoneDark, MAT.snow, 0.12) : MAT.stoneDark;
      isoBox(c, ox, oy, 0, 0, 0, 1.7, 1.5, 1.0, faceColors(stone));
      isoRoof(c, ox, oy, 0, 0, 1.0, 1.7, 1.5, 0.5, rgb('#4A423A'), 0.24);
      isoBox(c, ox, oy, 1.2, 0.2, 1.0, 0.36, 0.36, 0.7, faceColors(shade(stone, -0.1)));
      // forge mouth
      const m = iso(0.85, 1.54, 0.3, ox, oy);
      c.poly([{ x: m.x - 14, y: m.y }, { x: m.x + 14, y: m.y + 5 }, { x: m.x + 12, y: m.y - 20 }, { x: m.x - 12, y: m.y - 24 }], rgb('#1A1210'));
      if (lit) {
        c.ellipse(m.x, m.y - 10, 9, 8, MAT.emberGlow);
        c.ellipse(m.x, m.y - 12, 4.4, 4, MAT.flame);
        c.glow(m.x, m.y - 10, 40, withAlpha(MAT.emberGlow, 200), 1.15);
      }
      // anvil out front
      const a = iso(0.3, 1.9, 0, ox, oy);
      c.poly([{ x: a.x - 8, y: a.y }, { x: a.x + 8, y: a.y }, { x: a.x + 5, y: a.y - 8 }, { x: a.x - 5, y: a.y - 8 }], MAT.woodDark);
      c.poly([{ x: a.x - 11, y: a.y - 14 }, { x: a.x + 8, y: a.y - 14 }, { x: a.x + 15, y: a.y - 18 }, { x: a.x + 7, y: a.y - 21 }, { x: a.x - 11, y: a.y - 21 }], MAT.iron);
      c.ellipse(ox, oy + 48, 62, 18, withAlpha(INK, 70));
    },
  },
  ring_workbench: {
    w: 132, h: 124, anchorY: 0.9, gridW: 2, gridD: 2, bundle: 'home',
    draw(c, { lit }) {
      const ox = 66, oy = 42;
      isoBox(c, ox, oy, 0, 0, 0, 1.5, 1.2, 0.62, faceColors(MAT.wood), { top: Canvas.grainShader(11, 0.22, 1.2) });
      // canopy posts
      for (const [px, pz] of [[0, 0], [1.5, 0], [0, 1.2], [1.5, 1.2]] as [number, number][]) {
        const p0 = iso(px, pz, 0.62, ox, oy), p1 = iso(px, pz, 1.5, ox, oy);
        c.capsule(p0.x, p0.y, p1.x, p1.y, 2.4, 2, MAT.woodDark);
      }
      isoRoof(c, ox, oy, 0, 0, 1.5, 1.5, 1.2, 0.36, rgb('#4A5A46'), 0.3);
      // tools + ring rack
      const t = iso(0.75, 0.6, 0.62, ox, oy);
      c.ellipse(t.x, t.y - 2, 20, 8, shade(MAT.wood, 0.18));
      for (let i = 0; i < 4; i++) {
        const rx = t.x - 14 + i * 9, ry = t.y - 4 - (i % 2) * 3;
        c.disc(rx, ry, 4.2, i % 2 ? BRAND.gold : MAT.steel);
        c.disc(rx, ry, 2.2, [20, 22, 24, 255]);
        if (lit) c.glow(rx, ry, 12, withAlpha(i % 2 ? BRAND.gold : MAT.wardBlue, 150), 0.7);
      }
      c.ellipse(ox, oy + 44, 56, 16, withAlpha(INK, 68));
    },
  },
  garden: {
    w: 140, h: 104, anchorY: 0.86, gridW: 2, gridD: 2, bundle: 'home',
    draw(c, { season }) {
      const ox = 70, oy = 34;
      const soil = rgb('#4A3A28');
      c.poly([iso(0, 0, 0, ox, oy), iso(2, 0, 0, ox, oy), iso(2, 1.8, 0, ox, oy), iso(0, 1.8, 0, ox, oy)],
        season === 'winter' ? mix(soil, MAT.snow, 0.5) : soil, Canvas.grainShader(13, 0.26, 1.4));
      // raised edging
      for (const [a, b] of [[[0, 0], [2, 0]], [[2, 0], [2, 1.8]], [[2, 1.8], [0, 1.8]], [[0, 1.8], [0, 0]]] as [number, number][][]) {
        const p0 = iso(a![0]!, a![1]!, 0, ox, oy), p1 = iso(b![0]!, b![1]!, 0, ox, oy);
        c.capsule(p0.x, p0.y, p1.x, p1.y, 2.6, 2.6, MAT.woodDark);
      }
      const leaf = season === 'winter' ? mix(MAT.moss, MAT.snow, 0.45) : season === 'autumn' ? mix(MAT.moss, rgb('#C07A38'), 0.4) : MAT.moss;
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 4; k++) {
          const p = iso(0.3 + k * 0.45, 0.35 + r * 0.55, 0, ox, oy);
          c.ellipse(p.x, p.y - 4, 7, 5, shade(leaf, (k % 2 ? 0.1 : -0.1)));
          c.capsule(p.x, p.y, p.x, p.y - 6, 1.1, 0.7, shade(leaf, -0.3));
          if (season === 'summer' || season === 'spring') c.disc(p.x + 2, p.y - 7, 1.6, season === 'spring' ? rgb('#E4D8BC') : rgb('#D08A46'));
        }
      }
    },
  },
  watchtower: {
    w: 150, h: 228, anchorY: 0.93, gridW: 2, gridD: 2, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 75, oy = 82;
      const stone = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.16) : MAT.stone;
      isoBox(c, ox, oy, 0, 0, 0, 1.3, 1.3, 3.2, faceColors(stone));
      masonry(c, [iso(0, 0, 3.2, ox, oy), iso(0, 1.3, 3.2, ox, oy), iso(0, 1.3, 0, ox, oy), iso(0, 0, 0, ox, oy)], shade(stone, -0.06), 51, 12);
      masonry(c, [iso(0, 1.3, 3.2, ox, oy), iso(1.3, 1.3, 3.2, ox, oy), iso(1.3, 1.3, 0, ox, oy), iso(0, 1.3, 0, ox, oy)], shade(stone, -0.3), 53, 12);
      isoBox(c, ox, oy, -0.16, -0.16, 3.2, 1.62, 1.62, 0.22, faceColors(shade(stone, 0.16)));
      for (let i = 0; i < 4; i++) {
        isoBox(c, ox, oy, -0.16 + i * 0.42, -0.16, 3.42, 0.26, 0.24, 0.28, faceColors(shade(stone, 0.1)));
        isoBox(c, ox, oy, -0.16, -0.16 + i * 0.42, 3.42, 0.24, 0.26, 0.28, faceColors(shade(stone, 0.04)));
      }
      isoDoor(c, iso(0.65, 1.34, 0, ox, oy), 22, 36, MAT.woodDark, MAT.iron);
      isoWindow(c, iso(0.65, 1.34, 1.5, ox, oy), 14, 20, WARM, MAT.stoneDark, lit);
      if (lit) {
        const b = iso(0.65, 0.65, 3.5, ox, oy);
        c.ellipse(b.x, b.y - 6, 7, 11, withAlpha(MAT.emberGlow, 230));
        c.ellipse(b.x, b.y - 9, 3.4, 6, MAT.flameCore);
        c.glow(b.x, b.y - 6, 46, withAlpha(BRAND.gold, 190), 1.15);
      }
      c.ellipse(ox, oy + 42, 50, 16, withAlpha(INK, 72));
    },
  },
  wall_segment: {
    w: 104, h: 108, anchorY: 0.88, gridW: 1, gridD: 1, bundle: 'home',
    draw(c, { season }) {
      const ox = 52, oy = 40;
      const stone = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.18) : MAT.stone;
      isoBox(c, ox, oy, 0, 0, 0, 1.0, 0.44, 1.35, faceColors(stone));
      masonry(c, [iso(0, 0.44, 1.35, ox, oy), iso(1, 0.44, 1.35, ox, oy), iso(1, 0.44, 0, ox, oy), iso(0, 0.44, 0, ox, oy)], shade(stone, -0.28), 61, 6);
      isoBox(c, ox, oy, 0, 0, 1.35, 0.32, 0.44, 0.28, faceColors(shade(stone, 0.1)));
      isoBox(c, ox, oy, 0.62, 0, 1.35, 0.32, 0.44, 0.28, faceColors(shade(stone, 0.1)));
      c.ellipse(ox, oy + 26, 40, 11, withAlpha(INK, 68));
    },
  },
  gate: {
    w: 156, h: 172, anchorY: 0.9, gridW: 2, gridD: 1, bundle: 'home',
    draw(c, { season, lit }) {
      const ox = 78, oy = 60;
      const stone = season === 'winter' ? mix(MAT.stone, MAT.snow, 0.18) : MAT.stone;
      for (const tx of [0, 1.5]) {
        isoBox(c, ox, oy, tx, 0, 0, 0.6, 0.6, 2.1, faceColors(stone));
        isoBox(c, ox, oy, tx - 0.08, -0.08, 2.1, 0.76, 0.76, 0.2, faceColors(shade(stone, 0.14)));
      }
      isoBox(c, ox, oy, 0.6, 0.06, 1.55, 0.9, 0.48, 0.55, faceColors(shade(stone, 0.04)));
      isoDoor(c, iso(1.05, 0.62, 0, ox, oy), 44, 58, rgb('#43341F'), MAT.iron);
      if (lit) {
        for (const p of [iso(0.3, 0.64, 1.3, ox, oy), iso(1.8, 0.64, 1.3, ox, oy)]) {
          c.disc(p.x, p.y, 4, MAT.flame);
          c.glow(p.x, p.y, 28, withAlpha(MAT.emberGlow, 170), 0.95);
        }
      }
      c.ellipse(ox, oy + 42, 66, 16, withAlpha(INK, 70));
    },
  },
  bed: {
    w: 108, h: 84, anchorY: 0.86, gridW: 2, gridD: 1, bundle: 'home',
    draw(c) {
      const ox = 54, oy = 26;
      isoBox(c, ox, oy, 0, 0, 0, 1.5, 0.9, 0.22, faceColors(MAT.woodDark));
      isoBox(c, ox, oy, 0.06, 0.06, 0.22, 1.38, 0.78, 0.16, faceColors(rgb('#9A8E72')));
      const pillow = iso(0.3, 0.45, 0.4, ox, oy);
      c.ellipse(pillow.x, pillow.y, 13, 7, MAT.clothCream);
      const blanket = [iso(0.62, 0.06, 0.38, ox, oy), iso(1.44, 0.06, 0.38, ox, oy), iso(1.44, 0.84, 0.38, ox, oy), iso(0.62, 0.84, 0.38, ox, oy)];
      c.poly(blanket, rgb('#5A6E52'), Canvas.grainShader(29, 0.2, 1.2));
      for (const x of [0.02, 1.48]) {
        const p0 = iso(x, 0.04, 0, ox, oy), p1 = iso(x, 0.04, 0.62, ox, oy);
        c.capsule(p0.x, p0.y, p1.x, p1.y, 2.6, 2.4, MAT.woodDark);
      }
      c.ellipse(ox, oy + 34, 46, 12, withAlpha(INK, 66));
    },
  },
  storage_chest: {
    w: 84, h: 72, anchorY: 0.88, gridW: 1, gridD: 1, bundle: 'home',
    draw(c) {
      const ox = 42, oy = 24;
      isoBox(c, ox, oy, 0, 0, 0, 1.0, 0.7, 0.5, faceColors(MAT.woodDark), { top: Canvas.grainShader(33, 0.24, 1.3) });
      const lid = iso(0.5, 0.35, 0.5, ox, oy);
      c.ellipse(lid.x, lid.y - 4, 24, 11, MAT.wood, 0, Canvas.lampShader(lid.x - 8, lid.y - 10, 26, 0.28, 0.32));
      c.capsule(lid.x - 22, lid.y + 2, lid.x + 22, lid.y + 2, 2, 2, MAT.goldMetal);
      c.disc(lid.x, lid.y + 4, 3.4, MAT.goldMetal);
      c.ellipse(ox, oy + 30, 34, 10, withAlpha(INK, 68));
    },
  },
  trophy_display: {
    w: 116, h: 140, anchorY: 0.9, gridW: 2, gridD: 1, bundle: 'home',
    draw(c, { variant, lit }) {
      const ox = 58, oy = 52;
      isoBox(c, ox, oy, 0, 0, 0, 1.2, 0.6, 0.4, faceColors(MAT.stoneDark));
      const p = iso(0.6, 0.3, 0.4, ox, oy);
      c.capsule(p.x, p.y, p.x, p.y - 36, 3, 2.4, MAT.woodDark);
      const trophies = [
        () => { c.poly([{ x: p.x - 13, y: p.y - 36 }, { x: p.x + 13, y: p.y - 36 }, { x: p.x, y: p.y - 60 }], MAT.iron); },
        () => { c.ellipse(p.x, p.y - 46, 12, 10, MAT.skinOrcGrey); for (const s of [-1, 1]) c.poly([{ x: p.x + s * 6, y: p.y - 50 }, { x: p.x + s * 16, y: p.y - 64 }, { x: p.x + s * 9, y: p.y - 48 }], MAT.clothCream); },
        () => { c.disc(p.x, p.y - 48, 12, MAT.bronze); c.disc(p.x, p.y - 48, 6, [22, 24, 26, 255]); },
        () => { c.poly([{ x: p.x - 10, y: p.y - 38 }, { x: p.x + 10, y: p.y - 38 }, { x: p.x + 6, y: p.y - 64 }, { x: p.x - 6, y: p.y - 64 }], MAT.steel); },
        () => { c.ellipse(p.x, p.y - 48, 14, 12, MAT.shadow); c.glow(p.x, p.y - 48, 26, withAlpha(MAT.wardPurple, 170), 0.9); },
        () => { c.poly([{ x: p.x - 12, y: p.y - 40 }, { x: p.x + 12, y: p.y - 40 }, { x: p.x, y: p.y - 66 }], MAT.goldMetal); c.glow(p.x, p.y - 50, 30, withAlpha(BRAND.gold, 170), 1); },
      ];
      trophies[Math.min(trophies.length - 1, variant)]!();
      if (lit) c.glow(p.x, p.y - 44, 34, withAlpha(BRAND.gold, 110), 0.7);
      c.ellipse(ox, oy + 26, 44, 12, withAlpha(INK, 70));
    },
  },
  lantern_post: {
    w: 52, h: 108, anchorY: 0.94, bundle: 'home', gridW: 1, gridD: 1,
    draw(c, { lit }) {
      const cx = 26, fy = 102;
      c.capsule(cx, fy, cx, fy - 66, 2.6, 2, MAT.ironDark);
      c.capsule(cx, fy - 66, cx + 11, fy - 72, 2, 1.6, MAT.ironDark);
      const l = { x: cx + 12, y: fy - 62 };
      c.poly([{ x: l.x - 7, y: l.y - 12 }, { x: l.x + 7, y: l.y - 12 }, { x: l.x + 6, y: l.y + 3 }, { x: l.x - 6, y: l.y + 3 }],
        lit ? withAlpha(WARM, 235) : shade(MAT.ironDark, 0.1));
      c.strokePoly([{ x: l.x - 7, y: l.y - 13 }, { x: l.x + 7, y: l.y - 13 }, { x: l.x + 6, y: l.y + 4 }, { x: l.x - 6, y: l.y + 4 }], MAT.ironDark, 1.6);
      c.poly([{ x: l.x - 8, y: l.y - 13 }, { x: l.x + 8, y: l.y - 13 }, { x: l.x, y: l.y - 21 }], MAT.ironDark);
      if (lit) c.glow(l.x, l.y - 5, 40, withAlpha(WARM, 180), 1.05);
      c.ellipse(cx, fy + 2, 10, 4, withAlpha(INK, 85));
    },
  },
  path_stone: {
    w: 72, h: 40, anchorY: 0.62, bundle: 'home', gridW: 1, gridD: 1,
    draw(c, { season }) {
      const ox = 36, oy = 4;
      const base = season === 'winter' ? mix(MAT.stonePale, MAT.snow, 0.42) : MAT.stonePale;
      for (const [a, b] of [[0.14, 0.2], [0.55, 0.2], [0.2, 0.6], [0.62, 0.62], [0.36, 0.4]] as [number, number][]) {
        const p = iso(a, b, 0, ox, oy);
        c.ellipse(p.x, p.y, 10, 5, shade(base, (a + b) % 0.4 - 0.15), 0, Canvas.grainShader(Math.round(a * 91), 0.24, 1.4));
      }
    },
  },
  banner_wall: {
    w: 56, h: 108, anchorY: 0.94, bundle: 'home', gridW: 1, gridD: 1,
    draw(c, { variant }) {
      const cx = 28, fy = 100;
      c.capsule(cx, fy, cx, fy - 74, 2.4, 2, MAT.woodDark);
      const cols = [MAT.clothGreen, BRAND.gold, MAT.clothBlue, MAT.clothRed];
      const col = cols[variant % cols.length]!;
      c.poly([{ x: cx - 14, y: fy - 74 }, { x: cx + 14, y: fy - 74 }, { x: cx + 12, y: fy - 22 }, { x: cx, y: fy - 32 }, { x: cx - 12, y: fy - 22 }],
        col, Canvas.combine(Canvas.rampShader(fy - 74, fy - 22, 0.18, -0.38), Canvas.grainShader(43, 0.18, 1.3)));
      c.disc(cx, fy - 52, 6, withAlpha(BRAND.gold, 210));
      c.disc(cx, fy - 52, 3, shade(col, -0.35));
      c.ellipse(cx, fy + 2, 9, 3.4, withAlpha(INK, 85));
    },
  },
  monument: {
    w: 116, h: 176, anchorY: 0.93, bundle: 'home', gridW: 2, gridD: 2,
    draw(c, { variant, lit }) {
      const ox = 58, oy = 66;
      isoBox(c, ox, oy, 0, 0, 0, 1.2, 1.2, 0.36, faceColors(MAT.stoneDark));
      isoBox(c, ox, oy, 0.2, 0.2, 0.36, 0.8, 0.8, 0.3, faceColors(MAT.stone));
      const p = iso(0.6, 0.6, 0.66, ox, oy);
      masonry(c, [{ x: p.x - 13, y: p.y }, { x: p.x + 13, y: p.y }, { x: p.x + 10, y: p.y - 58 }, { x: p.x - 10, y: p.y - 58 }], MAT.stonePale, 71, 6);
      const crest = [BRAND.gold, MAT.wardGreen, MAT.iron, MAT.clothRed, MAT.wardBlue, MAT.emberGlow][variant % 6]!;
      c.poly([{ x: p.x - 12, y: p.y - 58 }, { x: p.x + 12, y: p.y - 58 }, { x: p.x, y: p.y - 84 }], crest);
      if (lit) c.glow(p.x, p.y - 66, 46, withAlpha(crest, 150), 0.95);
      c.ellipse(ox, oy + 40, 52, 16, withAlpha(INK, 72));
    },
  },
  practice_dummy: {
    w: 72, h: 116, anchorY: 0.93, bundle: 'home', gridW: 1, gridD: 1,
    draw(c) {
      const cx = 36, fy = 110;
      c.capsule(cx, fy, cx, fy - 52, 3.4, 3, MAT.woodDark);
      c.capsule(cx - 20, fy - 62, cx + 20, fy - 62, 3, 3, MAT.woodDark);
      c.ellipse(cx, fy - 48, 13, 18, rgb('#9A8B64'), 0, Canvas.combine(Canvas.lampShader(cx - 5, fy - 56, 18, 0.24, 0.34), Canvas.grainShader(47, 0.3, 1.6)));
      c.ellipse(cx, fy - 74, 9, 10, rgb('#8A7B58'));
      c.capsule(cx - 12, fy - 56, cx + 12, fy - 52, 1.8, 1.8, MAT.leatherDark);
      c.ellipse(cx, fy + 2, 14, 5, withAlpha(INK, 80));
    },
  },
};

export const BUILDING_KEYS = Object.keys(BUILDINGS);
