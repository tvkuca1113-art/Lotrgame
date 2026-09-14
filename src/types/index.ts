/** Shared domain types. Content data is typed against these. */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'] as const;

export type RegionKey = 'farmland' | 'woodland' | 'mountain' | 'borderland' | 'winterland' | 'fortress';
export type Difficulty = 'story' | 'adventurer' | 'veteran';
export type WeaponFamily = 'sword' | 'bow' | 'axe';
export type TalentPath = 'guardian' | 'ranger' | 'ringkeeper';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ResourceKey = 'gold' | 'wood' | 'stone' | 'iron' | 'shards';
export type EquipSlot = 'weapon' | 'armour' | 'boots';
export type RingSlot = 'active1' | 'active2' | 'support1' | 'support2';

export interface ResourceBundle {
  gold?: number;
  wood?: number;
  stone?: number;
  iron?: number;
  shards?: number;
}

export interface Vec2 { x: number; y: number }

export type ObjectiveKind =
  | 'rescue' | 'collect' | 'destroy' | 'escort' | 'defend' | 'light' | 'sabotage' | 'explore' | 'recover';

export interface StageObjective {
  kind: ObjectiveKind;
  /** Number of things to do (survivors, wards, crates...). */
  count: number;
  /** Localisation key for the HUD line. */
  labelKey: string;
}

export type EnemyKey = string;

export interface StageDef {
  id: number;
  region: RegionKey;
  /** Localisation keys. */
  nameKey: string;
  objectiveKey: string;
  loreKey: string;
  bossKey: string;
  bossNameKey: string;
  bossTestKey: string;
  recommendedLevel: number;
  chapterBoss: boolean;
  objective: StageObjective;
  /** Enemy families that spawn in the approach. */
  enemies: EnemyKey[];
  /** Map generation seed & shape. */
  mapSeed: number;
  mapWidth: number;
  mapHeight: number;
  /** Encounter budget used to lay out fights. */
  encounters: number;
  /** Optional side routes/caches. */
  caches: number;
  /** First-clear rewards. */
  firstClear: ResourceBundle & { xp: number; ringId?: string; unlocksSlot?: RingSlot; talentPoints?: number };
  replay: ResourceBundle & { xp: number };
  /** Seasonal route that changes on this map. */
  seasonRoute: { season: Season; noteKey: string };
  /** Ring-sight secret, if any. */
  ringSight?: { ring: string; noteKey: string };
  durationMinutes: [number, number];
}

export interface RingEvolution {
  rank: number;
  key: string;
}

export interface RingDef {
  id: string;
  nameKey: string;
  loreKey: string;
  activeKey: string;
  supportKey: string;
  homeKey: string;
  /** Stage whose boss/discovery guarantees the ring. */
  source: number;
  /** Base cooldown in seconds at rank 1. */
  cooldown: number;
  /** Cooldown floor after cooldown-reduction scaling. */
  cooldownFloor: number;
  baseDamage: number;
  baseRange: number;
  /** Hard caps so scaling never runs away. */
  caps: { range: number; cooldownReduction: number; crowdControl: number };
  evolutions: [RingEvolution, RingEvolution];
  /** Support effect magnitude at rank 1 and its cap. */
  support: { stat: string; perRank: number; cap: number };
  /** Home effect magnitude and cap. */
  home: { effect: string; perRank: number; cap: number };
  tags: string[];
}

export interface SynergyDef {
  id: string;
  rings: [string, string];
  nameKey: string;
  descKey: string;
  /** Internal cooldown in seconds. */
  icd: number;
  /** Maximum targets/instances per trigger. */
  cap: number;
  slots: 'active-active' | 'any';
}

export interface TalentNode {
  id: string;
  path: TalentPath;
  tier: number;
  nameKey: string;
  descKey: string;
  effect: { stat: string; value: number };
  requires?: string;
}

export interface EquipmentDef {
  id: string;
  slot: EquipSlot;
  family?: WeaponFamily;
  nameKey: string;
  tier: number;
  /** Visual tier drives which player sheet is used. */
  gearTier: 0 | 1 | 2;
  cost: ResourceBundle;
  stats: { attack?: number; armour?: number; speed?: number; stamina?: number; health?: number };
  requiresStage: number;
}

export interface BuildingDef {
  id: string;
  nameKey: string;
  descKey: string;
  art: string;
  gridW: number;
  gridD: number;
  cost: ResourceBundle;
  requiresTier: number;
  /** Functional role implemented in the home scene. */
  role: 'none' | 'rest' | 'storage' | 'forge' | 'ringbench' | 'garden' | 'watchtower' | 'wall' | 'gate' | 'trophy' | 'decor' | 'socket' | 'dummy' | 'monument';
  /** Ring socket index if this structure can hold a ring. */
  socket?: 0 | 1;
  decorative?: boolean;
  unique?: boolean;
}

export interface HomeTierDef {
  tier: number;
  id: string;
  nameKey: string;
  art: string;
  unlockStage: number;
  cost: ResourceBundle;
  plotW: number;
  plotD: number;
}

export interface EnemyDef {
  id: string;
  art: string;
  nameKey: string;
  family: 'goblin' | 'orc' | 'uruk' | 'warg' | 'troll' | 'spider' | 'wight' | 'human' | 'beast';
  health: number;
  damage: number;
  speed: number;
  /** Attack reach in world pixels. */
  reach: number;
  /** Telegraph duration in ms before the hitbox goes live. */
  telegraph: number;
  recovery: number;
  /** AI archetype implemented in the enemy controller. */
  behaviour: 'melee' | 'ranged' | 'flanker' | 'shield' | 'heavy' | 'caster' | 'bomber';
  xp: number;
  gold: [number, number];
  armour?: number;
  poise?: number;
  projectile?: string;
  elite?: boolean;
  scale?: number;
}

export type BossPhaseTrigger = { atHealthPct: number };

export interface BossAttackDef {
  id: string;
  /** Which animation to play. */
  anim: string;
  telegraph: number;
  active: number;
  recovery: number;
  damage: number;
  /** Shape of the danger zone. */
  shape: 'arc' | 'circle' | 'line' | 'ring' | 'cone' | 'projectile' | 'summon' | 'chain' | 'ground';
  range: number;
  arc?: number;
  /** Cooldown before this attack may repeat. */
  cooldown: number;
  /** Minimum/maximum distance at which the AI picks it. */
  band: [number, number];
  /** Optional mechanic hook implemented in the boss controller. */
  hook?: string;
  projectiles?: number;
  vfx?: string;
  sfx?: string;
}

export interface BossPhaseDef {
  id: string;
  trigger: BossPhaseTrigger;
  attacks: string[];
  /** Arena mutation applied on entering this phase. */
  arena?: string;
  moveSpeed: number;
  /** Delay between attacks in ms, giving the player breathing room. */
  aggression: [number, number];
  introKey?: string;
}

export interface BossDef {
  id: string;
  stage: number;
  art: string;
  nameKey: string;
  titleKey: string;
  introKey: string;
  defeatKey: string;
  health: number;
  armour: number;
  poise: number;
  scale: number;
  arena: string;
  attacks: BossAttackDef[];
  phases: BossPhaseDef[];
  /** Counterplay hint shown on the mission board and on death. */
  tipKey: string;
  trophyArt: number;
}

export interface SaveMeta {
  version: number;
  savedAt: number;
  playtimeMs: number;
}
