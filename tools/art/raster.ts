/**
 * Dependency-free software rasteriser used to author every sprite, tile, prop,
 * icon and UI frame in THE LAST HEARTH.
 *
 * Everything is drawn at a supersampled resolution and box-filtered down, which
 * gives the hand-illustrated edge quality the art direction asks for without
 * pulling in a native canvas dependency.
 */

export type RGBA = [number, number, number, number];

export function rgb(hex: string, alpha = 255): RGBA {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, alpha];
}

export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
    Math.round(a[3] + (b[3] - a[3]) * k),
  ];
}

export function shade(c: RGBA, amount: number): RGBA {
  // amount > 0 lightens toward a warm highlight, < 0 darkens toward a cool shadow.
  if (amount >= 0) return mix(c, [255, 246, 226, c[3]], amount);
  return mix(c, [14, 18, 22, c[3]], -amount);
}

export function withAlpha(c: RGBA, a: number): RGBA {
  return [c[0], c[1], c[2], Math.round(Math.max(0, Math.min(255, a)))];
}

export function hsl(h: number, s: number, l: number, a = 255): RGBA {
  const hh = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(hh + 1 / 3) * 255), Math.round(f(hh) * 255), Math.round(f(hh - 1 / 3) * 255), a];
}

export interface Vec { x: number; y: number }

/** Deterministic hash-based noise so every asset build is byte-identical. */
export class Rand {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next(): number {
    this.s ^= this.s << 13; this.s >>>= 0;
    this.s ^= this.s >>> 17;
    this.s ^= this.s << 5; this.s >>>= 0;
    return this.s / 0xffffffff;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]!; }
}

export const SS = 3; // default supersample factor

/** Per-canvas supersampling lets large boss frames render at a cheaper factor. */
export let DEFAULT_SS = SS;

export function setDefaultSS(v: number): void { DEFAULT_SS = Math.max(1, Math.min(4, Math.round(v))); }

