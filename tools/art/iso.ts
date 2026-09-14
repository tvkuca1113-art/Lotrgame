/** Isometric construction helpers shared by props, ruins and buildings. */
import { Canvas, shade, mix, type RGBA, type Vec, hashNoise } from './raster.ts';
import { INK } from './palette.ts';

/** One ground tile is 64x32 on screen; one height unit equals one tile width. */
export const TILE_W = 64;
export const TILE_H = 32;
export const HEIGHT_UNIT = 32;

export function iso(x: number, z: number, y = 0, ox = 0, oy = 0): Vec {
  return {
    x: ox + (x - z) * (TILE_W / 2),
    y: oy + (x + z) * (TILE_H / 2) - y * HEIGHT_UNIT,
  };
}

export interface BoxColors { top: RGBA; left: RGBA; right: RGBA }

export function faceColors(base: RGBA): BoxColors {
  return { top: shade(base, 0.22), left: shade(base, -0.06), right: shade(base, -0.3) };
}

/** Axis-aligned isometric box. (x,z) is the near corner, sizes are in tiles. */
export function isoBox(
  c: Canvas, ox: number, oy: number,
  x: number, z: number, y: number,
  w: number, d: number, h: number,
  col: BoxColors,
  shaders?: { top?: (x: number, y: number, b: RGBA) => RGBA; left?: (x: number, y: number, b: RGBA) => RGBA; right?: (x: number, y: number, b: RGBA) => RGBA },
): void {
  const P = (px: number, pz: number, py: number) => iso(px, pz, py, ox, oy);
  const t0 = P(x, z, y + h), t1 = P(x + w, z, y + h), t2 = P(x + w, z + d, y + h), t3 = P(x, z + d, y + h);
  const b0 = P(x, z, y), b1 = P(x + w, z, y), b2 = P(x + w, z + d, y), b3 = P(x, z + d, y);
  // left face (towards -x screen side): edge x..x, z..z+d
  c.poly([t3, t2, b2, b3], col.left, shaders?.left);
  // right face: edge x..x+w at z+d
  c.poly([t1, t2, b2, b1], col.right, shaders?.right);
  c.poly([t0, t1, t2, t3], col.top, shaders?.top);
  void b0;
}

/** Hip roof: four slopes meeting at a ridge, drawn in painter order. */
export function isoRoof(
  c: Canvas, ox: number, oy: number,
  x: number, z: number, y: number,
  w: number, d: number, h: number,
  base: RGBA, overhang = 0.12,
): void {
  const P = (px: number, pz: number, py: number) => iso(px, pz, py, ox, oy);
  const x0 = x - overhang, x1 = x + w + overhang;
  const z0 = z - overhang, z1 = z + d + overhang;
  const rx0 = x + w * 0.32, rx1 = x + w * 0.68;
  const rz = z + d / 2;
  const e0 = P(x0, z0, y), e1 = P(x1, z0, y), e2 = P(x1, z1, y), e3 = P(x0, z1, y);
  const r0 = P(rx0, rz, y + h), r1 = P(rx1, rz, y + h);
  const grain = Canvas.grainShader(31, 0.26, 1.2);
  c.poly([e0, e1, r1, r0], shade(base, 0.14), grain);       // back slope
  c.poly([e3, e2, r1, r0], shade(base, -0.22), grain);      // front slope
  c.poly([e0, e3, r0], shade(base, -0.05), grain);          // left hip
  c.poly([e1, e2, r1], shade(base, -0.34), grain);          // right hip
  c.polyline([r0, r1], shade(base, 0.3), 2.2);
  c.polyline([e0, e1], shade(base, -0.4), 1.4);
  c.polyline([e3, e2], shade(base, -0.45), 1.6);
}

