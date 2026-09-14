/** Combat and ability effects, telegraphs, and the small HUD furniture. */
import { Canvas, Rand, mix, shade, withAlpha, rgb, type RGBA, type Vec } from './raster.ts';
import { MAT, INK, BRAND } from './palette.ts';

export interface VfxDef {
  w: number;
  h: number;
  frames: number;
  fps: number;
  bundle: string;
  anchorX?: number;
  anchorY?: number;
  draw: (c: Canvas, t: number, rnd: Rand) => void;
}

const ease = (t: number) => t * t * (3 - 2 * t);

function arc(c: Canvas, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, col: RGBA, thick: number): void {
  const pts: Vec[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const r = r0 + (r1 - r0) * (i / steps);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.58 });
  }
  c.polyline(pts, col, thick);
}

export const VFX: Record<string, VfxDef> = {
  slash_light: {
    w: 96, h: 64, frames: 5, fps: 26, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 30, cy = 32;
      const spread = 1.5;
      const a0 = -spread / 2 - 0.5 + k * 0.4;
      const a1 = a0 + spread * (0.5 + k * 0.7);
      const alpha = 255 * (1 - Math.pow(k, 1.7));
      arc(c, cx, cy, 30 + k * 16, 34 + k * 20, a0, a1, withAlpha(BRAND.parchment, alpha), 5 - k * 3.4);
      arc(c, cx, cy, 24 + k * 14, 28 + k * 18, a0 + 0.12, a1 - 0.1, withAlpha(rgb('#FFF4DC'), alpha * 0.7), 2.4 - k * 1.6);
    },
  },
  slash_heavy: {
    w: 128, h: 84, frames: 6, fps: 24, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 34, cy = 42;
      const a0 = -1.5 + k * 0.35, a1 = a0 + 2.2 * (0.4 + k * 0.8);
      const alpha = 255 * (1 - Math.pow(k, 1.6));
      arc(c, cx, cy, 40 + k * 26, 46 + k * 30, a0, a1, withAlpha(rgb('#F4E3C0'), alpha), 9 - k * 6);
      arc(c, cx, cy, 30 + k * 22, 36 + k * 26, a0 + 0.1, a1 - 0.08, withAlpha(rgb('#FFFBEE'), alpha * 0.8), 4 - k * 2.6);
    },
  },
  impact: {
    w: 72, h: 64, frames: 5, fps: 28, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 36, cy = 34;
      const alpha = 255 * (1 - k);
      c.disc(cx, cy, 6 + k * 16, withAlpha(rgb('#FFE9BC'), alpha * 0.35));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd.range(-0.2, 0.2);
        const r0 = 5 + k * 12, r1 = 12 + k * 22;
        c.capsule(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6, 2.6 - k * 2, 0.6, withAlpha(BRAND.parchment, alpha));
      }
    },
  },
  hit_spark: {
    w: 52, h: 48, frames: 4, fps: 30, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 26, cy = 24;
      for (let i = 0; i < 6; i++) {
        const a = rnd.range(0, Math.PI * 2);
        const r = 3 + k * 16;
        c.disc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 2.6 * (1 - k), withAlpha(rgb('#FFD9A0'), 255 * (1 - k)));
      }
      c.disc(cx, cy, 6 * (1 - k) + 2, withAlpha(rgb('#FFF3D8'), 220 * (1 - k)));
    },
  },
  dust_puff: {
    w: 64, h: 40, frames: 5, fps: 18, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      for (let i = 0; i < 5; i++) {
        const a = rnd.range(0, Math.PI * 2);
        const r = k * 20;
        c.ellipse(32 + Math.cos(a) * r, 28 + Math.sin(a) * r * 0.4, 6 + k * 6, 3.4 + k * 3, withAlpha(rgb('#9A9080'), 150 * (1 - k)));
      }
    },
  },
  blood_spray: {
    w: 60, h: 52, frames: 4, fps: 26, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      for (let i = 0; i < 7; i++) {
        const a = rnd.range(-1.2, 1.2) - Math.PI / 2;
        const r = k * 20;
        c.disc(30 + Math.cos(a) * r, 26 + Math.sin(a) * r, 3 * (1 - k * 0.6), withAlpha(MAT.blood, 220 * (1 - k)));
      }
    },
  },
  heal_sparkle: {
    w: 64, h: 80, frames: 6, fps: 16, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      for (let i = 0; i < 9; i++) {
        const x = 32 + rnd.range(-16, 16);
        const y = 72 - k * 56 - rnd.range(0, 14);
        const s = 2.4 * (1 - k * 0.5);
        c.poly([{ x, y: y - s * 2 }, { x: x + s, y }, { x, y: y + s * 2 }, { x: x - s, y }], withAlpha(rgb('#A8E8B0'), 230 * (1 - k)));
      }
      c.glow(32, 60 - k * 40, 26, withAlpha(rgb('#8FE0A3'), 110 * (1 - k)), 0.8);
    },
  },
  ember_arc: {
    w: 148, h: 96, frames: 6, fps: 22, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 20, cy = 48;
      for (let i = 0; i < 16; i++) {
        const a = -0.72 + (i / 15) * 1.44;
        const r = 26 + k * 74 + rnd.range(-6, 6);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.72;
        const s = (5 - k * 3) * rnd.range(0.7, 1.3);
        c.ellipse(px, py, s, s * 0.8, withAlpha(MAT.flame, 235 * (1 - k * 0.8)));
        c.ellipse(px, py, s * 0.5, s * 0.4, withAlpha(MAT.flameCore, 235 * (1 - k * 0.7)));
      }
      c.glow(cx + 40 + k * 30, cy, 54, withAlpha(MAT.emberGlow, 150 * (1 - k)), 0.9);
    },
  },
  burn_tick: {
    w: 44, h: 60, frames: 5, fps: 14, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      for (let i = 0; i < 4; i++) {
        const x = 22 + rnd.range(-8, 8);
        const y = 52 - k * 32 - rnd.range(0, 10);
        c.ellipse(x, y, 3.4 * (1 - k * 0.6), 6 * (1 - k * 0.5), withAlpha(MAT.flame, 220 * (1 - k)));
      }
    },
  },
  stone_barrier: {
    w: 112, h: 112, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const k = ease(Math.min(1, t * 1.6));
      const cx = 56, cy = 60;
      const r = 20 + k * 26;
      c.ellipse(cx, cy, r, r * 0.6, withAlpha(mix(MAT.stonePale, BRAND.winter, 0.3), 60 * k));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.6;
        const hgt = 16 * k;
        c.poly([{ x: px - 6, y: py }, { x: px + 6, y: py }, { x: px + 4, y: py - hgt }, { x: px - 4, y: py - hgt - 3 }],
          withAlpha(MAT.stone, 230), Canvas.lampShader(px - 3, py - hgt, 10, 0.3, 0.4));
      }
      c.polyline(Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6 };
      }), withAlpha(BRAND.winter, 140), 1.8, true);
    },
  },
  barrier_break: {
    w: 120, h: 112, frames: 5, fps: 20, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 60, cy = 60;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 20 + k * 40;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.62;
        const s = 6 * (1 - k * 0.7);
        c.poly([{ x: px - s, y: py }, { x: px, y: py - s * rnd.range(0.8, 1.4) }, { x: px + s, y: py }, { x: px, y: py + s * 0.6 }],
          withAlpha(MAT.stone, 235 * (1 - k)));
      }
    },
  },
  wind_gust: {
    w: 140, h: 76, frames: 5, fps: 24, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      for (let i = 0; i < 5; i++) {
        const y = 20 + i * 8;
        const x0 = 8 + k * 60 + i * 6;
        const len = 40 - i * 4;
        c.capsule(x0, y, x0 + len, y - 3, 3 - i * 0.3, 0.6, withAlpha(rgb('#CFEDE2'), 200 * (1 - k)));
      }
      c.glow(40 + k * 60, 38, 40, withAlpha(rgb('#AFD6C8'), 100 * (1 - k)), 0.7);
    },
  },
  dash_trail: {
    w: 96, h: 72, frames: 4, fps: 26, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      for (let i = 0; i < 4; i++) {
        const x = 16 + i * 18;
        c.ellipse(x, 40, 9 - i * 1.4, 22 - i * 3, withAlpha(rgb('#CFEDE2'), (150 - i * 30) * (1 - k)));
      }
    },
  },
  root_patch: {
    w: 128, h: 96, frames: 6, fps: 12, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(Math.min(1, t * 1.5));
      const cx = 64, cy = 56;
      c.ellipse(cx, cy, 44 * k, 26 * k, withAlpha(rgb('#3A4A2E'), 110));
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rnd.range(-0.2, 0.2);
        const r = 14 + rnd.range(0, 26);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.6;
        c.curve({ x: px, y: py + 4 }, { x: px + rnd.range(-8, 8), y: py - 10 * k }, { x: px + rnd.range(-12, 12), y: py - 20 * k },
          rgb('#4E6238'), 3.4 * k, 1 * k, 8);
      }
      c.glow(cx, cy, 44, withAlpha(MAT.wardGreen, 70 * k), 0.6);
    },
  },
  light_pulse: {
    w: 160, h: 120, frames: 6, fps: 18, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 80, cy = 62;
      const r = 12 + k * 62;
      c.polyline(Array.from({ length: 33 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.58 };
      }), withAlpha(rgb('#FFF3CE'), 230 * (1 - k)), 4 - k * 2.6, true);
      c.ellipse(cx, cy, r * 0.9, r * 0.52, withAlpha(rgb('#F0DCA0'), 80 * (1 - k)));
      c.glow(cx, cy, r, withAlpha(BRAND.gold, 130 * (1 - k)), 0.9);
    },
  },
  venom_bolt: {
    w: 48, h: 40, frames: 4, fps: 20, bundle: 'core',
    draw(c, t, rnd) {
      const cx = 24, cy = 20;
      c.ellipse(cx, cy, 9, 7, MAT.venom, 0, Canvas.lampShader(cx - 3, cy - 3, 10, 0.4, 0.3));
      c.ellipse(cx - 2, cy - 2, 3.4, 2.6, mix(MAT.venom, [255, 255, 255, 255], 0.55));
      for (let i = 0; i < 3; i++) {
        const a = rnd.range(0, Math.PI * 2);
        c.disc(cx - 8 + Math.cos(a) * 4, cy + Math.sin(a) * 4, 2 - t * 1.2, withAlpha(MAT.venom, 180));
      }
      c.glow(cx, cy, 18, withAlpha(MAT.venom, 130), 0.8);
    },
  },
  poison_tick: {
    w: 44, h: 56, frames: 5, fps: 12, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      for (let i = 0; i < 4; i++) {
        const x = 22 + rnd.range(-9, 9), y = 48 - k * 30;
        c.ellipse(x, y, 3 * (1 - k * 0.5), 3.4 * (1 - k * 0.4), withAlpha(MAT.venom, 200 * (1 - k)));
      }
    },
  },
  frost_cone: {
    w: 168, h: 116, frames: 6, fps: 20, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 14, cy = 58;
      for (let i = 0; i < 18; i++) {
        const a = -0.58 + (i / 17) * 1.16;
        const r = 20 + k * 120 + rnd.range(-8, 8);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.75;
        const s = (6 - k * 3) * rnd.range(0.6, 1.2);
        c.poly([{ x: px, y: py - s }, { x: px + s * 0.8, y: py }, { x: px, y: py + s }, { x: px - s * 0.8, y: py }],
          withAlpha(MAT.frost, 230 * (1 - k * 0.7)));
      }
      c.glow(cx + 50 + k * 40, cy, 60, withAlpha(MAT.ice, 110 * (1 - k)), 0.7);
    },
  },
  freeze_shatter: {
    w: 96, h: 88, frames: 5, fps: 22, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const cx = 48, cy = 46;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = 8 + k * 34;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.7;
        const s = 6 * (1 - k * 0.6) * rnd.range(0.7, 1.3);
        c.poly([{ x: px, y: py - s }, { x: px + s * 0.6, y: py }, { x: px, y: py + s * 0.8 }, { x: px - s * 0.6, y: py }],
          withAlpha(MAT.ice, 235 * (1 - k)));
      }
    },
  },
  oath_flash: {
    w: 108, h: 96, frames: 5, fps: 24, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 54, cy = 50;
      c.polyline(Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = 18 + k * 26;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6 };
      }), withAlpha(rgb('#CBD8DE'), 235 * (1 - k)), 5 - k * 3.4, true);
      c.glow(cx, cy, 40, withAlpha(rgb('#98A4AA'), 140 * (1 - k)), 0.8);
    },
  },
  echo_ghost: {
    w: 96, h: 72, frames: 5, fps: 18, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 30, cy = 36;
      for (let i = 0; i < 3; i++) {
        const a0 = -1.2 + i * 0.1, a1 = a0 + 1.6;
        arc(c, cx, cy, 26 + k * 16 + i * 4, 32 + k * 18 + i * 4, a0, a1, withAlpha(rgb('#B9A8CE'), (200 - i * 55) * (1 - k)), 4 - k * 2.4);
      }
    },
  },
  storm_bolt: {
    w: 128, h: 132, frames: 5, fps: 28, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const alpha = 255 * (1 - Math.pow(k, 1.4));
      let x = 64, y = 6;
      const pts: Vec[] = [{ x, y }];
      while (y < 112) {
        y += rnd.range(12, 24);
        x += rnd.range(-16, 16);
        pts.push({ x, y });
      }
      c.polyline(pts, withAlpha(rgb('#EAF2FF'), alpha), 4.4 - k * 2.6);
      c.polyline(pts, withAlpha(MAT.storm, alpha * 0.55), 9 - k * 6);
      c.glow(x, 112, 44, withAlpha(MAT.storm, 150 * (1 - k)), 0.9);
    },
  },
  chain_link: {
    w: 84, h: 56, frames: 4, fps: 26, bundle: 'core',
    draw(c, t, rnd) {
      const k = ease(t);
      const pts: Vec[] = [];
      for (let i = 0; i <= 6; i++) pts.push({ x: 6 + i * 12, y: 28 + rnd.range(-9, 9) });
      c.polyline(pts, withAlpha(rgb('#EAF2FF'), 240 * (1 - k)), 3 - k * 1.8);
      c.polyline(pts, withAlpha(MAT.storm, 140 * (1 - k)), 7 - k * 4);
    },
  },
  dusk_blink: {
    w: 96, h: 96, frames: 5, fps: 22, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const cx = 48, cy = 50;
      c.ellipse(cx, cy, 10 + k * 26, 24 + k * 14, withAlpha(MAT.shadow, 200 * (1 - k)));
      c.polyline(Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = 14 + k * 28;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.62 };
      }), withAlpha(MAT.wardPurple, 200 * (1 - k)), 3 - k * 2, true);
      c.glow(cx, cy, 40, withAlpha(MAT.wardPurple, 120 * (1 - k)), 0.8);
    },
  },
  shadow_double: {
    w: 72, h: 88, frames: 6, fps: 14, bundle: 'core',
    draw(c, t) {
      const a = 200 * (1 - ease(t) * 0.7);
      c.ellipse(36, 50, 14, 30, withAlpha(MAT.shadow, a));
      c.ellipse(36, 22, 10, 11, withAlpha(MAT.shadow, a));
      c.glow(36, 40, 30, withAlpha(MAT.wardPurple, a * 0.4), 0.6);
    },
  },
  hearth_circle: {
    w: 176, h: 132, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const k = ease(Math.min(1, t * 1.4));
      const cx = 88, cy = 68;
      const r = 24 + k * 50;
      c.ellipse(cx, cy, r, r * 0.58, withAlpha(BRAND.gold, 40));
      c.polyline(Array.from({ length: 41 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.58 };
      }), withAlpha(rgb('#F2C87A'), 220), 3.4, true);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 1.2;
        c.disc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.58, 3.4, withAlpha(rgb('#FFE9BC'), 230));
      }
      c.glow(cx, cy, r, withAlpha(BRAND.gold, 90), 0.7);
    },
  },
  // ----------------------------------------------------------- telegraphs
  tele_circle: {
    w: 160, h: 112, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const cx = 80, cy = 56, R = 70;
      const k = ease(t);
      c.ellipse(cx, cy, R, R * 0.58, withAlpha(rgb('#C25A4A'), 46));
      c.ellipse(cx, cy, R * k, R * k * 0.58, withAlpha(rgb('#E8875E'), 92));
      c.polyline(Array.from({ length: 41 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.58 };
      }), withAlpha(rgb('#F0A882'), 220), 2.6, true);
    },
  },
  tele_cone: {
    w: 176, h: 128, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const cx = 12, cy = 64, R = 158, half = 0.5;
      const k = ease(t);
      const shape = (rr: number) => {
        const pts: Vec[] = [{ x: cx, y: cy }];
        for (let i = 0; i <= 16; i++) {
          const a = -half + (i / 16) * half * 2;
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.62 });
        }
        return pts;
      };
      c.poly(shape(R), withAlpha(rgb('#C25A4A'), 46));
      c.poly(shape(R * k), withAlpha(rgb('#E8875E'), 92));
      c.strokePoly(shape(R), withAlpha(rgb('#F0A882'), 210), 2.4);
    },
  },
  tele_line: {
    w: 200, h: 72, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      const y = 36, h = 15;
      c.poly([{ x: 6, y: y - h }, { x: 194, y: y - h }, { x: 194, y: y + h }, { x: 6, y: y + h }], withAlpha(rgb('#C25A4A'), 46));
      c.poly([{ x: 6, y: y - h }, { x: 6 + 188 * k, y: y - h }, { x: 6 + 188 * k, y: y + h }, { x: 6, y: y + h }], withAlpha(rgb('#E8875E'), 92));
      c.strokePoly([{ x: 6, y: y - h }, { x: 194, y: y - h }, { x: 194, y: y + h }, { x: 6, y: y + h }], withAlpha(rgb('#F0A882'), 210), 2.4);
    },
  },
  tele_ring: {
    w: 192, h: 132, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const cx = 96, cy = 66;
      const k = ease(t);
      const R = 18 + k * 68;
      c.polyline(Array.from({ length: 41 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.58 };
      }), withAlpha(rgb('#F0A882'), 230 * (1 - k * 0.4)), 5 - k * 2, true);
    },
  },
  // -------------------------------------------------------------- pickups
  coin_pickup: {
    w: 28, h: 28, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const w = Math.abs(Math.cos(t * Math.PI)) * 9 + 1.5;
      c.ellipse(14, 14, w, 9, BRAND.gold, 0, Canvas.lampShader(11, 10, 10, 0.5, 0.3));
      c.ellipse(14, 14, w * 0.55, 5, shade(BRAND.gold, -0.22));
    },
  },
  shard_pickup: {
    w: 28, h: 30, frames: 6, fps: 10, bundle: 'core',
    draw(c, t) {
      const lift = Math.sin(t * Math.PI * 2) * 2;
      c.poly([{ x: 14, y: 5 + lift }, { x: 21, y: 15 + lift }, { x: 14, y: 25 + lift }, { x: 7, y: 15 + lift }],
        rgb('#8FD0E0'), Canvas.lampShader(11, 11 + lift, 10, 0.55, 0.3));
      c.glow(14, 15 + lift, 12, withAlpha(rgb('#8FD0E0'), 120), 0.7);
    },
  },
  mat_pickup: {
    w: 28, h: 28, frames: 4, fps: 8, bundle: 'core',
    draw(c, t) {
      const lift = Math.sin(t * Math.PI * 2) * 1.6;
      c.poly([{ x: 6, y: 20 + lift }, { x: 14, y: 8 + lift }, { x: 22, y: 20 + lift }], MAT.stone, Canvas.lampShader(11, 13, 10, 0.4, 0.34));
      c.capsule(8, 22 + lift, 20, 22 + lift, 2.6, 2.6, MAT.wood);
    },
  },
  ring_pickup: {
    w: 40, h: 44, frames: 8, fps: 10, bundle: 'core',
    draw(c, t) {
      const lift = Math.sin(t * Math.PI * 2) * 3;
      const w = Math.abs(Math.cos(t * Math.PI)) * 11 + 2;
      c.glow(20, 22 + lift, 22, withAlpha(BRAND.gold, 150), 0.9);
      c.ellipse(20, 22 + lift, w, 11, BRAND.gold, 0, Canvas.lampShader(16, 17 + lift, 12, 0.55, 0.32));
      c.ellipse(20, 22 + lift, w * 0.58, 6.6, [0, 0, 0, 0]);
      c.disc(20, 12 + lift, 3.4, rgb('#E08348'));
    },
  },
  // ---------------------------------------------------------- environment
  rain_sheet: {
    w: 128, h: 128, frames: 4, fps: 18, bundle: 'core',
    draw(c, t, rnd) {
      for (let i = 0; i < 70; i++) {
        const x = rnd.range(0, 128), y = (rnd.range(0, 128) + t * 128) % 128;
        c.capsule(x, y, x - 3, y + 11, 0.7, 0.3, withAlpha(rgb('#AFC8D8'), 130));
      }
    },
  },
  snow_sheet: {
    w: 128, h: 128, frames: 6, fps: 10, bundle: 'core',
    draw(c, t, rnd) {
      for (let i = 0; i < 52; i++) {
        const bx = rnd.range(0, 128);
        const x = bx + Math.sin((t + i) * 2.2) * 5;
        const y = (rnd.range(0, 128) + t * 128) % 128;
        c.disc(x, y, rnd.range(0.9, 2.1), withAlpha(MAT.snow, 190));
      }
    },
  },
  leaf_sheet: {
    w: 128, h: 128, frames: 6, fps: 9, bundle: 'core',
    draw(c, t, rnd) {
      for (let i = 0; i < 26; i++) {
        const bx = rnd.range(0, 128);
        const x = bx + Math.sin((t + i) * 2.6) * 11;
        const y = (rnd.range(0, 128) + t * 128) % 128;
        const col = [rgb('#C98A45'), rgb('#B06A3A'), rgb('#D8A860')][i % 3]!;
        c.ellipse(x, y, 3.2, 1.8, withAlpha(col, 200), (t + i) * 2);
      }
    },
  },
  petal_sheet: {
    w: 128, h: 128, frames: 6, fps: 9, bundle: 'core',
    draw(c, t, rnd) {
      for (let i = 0; i < 22; i++) {
        const bx = rnd.range(0, 128);
        const x = bx + Math.sin((t + i) * 2.4) * 9;
        const y = (rnd.range(0, 128) + t * 128) % 128;
        c.ellipse(x, y, 2.6, 1.6, withAlpha(rgb('#E8C0D0'), 200), (t + i) * 1.6);
      }
    },
  },
  shadow_blob: {
    w: 64, h: 32, frames: 1, fps: 1, bundle: 'core',
    draw(c) {
      for (let i = 6; i >= 1; i--) {
        c.ellipse(32, 16, 4 * i, 2 * i, withAlpha(INK, 16));
      }
      c.ellipse(32, 16, 22, 11, withAlpha(INK, 60));
    },
  },
  interact_ping: {
    w: 56, h: 56, frames: 6, fps: 12, bundle: 'core',
    draw(c, t) {
      const k = ease(t);
      c.polyline(Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r = 10 + k * 14;
        return { x: 28 + Math.cos(a) * r, y: 28 + Math.sin(a) * r * 0.6 };
      }), withAlpha(BRAND.gold, 220 * (1 - k)), 2.4, true);
      c.disc(28, 28, 4, withAlpha(BRAND.gold, 230));
    },
  },
  ringsight_glint: {
    w: 72, h: 72, frames: 6, fps: 10, bundle: 'core',
    draw(c, t) {
      const k = Math.sin(t * Math.PI);
      c.glow(36, 36, 30, withAlpha(BRAND.gold, 130 * k), 0.8);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t * 0.8;
        c.capsule(36 + Math.cos(a) * 8, 36 + Math.sin(a) * 8, 36 + Math.cos(a) * 24, 36 + Math.sin(a) * 24, 2.2 * k, 0.4, withAlpha(rgb('#FFF3CE'), 200 * k));
      }
    },
  },
};

export const VFX_KEYS = Object.keys(VFX);