export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly ss: number;
  readonly sw: number;
  readonly sh: number;
  readonly buf: Uint8ClampedArray; // supersampled RGBA

  constructor(w: number, h: number, ss: number = DEFAULT_SS) {
    this.w = w; this.h = h; this.ss = ss;
    this.sw = w * ss; this.sh = h * ss;
    this.buf = new Uint8ClampedArray(this.sw * this.sh * 4);
  }

  clone(): Canvas {
    const c = new Canvas(this.w, this.h, this.ss);
    c.buf.set(this.buf);
    return c;
  }

  clear(): void { this.buf.fill(0); }

  fill(c: RGBA): void {
    for (let i = 0; i < this.sw * this.sh; i++) {
      this.buf[i * 4] = c[0]; this.buf[i * 4 + 1] = c[1];
      this.buf[i * 4 + 2] = c[2]; this.buf[i * 4 + 3] = c[3];
    }
  }

  /** Source-over blend of one supersample pixel. */
  px(sx: number, sy: number, c: RGBA): void {
    if (sx < 0 || sy < 0 || sx >= this.sw || sy >= this.sh) return;
    const a = c[3] / 255;
    if (a <= 0) return;
    const i = (sy * this.sw + sx) * 4;
    if (a >= 1) {
      this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2]; this.buf[i + 3] = 255;
      return;
    }
    const da = this.buf[i + 3]! / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) { this.buf[i + 3] = 0; return; }
    this.buf[i] = (c[0] * a + this.buf[i]! * da * (1 - a)) / oa;
    this.buf[i + 1] = (c[1] * a + this.buf[i + 1]! * da * (1 - a)) / oa;
    this.buf[i + 2] = (c[2] * a + this.buf[i + 2]! * da * (1 - a)) / oa;
    this.buf[i + 3] = oa * 255;
  }

  /** Destination-out: clears alpha inside a shape (used for ring holes, windows). */
  erase(shape: (px: (sx: number, sy: number) => void) => void): void {
    shape((sx, sy) => {
      if (sx < 0 || sy < 0 || sx >= this.sw || sy >= this.sh) return;
      this.buf[(sy * this.sw + sx) * 4 + 3] = 0;
    });
  }

  eraseEllipse(cx: number, cy: number, rx: number, ry: number): void {
    const scx = cx * this.ss, scy = cy * this.ss, srx = rx * this.ss, sry = ry * this.ss;
    const x0 = Math.max(0, Math.floor(scx - srx)), x1 = Math.min(this.sw - 1, Math.ceil(scx + srx));
    const y0 = Math.max(0, Math.floor(scy - sry)), y1 = Math.min(this.sh - 1, Math.ceil(scy + sry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - scx) / srx, dy = (y + 0.5 - scy) / sry;
        if (dx * dx + dy * dy <= 1) this.buf[(y * this.sw + x) * 4 + 3] = 0;
      }
    }
  }

  getS(sx: number, sy: number): RGBA {
    if (sx < 0 || sy < 0 || sx >= this.sw || sy >= this.sh) return [0, 0, 0, 0];
    const i = (sy * this.sw + sx) * 4;
    return [this.buf[i]!, this.buf[i + 1]!, this.buf[i + 2]!, this.buf[i + 3]!];
  }

  // ---------------------------------------------------------------- shapes

  /** Scanline polygon fill. `shader` may override the colour per supersample pixel. */
  poly(points: Vec[], c: RGBA, shader?: (x: number, y: number, base: RGBA) => RGBA): void {
    if (points.length < 3) return;
    const pts = points.map((p) => ({ x: p.x * this.ss, y: p.y * this.ss }));
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.sh - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
        if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) {
          xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      if (!xs.length) continue;
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const sxa = Math.max(0, Math.round(xs[i]!));
        const sxb = Math.min(this.sw - 1, Math.round(xs[i + 1]!) - 1);
        for (let x = sxa; x <= sxb; x++) {
          this.px(x, y, shader ? shader(x / this.ss, y / this.ss, c) : c);
        }
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, rot = 0, shader?: (x: number, y: number, base: RGBA) => RGBA): void {
    const steps = Math.max(14, Math.round((rx + ry) * 2.2));
    const pts: Vec[] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const px = Math.cos(t) * rx, py = Math.sin(t) * ry;
      pts.push({ x: cx + px * Math.cos(rot) - py * Math.sin(rot), y: cy + px * Math.sin(rot) + py * Math.cos(rot) });
    }
    this.poly(pts, c, shader);
  }

  disc(cx: number, cy: number, r: number, c: RGBA, shader?: (x: number, y: number, base: RGBA) => RGBA): void {
    this.ellipse(cx, cy, r, r, c, 0, shader);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA, shader?: (x: number, y: number, base: RGBA) => RGBA): void {
    this.poly([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], c, shader);
  }

  /** Tapered capsule - the workhorse for limbs, branches, hafts and horns. */
  capsule(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, c: RGBA, shader?: (x: number, y: number, base: RGBA) => RGBA): void {
    const baseAng = Math.atan2(y2 - y1, x2 - x1);
    const steps = 10;
    const ring: Vec[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = baseAng + Math.PI / 2 + (Math.PI * i) / steps;
      ring.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 });
    }
    for (let i = 0; i <= steps; i++) {
      const a = baseAng - Math.PI / 2 + (Math.PI * i) / steps;
      ring.push({ x: x2 + Math.cos(a) * r2, y: y2 + Math.sin(a) * r2 });
    }
    this.poly(ring, c, shader);
  }

  line(x1: number, y1: number, x2: number, y2: number, c: RGBA, width = 1): void {
    this.capsule(x1, y1, x2, y2, width / 2, width / 2, c);
  }

  /** Quadratic bezier stroke with variable width - cloaks, straps, vines, banners. */
  curve(p0: Vec, p1: Vec, p2: Vec, c: RGBA, w0 = 1, w1 = 1, segments = 12): void {
    let prev = p0;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const pt = {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
      };
      const wa = w0 + (w1 - w0) * ((i - 1) / segments);
      const wb = w0 + (w1 - w0) * t;
      this.capsule(prev.x, prev.y, pt.x, pt.y, wa / 2, wb / 2, c);
      prev = pt;
    }
  }

  polyline(pts: Vec[], c: RGBA, width = 1, closed = false): void {
    for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y, c, width);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y, pts[0]!.x, pts[0]!.y, c, width);
  }

  strokePoly(points: Vec[], c: RGBA, width = 1): void { this.polyline(points, c, width, true); }

  // ------------------------------------------------------------- shading

  /** Directional lambert-ish shader factory: light comes from up-left by default. */
  static lampShader(cx: number, cy: number, radius: number, lift = 0.36, drop = 0.42, lx = -0.55, ly = -0.8) {
    return (x: number, y: number, base: RGBA): RGBA => {
      const dx = (x - cx) / radius;
      const dy = (y - cy) / radius;
      const d = Math.min(1, Math.hypot(dx, dy));
      const nz = Math.sqrt(Math.max(0, 1 - d * d));
      const nl = dx * lx + dy * ly + nz * 0.55;
      const k = Math.max(-1, Math.min(1, nl));
      return k >= 0 ? shade(base, k * lift) : shade(base, k * drop);
    };
  }

  /** Vertical ramp shader for cloth, stone faces and banners. */
  static rampShader(y0: number, y1: number, top: number, bottom: number) {
    return (_x: number, y: number, base: RGBA): RGBA => {
      const t = Math.max(0, Math.min(1, (y - y0) / Math.max(1e-5, y1 - y0)));
      return shade(base, top + (bottom - top) * t);
    };
  }

  /** Deterministic grain, for weathered timber, moss, rusted iron and stone. */
  static grainShader(seed: number, amount: number, scale = 1.6, extra?: (x: number, y: number, base: RGBA) => RGBA) {
    return (x: number, y: number, base: RGBA): RGBA => {
      const b = extra ? extra(x, y, base) : base;
      const n = hashNoise(Math.floor(x * scale), Math.floor(y * scale), seed);
      return shade(b, (n - 0.5) * amount);
    };
  }

  static combine(...shaders: ((x: number, y: number, base: RGBA) => RGBA)[]) {
    return (x: number, y: number, base: RGBA): RGBA => {
      let c = base;
      for (const s of shaders) c = s(x, y, c);
      return c;
    };
  }

  /** Draw a dark contour around every opaque cluster - the key to readable silhouettes. */
  outline(c: RGBA, thickness = 1, onlyOutside = true): void {
    const t = Math.max(1, Math.round(thickness * this.ss));
    const w = this.sw, h = this.sh;
    const src = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) src[i] = this.buf[i * 4 + 3]! > 40 ? 1 : 0;
    // separable box dilation: O(n * t) instead of O(n * t^2)
    const tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = 0;
        const x0 = Math.max(0, x - t), x1 = Math.min(w - 1, x + t);
        for (let k = x0; k <= x1; k++) if (src[row + k]) { v = 1; break; }
        tmp[row + x] = v;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (src[y * w + x]) continue;
        let v = 0;
        const y0 = Math.max(0, y - t), y1 = Math.min(h - 1, y + t);
        for (let k = y0; k <= y1; k++) if (tmp[k * w + x]) { v = 1; break; }
        if (v) this.px(x, y, c);
      }
    }
    void onlyOutside;
  }

  /**
   * Draw beneath everything already on this canvas. Used for ground shadows,
   * which have to sit under the prop that casts them but are most readable when
   * written at the end of a draw routine, where the local geometry is in scope.
   */
  under(fn: (c: Canvas) => void): void {
    const tmp = new Canvas(this.w, this.h, this.ss);
    fn(tmp);
    tmp.blit(this, 0, 0);
    this.buf.set(tmp.buf);
  }

  /** Multiply-darken the lower part of a shape to seat it against the ground. */
  groundShadow(cx: number, cy: number, rx: number, ry: number, strength = 110): void {
    const c: RGBA = [8, 12, 12, strength];
    this.ellipse(cx, cy, rx, ry, c);
  }

  /** Additive glow used for embers, lanterns, ring light and magical wards. */
  glow(cx: number, cy: number, r: number, c: RGBA, intensity = 1): void {
    const sr = r * this.ss;
    const scx = cx * this.ss, scy = cy * this.ss;
    const x0 = Math.max(0, Math.floor(scx - sr)), x1 = Math.min(this.sw - 1, Math.ceil(scx + sr));
    const y0 = Math.max(0, Math.floor(scy - sr)), y1 = Math.min(this.sh - 1, Math.ceil(scy + sr));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - scx, y - scy) / sr;
        if (d >= 1) continue;
        const k = Math.pow(1 - d, 2.2) * intensity;
        const i = (y * this.sw + x) * 4;
        this.buf[i] = this.buf[i]! + c[0] * k;
        this.buf[i + 1] = this.buf[i + 1]! + c[1] * k;
        this.buf[i + 2] = this.buf[i + 2]! + c[2] * k;
        this.buf[i + 3] = Math.max(this.buf[i + 3]!, Math.min(255, c[3] * k));
      }
    }
  }

  /** Composite another canvas, optionally mirrored, tinted or faded. */
  blit(src: Canvas, dx: number, dy: number, opts: { flipX?: boolean; alpha?: number; tint?: RGBA; tintAmount?: number } = {}): void {
    const sdx = Math.round(dx * this.ss), sdy = Math.round(dy * this.ss);
    const a = opts.alpha ?? 1;
    const k = src.ss / this.ss;
    const dw = Math.round(src.sw / k), dh = Math.round(src.sh / k);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const ux = Math.min(src.sw - 1, Math.round(x * k));
        const uy = Math.min(src.sh - 1, Math.round(y * k));
        const sx = opts.flipX ? src.sw - 1 - ux : ux;
        const i = (uy * src.sw + sx) * 4;
        const sa = src.buf[i + 3]!;
        if (sa === 0) continue;
        let col: RGBA = [src.buf[i]!, src.buf[i + 1]!, src.buf[i + 2]!, sa * a];
        if (opts.tint) col = mix(col, withAlpha(opts.tint, col[3]), opts.tintAmount ?? 0.5);
        this.px(sdx + x, sdy + y, col);
      }
    }
  }

  /** Box-filter down to final resolution and return straight RGBA8. */
  resolve(): Uint8Array {
    const out = new Uint8Array(this.w * this.h * 4);
    const inv = 1 / (SS * this.ss);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < this.ss; sy++) {
          for (let sx = 0; sx < this.ss; sx++) {
            const i = ((y * this.ss + sy) * this.sw + (x * this.ss + sx)) * 4;
            const pa = this.buf[i + 3]! / 255;
            r += this.buf[i]! * pa; g += this.buf[i + 1]! * pa; b += this.buf[i + 2]! * pa; a += this.buf[i + 3]!;
          }
        }
        const oa = a * inv;
        const i = (y * this.w + x) * 4;
        if (oa <= 0.5) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0; continue; }
        const norm = 255 / oa / (SS * this.ss);
        out[i] = Math.round(Math.min(255, r * norm));
        out[i + 1] = Math.round(Math.min(255, g * norm));
        out[i + 2] = Math.round(Math.min(255, b * norm));
        out[i + 3] = Math.round(Math.min(255, oa));
      }
    }
    return out;
  }
}

