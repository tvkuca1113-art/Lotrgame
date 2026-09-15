import type { ResourceBundle } from '@/types';
import { STAGES } from '@/content/stages';
import { GAUNTLET_BOSSES, bossByStage } from '@/content/bosses';
import { RINGS, SYNERGIES } from '@/content/rings';
import type { GameState } from './state';
import { campaignComplete, isCleared } from './campaign';
import { grant } from './economy';

/**
 * Replay content, unlocked once the campaign is finished.
 *
 * These are additional modes, not campaign levels 31 onward: the character cap
 * stays at 30, and nothing here expires, resets, or costs real money.
 */

export interface ChallengeEntry {
  id: string;
  kind: 'boss' | 'hard' | 'gauntlet' | 'defence';
  stage: number;
  nameKey: string;
  descKey: string;
  unlocked: boolean;
  cleared: boolean;
  best: number | null;
  reward: ResourceBundle;
}

export function bossBoard(state: GameState): ChallengeEntry[] {
  const done = campaignComplete(state);
  return STAGES.map((def) => {
    const boss = bossByStage(def.id)!;
    return {
      id: `boss:${def.id}`,
      kind: 'boss' as const,
      stage: def.id,
      nameKey: boss.nameKey,
      descKey: def.bossTestKey,
      unlocked: isCleared(state, def.id),
      cleared: state.replay.challengeCleared.includes(`boss:${def.id}`),
      best: state.campaign.bestTimes[`boss${def.id}`] ?? null,
      reward: { gold: Math.round((80 + 35 * def.id) * 0.5), shards: Math.max(1, Math.round(def.id * 0.5)) },
    };
  }).filter((e) => done || e.unlocked);
}

export function hardStages(state: GameState): ChallengeEntry[] {
  if (!campaignComplete(state)) return [];
  return STAGES.map((def) => ({
    id: `hard:${def.id}`,
    kind: 'hard' as const,
    stage: def.id,
    nameKey: def.nameKey,
    descKey: def.objectiveKey,
    unlocked: true,
    cleared: state.replay.hardCleared.includes(def.id),
    best: state.campaign.bestTimes[`hard${def.id}`] ?? null,
    reward: { gold: Math.round((80 + 35 * def.id) * 0.9), shards: Math.max(2, Math.round(def.id * 0.8)) },
  }));
}

export const GAUNTLET_ID = 'gauntlet:six';

export function gauntletEntry(state: GameState): ChallengeEntry {
  return {
    id: GAUNTLET_ID,
    kind: 'gauntlet',
    stage: 30,
    nameKey: 'replay.gauntlet',
    descKey: 'replay.gauntlet_note',
    unlocked: campaignComplete(state),
    cleared: state.replay.challengeCleared.includes(GAUNTLET_ID),
    best: state.replay.gauntletBest,
    reward: { gold: 4000, shards: 60 },
  };
}

/** The six chapter bosses in order, with a checkpoint between each. */
export const GAUNTLET_STAGES = GAUNTLET_BOSSES.map((b) => b.stage);

export interface GauntletRun {
  index: number;
  startedAt: number;
  elapsedMs: number;
  /** Health carried between fights, as a fraction. */
  carryHealth: number;
  flask: number;
  deaths: number;
}

export function startGauntlet(state: GameState): GauntletRun {
  void state;
  return { index: 0, startedAt: Date.now(), elapsedMs: 0, carryHealth: 1, flask: 3, deaths: 0 };
}

export function advanceGauntlet(state: GameState, run: GauntletRun, elapsedMs: number): { done: boolean; nextStage: number | null } {
  run.elapsedMs += elapsedMs;
  run.index += 1;
  if (run.index >= GAUNTLET_STAGES.length) {
    if (!state.replay.challengeCleared.includes(GAUNTLET_ID)) state.replay.challengeCleared.push(GAUNTLET_ID);
    if (state.replay.gauntletBest === null || run.elapsedMs < state.replay.gauntletBest) {
      state.replay.gauntletBest = Math.round(run.elapsedMs);
    }
    if (!state.replay.banners.includes('six')) state.replay.banners.push('six');
    return { done: true, nextStage: null };
  }
  return { done: false, nextStage: GAUNTLET_STAGES[run.index]! };
}

