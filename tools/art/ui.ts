/** Interface furniture: frames, buttons, bars, touch controls and title art. */
import { Canvas, Rand, fbm, mix, shade, withAlpha, rgb, type RGBA, type Vec } from './raster.ts';
import { MAT, INK, BRAND } from './palette.ts';
import { iso, isoBox, isoGable, faceColors } from './iso.ts';

/** Nine-slice parchment panel. Corner size is 24px. */
export function drawPanel(c: Canvas, w: number, h: number, opts: { tone?: 'parchment' | 'dark' | 'wood' } = {}): void {
  const tone = opts.tone ?? 'parchment';
  const fill = tone === 'parchment' ? rgb('#241F1A') : tone === 'wood' ? rgb('#2A221B') : rgb('#14191A');
  const edge = tone === 'wood' ? MAT.woodDark : BRAND.gold;
  c.rect(3, 3, w - 6, h - 6, withAlpha(fill, 238), Canvas.combine(
    Canvas.rampShader(0, h, 0.06, -0.12),
    Canvas.grainShader(53, 0.1, 0.8),
  ));
  c.strokePoly([{ x: 2, y: 2 }, { x: w - 2, y: 2 }, { x: w - 2, y: h - 2 }, { x: 2, y: h - 2 }], shade(edge, -0.42), 3);
  c.strokePoly([{ x: 4.5, y: 4.5 }, { x: w - 4.5, y: 4.5 }, { x: w - 4.5, y: h - 4.5 }, { x: 4.5, y: h - 4.5 }], withAlpha(edge, 180), 1.4);
  // corner knots
  for (const [cx, cy] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]] as [number, number][]) {
    c.disc(cx, cy, 4.4, withAlpha(edge, 220));
    c.disc(cx, cy, 2, shade(fill, -0.2));
  }
}

export function drawButton(c: Canvas, w: number, h: number, state: 'idle' | 'hover' | 'down' | 'disabled'): void {
  const base = state === 'disabled' ? rgb('#2E3230') : state === 'down' ? rgb('#3A2F22') : state === 'hover' ? rgb('#4A3B29') : rgb('#38301F');
  const edge = state === 'disabled' ? rgb('#5A605C') : state === 'hover' ? rgb('#E0C48A') : BRAND.gold;
  const r = 6;
  const body: Vec[] = [
    { x: r, y: 1.5 }, { x: w - r, y: 1.5 }, { x: w - 1.5, y: r }, { x: w - 1.5, y: h - r },
    { x: w - r, y: h - 1.5 }, { x: r, y: h - 1.5 }, { x: 1.5, y: h - r }, { x: 1.5, y: r },
  ];
  c.poly(body, base, Canvas.rampShader(0, h, state === 'down' ? -0.12 : 0.14, state === 'down' ? 0.1 : -0.24));
  c.strokePoly(body, withAlpha(edge, state === 'disabled' ? 120 : 225), 2);
  if (state !== 'down' && state !== 'disabled') {
    c.polyline([{ x: r, y: 3.5 }, { x: w - r, y: 3.5 }], withAlpha(BRAND.parchment, 55), 1.4);
  }
}

export function drawBarFrame(c: Canvas, w: number, h: number): void {
  c.rect(0, 0, w, h, withAlpha(rgb('#12100E'), 225));
  c.strokePoly([{ x: 1, y: 1 }, { x: w - 1, y: 1 }, { x: w - 1, y: h - 1 }, { x: 1, y: h - 1 }], withAlpha(BRAND.gold, 200), 2);
}

export function drawBarFill(c: Canvas, w: number, h: number, colA: RGBA, colB: RGBA): void {
  c.rect(0, 0, w, h, colA, Canvas.rampShader(0, h, 0.26, -0.3));
  c.rect(0, 0, w, Math.max(1, h * 0.34), withAlpha(mix(colA, colB, 0.7), 170));
}

export function drawStickBase(c: Canvas, size: number): void {
  const r = size / 2 - 2;
  c.disc(size / 2, size / 2, r, withAlpha(rgb('#161B1A'), 120));
  c.polyline(Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r };
  }), withAlpha(BRAND.gold, 150), 2.4, true);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    c.capsule(size / 2 + Math.cos(a) * r * 0.5, size / 2 + Math.sin(a) * r * 0.5,
      size / 2 + Math.cos(a) * r * 0.78, size / 2 + Math.sin(a) * r * 0.78, 2, 1, withAlpha(BRAND.parchment, 90));
  }
}

