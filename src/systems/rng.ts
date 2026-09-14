/**
 * Deterministic, serialisable random number generation.
 *
 * Two independent streams are kept in the save: `world` seeds map layout and
 * encounter placement so a stage looks the same on reload, and `loot` seeds
 * drop rolls. Saving the stream state means a reload can never be used to
 * re-roll a reward.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  get state(): number { return this.s; }
  set state(v: number) { this.s = (v >>> 0) || 0x9e3779b9; }

  /** xorshift32 - fast, deterministic across engines, good enough for loot. */
  next(): number {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 0x100000000;
  }

  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]!; }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  /** Stable sub-stream for a named purpose, so adding a system cannot shift others. */
  fork(tag: string): Rng {
    let h = this.s;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
    return new Rng(h ^ 0x5bf03635);
  }
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}
