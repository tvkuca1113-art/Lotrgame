/**
 * Sprite-sheet assembly: renders every animation x facing x frame of a figure
 * into a single packed texture plus a Phaser-compatible atlas description.
 */
import { Canvas, quantize, type RGBA } from './raster.ts';
import { INK } from './palette.ts';
import { drawFigure, type FigureSpec } from './figure.ts';
import { ANIM_SETS, sampleAnim, type AnimName } from './animation.ts';

/** Five rendered facings; the game mirrors them to cover all eight. */
export const FACINGS = ['s', 'se', 'e', 'ne', 'n'] as const;
export type Facing = (typeof FACINGS)[number];
export const FACING_YAW: Record<Facing, number> = {
  s: 0,
  se: Math.PI * 0.25,
  e: Math.PI * 0.5,
  ne: Math.PI * 0.75,
  n: Math.PI,
};

export interface AtlasFrame { x: number; y: number; w: number; h: number }

export interface SheetResult {
  key: string;
  width: number;
  height: number;
  rgba: Uint8Array;
  frames: Record<string, AtlasFrame>;
  anims: Record<string, { frames: string[]; frameRate: number; repeat: number }>;
  anchorX: number;
  anchorY: number;
  frameW: number;
  frameH: number;
}

export interface SheetOptions {
  key: string;
  spec: FigureSpec;
  frameW: number;
  frameH: number;
  /** Pixels per rig unit before the figure's own height multiplier. */
  scale: number;
  /** Fraction of frame height where the feet sit. */
  footRatio?: number;
  anims: AnimName[];
  outlineColor?: RGBA;
  outlineWidth?: number;
  columns?: number;
  /** Supersample factor; large boss frames render at 2 to keep the build affordable. */
  ss?: number;
  /** Extra decoration drawn under/over the figure per frame. */
  decorate?: (c: Canvas, ctx: { anim: AnimName; frame: number; t: number; facing: Facing; cx: number; cy: number; scale: number }) => void;
  overlay?: (c: Canvas, ctx: { anim: AnimName; frame: number; t: number; facing: Facing; cx: number; cy: number; scale: number }) => void;
}

export function buildFigureSheet(opts: SheetOptions): SheetResult {
  const anims = ANIM_SETS[opts.spec.rig];
  const footRatio = opts.footRatio ?? 0.9;
  const cells: { name: string; canvas: Canvas }[] = [];
  const animMap: SheetResult['anims'] = {};

  for (const animName of opts.anims) {
    const def = anims[animName];
    if (!def) continue;
    for (const facing of FACINGS) {
      const names: string[] = [];
      for (let f = 0; f < def.frames; f++) {
        const { pose, lift } = sampleAnim(def, f);
        const c = new Canvas(opts.frameW, opts.frameH, opts.ss ?? (opts.frameW * opts.frameH > 7200 ? 2 : 3));
        const cx = opts.frameW / 2;
        const cy = opts.frameH * footRatio;
        const t = def.loop ? f / def.frames : def.frames === 1 ? 0 : f / (def.frames - 1);
        opts.decorate?.(c, { anim: animName, frame: f, t, facing, cx, cy, scale: opts.scale });
        drawFigure(c, opts.spec, pose, {
          scale: opts.scale,
          originX: cx,
          originY: cy,
          yaw: FACING_YAW[facing],
          lift,
        });
        c.outline(opts.outlineColor ?? INK, opts.outlineWidth ?? 0.62);
        opts.overlay?.(c, { anim: animName, frame: f, t, facing, cx, cy, scale: opts.scale });
        const name = `${animName}_${facing}_${f}`;
        names.push(name);
        cells.push({ name, canvas: c });
      }
      animMap[`${animName}_${facing}`] = {
        frames: names,
        frameRate: Math.max(1, Math.round(def.frames / def.duration)),
        repeat: def.loop ? -1 : 0,
      };
    }
  }

  return packCells(opts.key, cells, opts.frameW, opts.frameH, animMap, 0.5, footRatio, opts.columns);
}

export function packCells(
  key: string,
  cells: { name: string; canvas: Canvas }[],
  frameW: number,
  frameH: number,
  animMap: SheetResult['anims'],
  anchorX: number,
  anchorY: number,
  columns?: number,
): SheetResult {
  const cols = columns ?? Math.max(1, Math.ceil(Math.sqrt(cells.length * (frameH / frameW))));
  const rows = Math.ceil(cells.length / cols);
  const width = cols * frameW;
  const height = rows * frameH;
  const rgba = new Uint8Array(width * height * 4);
  const frames: Record<string, AtlasFrame> = {};

  cells.forEach((cell, i) => {
    const cx = (i % cols) * frameW;
    const cy = Math.floor(i / cols) * frameH;
    const px = cell.canvas.resolve();
    for (let y = 0; y < frameH; y++) {
      const src = y * frameW * 4;
      const dst = ((cy + y) * width + cx) * 4;
      rgba.set(px.subarray(src, src + frameW * 4), dst);
    }
    frames[cell.name] = { x: cx, y: cy, w: frameW, h: frameH };
  });

  return {
    key, width, height,
    rgba: quantize(rgba, 256),
    frames, anims: animMap,
    anchorX, anchorY, frameW, frameH,
  };
}

/** TexturePacker "JSON Hash" description, which Phaser loads natively. */
export function toAtlasJson(sheet: SheetResult, imageFile: string): unknown {
  const frames: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(sheet.frames)) {
    frames[name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return {
    frames,
    meta: {
      app: 'the-last-hearth asset pipeline',
      version: '1.0',
      image: imageFile,
      format: 'RGBA8888',
      size: { w: sheet.width, h: sheet.height },
      scale: '1',
    },
  };
}
