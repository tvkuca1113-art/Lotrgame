import { describe, it, expect } from 'vitest';
import { newGameState } from '@/systems/state';
import {
  advanceDay, calendarView, nextSeason, snapshotSeason, DAYS_PER_SEASON,
  seasonProfile, seasonDamageModifier, seasonRouteOpen,
} from '@/systems/seasons';
import { SEASONS } from '@/types';
import { STAGES } from '@/content/stages';
import { generateStage, validateReachability } from '@/world/stagegen';

describe('calendar', () => {
  it('runs four days per season and then turns', () => {
    const s = newGameState();
    expect(s.calendar.season).toBe('spring');
    for (let i = 0; i < DAYS_PER_SEASON - 1; i++) {
      const r = advanceDay(s);
      expect(r.seasonChanged).toBe(false);
    }
    const turn = advanceDay(s);
    expect(turn.seasonChanged).toBe(true);
    expect(s.calendar.season).toBe('summer');
    expect(s.calendar.day).toBe(0);
  });

  it('cycles through all four seasons and back', () => {
    const s = newGameState();
    for (let i = 0; i < DAYS_PER_SEASON * 4; i++) advanceDay(s);
    expect(s.calendar.season).toBe('spring');
    expect(s.calendar.totalDays).toBe(16);
  });

  it('previews the coming season', () => {
    const s = newGameState();
    expect(calendarView(s).next).toBe('summer');
    expect(nextSeason('winter')).toBe('spring');
  });

  it('is not tied to real dates: only explicit advances move it', () => {
    const s = newGameState();
    const before = { ...s.calendar };
    // No time passes on its own.
    expect(s.calendar).toEqual(before);
    advanceDay(s);
    expect(s.calendar.totalDays).toBe(before.totalDays + 1);
  });

  it('a mission snapshot is taken at departure and does not follow later changes', () => {
    const s = newGameState();
    const snap = snapshotSeason(s);
    for (let i = 0; i < 6; i++) advanceDay(s);
    expect(snap.season).toBe('spring');
    expect(s.calendar.season).not.toBe('spring');
  });
});

describe('seasonal effects', () => {
  it('keeps damage modifiers inside the +/-15% budget', () => {
    for (const season of SEASONS) {
      for (const tags of [['fire'], ['frost'], ['lightning'], ['fire', 'frost', 'lightning'], []]) {
        const m = seasonDamageModifier(season, tags);
        expect(m).toBeGreaterThanOrEqual(-0.15);
        expect(m).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('gives each season a distinct interaction, not just a recolour', () => {
    expect(seasonProfile('winter').frozenWater).toBe(true);
    expect(seasonProfile('summer').lowWater).toBe(true);
    expect(seasonProfile('summer').dryGrowth).toBe(true);
    expect(seasonProfile('spring').wetGround).toBe(true);
    expect(seasonProfile('autumn').dryGrowth).toBe(true);
    // Only winter freezes water; only summer drops it.
    expect(SEASONS.filter((s) => seasonProfile(s).frozenWater)).toEqual(['winter']);
    expect(SEASONS.filter((s) => seasonProfile(s).lowWater)).toEqual(['summer']);
  });

  it('every season has its own weather layer', () => {
    const layers = SEASONS.map((s) => seasonProfile(s).weather);
    expect(new Set(layers).size).toBe(4);
  });
});

describe('seasonal routes', () => {
  it('every region has at least one stage whose optional route is seasonal', () => {
    const byRegion = new Map<string, number>();
    for (const def of STAGES) {
      byRegion.set(def.region, (byRegion.get(def.region) ?? 0) + 1);
    }
    expect(byRegion.size).toBe(6);
    for (const region of byRegion.keys()) {
      const stages = STAGES.filter((s) => s.region === region);
      expect(stages.some((s) => !!s.seasonRoute)).toBe(true);
    }
  });

  it('a route opens only in its own season', () => {
    for (const def of STAGES) {
      for (const season of SEASONS) {
        expect(seasonRouteOpen(def.seasonRoute.season, season)).toBe(def.seasonRoute.season === season);
      }
    }
  });

  it('mandatory objectives stay reachable in every season on every stage', () => {
    const failures: string[] = [];
    for (const def of STAGES) {
      for (const season of SEASONS) {
        const map = generateStage(def, season);
        const check = validateReachability(map);
        if (!check.ok) failures.push(`${def.id}/${season}: ${check.unreachable.join(',')}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('critical doors and the boss trigger are reachable in every season', () => {
    for (const def of STAGES) {
      for (const season of SEASONS) {
        const map = generateStage(def, season);
        const door = map.nodes.find((n) => n.kind === 'bossdoor');
        const checkpoint = map.nodes.find((n) => n.kind === 'checkpoint');
        expect(door).toBeDefined();
        expect(checkpoint).toBeDefined();
        const check = validateReachability(map);
        expect(check.unreachable).not.toContain(door!.id);
        expect(check.unreachable).not.toContain(checkpoint!.id);
        expect(check.unreachable).not.toContain('bossArena');
      }
    }
  });
});
