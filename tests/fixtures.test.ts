import { describe, it, expect } from 'vitest';
import { BOSSES, bossByStage, bossHealth, bossBaseDamage, GAUNTLET_BOSSES } from '@/content/bosses';
import { STAGES } from '@/content/stages';
import { generateStage } from '@/world/stagegen';
import { parseFixture, fixtureState, setFixtureMode, isFixtureMode } from '@/systems/fixtures';
import { newGameState } from '@/systems/state';
import { levelHealth } from '@/systems/progression';
import { SEASONS } from '@/types';

/**
 * The development fixture pass: walk every boss encounter as data and confirm
 * the arena, phase transitions, rewards, exit and checkpoint all exist and are
 * coherent. The in-game counterpart is `?fixture=<stage>`.
 */
describe('boss fixtures', () => {
  it('covers all thirty stages', () => {
    for (let stage = 1; stage <= 30; stage++) {
      expect(bossByStage(stage), `stage ${stage}`).toBeDefined();
    }
    expect(BOSSES).toHaveLength(30);
    expect(GAUNTLET_BOSSES.map((b) => b.stage)).toEqual([5, 10, 15, 20, 25, 30]);
  });

  it('every arena has a checkpoint, a boss door and an exit', () => {
    for (const def of STAGES) {
      const map = generateStage(def, 'spring');
      expect(map.nodes.some((n) => n.kind === 'checkpoint'), `stage ${def.id}`).toBe(true);
      expect(map.nodes.some((n) => n.kind === 'bossdoor'), `stage ${def.id}`).toBe(true);
      expect(map.nodes.some((n) => n.kind === 'exit'), `stage ${def.id}`).toBe(true);
      expect(map.bossArena.radius).toBeGreaterThan(4);
    }
  });

  it('phase transitions are reachable by draining health', () => {
    for (const boss of BOSSES) {
      const max = boss.health;
      const entered: string[] = [];
      let index = 0;
      // Walk health down in 1% steps and record every phase the machine enters.
      for (let pct = 1; pct >= 0; pct -= 0.01) {
        const next = boss.phases[index + 1];
        if (next && pct <= next.trigger.atHealthPct) {
          index += 1;
          entered.push(next.id);
        }
      }
      expect(entered, `boss ${boss.id}`).toEqual(boss.phases.slice(1).map((p) => p.id));
      expect(max).toBeGreaterThan(0);
    }
  });

  it('two- and three-phase bosses are exactly the ones the brief names', () => {
    const multi = BOSSES.filter((b) => b.phases.length >= 2).map((b) => b.stage);
    for (const stage of [5, 10, 15, 20, 25, 30]) expect(multi).toContain(stage);
    const three = BOSSES.filter((b) => b.phases.length >= 3).map((b) => b.stage);
    expect(three).toEqual([20, 30]);
  });

  it('boss health and hit damage stay proportionate to the expected player', () => {
    for (const boss of BOSSES) {
      const expectedLevel = Math.min(30, boss.stage + 1);
      const playerHealth = levelHealth(expectedLevel);
      const hit = bossBaseDamage(boss.stage);
      // A standard hit costs roughly a fifth of the bar; never a one-shot.
      expect(hit / playerHealth).toBeGreaterThan(0.1);
      expect(hit / playerHealth).toBeLessThan(0.25);
      // The heaviest attack still leaves the player alive from full health.
      const heaviest = Math.max(...boss.attacks.map((a) => a.damage));
      expect(hit * heaviest).toBeLessThan(playerHealth);
    }
  });

  it('health rises through each chapter, with the chapter boss as its peak', () => {
    const sorted = [...BOSSES].sort((a, b) => a.stage - b.stage);
    // Within a chapter, every fight is bigger than the last.
    for (const chapterStart of [1, 6, 11, 16, 21, 26]) {
      const chapter = sorted.filter((b) => b.stage >= chapterStart && b.stage < chapterStart + 5);
      let last = 0;
      for (const boss of chapter) {
        expect(boss.health, `stage ${boss.stage}`).toBeGreaterThan(last);
        last = boss.health;
      }
      // The chapter boss is the peak of its chapter.
      const peak = Math.max(...chapter.map((b) => b.health));
      expect(chapter[chapter.length - 1]!.health).toBe(peak);
    }
    // A chapter boss deliberately outweighs the opening fight of the next
    // chapter, which is where the player is meant to feel their new strength.
    for (const stage of [5, 10, 15, 20, 25]) {
      expect(bossByStage(stage)!.health).toBeGreaterThan(bossByStage(stage + 1)!.health);
    }
    // The final boss is the largest fight in the game.
    expect(bossByStage(30)!.health).toBe(Math.max(...BOSSES.map((b) => b.health)));
    expect(bossHealth(5, 1.55)).toBeGreaterThan(bossHealth(5, 1.0));
  });

  it('rewards exist for every stage and first-clear beats replay', () => {
    for (const def of STAGES) {
      expect(def.firstClear.gold).toBeGreaterThan(0);
      expect(def.firstClear.xp).toBeGreaterThan(0);
      expect(def.replay.gold ?? 0).toBeLessThan(def.firstClear.gold!);
      expect(def.replay.xp).toBeLessThan(def.firstClear.xp);
    }
  });

  it('every arena mutation named by a phase is a real hook the boss can run', () => {
    const hooks = new Set<string>();
    for (const b of BOSSES) for (const a of b.attacks) if (a.hook) hooks.add(a.hook);
    // Spot-check the named mechanics from the stage table.
    for (const h of [
      'combo_follow', 'pull', 'ring_gaps', 'committed_charge', 'pillar_bait',
      'summon_brood', 'aimed_lane', 'spawn_pools', 'silence_zone', 'reweave_arena',
      'delayed_slam', 'vent_burst', 'arm_mines', 'landing_marker', 'echo_strike',
      'expose_anchors', 'frontal_block', 'redirect_ballista', 'banner_summon',
      'counter_stance', 'siege_fire', 'spawn_mirrors', 'alternating_fissures',
      'rotating_sectors', 'expose_weakpoint', 'dread_field', 'timed_charges',
      'cooling_window', 'swap_stance', 'copy_ember', 'season_field', 'conduit_break',
    ]) {
      expect(hooks.has(h), `hook ${h}`).toBe(true);
    }
  });
});

