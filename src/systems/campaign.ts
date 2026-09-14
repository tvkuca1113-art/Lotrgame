import type { ResourceBundle, RingSlot, StageDef } from '@/types';
import { STAGES, stageById, chapterForStage } from '@/content/stages';
import { bossByStage } from '@/content/bosses';
import { RESIDENTS } from '@/content/buildings';
import type { GameState } from './state';
import { grantXp } from './progression';
import { claimOnce, grant, rewardId, replayPool, explorationIncome, isClaimed } from './economy';
import { discoverRing } from './rings';
import { advanceDay } from './seasons';

export function isCleared(state: GameState, stage: number): boolean {
  return state.campaign.cleared.includes(stage);
}

/** Stage 1 is always open; every later stage needs the previous one cleared. */
export function isUnlocked(state: GameState, stage: number): boolean {
  if (stage <= 1) return true;
  return isCleared(state, stage - 1);
}

export function highestCleared(state: GameState): number {
  return state.campaign.cleared.length ? Math.max(...state.campaign.cleared) : 0;
}

export function nextStage(state: GameState): number {
  const h = highestCleared(state);
  return Math.min(STAGES.length, h + 1);
}

export function campaignComplete(state: GameState): boolean {
  return isCleared(state, 30);
}

export interface StageView {
  def: StageDef;
  unlocked: boolean;
  cleared: boolean;
  firstClear: ResourceBundle & { xp: number };
  replay: ResourceBundle & { xp: number };
  recommendedLevel: number;
  bossName: string;
  chapter: number;
}

export function stageView(state: GameState, stage: number): StageView | null {
  const def = stageById(stage);
  if (!def) return null;
  const cleared = isCleared(state, stage);
  return {
    def,
    unlocked: isUnlocked(state, stage),
    cleared,
    firstClear: def.firstClear,
    replay: { ...replayPool(stage), xp: def.replay.xp },
    recommendedLevel: def.recommendedLevel,
    bossName: def.bossNameKey,
    chapter: chapterForStage(stage).id,
  };
}

export interface CompletionResult {
  firstClear: boolean;
  granted: ResourceBundle;
  xp: number;
  levels: number;
  ringDiscovered: string | null;
  duplicateShards: number;
  slotUnlocked: RingSlot | null;
  residentRescued: string | null;
  trophy: number | null;
  seasonChanged: boolean;
  monumentUnlocked: boolean;
}

/**
 * Complete a stage.
 *
 * Reward grants and their claimed flags are written to the same state object in
 * one call, which is what makes death, retry and reload unable to duplicate a
 * first clear. A successful expedition advances one calendar day.
 */
export function completeStage(state: GameState, stage: number, elapsedMs: number): CompletionResult {
  const def = stageById(stage);
  const result: CompletionResult = {
    firstClear: false, granted: {}, xp: 0, levels: 0, ringDiscovered: null,
    duplicateShards: 0, slotUnlocked: null, residentRescued: null, trophy: null,
    seasonChanged: false, monumentUnlocked: false,
  };
  if (!def) return result;

  const firstId = rewardId('stage', stage, 'first');
  const first = !isClaimed(state, firstId);
  result.firstClear = first;

  if (first) {
    const bundle: ResourceBundle = {
      gold: def.firstClear.gold, wood: def.firstClear.wood,
      stone: def.firstClear.stone, iron: def.firstClear.iron, shards: def.firstClear.shards,
    };
    const claim = claimOnce(state, firstId, bundle);
    result.granted = claim.bundle;
    const xp = grantXp(state, def.firstClear.xp);
    result.xp = def.firstClear.xp;
    result.levels = xp.levels;

    if (def.firstClear.ringId) {
      const disc = discoverRing(state, def.firstClear.ringId);
      if (disc.firstTime) result.ringDiscovered = def.firstClear.ringId;
      else result.duplicateShards = disc.shards;
    }
    if (def.firstClear.unlocksSlot) result.slotUnlocked = def.firstClear.unlocksSlot;
    if (def.firstClear.talentPoints) {
      state.player.talentPoints += def.firstClear.talentPoints;
    }
    const resident = RESIDENTS.find((r) => r.rescuedAt === stage);
    if (resident && !state.home.residents.includes(resident.id)) {
      state.home.residents.push(resident.id);
      result.residentRescued = resident.id;
    }
    const boss = bossByStage(stage);
    if (boss && def.chapterBoss) {
      if (!state.home.trophies.includes(boss.trophyArt)) {
        state.home.trophies.push(boss.trophyArt);
        result.trophy = boss.trophyArt;
        result.monumentUnlocked = true;
      }
    }
    if (!state.campaign.cleared.includes(stage)) state.campaign.cleared.push(stage);
    state.campaign.cleared.sort((a, b) => a - b);
    if (!state.journal.storyBeats.includes(def.loreKey)) state.journal.storyBeats.push(def.loreKey);
  } else {
    // Replays grant reduced gold and appropriate materials, never the story rewards.
    result.granted = grant(state, replayPool(stage));
    const xp = grantXp(state, def.replay.xp);
    result.xp = def.replay.xp;
    result.levels = xp.levels;
  }

  const key = `stage${stage}`;
  const best = state.campaign.bestTimes[key];
  if (elapsedMs > 0 && (best === undefined || elapsedMs < best)) state.campaign.bestTimes[key] = elapsedMs;

  state.campaign.checkpoint = null;
  state.campaign.lastStage = Math.min(30, stage + 1);

  const day = advanceDay(state);
  result.seasonChanged = day.seasonChanged;
  return result;
}