export function hashNoise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

export function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hashNoise(xi, yi, seed), b = hashNoise(xi + 1, yi, seed);
  const c = hashNoise(xi, yi + 1, seed), d = hashNoise(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq, y * freq, seed + i * 977) * amp;
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

/** Median-cut quantisation so illustrated (anti-aliased) art still ships as indexed PNG. */
export function quantize(rgba: Uint8Array, maxColors = 256): Uint8Array {
  const n = rgba.length / 4;
  const opaque: number[] = [];
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3]! > 0) opaque.push(i);
  const distinct = new Set<number>();
  for (const i of opaque) {
    distinct.add(((rgba[i * 4]! << 24) | (rgba[i * 4 + 1]! << 16) | (rgba[i * 4 + 2]! << 8) | rgba[i * 4 + 3]!) >>> 0);
    if (distinct.size > maxColors) break;
  }
  if (distinct.size <= maxColors - 1) return rgba;

  interface Box { idx: number[]; }
  let boxes: Box[] = [{ idx: opaque }];
  const budget = maxColors - 1; // keep one slot for full transparency
  while (boxes.length < budget) {
    let bi = -1, bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i]!;
      if (bx.idx.length < 2) continue;
      let mn = [255, 255, 255, 255], mx = [0, 0, 0, 0];
      for (const p of bx.idx) {
        for (let c = 0; c < 4; c++) {
          const v = rgba[p * 4 + c]!;
          if (v < mn[c]!) mn[c] = v;
          if (v > mx[c]!) mx[c] = v;
        }
      }
      const range = Math.max(mx[0]! - mn[0]!, mx[1]! - mn[1]!, mx[2]! - mn[2]!, (mx[3]! - mn[3]!) * 2);
      if (range > bestRange) { bestRange = range; bi = i; }
    }
    if (bi < 0 || bestRange <= 0) break;
    const bx = boxes[bi]!;
    let mn = [255, 255, 255, 255], mx = [0, 0, 0, 0];
    for (const p of bx.idx) for (let c = 0; c < 4; c++) {
      const v = rgba[p * 4 + c]!;
      if (v < mn[c]!) mn[c] = v;
      if (v > mx[c]!) mx[c] = v;
    }
    let ch = 0, best = -1;
    for (let c = 0; c < 4; c++) {
      const r = (mx[c]! - mn[c]!) * (c === 3 ? 2 : 1);
      if (r > best) { best = r; ch = c; }
    }
    const sorted = bx.idx.slice().sort((p, q) => rgba[p * 4 + ch]! - rgba[q * 4 + ch]!);
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, { idx: sorted.slice(0, mid) }, { idx: sorted.slice(mid) });
    boxes = boxes.filter((b) => b.idx.length > 0);
  }

  const reps: RGBA[] = boxes.map((b) => {
    let r = 0, g = 0, bl = 0, a = 0;
    for (const p of b.idx) { r += rgba[p * 4]!; g += rgba[p * 4 + 1]!; bl += rgba[p * 4 + 2]!; a += rgba[p * 4 + 3]!; }
    const k = b.idx.length || 1;
    return [Math.round(r / k), Math.round(g / k), Math.round(bl / k), Math.round(a / k)];
  });

  const out = new Uint8Array(rgba.length);
  for (let bi2 = 0; bi2 < boxes.length; bi2++) {
    const rep = reps[bi2]!;
    for (const p of boxes[bi2]!.idx) {
      out[p * 4] = rep[0]; out[p * 4 + 1] = rep[1]; out[p * 4 + 2] = rep[2]; out[p * 4 + 3] = rep[3];
    }
  }
  return out;
}
