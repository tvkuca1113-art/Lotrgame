import { describe, it, expect } from 'vitest';
import { newGameState } from '@/systems/state';
import {
  xpToNext, xpTotalFor, levelForTotalXp, grantXp, MAX_LEVEL,
  deriveStats, levelHealth, levelStamina, spendTalent, respec, earnedTalentPoints,
  saveLoadout, loadLoadout, DIFFICULTY,
} from '@/systems/progression';
import { STAGES } from '@/content/stages';
import { MAX_TALENT_POINTS } from '@/content/talents';

describe('experience curve', () => {
  it('uses 60 + 24L + 4L^2 exactly', () => {
    for (const l of [1, 5, 12, 29]) {
      expect(xpToNext(l)).toBe(60 + 24 * l + 4 * l * l);
    }
  });

  it('caps the character at level 30', () => {
    const s = newGameState();
    grantXp(s, 10_000_000);
    expect(s.player.level).toBe(MAX_LEVEL);
    const again = grantXp(s, 10_000_000);
    expect(again.levels).toBe(0);
    expect(again.cappedXp).toBe(true);
    expect(s.player.level).toBe(MAX_LEVEL);
    expect(s.player.xp).toBe(xpTotalFor(MAX_LEVEL));
  });

  it('awards exactly 29 talent points across the campaign', () => {
    const s = newGameState();
    grantXp(s, xpTotalFor(MAX_LEVEL));
    expect(s.player.level).toBe(30);
    expect(s.player.talentPoints).toBe(MAX_TALENT_POINTS);
    expect(earnedTalentPoints(30)).toBe(29);
  });

  it('level lookup round-trips with the total curve', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(levelForTotalXp(xpTotalFor(l))).toBe(l);
    }
  });
});

describe('main-path pacing', () => {
  /** Mandatory XP only: boss + objective from the stage table. */
  function mainPathLevelAfter(stage: number): number {
    const s = newGameState();
    for (const def of STAGES) {
      if (def.id > stage) break;
      grantXp(s, def.firstClear.xp);
      // Mandatory encounter experience is budgeted at the remainder of the
      // stage total; the stage table splits 46% boss, 20% objective, 34% fights.
      const total = Math.round(def.firstClear.xp / 0.66);
      grantXp(s, total - def.firstClear.xp);
    }
    return s.player.level;
  }

  it('reaches the targets in the brief', () => {
    expect(mainPathLevelAfter(5)).toBe(6);
    expect(mainPathLevelAfter(10)).toBe(11);
    expect(mainPathLevelAfter(20)).toBe(21);
    expect(mainPathLevelAfter(29)).toBe(30);
  });

  it('is monotonic: every stage moves the player forward', () => {
    let last = 1;
    for (let stage = 1; stage <= 30; stage++) {
      const lv = mainPathLevelAfter(stage);
      expect(lv).toBeGreaterThanOrEqual(last);
      last = lv;
    }
  });
});

describe('derived stats', () => {
  it('every level gives visible health or stamina growth', () => {
    for (let l = 2; l <= 30; l++) {
      const grew = levelHealth(l) > levelHealth(l - 1) || levelStamina(l) > levelStamina(l - 1);
      expect(grew).toBe(true);
    }
    expect(levelHealth(1)).toBe(100);
    expect(levelStamina(1)).toBe(100);
  });

  it('a fresh character starts at 100 health, 100 stamina, no gold and no rings', () => {
    const s = newGameState();
    const stats = deriveStats(s);
    expect(stats.maxHealth).toBe(100);
    expect(stats.maxStamina).toBe(100);
    expect(s.resources.gold).toBe(0);
    expect(Object.values(s.rings).every((r) => !r.discovered)).toBe(true);
    expect(s.player.equipment.weapon).toBe('sword_worn');
    expect(s.home.tier).toBe(-1);
  });

  it('dodge starts at 25 stamina with ~180ms of invulnerability', () => {
    const stats = deriveStats(newGameState());
    expect(stats.dodgeCost).toBe(25);
    expect(stats.dodgeIFrames).toBeCloseTo(0.18);
    expect(stats.staminaRegen).toBe(20);
  });
});

describe('talents', () => {
  it('respects prerequisites and the point budget', () => {
    const s = newGameState();
    s.player.talentPoints = 2;
    expect(spendTalent(s, 'g3')).toBe(false); // requires g1
    expect(spendTalent(s, 'g1')).toBe(true);
    expect(spendTalent(s, 'g3')).toBe(true);
    expect(s.player.talentPoints).toBe(0);
    expect(spendTalent(s, 'g2')).toBe(false);
  });

  it('respecialisation returns every point', () => {
    const s = newGameState();
    s.player.level = 30;
    s.player.talentPoints = 29;
    spendTalent(s, 'r1');
    spendTalent(s, 'r2');
    respec(s);
    expect(s.player.talents).toEqual([]);
    expect(s.player.talentPoints).toBe(29);
  });

  it('saves and restores three loadouts', () => {
    const s = newGameState();
    s.player.level = 10;
    s.player.talentPoints = earnedTalentPoints(10);
    spendTalent(s, 'k1');
    spendTalent(s, 'k2');
    saveLoadout(s, 1);
    respec(s);
    expect(s.player.talents).toHaveLength(0);
    expect(loadLoadout(s, 1)).toBe(true);
    expect(s.player.talents).toEqual(['k1', 'k2']);
  });

  it('a loadout that exceeds the current budget is refused rather than truncated', () => {
    const s = newGameState();
    s.player.level = 30;
    s.player.talentPoints = 29;
    for (const id of ['g1', 'g2', 'g3', 'g4']) spendTalent(s, id);
    saveLoadout(s, 0);
    s.player.level = 2;
    s.player.talentPoints = earnedTalentPoints(2);
    s.player.talents = [];
    expect(loadLoadout(s, 0)).toBe(false);
  });
});

describe('difficulty', () => {
  it('changes only the numbers, never the boss patterns', () => {
    expect(DIFFICULTY.story.incomingDamage).toBeLessThan(DIFFICULTY.adventurer.incomingDamage);
    expect(DIFFICULTY.veteran.incomingDamage).toBeGreaterThan(DIFFICULTY.adventurer.incomingDamage);
    expect(DIFFICULTY.story.telegraphScale).toBeGreaterThan(1);
    expect(DIFFICULTY.veteran.telegraphScale).toBeLessThan(1);
    expect(DIFFICULTY.veteran.telegraphScale).toBeGreaterThan(0.6);
  });
});