export function drawStickKnob(c: Canvas, size: number): void {
  const r = size / 2 - 2;
  c.disc(size / 2, size / 2, r, withAlpha(rgb('#3A3226'), 210), Canvas.lampShader(size / 2 - r * 0.3, size / 2 - r * 0.4, r * 1.6, 0.3, 0.4));
  c.polyline(Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r };
  }), withAlpha(BRAND.gold, 220), 2.4, true);
}

export function drawTouchButton(c: Canvas, size: number, state: 'idle' | 'down' | 'disabled'): void {
  const r = size / 2 - 2;
  const fill = state === 'down' ? withAlpha(rgb('#5A4428'), 220) : state === 'disabled' ? withAlpha(rgb('#24282A'), 150) : withAlpha(rgb('#2A2A22'), 175);
  c.disc(size / 2, size / 2, r, fill);
  c.polyline(Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return { x: size / 2 + Math.cos(a) * r, y: size / 2 + Math.sin(a) * r };
  }), withAlpha(state === 'disabled' ? rgb('#606664') : BRAND.gold, state === 'down' ? 255 : 195), 2.6, true);
}

/** Cooldown sweep overlay frames (a radial wipe, 12 steps). */
export function drawCooldownSweep(c: Canvas, size: number, t: number): void {
  const cx = size / 2, cy = size / 2, r = size / 2;
  const steps = 40;
  const pts: Vec[] = [{ x: cx, y: cy }];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2 * (1 - t);
    pts.push({ x: cx + Math.cos(a) * r * 1.5, y: cy + Math.sin(a) * r * 1.5 });
  }
  c.poly(pts, withAlpha(rgb('#0E1211'), 165));
}

