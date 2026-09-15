import { describe, it, expect } from 'vitest';
import { newGameState, type GameState } from '@/systems/state';
import { STAGES } from '@/content/stages';
import { RINGS, SYNERGIES } from '@/content/rings';
import { GAUNTLET_BOSSES } from '@/content/bosses';
import {
  bossBoard, hardStages, gauntletEntry, GAUNTLET_ID, GAUNTLET_STAGES,
  startGauntlet, advanceGauntlet, completeChallenge, cosmetics,
  unlockedCloaks, collectionGoals, CLOAK_COLOURS, CLOAK_TINTS,
} from '@/systems/replay';
import { campaignComplete } from '@/systems/campaign';

function finished(): GameState {
  const s = newGameState();
  s.campaign.cleared = STAGES.map((d) => d.id);
  s.player.level = 30;
  return s;
}

describe('the challenge board', () => {
  it('offers only stages the player has cleared, before the campaign is over', () => {
    const s = newGameState();
    s.campaign.cleared = [1, 2, 3];
    const board = bossBoard(s);
    expect(board.map((e) => e.stage)).toEqual([1, 2, 3]);
    expect(board.every((e) => e.unlocked)).toBe(true);
  });

  it('offers every stage once the campaign is finished', () => {
    const s = finished();
    expect(campaignComplete(s)).toBe(true);
    expect(bossBoard(s)).toHaveLength(STAGES.length);
  });

  it('keeps hardened replays locked until the campaign is finished', () => {
    const s = newGameState();
    s.campaign.cleared = [1, 2, 3];
    expect(hardStages(s)).toHaveLength(0);
    expect(hardStages(finished())).toHaveLength(STAGES.length);
  });

  it('pays a first clear in full and repeats at a reduced share', () => {
    const s = finished();
    const entry = bossBoard(s)[9]!;
    const first = completeChallenge(s, entry, 40_000);
    const after = bossBoard(s).find((e) => e.id === entry.id)!;
    expect(after.cleared).toBe(true);
    const repeat = completeChallenge(s, after, 41_000);
    expect(repeat.gold!).toBeLessThan(first.gold!);
    expect(repeat.gold!).toBeGreaterThan(0);
  });

  it('records a personal best only when the run is faster', () => {
    const s = finished();
    const entry = bossBoard(s)[0]!;
    completeChallenge(s, entry, 50_000);
    expect(s.campaign.bestTimes.boss1).toBe(50_000);
    completeChallenge(s, bossBoard(s)[0]!, 70_000);
    expect(s.campaign.bestTimes.boss1).toBe(50_000);
    completeChallenge(s, bossBoard(s)[0]!, 31_000);
    expect(s.campaign.bestTimes.boss1).toBe(31_000);
  });

  it('never marks a challenge as campaign progress', () => {
    const s = newGameState();
    s.campaign.cleared = [1];
    const before = [...s.campaign.cleared];
    completeChallenge(s, bossBoard(s)[0]!, 20_000);
    expect(s.campaign.cleared).toEqual(before);
    expect(s.player.xp).toBe(0);
    expect(s.calendar.day).toBe(newGameState().calendar.day);
  });
});

describe('the six', () => {
  it('runs the six chapter bosses in order', () => {
    expect(GAUNTLET_STAGES).toEqual(GAUNTLET_BOSSES.map((b) => b.stage));
    expect(GAUNTLET_STAGES).toHaveLength(6);
    expect([...GAUNTLET_STAGES].sort((a, b) => a - b)).toEqual(GAUNTLET_STAGES);
  });

  it('only completes after the last boss, and records the total time', () => {
    const s = finished();
    const run = startGauntlet(s);
    for (let i = 0; i < GAUNTLET_STAGES.length - 1; i++) {
      const step = advanceGauntlet(s, run, 30_000);
      expect(step.done).toBe(false);
      expect(step.nextStage).toBe(GAUNTLET_STAGES[i + 1]);
    }
    expect(s.replay.challengeCleared).not.toContain(GAUNTLET_ID);
    const last = advanceGauntlet(s, run, 30_000);
    expect(last.done).toBe(true);
    expect(s.replay.gauntletBest).toBe(180_000);
    expect(s.replay.banners).toContain('six');
  });

  it('keeps the faster of two runs', () => {
    const s = finished();
    const slow = startGauntlet(s);
    for (let i = 0; i < GAUNTLET_STAGES.length; i++) advanceGauntlet(s, slow, 40_000);
    const fast = startGauntlet(s);
    for (let i = 0; i < GAUNTLET_STAGES.length; i++) advanceGauntlet(s, fast, 20_000);
    expect(s.replay.gauntletBest).toBe(120_000);
  });

  it('stays locked until the campaign is finished', () => {
    expect(gauntletEntry(newGameState()).unlocked).toBe(false);
    expect(gauntletEntry(finished()).unlocked).toBe(true);
  });
});

describe('cosmetics and collection', () => {
  it('starts with only the plain cloak', () => {
    expect(unlockedCloaks(newGameState())).toEqual(['grey']);
  });

  it('unlocks a cloak when its condition is met, and never takes one back', () => {
    const s = newGameState();
    s.campaign.cleared = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(unlockedCloaks(s)).toContain('forest');
    s.campaign.cleared.push(11);
    expect(unlockedCloaks(s)).toContain('forest');
  });

  it('gives every cloak colour a tint', () => {
    for (const c of CLOAK_COLOURS) expect(CLOAK_TINTS[c]).toBeGreaterThan(0);
  });

  it('marks nothing earned on a new save', () => {
    expect(cosmetics(newGameState()).every((c) => !c.earned)).toBe(true);
  });

  it('counts collection goals against the real content totals', () => {
    const goals = collectionGoals(newGameState());
    const need = Object.fromEntries(goals.map((g) => [g.key, g.need]));
    expect(need['inv.rings']).toBe(RINGS.length);
    expect(need['journal.synergies']).toBe(SYNERGIES.length);
    expect(need['map.cleared']).toBe(STAGES.length);
    expect(goals.every((g) => g.have === 0)).toBe(true);
  });
});