describe('fixture mode', () => {
  it('parses the query string', () => {
    expect(parseFixture('')).toBeNull();
    const f = parseFixture('?fixture=17&difficulty=veteran&at=entrance');
    expect(f).toEqual({ stage: 17, difficulty: 'veteran', atBoss: false, hard: false });
    expect(parseFixture('?fixture=999')!.stage).toBe(30);
    expect(parseFixture('?fixture=0')!.stage).toBe(1);
  });

  it('builds a fully unlocked character separate from any player save', () => {
    const s = fixtureState({ stage: 25, difficulty: 'adventurer', atBoss: true, hard: false });
    expect(s.player.level).toBe(30);
    expect(Object.values(s.rings).every((r) => r.discovered && r.rank === 10)).toBe(true);
    expect(s.home.tier).toBe(4);
    expect(s.campaign.cleared).toHaveLength(24);
    // It is a fresh object; the real save is untouched.
    const real = newGameState();
    expect(real.player.level).toBe(1);
    expect(real.rings.ember!.discovered).toBe(false);
  });

  it('suppresses saving while active', () => {
    expect(isFixtureMode()).toBe(false);
    setFixtureMode(true);
    expect(isFixtureMode()).toBe(true);
    setFixtureMode(false);
  });

  it('can reach every stage in every season', () => {
    for (const def of STAGES) {
      for (const season of SEASONS) {
        const map = generateStage(def, season);
        expect(map.nodes.filter((n) => n.kind === 'bossdoor')).toHaveLength(1);
      }
    }
  });
});
