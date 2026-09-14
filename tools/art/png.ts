/**
 * Minimal, dependency-free PNG encoder.
 * Supports truecolour+alpha (type 6) and indexed colour (type 3 + tRNS).
 * Written for the asset pipeline of THE LAST HEARTH.
 */
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcBuf = out.subarray(4, 8 + data.length);
  dv.setUint32(8 + data.length, crc32(crcBuf));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Adaptive per-scanline filtering (PNG filter types 0-4) chosen by minimum sum of absolute differences. */
function filterScanlines(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array((stride + 1) * height);
  const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
  let prev: Uint8Array = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const line = raw.subarray(y * stride, y * stride + stride);
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f]!;
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? line[x - bpp]! : 0;
        const b = prev[x]!;
        const cc = x >= bpp ? prev[x - bpp]! : 0;
        let v: number;
        switch (f) {
          case 0: v = line[x]!; break;
          case 1: v = line[x]! - a; break;
          case 2: v = line[x]! - b; break;
          case 3: v = line[x]! - ((a + b) >> 1); break;
          default: {
            const p = a + b - cc;
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc);
            const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc;
            v = line[x]! - pr;
          }
        }
        const bv = v & 0xff;
        c[x] = bv;
        score += bv < 128 ? bv : 256 - bv;
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    out[y * (stride + 1)] = best;
    out.set(cand[best]!, y * (stride + 1) + 1);
    prev = line as Uint8Array;
  }
  return out;
}

export interface PngMeta {
  /** Free-form provenance text written into a tEXt chunk. */
  text?: Record<string, string>;
}

function textChunks(text: Record<string, string> | undefined): Uint8Array[] {
  if (!text) return [];
  const out: Uint8Array[] = [];
  for (const [k, v] of Object.entries(text)) {
    const key = k.slice(0, 79);
    const bytes = new Uint8Array(key.length + 1 + v.length);
    for (let i = 0; i < key.length; i++) bytes[i] = key.charCodeAt(i) & 0xff;
    bytes[key.length] = 0;
    for (let i = 0; i < v.length; i++) bytes[key.length + 1 + i] = v.charCodeAt(i) & 0xff;
    out.push(chunk('tEXt', bytes));
  }
  return out;
}

/** Encode RGBA8 pixel data as a truecolour-with-alpha PNG. */
export function encodeRGBA(width: number, height: number, rgba: Uint8Array, meta?: PngMeta): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const filtered = filterScanlines(rgba, width, height, 4);
  const idat = deflateSync(filtered, { level: 9, memLevel: 9 });
  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    ...textChunks(meta?.text),
    chunk('IDAT', new Uint8Array(idat.buffer, idat.byteOffset, idat.byteLength)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Encode RGBA8 data as an indexed PNG when it uses <= 256 distinct colours,
 * otherwise fall back to truecolour. Indexed output is typically 2-4x smaller,
 * which matters for a browser game shipping ~200 sprite sheets.
 */
export function encodeAuto(width: number, height: number, rgba: Uint8Array, meta?: PngMeta): Uint8Array {
  const map = new Map<number, number>();
  const palette: number[] = [];
  const n = width * height;
  const idx = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]!, g = rgba[i * 4 + 1]!, b = rgba[i * 4 + 2]!, a = rgba[i * 4 + 3]!;
    const key = a === 0 ? 0 : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    let v = map.get(key);
    if (v === undefined) {
      if (palette.length >= 256) return encodeRGBA(width, height, rgba, meta);
      v = palette.length;
      palette.push(key);
      map.set(key, v);
    }
    idx[i] = v;
  }
  // Sort so fully transparent entries come first (lets tRNS stay short).
  const order = palette.map((c, i) => ({ c, i })).sort((a, b) => (a.c & 0xff) - (b.c & 0xff));
  const remap = new Uint8Array(palette.length);
  order.forEach((e, newIndex) => { remap[e.i] = newIndex; });
  for (let i = 0; i < n; i++) idx[i] = remap[idx[i]!]!;
  const sorted = order.map((e) => e.c);

  const plte = new Uint8Array(sorted.length * 3);
  const trnsFull = new Uint8Array(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    plte[i * 3] = (c >>> 24) & 0xff;
    plte[i * 3 + 1] = (c >>> 16) & 0xff;
    plte[i * 3 + 2] = (c >>> 8) & 0xff;
    trnsFull[i] = c & 0xff;
  }
  let trnsLen = trnsFull.length;
  while (trnsLen > 0 && trnsFull[trnsLen - 1] === 255) trnsLen--;

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const filtered = filterScanlines(idx, width, height, 1);
  const idat = deflateSync(filtered, { level: 9, memLevel: 9 });
  const parts: Uint8Array[] = [
    SIGNATURE,
    chunk('IHDR', ihdr),
    ...textChunks(meta?.text),
    chunk('PLTE', plte),
  ];
  if (trnsLen > 0) parts.push(chunk('tRNS', trnsFull.subarray(0, trnsLen)));
  parts.push(chunk('IDAT', new Uint8Array(idat.buffer, idat.byteOffset, idat.byteLength)));
  parts.push(chunk('IEND', new Uint8Array(0)));
  const indexed = concat(parts);
  const truecolour = encodeRGBA(width, height, rgba, meta);
  return indexed.length <= truecolour.length ? indexed : truecolour;
}
