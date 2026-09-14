import type {
  Difficulty, RingSlot, Season, WeaponFamily, ResourceKey, EquipSlot,
} from '@/types';
import { STARTING_EQUIPMENT } from '@/content/equipment';
import { RINGS } from '@/content/rings';

/** The current save format. Bump this and add a migration when the shape changes. */
export const SAVE_VERSION = 3;

export interface PlacedBuilding {
  uid: string;
  id: string;
  /** Grid cell of the building's near corner. */
  gx: number;
  gy: number;
  rotation: 0 | 1 | 2 | 3;
  variant: number;
}

export interface OwnedItem {
  uid: string;
  defId: string;
  locked: boolean;
}

export interface RingState {
  discovered: boolean;
  rank: number;
}

export interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  renderScale: number;
  particleQuality: 0 | 1 | 2;
  cameraShake: boolean;
  hitStop: boolean;
  seasonalEffects: 0 | 1 | 2;
  highContrast: boolean;
  keyboardAim: boolean;
  leftHanded: boolean;
  aimAssist: number;
  stickScale: number;
  buttonScale: number;
  keybinds: Record<string, string>;
  locale: string;
}

export interface TalentLoadout {
  name: string;
  talents: string[];
  weaponFamily: WeaponFamily;
  rings: Record<RingSlot, string | null>;
}

export interface CheckpointState {
  stage: number;
  /** Where the run was when it was saved: the boss door, or the stage entrance. */
  at: 'entrance' | 'boss';
  /** Exploration rewards already banked this run, so a retry cannot duplicate them. */
  bankedRewardIds: string[];
  flaskCharges: number;
  elapsedMs: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  savedAt: number;
  playtimeMs: number;

  settings: SettingsState;

  player: {
    level: number;
    xp: number;
    talentPoints: number;
    talents: string[];
    loadouts: TalentLoadout[];
    activeLoadout: number;
    weaponFamily: WeaponFamily;
    equipment: Record<EquipSlot, string>;
    flaskCharges: number;
    flaskMax: number;
  };

  resources: Record<ResourceKey, number>;

  rings: Record<string, RingState>;
  ringSlots: Record<RingSlot, string | null>;
  /** Two settlement sockets, unlocked after stage 10. */
  ringSockets: [string | null, string | null];

  campaign: {
    difficulty: Difficulty;
    cleared: number[];
    /** Reward ids already granted, so death/retry/reload can never duplicate. */
    claimedRewards: string[];
    checkpoint: CheckpointState | null;
    endingChosen: 'spread' | 'concentrate' | null;
    bestTimes: Record<string, number>;
    lastStage: number;
  };

  home: {
    tier: number;
    buildings: PlacedBuilding[];
    residents: string[];
    trophies: number[];
    defenceCleared: number;
  };

  calendar: {
    /** 0-based day within the current season (0..3). */
    day: number;
    season: Season;
    totalDays: number;
  };

  inventory: {
    items: OwnedItem[];
    stash: OwnedItem[];
    capacity: number;
  };

  rng: { world: number; loot: number };

  journal: {
    synergies: string[];
    bestiary: string[];
    storyBeats: string[];
    ringSightFound: string[];
  };

  replay: {
    challengeCleared: string[];
    gauntletBest: number | null;
    banners: string[];
    cloak: string;
    hardCleared: number[];
  };

  tutorial: {
    step: number;
    done: boolean;
  };
}

export const DEFAULT_KEYBINDS: Record<string, string> = {
  up: 'W', down: 'S', left: 'A', right: 'D',
  attack: 'MOUSE0', secondary: 'MOUSE2', dodge: 'SPACE',
  ring1: 'Q', ring2: 'E', heal: 'R', interact: 'F',
  inventory: 'I', map: 'M', pause: 'ESC',
};

export function defaultSettings(): SettingsState {
  return {
    masterVolume: 0.8,
    musicVolume: 0.55,
    sfxVolume: 0.9,
    ambienceVolume: 0.7,
    renderScale: 1,
    particleQuality: 2,
    cameraShake: true,
    hitStop: true,
    seasonalEffects: 2,
    highContrast: false,
    keyboardAim: false,
    leftHanded: false,
    aimAssist: 0.5,
    stickScale: 1,
    buttonScale: 1,
    keybinds: { ...DEFAULT_KEYBINDS },
    locale: 'en',
  };
}

function emptyLoadout(name: string): TalentLoadout {
  return {
    name,
    talents: [],
    weaponFamily: 'sword',
    rings: { active1: null, active2: null, support1: null, support2: null },
  };
}

/**
 * A brand-new campaign: level 1, 100 health, 100 stamina, no gold, no rings,
 * a worn sword, a patched cloak and no house.
 */
export function newGameState(difficulty: Difficulty = 'adventurer'): GameState {
  const rings: Record<string, RingState> = {};
  for (const r of RINGS) rings[r.id] = { discovered: false, rank: 1 };
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playtimeMs: 0,
    settings: defaultSettings(),
    player: {
      level: 1,
      xp: 0,
      talentPoints: 0,
      talents: [],
      loadouts: [emptyLoadout('I'), emptyLoadout('II'), emptyLoadout('III')],
      activeLoadout: 0,
      weaponFamily: 'sword',
      equipment: { ...STARTING_EQUIPMENT },
      flaskCharges: 3,
      flaskMax: 3,
    },
    resources: { gold: 0, wood: 0, stone: 0, iron: 0, shards: 0 },
    rings,
    ringSlots: { active1: null, active2: null, support1: null, support2: null },
    ringSockets: [null, null],
    campaign: {
      difficulty,
      cleared: [],
      claimedRewards: [],
      checkpoint: null,
      endingChosen: null,
      bestTimes: {},
      lastStage: 1,
    },
    home: {
      tier: -1,
      buildings: [],
      residents: [],
      trophies: [],
      defenceCleared: 0,
    },
    calendar: { day: 0, season: 'spring', totalDays: 0 },
    inventory: { items: [], stash: [], capacity: 40 },
    rng: { world: 0x1a2b3c4d, loot: 0x51ed270b },
    journal: { synergies: [], bestiary: [], storyBeats: [], ringSightFound: [] },
    replay: { challengeCleared: [], gauntletBest: null, banners: [], cloak: 'grey', hardCleared: [] },
    tutorial: { step: 0, done: false },
  };
}

let active: GameState = newGameState();
const listeners = new Set<(s: GameState) => void>();

export function getState(): GameState { return active; }

export function setState(s: GameState): void {
  active = s;
  emit();
}

export function emit(): void {
  for (const l of listeners) l(active);
}

export function subscribe(fn: (s: GameState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Mutate the state and notify listeners in one step. */
export function update(fn: (s: GameState) => void): GameState {
  fn(active);
  emit();
  return active;
}

export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
