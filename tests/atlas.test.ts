import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A texture key and frame name that do not exist produce no build error and no
 * obvious runtime one either - Phaser substitutes a missing frame and the first
 * thing that reads its size throws somewhere unrelated. Checking the literals
 * in the source against the generated atlases catches it at test time instead.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ATLASES: Record<string, string> = {
  frames: 'public/assets/ui/frames.json',
  glyphs: 'public/assets/ui/glyphs.json',
  rings: 'public/assets/ui/rings.json',
  vfx: 'public/assets/vfx/vfx.json',
};

function framesOf(file: string): Set<string> {
  const data = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as
    | { frames: Record<string, unknown> }
    | { frames: { filename: string }[] };
  const f = data.frames;
  return new Set(Array.isArray(f) ? f.map((x) => x.filename) : Object.keys(f));
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

describe('atlas frame references', () => {
  const available = Object.entries(ATLASES)
    .filter(([, file]) => existsSync(join(ROOT, file)))
    .map(([key, file]) => [key, framesOf(file)] as const);

  it('has the generated atlases to check against', () => {
    // If the assets have not been built there is nothing to verify, and a
    // silent pass would be worse than a clear failure.
    expect(available.map(([k]) => k).sort()).toEqual(Object.keys(ATLASES).sort());
  });

  for (const [key, frames] of available) {
    it(`only names frames that exist in the ${key} atlas`, () => {
      // Anchored to the calls that actually take a texture key, so a plain
      // string list that happens to contain the same word is not a match.
      const call = '(?:add\\.(?:image|sprite|nineslice|tileSprite)|setTexture|make\\.(?:image|sprite))';
      const pattern = new RegExp(`${call}\\s*\\([^;()]{0,120}?['"]${key}['"]\\s*,\\s*['"]([A-Za-z0-9_\\-]+)['"]`, 'g');
      const bad: string[] = [];
      for (const file of sourceFiles()) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(pattern)) {
          const name = m[1]!;
          if (!frames.has(name)) bad.push(`${file.split(`src${sep}`)[1]}: ${key}/${name}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