/** Exploration income banked during a run, claimed once per stage per campaign. */
export function claimExploration(state: GameState, stage: number, fraction: number): ResourceBundle {
  const id = rewardId('stage', stage, 'explore');
  const pool = explorationIncome(stage);
  const scaled: ResourceBundle = {
    gold: Math.round((pool.gold ?? 0) * fraction),
    wood: Math.round((pool.wood ?? 0) * fraction),
    stone: Math.round((pool.stone ?? 0) * fraction),
    iron: Math.round((pool.iron ?? 0) * fraction),
    shards: Math.round((pool.shards ?? 0) * fraction),
  };
  if (isClaimed(state, id)) {
    // Replays still pay out, at a reduced rate, without re-granting the first-clear pool.
    return grant(state, {
      gold: Math.round((scaled.gold ?? 0) * 0.35),
      wood: Math.round((scaled.wood ?? 0) * 0.35),
      stone: Math.round((scaled.stone ?? 0) * 0.35),
      iron: Math.round((scaled.iron ?? 0) * 0.35),
      shards: Math.round((scaled.shards ?? 0) * 0.35),
    });
  }
  return claimOnce(state, id, scaled).bundle;
}

// -------------------------------------------------------------- checkpoint

/** Place a checkpoint immediately before a boss. */
export function setCheckpoint(state: GameState, stage: number, at: 'entrance' | 'boss', banked: string[], flask: number, elapsedMs: number): void {
  state.campaign.checkpoint = {
    stage, at,
    bankedRewardIds: [...banked],
    flaskCharges: flask,
    elapsedMs,
  };
}

export function clearCheckpoint(state: GameState): void {
  state.campaign.checkpoint = null;
}

/** Reloading during a boss resumes at its entrance. */
export function resumePoint(state: GameState): { stage: number; at: 'entrance' | 'boss' } | null {
  const cp = state.campaign.checkpoint;
  if (!cp) return null;
  return { stage: cp.stage, at: cp.at };
}

// ------------------------------------------------------------------ replay

export function hardModeAvailable(state: GameState, stage: number): boolean {
  return campaignComplete(state) && isCleared(state, stage);
}

export function gauntletAvailable(state: GameState): boolean {
  return campaignComplete(state);
}

export interface CollectionProgress {
  ringsFound: number;
  ringsTotal: number;
  ringsLegendary: number;
  synergiesFound: number;
  synergiesTotal: number;
  stagesCleared: number;
  bestiary: number;
}

export function collectionProgress(state: GameState): CollectionProgress {
  const ringIds = Object.keys(state.rings);
  return {
    ringsFound: ringIds.filter((id) => state.rings[id]!.discovered).length,
    ringsTotal: ringIds.length,
    ringsLegendary: ringIds.filter((id) => state.rings[id]!.rank >= 10).length,
    synergiesFound: state.journal.synergies.length,
    synergiesTotal: 6,
    stagesCleared: state.campaign.cleared.length,
    bestiary: state.journal.bestiary.length,
  };
}

export function recordBestiary(state: GameState, enemyId: string): void {
  if (!state.journal.bestiary.includes(enemyId)) state.journal.bestiary.push(enemyId);
}

/** Choose the ending. Both keep the collection, buildings and continued play. */
export function chooseEnding(state: GameState, ending: 'spread' | 'concentrate'): void {
  state.campaign.endingChosen = ending;
  const banner = ending === 'spread' ? 'valley-light' : 'hearth-light';
  if (!state.replay.banners.includes(banner)) state.replay.banners.push(banner);
}