/** Title screen art: the future stronghold across the valley, in layers. */
export function drawTitleLayer(c: Canvas, layer: 'sky' | 'far' | 'mid' | 'keep' | 'near', w: number, h: number, frame: number): void {
  const rnd = new Rand(1000 + layer.length * 31 + frame);
  switch (layer) {
    case 'sky': {
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const col = mix(rgb('#1B2A30'), rgb('#4A3A30'), Math.pow(t, 1.4));
        c.rect(0, y, w, 1, mix(col, rgb('#0E1414'), Math.max(0, 0.7 - t)));
      }
      // low sun haze
      c.glow(w * 0.68, h * 0.52, w * 0.36, withAlpha(rgb('#C2703E'), 90), 0.7);
      c.disc(w * 0.68, h * 0.52, w * 0.022, withAlpha(rgb('#E8B070'), 210));
      for (let i = 0; i < 90; i++) {
        const x = rnd.range(0, w), y = rnd.range(0, h * 0.5);
        c.disc(x, y, rnd.range(0.4, 1.2), withAlpha(BRAND.parchment, rnd.range(30, 120)));
      }
      break;
    }
    case 'far': {
      const ridge: Vec[] = [];
      for (let x = 0; x <= w; x += 12) {
        ridge.push({ x, y: h * 0.56 - fbm(x * 0.006, 3.1, 77, 4) * h * 0.2 });
      }
      c.poly([...ridge, { x: w, y: h }, { x: 0, y: h }], withAlpha(rgb('#243036'), 235));
      const ridge2: Vec[] = [];
      for (let x = 0; x <= w; x += 12) {
        ridge2.push({ x, y: h * 0.66 - fbm(x * 0.009 + 7, 5.4, 91, 4) * h * 0.14 });
      }
      c.poly([...ridge2, { x: w, y: h }, { x: 0, y: h }], withAlpha(rgb('#1E2A2A'), 240));
      break;
    }
    case 'mid': {
      const hills: Vec[] = [];
      for (let x = 0; x <= w; x += 10) {
        hills.push({ x, y: h * 0.75 - fbm(x * 0.012 + 3, 1.2, 123, 4) * h * 0.1 });
      }
      c.poly([...hills, { x: w, y: h }, { x: 0, y: h }], rgb('#1A2620'));
      for (let i = 0; i < 26; i++) {
        const x = rnd.range(0, w), y = h * 0.76 + rnd.range(0, h * 0.06);
        const s = rnd.range(0.6, 1.3);
        c.capsule(x, y, x, y - 26 * s, 3 * s, 1.4 * s, rgb('#16201A'));
        for (let k = 0; k < 4; k++) {
          const yy = y - 8 * s - k * 6 * s;
          const ww = (16 - k * 3) * s;
          c.poly([{ x: x - ww, y: yy + 4 * s }, { x, y: yy - 8 * s }, { x: x + ww, y: yy + 4 * s }], rgb('#16201A'));
        }
      }
      break;
    }
    case 'keep': {
      const ox = w * 0.5, oy = h * 0.5;
      const stone = rgb('#3E4A4C');
      isoBox(c, ox, oy, 0, 0, 0, 4.4, 0.4, 1.3, faceColors(shade(stone, -0.1)));
      isoBox(c, ox, oy, 0, 0, 0, 0.4, 3.6, 1.3, faceColors(shade(stone, -0.02)));
      for (let i = 0; i < 8; i++) isoBox(c, ox, oy, i * 0.55, 0, 1.3, 0.3, 0.4, 0.26, faceColors(shade(stone, 0.08)));
      isoBox(c, ox, oy, 1.1, 0.8, 0, 2.2, 2.0, 2.4, faceColors(stone));
      isoGable(c, ox, oy, 1.3, 0.95, 2.4, 1.8, 1.7, 0.9, rgb('#37474C'), 0.14);
      for (const [tx, tz] of [[0, 0], [4.0, 0], [0, 3.3]] as [number, number][]) {
        isoBox(c, ox, oy, tx, tz, 0, 0.8, 0.8, 2.1, faceColors(shade(stone, 0.02)));
        const cone = [iso(tx - 0.08, tz - 0.08, 2.1, ox, oy), iso(tx + 0.88, tz - 0.08, 2.1, ox, oy), iso(tx + 0.88, tz + 0.88, 2.1, ox, oy), iso(tx - 0.08, tz + 0.88, 2.1, ox, oy)];
        const apex = iso(tx + 0.4, tz + 0.4, 3.0, ox, oy);
        c.poly([cone[0]!, cone[1]!, apex], rgb('#3E5154'));
        c.poly([cone[1]!, cone[2]!, apex], rgb('#2A383B'));
        c.poly([cone[3]!, cone[0]!, apex], rgb('#374B4E'));
      }
      // warm windows
      const flicker = 0.85 + Math.sin(frame * 0.9) * 0.15;
      for (const [wx, wz, wy] of [[1.9, 2.84, 1.4], [2.7, 2.84, 0.7], [1.4, 2.84, 0.7], [0.4, 0.86, 1.1], [4.4, 0.86, 1.1]] as [number, number, number][]) {
        const p = iso(wx, wz, wy, ox, oy);
        c.poly([{ x: p.x - 4, y: p.y - 9 }, { x: p.x + 4, y: p.y - 7 }, { x: p.x + 4, y: p.y + 1 }, { x: p.x - 4, y: p.y - 1 }], withAlpha(rgb('#F2C87A'), 240 * flicker));
        c.glow(p.x, p.y - 4, 22, withAlpha(rgb('#F2C87A'), 130 * flicker), 0.9);
      }
      break;
    }
    case 'near': {
      const edge: Vec[] = [];
      for (let x = 0; x <= w; x += 8) edge.push({ x, y: h * 0.9 - fbm(x * 0.02 + 11, 9.1, 141, 3) * h * 0.06 });
      c.poly([...edge, { x: w, y: h }, { x: 0, y: h }], rgb('#101816'));
      for (let i = 0; i < 12; i++) {
        const x = rnd.range(-20, w + 20);
        const y = h * 0.93;
        c.capsule(x, y, x + rnd.range(-6, 6), y - rnd.range(50, 120), rnd.range(4, 8), 2, rgb('#0C1210'));
      }
      break;
    }
  }
}

export function drawFavicon(c: Canvas, size: number): void {
  c.rect(0, 0, size, size, rgb('#171C1B'));
  const cx = size / 2, cy = size / 2;
  c.poly([{ x: cx - size * 0.32, y: cy + size * 0.08 }, { x: cx, y: cy - size * 0.3 }, { x: cx + size * 0.32, y: cy + size * 0.08 }], rgb('#8A6A4E'));
  c.rect(cx - size * 0.22, cy + size * 0.06, size * 0.44, size * 0.28, rgb('#B7A986'));
  c.rect(cx - size * 0.08, cy + size * 0.16, size * 0.16, size * 0.18, rgb('#F2C87A'));
  c.glow(cx, cy + size * 0.22, size * 0.42, withAlpha(rgb('#F2C87A'), 140), 0.9);
  c.ellipse(cx, cy - size * 0.02, size * 0.2, size * 0.19, withAlpha(BRAND.gold, 0));
}

export const _uiUnused = { INK, MAT };
