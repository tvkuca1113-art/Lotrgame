import { describe, it, expect } from 'vitest';
import { STAGES } from '@/content';
import { SEASONS } from '@/types';
import { generateStage, validateReachability } from '@/world/stagegen';

describe('stage generation', () => {
  it('produces a reachable objective route for every stage in every season', () => {
    const failures: string[] = [];
    for (const def of STAGES) {
      for (const season of SEASONS) {
        const map = generateStage(def, season);
        const check = validateReachability(map);
        if (!check.ok) failures.push(`stage ${def.id} / ${season}: ${check.unreachable.join(', ')}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('places a checkpoint and a boss door on every stage', () => {
    for (const def of STAGES) {
      const map = generateStage(def, 'spring');
      expect(map.nodes.some((n) => n.kind === 'checkpoint')).toBe(true);
      expect(map.nodes.some((n) => n.kind === 'bossdoor')).toBe(true);
      expect(map.nodes.some((n) => n.kind === 'exit')).toBe(true);
    }
  });

  it('spawns the authored objective count and at least one encounter group', () => {
    for (const def of STAGES) {
      const map = generateStage(def, 'summer');
      const objectives = map.nodes.filter((n) => n.kind === 'objective' || n.kind === 'escortStop');
      expect(objectives).toHaveLength(def.objective.count);
      expect(map.enemies.length).toBeGreaterThan(0);
      expect(map.nodes.filter((n) => n.kind === 'cache')).toHaveLength(def.caches);
    }
  });

  it('is deterministic: the same stage and season generates the same map', () => {
    const a = generateStage(STAGES[12]!, 'autumn');
    const b = generateStage(STAGES[12]!, 'autumn');
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.enemies).toEqual(b.enemies);
    expect(a.nodes).toEqual(b.nodes);
  });

  it('opens the seasonal route only in its own season', () => {
    for (const def of STAGES.slice(0, 8)) {
      for (const season of SEASONS) {
        const map = generateStage(def, season);
        const node = map.nodes.find((n) => n.kind === 'seasonal');
        expect(node?.data).toBe(def.seasonRoute.season === season ? 'open' : 'closed');
      }
    }
  });
});
