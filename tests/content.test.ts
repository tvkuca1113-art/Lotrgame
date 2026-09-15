import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent, STAGES, RINGS, BOSSES, SYNERGIES, TALENTS } from '@/content';
import { t, hasKey } from '@/content/locale';

describe('content layer', () => {
  it('passes structural validation', () => {
    const issues = validateContent();
    if (issues.length) {
      console.error(issues.map((i) => `${i.where}: ${i.message}`).join('\n'));
    }
    expect(issues).toEqual([]);
  });

  it('ships exactly the specified counts', () => {
    expect(STAGES).toHaveLength(30);
    expect(RINGS).toHaveLength(12);
    expect(BOSSES).toHaveLength(30);
    expect(SYNERGIES).toHaveLength(6);
    expect(TALENTS).toHaveLength(30);
  });

  it('has a mandatory boss at the end of every stage', () => {
    for (const s of STAGES) {
      expect(BOSSES.some((b) => b.stage === s.id && b.id === s.bossKey)).toBe(true);
    }
  });

  it('marks exactly six chapter bosses', () => {
    expect(STAGES.filter((s) => s.chapterBoss).map((s) => s.id)).toEqual([5, 10, 15, 20, 25, 30]);
  });
});

describe('the localisation dictionary', () => {
  it('defines every key the code asks for by name', () => {
    const root = fileURLToPath(new URL('../src', import.meta.url));
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(root);
    const used = new Set<string>();
    for (const f of files) {
      if (f.includes(`${sep}locale${sep}`)) continue;
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([^']+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(150);
    const missing = [...used].filter((k) => !hasKey(k)).sort();
    expect(missing).toEqual([]);
  });

  it('never renders a key as its own text', () => {
    // t() falls back to the key when a string is absent; that is the bug this
    // catches, so a round-trip has to differ from the key itself.
    for (const k of ['replay.title', 'escort.cart', 'settings.aim_assist', 'hud.guarded']) {
      expect(t(k)).not.toBe(k);
    }
  });
});