/** Gable roof running along z, for halls and towers. */
export function isoGable(
  c: Canvas, ox: number, oy: number,
  x: number, z: number, y: number,
  w: number, d: number, h: number,
  base: RGBA, overhang = 0.12,
): void {
  const P = (px: number, pz: number, py: number) => iso(px, pz, py, ox, oy);
  const x0 = x - overhang, x1 = x + w + overhang;
  const z0 = z - overhang, z1 = z + d + overhang;
  const rx = x + w / 2;
  const grain = Canvas.grainShader(37, 0.24, 1.2);
  c.poly([P(x0, z0, y), P(x1, z0, y), P(rx, z0, y + h)], shade(base, -0.1));
  c.poly([P(x0, z0, y), P(x0, z1, y), P(rx, z1, y + h), P(rx, z0, y + h)], shade(base, 0.12), grain);
  c.poly([P(x1, z0, y), P(x1, z1, y), P(rx, z1, y + h), P(rx, z0, y + h)], shade(base, -0.3), grain);
  c.poly([P(x0, z1, y), P(x1, z1, y), P(rx, z1, y + h)], shade(base, -0.24));
  c.polyline([P(rx, z0, y + h), P(rx, z1, y + h)], shade(base, 0.32), 2);
}

/** A warm window - the single most important readability cue for "home". */
export function isoWindow(c: Canvas, p: Vec, w: number, h: number, glow: RGBA, frame: RGBA, lit = true): void {
  c.poly([
    { x: p.x - w / 2, y: p.y - h },
    { x: p.x + w / 2, y: p.y - h + w * 0.28 },
    { x: p.x + w / 2, y: p.y + w * 0.28 },
    { x: p.x - w / 2, y: p.y },
  ], lit ? glow : shade(frame, -0.4));
  c.strokePoly([
    { x: p.x - w / 2, y: p.y - h },
    { x: p.x + w / 2, y: p.y - h + w * 0.28 },
    { x: p.x + w / 2, y: p.y + w * 0.28 },
    { x: p.x - w / 2, y: p.y },
  ], frame, 1.4);
  if (lit) c.glow(p.x, p.y - h / 2, w * 2.4, [...glow.slice(0, 3), 150] as RGBA, 0.8);
}

export function isoDoor(c: Canvas, p: Vec, w: number, h: number, wood: RGBA, metal: RGBA): void {
  const pts = [
    { x: p.x - w / 2, y: p.y - h },
    { x: p.x + w / 2, y: p.y - h + w * 0.3 },
    { x: p.x + w / 2, y: p.y + w * 0.3 },
    { x: p.x - w / 2, y: p.y },
  ];
  c.poly(pts, wood, Canvas.combine(Canvas.rampShader(p.y - h, p.y, 0.1, -0.35), Canvas.grainShader(17, 0.3, 1.1)));
  c.strokePoly(pts, shade(wood, -0.4), 1.4);
  c.disc(p.x + w * 0.24, p.y - h * 0.44, 1.6, metal);
  c.polyline([{ x: p.x - w / 2, y: p.y - h * 0.72 }, { x: p.x + w / 2, y: p.y - h * 0.72 + w * 0.3 }], shade(metal, -0.2), 1.2);
}

/** Stone block masonry drawn over a face region. */
export function masonry(c: Canvas, pts: Vec[], base: RGBA, seed: number, rows = 5): void {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  c.poly(pts, base, Canvas.combine(
    Canvas.lampShader((minX + maxX) / 2 - (maxX - minX) * 0.25, (minY + maxY) / 2 - (maxY - minY) * 0.3, (maxX - minX) * 0.9, 0.2, 0.32),
    (x, y, b) => {
      const rowH = (maxY - minY) / rows;
      const row = Math.floor((y - minY) / Math.max(1e-5, rowH));
      const off = row % 2 ? 0.5 : 0;
      const colW = (maxX - minX) / (rows + 1);
      const colf = (x - minX) / Math.max(1e-5, colW) + off;
      const fx = colf - Math.floor(colf);
      const fy = (y - minY) / Math.max(1e-5, rowH) - row;
      const edge = fx < 0.06 || fy < 0.09 ? -0.3 : 0;
      const n = hashNoise(Math.floor(colf), row, seed) - 0.5;
      return shade(b, edge + n * 0.2);
    },
  ));
}

export function timberFrame(c: Canvas, pts: Vec[], beam: RGBA, count = 3): void {
  const [a, b, cc, d] = pts as [Vec, Vec, Vec, Vec];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const p0 = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const p1 = { x: d.x + (cc.x - d.x) * t, y: d.y + (cc.y - d.y) * t };
    c.polyline([p0, p1], beam, 2.2);
  }
  c.strokePoly(pts, beam, 2.4);
}

export function outlineProp(c: Canvas, thickness = 0.62): void {
  c.outline(INK, thickness);
}

export const _u = { mix };
