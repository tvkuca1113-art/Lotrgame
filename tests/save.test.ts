import { describe, it, expect } from 'vitest';
import { newGameState, SAVE_VERSION, type GameState } from '@/systems/state';
import { sanitiseState, exportSave, importSave } from '@/systems/save';
import { xpTotalFor } from '@/systems/progression';

function seeded(): GameState {
  const s = newGameState('veteran');
  s.player.xp = xpTotalFor(12);
  s.player.level = 12;
  s.player.talents = ['g1', 'g3'];
  s.player.talentPoints = 9;
  s.resources = { gold: 1200, wood: 40, stone: 30, iron: 8, shards: 22 };
  s.rings.ember = { discovered: true, rank: 6 };
  s.rings.windstep = { discovered: true, rank: 3 };
  s.ringSlots.active1 = 'ember';
  s.ringSockets[0] = 'windstep';
  s.campaign.cleared = [1, 2, 3, 4, 5];
  s.campaign.claimedRewards = ['stage:1:first'];
  s.home.tier = 1;
  s.home.buildings = [{ uid: 'b1', id: 'forge', gx: 2, gy: 3, rotation: 0, variant: 0 }];
  s.home.residents = ['smith'];
  s.calendar = { day: 2, season: 'autumn', totalDays: 14 };
  s.inventory.items = [{ uid: 'i1', defId: 'sword_valley', locked: true }];
  return s;
}

describe('save round-trip', () => {
  it('survives export and import unchanged in every field that matters', () => {
    const s = seeded();
    const res = importSave(exportSave(s));
    expect(res.ok).toBe(true);
    const out = res.state!;
    expect(out.player.level).toBe(12);
    expect(out.player.talents).toEqual(['g1', 'g3']);
    expect(out.resources).toEqual(s.resources);
    expect(out.rings.ember).toEqual({ discovered: true, rank: 6 });
    expect(out.ringSlots.active1).toBe('ember');
    expect(out.ringSockets[0]).toBe('windstep');
    expect(out.campaign.cleared).toEqual([1, 2, 3, 4, 5]);
    expect(out.campaign.claimedRewards).toEqual(['stage:1:first']);
    expect(out.campaign.difficulty).toBe('veteran');
    expect(out.home.buildings).toHaveLength(1);
    expect(out.home.residents).toEqual(['smith']);
    expect(out.calendar).toEqual({ day: 2, season: 'autumn', totalDays: 14 });
    expect(out.inventory.items[0]).toEqual({ uid: 'i1', defId: 'sword_valley', locked: true });
  });

  it('rejects text that is not a save', () => {
    expect(importSave('not json').ok).toBe(false);
    expect(importSave('{"hello":1}').ok).toBe(true); // an object is coerced to a fresh game
    expect(importSave('[]').ok).toBe(true);
  });

  it('refuses a save from a newer build rather than mangling it', () => {
    const s = seeded();
    const raw = JSON.parse(exportSave(s));
    raw.state.version = SAVE_VERSION + 5;
    const res = importSave(JSON.stringify(raw));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('newer');
  });
});

