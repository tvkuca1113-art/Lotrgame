import type { Difficulty } from '@/types';
import { RINGS } from '@/content/rings';
import { STAGES } from '@/content/stages';
import { BUILDINGS } from '@/content/buildings';
import { newGameState, type GameState } from './state';
import { xpTotalFor } from './progression';

/**
 * Development fixtures.
 *
 * Opening the game with `?fixture=<stage>` drops straight into that stage with
 * everything unlocked, so all thirty boss arenas, their phase transitions,
 * rewards, exits and checkpoints can be inspected without replaying the
 * campaign. Fixture mode never reads or writes the player's save.
 */

let fixtureActive = false;

export interface FixtureRequest {
  stage: number;
  difficulty: Difficulty;
  /** Jump straight to the boss door instead of the stage entrance. */
  atBoss: boolean;
  hard: boolean;
}

export function parseFixture(search: string): FixtureRequest | null {
  const params = new URLSearchParams(search);
  const raw = params.get('fixture');
  if (raw === null) return null;
  const stage = Math.max(1, Math.min(STAGES.length, Number.parseInt(raw, 10) || 1));
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'adventurer';
  return {
    stage,
    difficulty: ['story', 'adventurer', 'veteran'].includes(difficulty) ? difficulty : 'adventurer',
    atBoss: params.get('at') !== 'entrance',
    hard: params.has('hard'),
  };
}

export function isFixtureMode(): boolean { return fixtureActive; }
export function setFixtureMode(v: boolean): void { fixtureActive = v; }

/**
 * A fully unlocked character: level 30, every ring discovered at rank 10, every
 * slot and socket open, a built settlement and full resources.
 */
export function fixtureState(req: FixtureRequest): GameState {
  const s = newGameState(req.difficulty);
  s.player.level = 30;
  s.player.xp = xpTotalFor(30);
  s.player.talentPoints = 29;
  s.player.flaskCharges = s.player.flaskMax;
  s.player.equipment = { weapon: 'sword_hearthlight', armour: 'armour_hearthplate', boots: 'boots_snowmarch' };
  s.player.weaponFamily = 'sword';
  s.resources = { gold: 99_999, wood: 9999, stone: 9999, iron: 9999, shards: 9999 };
  for (const r of RINGS) s.rings[r.id] = { discovered: true, rank: 10 };
  s.ringSlots.active1 = 'ember';
  s.ringSlots.active2 = 'windstep';
  s.ringSlots.support1 = 'stoneward';
  s.ringSlots.support2 = 'last_hearth';
  s.campaign.cleared = STAGES.filter((x) => x.id < req.stage).map((x) => x.id);
  if (s.campaign.cleared.length === 0) s.campaign.cleared = [];
  s.campaign.difficulty = req.difficulty;
  s.home.tier = 4;
  s.home.residents = ['smith', 'scout', 'gardener', 'mason', 'healer', 'chronicler'];
  s.home.trophies = [0, 1, 2, 3, 4, 5];
  s.tutorial.done = true;
  // A representative settlement so the home scene can be inspected too.
  let gx = 0;
  for (const b of BUILDINGS) {
    if (b.decorative) continue;
    s.home.buildings.push({ uid: `fx${gx}`, id: b.id, gx: (gx % 4) * 4, gy: Math.floor(gx / 4) * 3, rotation: 0, variant: 0 });
    gx++;
    if (gx >= 8) break;
  }
  return s;
}

/**
 * A machine-readable description of every boss encounter, used by the fixture
 * report and by tests/fixtures.test.ts.
 */
export interface BossFixtureRow {
  stage: number;
  boss: string;
  arena: string;
  chapterBoss: boolean;
  health: number;
  phases: { id: string; at: number; attacks: number; arena?: string }[];
  attacks: { id: string; telegraph: number; active: number; recovery: number; shape: string; hook?: string }[];
  rewardGold: number;
  rewardXp: number;
  ring?: string;
}
