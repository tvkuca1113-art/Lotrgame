import { describe, it, expect } from 'vitest';
import { validateContent, STAGES, RINGS, BOSSES, SYNERGIES, TALENTS } from '@/content';

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