describe('validation and repair', () => {
  it('clamps negative and absurd resources', () => {
    const s = seeded();
    (s.resources as Record<string, number>).gold = -500;
    (s.resources as Record<string, number>).iron = Number.POSITIVE_INFINITY;
    const { state, report } = sanitiseState(JSON.parse(JSON.stringify(s)));
    expect(state.resources.gold).toBe(0);
    expect(Number.isFinite(state.resources.iron)).toBe(true);
    expect(report.repaired.some((r) => r.includes('negative gold'))).toBe(true);
  });

  it('drops unknown rings, items and buildings instead of crashing', () => {
    const raw = JSON.parse(exportSave(seeded()));
    raw.state.ringSlots.active1 = 'not_a_ring';
    raw.state.inventory.items.push({ uid: 'x', defId: 'sword_of_nothing', locked: false });
    raw.state.home.buildings.push({ uid: 'y', id: 'moon_base', gx: 0, gy: 0, rotation: 0, variant: 0 });
    const res = importSave(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    expect(res.state!.ringSlots.active1).toBeNull();
    expect(res.state!.inventory.items.every((i) => i.defId !== 'sword_of_nothing')).toBe(true);
    expect(res.state!.home.buildings.every((b) => b.id !== 'moon_base')).toBe(true);
    expect(res.report!.repaired.length).toBeGreaterThan(0);
  });

  it('recomputes a level that does not match the experience total', () => {
    const raw = JSON.parse(exportSave(seeded()));
    raw.state.player.level = 30;
    const res = importSave(JSON.stringify(raw));
    expect(res.state!.player.level).toBe(12);
    expect(res.report!.repaired.some((r) => r.includes('level recomputed'))).toBe(true);
  });

  it('refuses ring ranks above ten and levels above thirty', () => {
    const raw = JSON.parse(exportSave(seeded()));
    raw.state.rings.ember.rank = 99;
    raw.state.player.xp = 99_999_999;
    const res = importSave(JSON.stringify(raw));
    expect(res.state!.rings.ember!.rank).toBe(10);
    expect(res.state!.player.level).toBe(30);
  });

  it('enforces ring exclusivity on import: no ring in two places', () => {
    const raw = JSON.parse(exportSave(seeded()));
    raw.state.ringSlots.active1 = 'ember';
    raw.state.ringSlots.active2 = 'ember';
    raw.state.ringSockets[0] = 'ember';
    const res = importSave(JSON.stringify(raw));
    const out = res.state!;
    const places = [out.ringSlots.active1, out.ringSlots.active2, out.ringSlots.support1, out.ringSlots.support2, ...out.ringSockets]
      .filter((r) => r === 'ember');
    expect(places).toHaveLength(1);
  });

  it('never lets an undiscovered ring sit in a slot', () => {
    const raw = JSON.parse(exportSave(seeded()));
    raw.state.ringSlots.active2 = 'last_hearth'; // not discovered in this save
    const res = importSave(JSON.stringify(raw));
    expect(res.state!.ringSlots.active2).toBeNull();
  });

  it('keeps a boss checkpoint so a reload resumes at the arena entrance', () => {
    const s = seeded();
    s.campaign.checkpoint = { stage: 5, at: 'boss', bankedRewardIds: ['cache:5:0'], flaskCharges: 2, elapsedMs: 90_000 };
    const res = importSave(exportSave(s));
    expect(res.state!.campaign.checkpoint).toEqual(s.campaign.checkpoint);
  });
});

describe('migration', () => {
  it('reads a version 1 save and brings it forward', () => {
    // A minimal, older-shaped save: no loadouts, no journal, no replay block.
    const legacy = {
      version: 1,
      player: { level: 4, xp: xpTotalFor(4), talents: ['g1'], weaponFamily: 'axe', equipment: { weapon: 'axe_quarry' } },
      resources: { gold: 300, wood: 12 },
      rings: { ember: { discovered: true, rank: 2 } },
      ringSlots: { active1: 'ember' },
      campaign: { cleared: [1, 2], difficulty: 'story' },
      home: { tier: 0 },
      calendar: { season: 'summer', day: 1 },
    };
    const res = importSave(JSON.stringify(legacy));
    expect(res.ok).toBe(true);
    const out = res.state!;
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.player.level).toBe(4);
    expect(out.player.weaponFamily).toBe('axe');
    expect(out.player.equipment.weapon).toBe('axe_quarry');
    expect(out.resources.gold).toBe(300);
    expect(out.rings.ember).toEqual({ discovered: true, rank: 2 });
    expect(out.ringSlots.active1).toBe('ember');
    expect(out.campaign.difficulty).toBe('story');
    expect(out.calendar.season).toBe('summer');
    // New blocks are filled in with defaults rather than left undefined.
    expect(out.player.loadouts).toHaveLength(3);
    expect(out.journal.synergies).toEqual([]);
    expect(out.replay.banners).toEqual([]);
    expect(res.report!.repaired.some((r) => r.includes('migrated from save version 1'))).toBe(true);
  });

  it('gives every ring an entry even if the old save never mentioned it', () => {
    const res = importSave(JSON.stringify({ version: 1, rings: {} }));
    expect(Object.keys(res.state!.rings)).toHaveLength(12);
  });
});
