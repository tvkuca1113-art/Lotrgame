import type { Season } from '@/types';
import { SEASONS } from '@/types';
import type { GameState } from './state';

/** A season lasts four in-game days. Nothing here is tied to real dates. */
export const DAYS_PER_SEASON = 4;

export function seasonIndex(s: Season): number { return SEASONS.indexOf(s); }

export function nextSeason(s: Season): Season {
  return SEASONS[(seasonIndex(s) + 1) % SEASONS.length]!;
}

export interface CalendarView {
  season: Season;
  day: number;
  daysLeft: number;
  next: Season;
  totalDays: number;
}

export function calendarView(state: GameState): CalendarView {
  return {
    season: state.calendar.season,
    day: state.calendar.day + 1,
    daysLeft: DAYS_PER_SEASON - state.calendar.day,
    next: nextSeason(state.calendar.season),
    totalDays: state.calendar.totalDays,
  };
}

export interface DayAdvance {
  seasonChanged: boolean;
  from: Season;
  to: Season;
}

/**
 * Advance the calendar by one day.
 *
 * A successful expedition advances a day. A failed attempt does not. Resting at
 * home advances a day without granting resources. This is the only place the
 * calendar moves.
 */
export function advanceDay(state: GameState): DayAdvance {
  const from = state.calendar.season;
  state.calendar.totalDays += 1;
  state.calendar.day += 1;
  if (state.calendar.day >= DAYS_PER_SEASON) {
    state.calendar.day = 0;
    state.calendar.season = nextSeason(from);
  }
  return { seasonChanged: state.calendar.season !== from, from, to: state.calendar.season };
}

/**
 * Seasons are snapshotted when a mission begins and only applied on the next
 * departure or home return, so a boss attack can never change mid-swing.
 */
export interface SeasonSnapshot {
  season: Season;
  day: number;
  takenAt: number;
}

export function snapshotSeason(state: GameState): SeasonSnapshot {
  return { season: state.calendar.season, day: state.calendar.day, takenAt: Date.now() };
}

// ---------------------------------------------------------- season effects

export interface SeasonProfile {
  /** Modest damage modifiers, kept inside +/-15%. */
  fireDamage: number;
  frostDamage: number;
  shockDamage: number;
  /** Movement modifier on open ground. */
  moveSpeed: number;
  /** Whether marked water is frozen and crossable. */
  frozenWater: boolean;
  /** Whether low water opens shallow shortcuts. */
  lowWater: boolean;
  /** Whether marked vegetation is dry enough to ignite. */
  dryGrowth: boolean;
  /** Whether wet ground extends lightning chains. */
  wetGround: boolean;
  /** Ambient particle sheet used by the stage renderer. */
  weather: 'rain_sheet' | 'snow_sheet' | 'leaf_sheet' | 'petal_sheet' | null;
  /** Light tint applied to the scene. */
  tint: number;
  ambientAlpha: number;
}

export const SEASON_PROFILES: Record<Season, SeasonProfile> = {
  spring: {
    fireDamage: -0.08, frostDamage: 0, shockDamage: 0.12, moveSpeed: -0.02,
    frozenWater: false, lowWater: false, dryGrowth: false, wetGround: true,
    weather: 'rain_sheet', tint: 0x9fd08a, ambientAlpha: 0.1,
  },
  summer: {
    fireDamage: 0.12, frostDamage: -0.1, shockDamage: 0, moveSpeed: 0.02,
    frozenWater: false, lowWater: true, dryGrowth: true, wetGround: false,
    weather: 'petal_sheet', tint: 0xe7c878, ambientAlpha: 0.1,
  },
  autumn: {
    fireDamage: 0.06, frostDamage: 0.04, shockDamage: 0.04, moveSpeed: 0,
    frozenWater: false, lowWater: false, dryGrowth: true, wetGround: false,
    weather: 'leaf_sheet', tint: 0xc98a45, ambientAlpha: 0.12,
  },
  winter: {
    fireDamage: -0.1, frostDamage: 0.14, shockDamage: -0.05, moveSpeed: -0.04,
    frozenWater: true, lowWater: false, dryGrowth: false, wetGround: false,
    weather: 'snow_sheet', tint: 0xb7d2de, ambientAlpha: 0.16,
  },
};

export function seasonProfile(s: Season): SeasonProfile {
  return SEASON_PROFILES[s];
}

/** Elemental modifier for a damage tag, clamped to the +/-15% design budget. */
export function seasonDamageModifier(s: Season, tags: readonly string[]): number {
  const p = SEASON_PROFILES[s];
  let m = 0;
  if (tags.includes('fire')) m += p.fireDamage;
  if (tags.includes('frost')) m += p.frostDamage;
  if (tags.includes('lightning')) m += p.shockDamage;
  return Math.max(-0.15, Math.min(0.15, m));
}

/**
 * Does the season open this stage's optional route? Mandatory objectives never
 * depend on this; the answer only gates a shortcut, a cache or a side encounter.
 */
export function seasonRouteOpen(routeSeason: Season, current: Season): boolean {
  return routeSeason === current;
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'season.spring',
  summer: 'season.summer',
  autumn: 'season.autumn',
  winter: 'season.winter',
};