export function completeChallenge(state: GameState, entry: ChallengeEntry, elapsedMs: number): ResourceBundle {
  const firstTime = !state.replay.challengeCleared.includes(entry.id);
  if (firstTime) state.replay.challengeCleared.push(entry.id);
  if (entry.kind === 'hard' && !state.replay.hardCleared.includes(entry.stage)) {
    state.replay.hardCleared.push(entry.stage);
  }
  const key = entry.kind === 'hard' ? `hard${entry.stage}` : `boss${entry.stage}`;
  const best = state.campaign.bestTimes[key];
  if (elapsedMs > 0 && (best === undefined || elapsedMs < best)) state.campaign.bestTimes[key] = Math.round(elapsedMs);
  // Repeats pay a reduced share, so a challenge is worth doing but not farming.
  const scale = firstTime ? 1 : 0.35;
  return grant(state, {
    gold: Math.round((entry.reward.gold ?? 0) * scale),
    shards: Math.round((entry.reward.shards ?? 0) * scale),
  });
}

// --------------------------------------------------------------- cosmetics

export interface Cosmetic { id: string; nameKey: string; earned: boolean; hint: string }

export const CLOAK_COLOURS = ['grey', 'forest', 'ember', 'winter', 'gold', 'shadow'] as const;
export type CloakColour = (typeof CLOAK_COLOURS)[number];

export const CLOAK_TINTS: Record<CloakColour, number> = {
  grey: 0x5a5f55,
  forest: 0x2f4a39,
  ember: 0xce7144,
  winter: 0x95b6c6,
  gold: 0xc2a264,
  shadow: 0x2a2436,
};

export function cosmetics(state: GameState): Cosmetic[] {
  const prog = {
    rings: Object.values(state.rings).filter((r) => r.discovered).length,
    legendary: Object.values(state.rings).filter((r) => r.rank >= 10).length,
    synergies: state.journal.synergies.length,
    cleared: state.campaign.cleared.length,
  };
  return [
    { id: 'cloak:forest', nameKey: 'replay.cloak', earned: prog.cleared >= 10, hint: 'clear 10 stages' },
    { id: 'cloak:ember', nameKey: 'replay.cloak', earned: prog.rings >= 6, hint: 'find 6 rings' },
    { id: 'cloak:winter', nameKey: 'replay.cloak', earned: prog.cleared >= 25, hint: 'clear 25 stages' },
    { id: 'cloak:gold', nameKey: 'replay.cloak', earned: prog.legendary >= 1, hint: 'take a ring to rank 10' },
    { id: 'cloak:shadow', nameKey: 'replay.cloak', earned: prog.synergies >= 6, hint: 'discover all six synergies' },
    { id: 'banner:six', nameKey: 'replay.banner', earned: state.replay.challengeCleared.includes(GAUNTLET_ID), hint: 'finish The Six' },
    { id: 'banner:collection', nameKey: 'replay.banner', earned: prog.rings >= RINGS.length, hint: 'find every ring' },
    { id: 'banner:valley', nameKey: 'replay.banner', earned: state.campaign.endingChosen !== null, hint: 'finish the campaign' },
  ];
}

export function unlockedCloaks(state: GameState): CloakColour[] {
  const earned = new Set(cosmetics(state).filter((c) => c.earned).map((c) => c.id));
  const out: CloakColour[] = ['grey'];
  for (const c of CLOAK_COLOURS) {
    if (c === 'grey') continue;
    if (earned.has(`cloak:${c}`)) out.push(c);
  }
  return out;
}

export interface CollectionGoal { key: string; have: number; need: number }

export function collectionGoals(state: GameState): CollectionGoal[] {
  return [
    { key: 'inv.rings', have: Object.values(state.rings).filter((r) => r.discovered).length, need: RINGS.length },
    { key: 'ring.rarity.legendary', have: Object.values(state.rings).filter((r) => r.rank >= 10).length, need: RINGS.length },
    { key: 'journal.synergies', have: state.journal.synergies.length, need: SYNERGIES.length },
    { key: 'map.cleared', have: state.campaign.cleared.length, need: STAGES.length },
    { key: 'replay.hard', have: state.replay.hardCleared.length, need: STAGES.length },
    { key: 'journal.bestiary', have: state.journal.bestiary.length, need: 20 },
  ];
}
