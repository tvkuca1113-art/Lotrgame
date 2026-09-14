/**
 * The full cast. Every entry is a data description; the rig, animation library
 * and figure renderer turn it into an eight-direction animated sheet.
 */
import { MAT, BRAND } from './palette.ts';
import { shade, mix, rgb, type RGBA } from './raster.ts';
import type { FigureSpec } from './figure.ts';
import type { AnimName } from './animation.ts';

export interface CharEntry {
  key: string;
  spec: FigureSpec;
  frameW: number;
  frameH: number;
  scale: number;
  footRatio: number;
  anims: AnimName[];
  /** Asset bundle: 'core' loads at boot, region bundles load on demand. */
  bundle: string;
  outlineWidth?: number;
}

const FIGHTER_ANIMS: AnimName[] = ['idle', 'walk', 'run', 'attack', 'attack2', 'heavy', 'dodge', 'hit', 'death'];
const ENEMY_ANIMS: AnimName[] = ['idle', 'walk', 'run', 'attack', 'hit', 'death'];
const CASTER_ANIMS: AnimName[] = ['idle', 'walk', 'attack', 'cast', 'hit', 'death'];
const ARCHER_ANIMS: AnimName[] = ['idle', 'walk', 'run', 'attack', 'shoot', 'hit', 'death'];
const BOSS_ANIMS: AnimName[] = ['idle', 'walk', 'attack', 'attack2', 'heavy', 'hit', 'death'];
/** Chapter bosses (5/10/15/20/25/30) get the extra presentation beats. */
const CHAPTER_BOSS_ANIMS: AnimName[] = ['idle', 'walk', 'run', 'attack', 'attack2', 'heavy', 'roar', 'hit', 'death'];
const CASTER_BOSS_ANIMS: AnimName[] = ['idle', 'walk', 'attack', 'cast', 'heavy', 'hit', 'death'];
const NPC_ANIMS: AnimName[] = ['idle', 'walk', 'build', 'sit'];

// ------------------------------------------------------------------ player

export type WeaponFamily = 'sword' | 'bow' | 'axe';
export type GearTier = 0 | 1 | 2;

const TIER_LOOK: Record<GearTier, Partial<FigureSpec>> = {
  0: { cloth: MAT.clothGreen, clothAlt: MAT.leather, trousers: rgb('#4E3A28'), metal: MAT.iron, armour: 'light', shoulders: 'pads', helmet: 'none', cloak: rgb('#5A5F55'), accent: MAT.bronze },
  1: { cloth: rgb('#2C4A4E'), clothAlt: MAT.leatherDark, trousers: rgb('#3E3527'), metal: MAT.steel, armour: 'mail', shoulders: 'plates', helmet: 'cap', cloak: rgb('#3B5648'), accent: BRAND.gold },
  2: { cloth: rgb('#27333F'), clothAlt: rgb('#3A3B44'), trousers: rgb('#2F3038'), metal: rgb('#9DA9AE'), armour: 'plate', shoulders: 'plates', helmet: 'full', cloak: rgb('#5B3A2E'), accent: BRAND.gold },
};

const TIER_WEAPON: Record<GearTier, { metal: RGBA; wood: RGBA }> = {
  0: { metal: MAT.iron, wood: MAT.wood },
  1: { metal: MAT.steel, wood: MAT.woodPale },
  2: { metal: rgb('#AEBAC0'), wood: rgb('#4A3B2C') },
};

export function playerSpec(family: WeaponFamily, tier: GearTier): FigureSpec {
  const look = TIER_LOOK[tier];
  const w = TIER_WEAPON[tier];
  const base: FigureSpec = {
    rig: 'humanoid', height: 1, bulk: 1,
    skin: MAT.skinTan, hair: rgb('#3E2F22'), eyes: rgb('#20262A'),
    cloth: MAT.clothGreen, clothAlt: MAT.leather, metal: MAT.iron, accent: MAT.bronze,
    seed: 3 + tier,
    ...look,
  } as FigureSpec;
  if (family === 'sword') {
    base.weaponR = { kind: tier === 2 ? 'sword' : 'sword', metal: w.metal, accent: base.accent };
    base.weaponL = { kind: 'shield', wood: tier === 2 ? rgb('#4A4038') : MAT.wood, metal: w.metal, accent: base.accent };
  } else if (family === 'bow') {
    base.weaponL = { kind: 'bow', wood: w.wood, metal: w.metal };
    base.weaponR = { kind: 'none' };
    base.armour = tier === 2 ? 'mail' : 'light';
    base.shoulders = 'pads';
  } else {
    base.weaponR = { kind: tier === 0 ? 'axe' : 'greataxe', metal: w.metal, wood: w.wood, accent: base.accent };
    base.weaponL = { kind: 'none' };
    base.bulk = 1.06;
  }
  return base;
}

export function playerEntries(): CharEntry[] {
  const out: CharEntry[] = [];
  for (const family of ['sword', 'bow', 'axe'] as WeaponFamily[]) {
    for (const tier of [0, 1, 2] as GearTier[]) {
      out.push({
        key: `player_${family}_${tier}`,
        spec: playerSpec(family, tier),
        frameW: 64, frameH: 74, scale: 56, footRatio: 0.88,
        anims: family === 'bow'
          ? ['idle', 'walk', 'run', 'attack', 'shoot', 'heavy', 'dodge', 'hit', 'death']
          : family === 'sword'
            ? ['idle', 'walk', 'run', 'attack', 'attack2', 'block', 'dodge', 'hit', 'death']
            : FIGHTER_ANIMS,
        bundle: tier === 0 ? 'core' : `gear${tier}`,
      });
    }
  }
  return out;
}

// ----------------------------------------------------------------- enemies

function humanoidEnemy(p: Partial<FigureSpec>): FigureSpec {
  return {
    rig: 'humanoid', height: 1, bulk: 1.1,
    skin: MAT.skinOrcGreen, cloth: MAT.leatherDark, clothAlt: MAT.clothGrey, trousers: rgb('#3B3B36'),
    metal: MAT.ironDark, accent: MAT.rust, eyes: rgb('#D8C46A'), armour: 'light',
    shoulders: 'none', hunch: 0.4, tusks: true, seed: 17,
    ...p,
  } as FigureSpec;
}

export const ENEMY_DEFS: CharEntry[] = [
  {
    key: 'goblin_scout', bundle: 'core', frameW: 56, frameH: 62, scale: 46, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 0.82, bulk: 1.0, skin: MAT.skinGoblin, cloth: rgb('#4A4232'), clothAlt: rgb('#5A5140'), trousers: rgb('#3E3A2E'), hunch: 0.7, weaponR: { kind: 'dagger', metal: MAT.iron }, seed: 21 }),
  },
  {
    key: 'goblin_archer', bundle: 'core', frameW: 58, frameH: 64, scale: 46, footRatio: 0.88, anims: ARCHER_ANIMS,
    spec: humanoidEnemy({ height: 0.84, bulk: 0.98, skin: MAT.skinGoblin, cloth: rgb('#414A35'), clothAlt: rgb('#54503C'), hunch: 0.6, weaponL: { kind: 'bow', wood: MAT.woodDark }, weaponR: { kind: 'none' }, seed: 23 }),
  },
  {
    key: 'goblin_sapper', bundle: 'borderland', frameW: 58, frameH: 64, scale: 46, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 0.86, bulk: 1.05, skin: MAT.skinGoblin, cloth: rgb('#4A3A2A'), clothAlt: MAT.rust, accent: MAT.flame, weaponR: { kind: 'club', wood: MAT.woodDark }, seed: 24 }),
  },
  {
    key: 'orc_raider', bundle: 'core', frameW: 62, frameH: 70, scale: 52, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 0.98, skin: MAT.skinOrcGreen, armour: 'light', shoulders: 'spikes', weaponR: { kind: 'sword', metal: MAT.rust }, seed: 31 }),
  },
  {
    key: 'orc_axe', bundle: 'core', frameW: 64, frameH: 72, scale: 52, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 1.02, bulk: 1.18, skin: MAT.skinOrcGrey, armour: 'mail', shoulders: 'spikes', helmet: 'cap', weaponR: { kind: 'axe', metal: MAT.ironDark, wood: MAT.woodDark }, seed: 33 }),
  },
  {
    key: 'orc_shield', bundle: 'core', frameW: 64, frameH: 72, scale: 52, footRatio: 0.88, anims: [...ENEMY_ANIMS, 'block'],
    spec: humanoidEnemy({ height: 1.0, bulk: 1.2, skin: MAT.skinOrcGrey, armour: 'mail', shoulders: 'plates', helmet: 'cap', weaponR: { kind: 'sword', metal: MAT.iron }, weaponL: { kind: 'shield', wood: MAT.woodDark, metal: MAT.ironDark, accent: MAT.rust }, seed: 35 }),
  },
  {
    key: 'uruk_soldier', bundle: 'borderland', frameW: 66, frameH: 76, scale: 56, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 1.1, bulk: 1.24, skin: MAT.skinUruk, hunch: 0.15, cloth: rgb('#33322E'), clothAlt: rgb('#3E3A33'), metal: rgb('#4E5153'), armour: 'plate', shoulders: 'plates', helmet: 'full', accent: MAT.clothRed, eyes: MAT.flame, weaponR: { kind: 'sword', metal: MAT.steel }, seed: 41 }),
  },
  {
    key: 'uruk_pikeman', bundle: 'borderland', frameW: 70, frameH: 78, scale: 56, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 1.08, bulk: 1.2, skin: MAT.skinUruk, hunch: 0.15, cloth: rgb('#33322E'), metal: rgb('#4E5153'), armour: 'mail', shoulders: 'plates', helmet: 'cap', accent: MAT.clothRed, weaponR: { kind: 'spear', metal: MAT.steel, wood: MAT.woodDark }, seed: 43 }),
  },
  {
    key: 'uruk_crossbow', bundle: 'borderland', frameW: 66, frameH: 76, scale: 56, footRatio: 0.88, anims: ARCHER_ANIMS,
    spec: humanoidEnemy({ height: 1.06, bulk: 1.18, skin: MAT.skinUruk, hunch: 0.2, cloth: rgb('#332E2B'), metal: rgb('#4E5153'), armour: 'mail', shoulders: 'pads', helmet: 'cap', accent: MAT.clothRed, weaponR: { kind: 'crossbow', metal: MAT.steel, wood: MAT.woodDark }, seed: 45 }),
  },
  {
    key: 'warg', bundle: 'core', frameW: 74, frameH: 62, scale: 54, footRatio: 0.9, anims: [...ENEMY_ANIMS, 'leap'],
    spec: { rig: 'quadruped', height: 1.02, bulk: 1.02, skin: MAT.furDark, fur: MAT.furDark, cloth: MAT.leatherDark, clothAlt: MAT.leather, metal: MAT.ironDark, accent: MAT.rust, eyes: MAT.flame, eyeGlow: true, seed: 51 },
  },
  {
    key: 'warg_alpha', bundle: 'core', frameW: 82, frameH: 70, scale: 60, footRatio: 0.9, anims: [...ENEMY_ANIMS, 'leap', 'roar'],
    spec: { rig: 'quadruped', height: 1.16, bulk: 1.14, skin: rgb('#4A443C'), fur: rgb('#4A443C'), cloth: MAT.leatherDark, clothAlt: MAT.leather, metal: MAT.ironDark, accent: MAT.clothRed, eyes: MAT.emberGlow, eyeGlow: true, seed: 53 },
  },
  {
    key: 'ash_hound', bundle: 'fortress', frameW: 76, frameH: 64, scale: 54, footRatio: 0.9, anims: [...ENEMY_ANIMS, 'leap'],
    spec: { rig: 'quadruped', height: 1.04, bulk: 1.05, skin: rgb('#3A3330'), fur: rgb('#3A3330'), cloth: MAT.ash, clothAlt: MAT.ash, metal: MAT.ironDark, accent: MAT.emberGlow, eyes: MAT.flame, eyeGlow: true, glowAura: MAT.emberGlow, seed: 55 },
  },
  {
    key: 'troll', bundle: 'mountain', frameW: 92, frameH: 104, scale: 74, footRatio: 0.9, anims: [...ENEMY_ANIMS, 'slam'],
    spec: humanoidEnemy({ height: 1.42, bulk: 1.6, skin: MAT.skinTroll, cloth: rgb('#4A4238'), clothAlt: rgb('#3E382F'), trousers: rgb('#453E35'), armour: 'none', shoulders: 'fur', fur: rgb('#54493C'), hunch: 0.9, tusks: true, eyes: rgb('#C7B26A'), weaponR: { kind: 'club', wood: MAT.woodDark }, seed: 61 }),
  },
  {
    key: 'cave_troll', bundle: 'mountain', frameW: 98, frameH: 110, scale: 78, footRatio: 0.9, anims: [...ENEMY_ANIMS, 'slam', 'roar'],
    spec: humanoidEnemy({ height: 1.5, bulk: 1.7, skin: rgb('#5E5A50'), cloth: rgb('#413C34'), clothAlt: rgb('#37322B'), armour: 'none', shoulders: 'spikes', metal: MAT.rust, hunch: 1.0, tusks: true, eyes: MAT.flame, weaponR: { kind: 'hammer', metal: MAT.ironDark, wood: MAT.woodDark }, seed: 63 }),
  },
  {
    key: 'spider_broodling', bundle: 'woodland', frameW: 62, frameH: 54, scale: 44, footRatio: 0.92, anims: [...ENEMY_ANIMS, 'leap'],
    spec: { rig: 'arachnid', height: 0.78, bulk: 0.92, skin: rgb('#33283A'), cloth: MAT.shadow, clothAlt: MAT.shadow, metal: MAT.ironDark, accent: MAT.venom, eyes: MAT.venom, eyeGlow: true, seed: 71 },
  },
  {
    key: 'spider_weaver', bundle: 'woodland', frameW: 78, frameH: 66, scale: 56, footRatio: 0.92, anims: [...ENEMY_ANIMS, 'shoot', 'leap'],
    spec: { rig: 'arachnid', height: 1.0, bulk: 1.05, skin: MAT.skinSpider, cloth: MAT.shadow, clothAlt: MAT.shadow, metal: MAT.ironDark, accent: rgb('#C4B77A'), eyes: rgb('#D8D0A0'), eyeGlow: true, seed: 73 },
  },
  {
    key: 'barrow_wight', bundle: 'winterland', frameW: 66, frameH: 78, scale: 56, footRatio: 0.88, anims: CASTER_ANIMS,
    spec: {
      rig: 'wraith', height: 1.1, bulk: 1, skin: MAT.skinWight, cloth: rgb('#5A6068'), clothAlt: MAT.stoneDark,
      metal: MAT.steel, accent: MAT.wardBlue, eyes: MAT.wardBlue, eyeGlow: true, helmet: 'tattered',
      cloak: null, weaponR: { kind: 'sword', metal: rgb('#9AA6AC'), glow: MAT.wardBlue }, glowAura: null, seed: 81,
    },
  },
  {
    key: 'shade', bundle: 'winterland', frameW: 64, frameH: 76, scale: 54, footRatio: 0.88, anims: CASTER_ANIMS,
    spec: {
      rig: 'wraith', height: 1.04, bulk: 0.94, skin: MAT.skinWraith, cloth: rgb('#2A2733'), clothAlt: rgb('#221F29'),
      metal: MAT.ironDark, accent: MAT.wardPurple, eyes: MAT.wardPurple, eyeGlow: true, helmet: 'tattered',
      weaponR: { kind: 'dagger', metal: rgb('#6E6878'), glow: MAT.wardPurple }, seed: 83,
    },
  },
  {
    key: 'frost_wight', bundle: 'winterland', frameW: 68, frameH: 80, scale: 57, footRatio: 0.88, anims: CASTER_ANIMS,
    spec: {
      rig: 'wraith', height: 1.12, bulk: 1.02, skin: rgb('#C6D6DA'), cloth: rgb('#6E838E'), clothAlt: rgb('#54646E'),
      metal: MAT.ice, accent: MAT.frost, eyes: MAT.frost, eyeGlow: true, helmet: 'tattered',
      weaponR: { kind: 'spear', metal: MAT.ice, wood: rgb('#5E6E74'), glow: MAT.frost }, seed: 85,
    },
  },
  {
    key: 'marauder', bundle: 'borderland', frameW: 62, frameH: 72, scale: 52, footRatio: 0.88, anims: ENEMY_ANIMS,
    spec: humanoidEnemy({ height: 1.0, bulk: 1.06, skin: MAT.skinPale, hair: rgb('#2E2620'), tusks: false, hunch: 0.1, eyes: rgb('#2A2A2A'), cloth: rgb('#4A4038'), clothAlt: MAT.leather, trousers: rgb('#453B30'), armour: 'light', shoulders: 'pads', helmet: 'cap', metal: MAT.iron, weaponR: { kind: 'sword', metal: MAT.iron }, seed: 91 }),
  },
];

// ------------------------------------------------------------------ bosses

function bossHumanoid(p: Partial<FigureSpec>): FigureSpec {
  return humanoidEnemy({ armour: 'mail', shoulders: 'plates', eyeGlow: true, ...p });
}

export interface BossEntry extends CharEntry { stage: number }

export const BOSS_DEFS: BossEntry[] = [
  { stage: 1, key: 'boss_gritch', bundle: 'farmland', frameW: 78, frameH: 86, scale: 60, footRatio: 0.89, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.14, bulk: 1.34, skin: MAT.skinOrcGrey, cloth: rgb('#4A4034'), clothAlt: rgb('#5A4A38'), trousers: rgb('#3E362C'), metal: MAT.rust, accent: BRAND.gold, helmet: 'cap', shoulders: 'spikes', hunch: 0.6, weaponR: { kind: 'club', wood: MAT.woodDark }, weaponL: { kind: 'lantern' }, seed: 101 }) },
  { stage: 2, key: 'boss_kruk', bundle: 'farmland', frameW: 78, frameH: 88, scale: 60, footRatio: 0.89, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.16, bulk: 1.3, skin: MAT.skinOrcGreen, cloth: rgb('#44392E'), clothAlt: MAT.leatherDark, metal: MAT.ironDark, accent: MAT.blood, helmet: 'none', shoulders: 'spikes', hunch: 0.55, weaponR: { kind: 'hook', metal: MAT.rust }, weaponL: { kind: 'chain', metal: MAT.ironDark }, seed: 103 }) },
  { stage: 3, key: 'boss_bellwight', bundle: 'farmland', frameW: 76, frameH: 90, scale: 60, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.22, bulk: 1.04, skin: MAT.skinWight, cloth: rgb('#4E5560'), clothAlt: MAT.stoneDark, metal: MAT.bronze, accent: MAT.wardBlue, eyes: MAT.wardBlue, eyeGlow: true, helmet: 'tattered', weaponR: { kind: 'bell', metal: MAT.bronze }, weaponL: { kind: 'staff', wood: MAT.stoneDark, accent: MAT.wardBlue, glow: MAT.wardBlue }, glowAura: MAT.wardBlue, seed: 105 } },
  { stage: 4, key: 'boss_greyfang', bundle: 'farmland', frameW: 96, frameH: 82, scale: 68, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: { rig: 'quadruped', height: 1.32, bulk: 1.24, skin: rgb('#5E5A52'), fur: rgb('#5E5A52'), cloth: MAT.leatherDark, clothAlt: MAT.leather, metal: MAT.ironDark, accent: MAT.clothRed, eyes: MAT.emberGlow, eyeGlow: true, seed: 107 } },
  { stage: 5, key: 'boss_mogrun', bundle: 'farmland', frameW: 118, frameH: 128, scale: 86, footRatio: 0.9, anims: CHAPTER_BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.72, bulk: 1.8, skin: MAT.skinTroll, cloth: rgb('#48423A'), clothAlt: rgb('#3A352E'), trousers: rgb('#433D35'), metal: MAT.ironDark, accent: MAT.emberGlow, armour: 'none', shoulders: 'spikes', helmet: 'none', hunch: 0.8, tusks: true, eyes: MAT.flame, weaponR: { kind: 'hammer', metal: MAT.ironDark, wood: MAT.woodDark, scale: 1.25 }, seed: 109 }) },
  { stage: 6, key: 'boss_ssilka', bundle: 'woodland', frameW: 100, frameH: 84, scale: 70, footRatio: 0.92, anims: BOSS_ANIMS,
    spec: { rig: 'arachnid', height: 1.3, bulk: 1.2, skin: rgb('#2E2636'), cloth: MAT.shadow, clothAlt: MAT.shadow, metal: MAT.ironDark, accent: MAT.venom, eyes: MAT.venom, eyeGlow: true, glowAura: MAT.venom, seed: 111 } },
  { stage: 7, key: 'boss_briararcher', bundle: 'woodland', frameW: 74, frameH: 84, scale: 58, footRatio: 0.88, anims: [...BOSS_ANIMS, 'shoot'],
    spec: bossHumanoid({ height: 1.1, bulk: 1.02, skin: rgb('#7E8A62'), cloth: rgb('#33452F'), clothAlt: rgb('#46523A'), trousers: rgb('#2E3A2A'), metal: MAT.bronze, accent: MAT.moss, helmet: 'hood', shoulders: 'pads', hunch: 0.2, tusks: false, eyes: rgb('#D6E07A'), cloak: rgb('#33452F'), weaponL: { kind: 'bow', wood: MAT.woodDark, metal: MAT.bronze }, weaponR: { kind: 'none' }, seed: 113 }) },
  { stage: 8, key: 'boss_norgath', bundle: 'woodland', frameW: 104, frameH: 112, scale: 78, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.52, bulk: 1.62, skin: rgb('#4E5A46'), cloth: rgb('#3A4236'), clothAlt: rgb('#2E3529'), metal: MAT.bronze, accent: MAT.moss, armour: 'none', shoulders: 'fur', fur: rgb('#3E4A38'), helmet: 'antlers', hunch: 0.9, tusks: true, eyes: MAT.wardGreen, weaponR: { kind: 'club', wood: rgb('#3E4A38') }, seed: 115 }) },
  { stage: 9, key: 'boss_hushcaller', bundle: 'woodland', frameW: 78, frameH: 92, scale: 62, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.26, bulk: 1.0, skin: MAT.skinWraith, cloth: rgb('#2E3540'), clothAlt: rgb('#242A33'), metal: MAT.steel, accent: MAT.wardPurple, eyes: MAT.wardPurple, eyeGlow: true, helmet: 'tattered', weaponR: { kind: 'staff', wood: rgb('#3A3340'), accent: MAT.wardPurple, glow: MAT.wardPurple }, glowAura: MAT.wardPurple, seed: 117 } },
  { stage: 10, key: 'boss_ashweb_queen', bundle: 'woodland', frameW: 132, frameH: 108, scale: 92, footRatio: 0.92, anims: CHAPTER_BOSS_ANIMS,
    spec: { rig: 'arachnid', height: 1.72, bulk: 1.4, skin: rgb('#241E2C'), cloth: MAT.shadow, clothAlt: MAT.shadow, metal: MAT.ironDark, accent: rgb('#D8C88A'), eyes: rgb('#F0E2A0'), eyeGlow: true, glowAura: rgb('#8A7A50'), seed: 119 } },
  { stage: 11, key: 'boss_rockjaw', bundle: 'mountain', frameW: 108, frameH: 116, scale: 80, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.56, bulk: 1.66, skin: rgb('#6A665C'), cloth: rgb('#45403A'), clothAlt: rgb('#39352F'), metal: MAT.iron, accent: MAT.stonePale, armour: 'none', shoulders: 'spikes', helmet: 'none', hunch: 0.85, tusks: true, eyes: rgb('#C7B26A'), weaponR: { kind: 'pick', metal: MAT.iron, wood: MAT.woodDark, scale: 1.2 }, seed: 121 }) },
  { stage: 12, key: 'boss_bragg', bundle: 'mountain', frameW: 84, frameH: 94, scale: 64, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.22, bulk: 1.38, skin: MAT.skinUruk, cloth: rgb('#3A312B'), clothAlt: MAT.rust, trousers: rgb('#332C26'), metal: rgb('#585048'), accent: MAT.emberGlow, armour: 'plate', shoulders: 'plates', helmet: 'full', hunch: 0.2, eyes: MAT.flame, glowAura: MAT.emberGlow, weaponR: { kind: 'anvilhammer', metal: rgb('#585048'), wood: MAT.woodDark, scale: 1.15 }, seed: 123 }) },
  { stage: 13, key: 'boss_whitefang', bundle: 'mountain', frameW: 98, frameH: 84, scale: 70, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: { rig: 'quadruped', height: 1.36, bulk: 1.2, skin: MAT.furWhite, fur: MAT.furWhite, cloth: MAT.ice, clothAlt: MAT.ice, metal: MAT.ice, accent: MAT.frost, eyes: MAT.frost, eyeGlow: true, glowAura: MAT.frost, seed: 125 } },
  { stage: 14, key: 'boss_ironecho', bundle: 'mountain', frameW: 86, frameH: 98, scale: 66, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.3, bulk: 1.34, skin: rgb('#5A5E60'), cloth: rgb('#464C4E'), clothAlt: rgb('#3A4042'), trousers: rgb('#3A4042'), metal: rgb('#7E888C'), accent: MAT.bronze, armour: 'plate', shoulders: 'plates', helmet: 'greathelm', hunch: 0, tusks: false, eyes: MAT.wardBlue, glowAura: null, weaponR: { kind: 'hammer', metal: rgb('#7E888C'), wood: MAT.ironDark }, weaponL: { kind: 'shield', wood: rgb('#4A5052'), metal: rgb('#7E888C'), accent: MAT.bronze }, seed: 127 }) },
  { stage: 15, key: 'boss_durnok', bundle: 'mountain', frameW: 124, frameH: 132, scale: 90, footRatio: 0.9, anims: CHAPTER_BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.78, bulk: 1.84, skin: rgb('#5E5548'), cloth: rgb('#3E362E'), clothAlt: rgb('#332C26'), metal: MAT.rust, accent: MAT.emberGlow, armour: 'none', shoulders: 'spikes', helmet: 'none', hunch: 0.75, tusks: true, eyes: MAT.flame, weaponR: { kind: 'chain', metal: MAT.rust, scale: 1.6 }, weaponL: { kind: 'chain', metal: MAT.rust, scale: 1.6 }, seed: 129 }) },
  { stage: 16, key: 'boss_karg', bundle: 'borderland', frameW: 84, frameH: 92, scale: 64, footRatio: 0.88, anims: [...BOSS_ANIMS, 'block'],
    spec: bossHumanoid({ height: 1.24, bulk: 1.38, skin: MAT.skinUruk, cloth: rgb('#2E2E2C'), clothAlt: rgb('#3A3734'), trousers: rgb('#2A2927'), metal: rgb('#5A6062'), accent: MAT.clothRed, armour: 'plate', shoulders: 'plates', helmet: 'full', hunch: 0.05, eyes: MAT.flame, weaponR: { kind: 'sword', metal: MAT.steel, accent: MAT.clothRed }, weaponL: { kind: 'shield', wood: rgb('#4A3A32'), metal: rgb('#5A6062'), accent: MAT.clothRed }, seed: 131 }) },
  { stage: 17, key: 'boss_uzg', bundle: 'borderland', frameW: 82, frameH: 90, scale: 62, footRatio: 0.88, anims: [...BOSS_ANIMS, 'shoot'],
    spec: bossHumanoid({ height: 1.18, bulk: 1.28, skin: MAT.skinUruk, cloth: rgb('#3E3730'), clothAlt: MAT.rust, metal: rgb('#5A5450'), accent: MAT.flame, armour: 'mail', shoulders: 'pads', helmet: 'cap', hunch: 0.3, eyes: MAT.flame, weaponR: { kind: 'crossbow', metal: MAT.steel, wood: MAT.woodDark, scale: 1.25 }, seed: 133 }) },
  { stage: 18, key: 'boss_wardrummer', bundle: 'borderland', frameW: 86, frameH: 96, scale: 66, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.28, bulk: 1.42, skin: MAT.skinOrcGrey, cloth: rgb('#45332C'), clothAlt: MAT.clothRed, trousers: rgb('#3A2C26'), metal: MAT.bronze, accent: MAT.clothRed, armour: 'mail', shoulders: 'fur', fur: rgb('#4A3B30'), helmet: 'horned', hunch: 0.4, tusks: true, eyes: MAT.flame, weaponR: { kind: 'hammer', metal: MAT.bronze, wood: MAT.woodDark }, weaponL: { kind: 'banner', wood: MAT.woodDark, accent: MAT.clothRed }, seed: 135 }) },
  { stage: 19, key: 'boss_cinderknight', bundle: 'borderland', frameW: 88, frameH: 100, scale: 68, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.32, bulk: 1.3, skin: rgb('#3A3330'), cloth: rgb('#38302C'), clothAlt: rgb('#2E2825'), trousers: rgb('#2E2825'), metal: rgb('#6E5A4A'), accent: MAT.emberGlow, armour: 'plate', shoulders: 'plates', helmet: 'greathelm', hunch: 0, tusks: false, eyes: MAT.flame, glowAura: MAT.emberGlow, cloak: rgb('#5A3128'), weaponR: { kind: 'greatsword', metal: rgb('#8E7058'), accent: MAT.flame, glow: MAT.emberGlow }, seed: 137 }) },
  { stage: 20, key: 'boss_varzug', bundle: 'borderland', frameW: 94, frameH: 106, scale: 72, footRatio: 0.88, anims: CHAPTER_BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.42, bulk: 1.48, skin: MAT.skinUruk, cloth: rgb('#2A2A28'), clothAlt: MAT.clothRed, trousers: rgb('#26262A'), metal: rgb('#646A6C'), accent: MAT.clothRed, armour: 'plate', shoulders: 'spikes', helmet: 'horned', hunch: 0, eyes: MAT.flame, cloak: MAT.clothRed, cloakLength: 0.5, weaponR: { kind: 'greatsword', metal: MAT.steel, accent: MAT.clothRed }, weaponL: { kind: 'banner', wood: MAT.woodDark, accent: MAT.clothRed }, seed: 139 }) },
  { stage: 21, key: 'boss_glasswight', bundle: 'winterland', frameW: 80, frameH: 94, scale: 62, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.26, bulk: 1.0, skin: rgb('#CEDCE2'), cloth: rgb('#6E7E8A'), clothAlt: rgb('#56646E'), metal: MAT.ice, accent: MAT.frost, eyes: MAT.frost, eyeGlow: true, helmet: 'tattered', glowAura: MAT.frost, weaponR: { kind: 'sword', metal: MAT.ice, glow: MAT.frost }, weaponL: { kind: 'dagger', metal: MAT.ice, glow: MAT.frost }, seed: 141 } },
  { stage: 22, key: 'boss_riftkeeper', bundle: 'winterland', frameW: 82, frameH: 96, scale: 64, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.3, bulk: 1.04, skin: rgb('#2A2530'), cloth: rgb('#33303E'), clothAlt: rgb('#26242E'), metal: MAT.ironDark, accent: MAT.wardPurple, eyes: MAT.wardPurple, eyeGlow: true, helmet: 'crown', glowAura: MAT.wardPurple, weaponR: { kind: 'staff', wood: rgb('#3A3340'), accent: MAT.wardPurple, glow: MAT.wardPurple, scale: 1.15 }, seed: 143 } },
  { stage: 23, key: 'boss_paleflame', bundle: 'winterland', frameW: 84, frameH: 98, scale: 64, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.3, bulk: 1.02, skin: rgb('#D2DCE0'), cloth: rgb('#5E6E7A'), clothAlt: rgb('#46545E'), metal: MAT.frost, accent: rgb('#BFE8F5'), eyes: rgb('#DFF4FA'), eyeGlow: true, helmet: 'tattered', glowAura: rgb('#9FD8EA'), weaponR: { kind: 'staff', wood: rgb('#5A6A72'), accent: rgb('#CFEEF8'), glow: rgb('#CFEEF8'), scale: 1.1 }, seed: 145 } },
  { stage: 24, key: 'boss_oathbreaker', bundle: 'winterland', frameW: 132, frameH: 140, scale: 96, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.9, bulk: 1.86, skin: rgb('#7A7468'), cloth: rgb('#4A443A'), clothAlt: rgb('#3A352E'), trousers: rgb('#453F36'), metal: MAT.rust, accent: MAT.bronze, armour: 'none', shoulders: 'plates', helmet: 'none', hunch: 0.6, tusks: false, hair: rgb('#3A352E'), eyes: rgb('#D6C078'), weaponR: { kind: 'morningstar', metal: MAT.rust, wood: MAT.woodDark, scale: 1.3 }, seed: 147 }) },
  { stage: 25, key: 'boss_nameless_nazgul', bundle: 'winterland', frameW: 98, frameH: 116, scale: 76, footRatio: 0.88, anims: CHAPTER_BOSS_ANIMS,
    spec: { rig: 'wraith', height: 1.54, bulk: 1.12, skin: rgb('#141118'), cloth: rgb('#17151C'), clothAlt: rgb('#100E14'), metal: rgb('#4A4650'), accent: rgb('#7AB8CE'), eyes: rgb('#8FD4E8'), eyeGlow: true, helmet: 'crown', cloak: rgb('#17151C'), cloakLength: 0.56, glowAura: rgb('#2A3A48'), weaponR: { kind: 'greatsword', metal: rgb('#565060'), glow: rgb('#7AB8CE') }, seed: 149 } },
  { stage: 26, key: 'boss_gruk', bundle: 'fortress', frameW: 84, frameH: 92, scale: 64, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.2, bulk: 1.34, skin: MAT.skinOrcGrey, cloth: rgb('#413630'), clothAlt: MAT.rust, trousers: rgb('#37302A'), metal: MAT.ironDark, accent: MAT.flame, armour: 'mail', shoulders: 'pads', helmet: 'cap', hunch: 0.4, tusks: true, eyes: MAT.flame, weaponR: { kind: 'club', wood: MAT.woodDark }, weaponL: { kind: 'torch' }, seed: 151 }) },
  { stage: 27, key: 'boss_cindermaw', bundle: 'fortress', frameW: 108, frameH: 92, scale: 76, footRatio: 0.9, anims: BOSS_ANIMS,
    spec: { rig: 'quadruped', height: 1.48, bulk: 1.32, skin: rgb('#39302C'), fur: rgb('#39302C'), cloth: MAT.ash, clothAlt: MAT.ash, metal: MAT.ironDark, accent: MAT.emberGlow, eyes: MAT.flameCore, eyeGlow: true, glowAura: MAT.emberGlow, seed: 153 } },
  { stage: 28, key: 'boss_castellan', bundle: 'fortress', frameW: 92, frameH: 104, scale: 70, footRatio: 0.88, anims: BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.38, bulk: 1.36, skin: rgb('#2E2C30'), cloth: rgb('#25252B'), clothAlt: rgb('#1E1E24'), trousers: rgb('#212128'), metal: rgb('#565C60'), accent: MAT.goldMetal, armour: 'plate', shoulders: 'plates', helmet: 'greathelm', hunch: 0, tusks: false, eyes: MAT.emberGlow, cloak: rgb('#2A2128'), glowAura: null, weaponR: { kind: 'greatsword', metal: rgb('#6E767A'), accent: MAT.goldMetal }, seed: 155 }) },
  { stage: 29, key: 'boss_oaththief', bundle: 'fortress', frameW: 86, frameH: 100, scale: 68, footRatio: 0.88, anims: CASTER_BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.3, bulk: 1.16, skin: rgb('#8A7E6E'), cloth: rgb('#3E3644'), clothAlt: rgb('#54485C'), trousers: rgb('#322C38'), metal: MAT.goldMetal, accent: MAT.wardPurple, armour: 'mail', shoulders: 'pads', helmet: 'hood', hunch: 0.15, tusks: false, eyes: MAT.wardPurple, eyeGlow: true, cloak: rgb('#3E3644'), glowAura: MAT.wardPurple, weaponR: { kind: 'wand', wood: rgb('#3A3340'), accent: MAT.goldMetal, glow: MAT.wardPurple }, weaponL: { kind: 'dagger', metal: MAT.goldMetal, glow: MAT.wardPurple }, seed: 157 }) },
  { stage: 30, key: 'boss_ashen_regent', bundle: 'fortress', frameW: 112, frameH: 130, scale: 84, footRatio: 0.88, anims: CHAPTER_BOSS_ANIMS,
    spec: bossHumanoid({ height: 1.66, bulk: 1.3, skin: rgb('#6E6258'), cloth: rgb('#2E2A2E'), clothAlt: rgb('#3E3438'), trousers: rgb('#2A2629'), metal: MAT.goldMetal, accent: MAT.emberGlow, armour: 'plate', shoulders: 'spikes', helmet: 'crown', hunch: 0, tusks: false, hair: rgb('#3A3336'), eyes: MAT.flameCore, eyeGlow: true, cloak: rgb('#4A2C24'), cloakLength: 0.58, glowAura: MAT.emberGlow, weaponR: { kind: 'greatsword', metal: rgb('#8E7A5A'), accent: MAT.emberGlow, glow: MAT.emberGlow }, weaponL: { kind: 'staff', wood: rgb('#3A3134'), accent: MAT.goldMetal, glow: MAT.emberGlow }, seed: 159 }) },
];

// -------------------------------------------------------------- residents

function villager(p: Partial<FigureSpec>): FigureSpec {
  return {
    rig: 'humanoid', height: 0.98, bulk: 1,
    skin: MAT.skinPale, hair: rgb('#43352A'), eyes: rgb('#2A2A2A'),
    cloth: MAT.clothCream, clothAlt: MAT.leather, trousers: rgb('#4E4234'),
    metal: MAT.iron, accent: MAT.bronze, armour: 'none', shoulders: 'none',
    hunch: 0, tusks: false, seed: 201,
    ...p,
  } as FigureSpec;
}

export const RESIDENT_DEFS: CharEntry[] = [
  { key: 'npc_smith', bundle: 'core', frameW: 58, frameH: 68, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ skin: MAT.skinTan, cloth: rgb('#5A4438'), clothAlt: MAT.leatherDark, trousers: rgb('#3E3227'), bulk: 1.12, weaponR: { kind: 'anvilhammer', metal: MAT.iron, wood: MAT.woodDark, scale: 0.7 }, hair: rgb('#2E2620'), seed: 203 }) },
  { key: 'npc_scout', bundle: 'core', frameW: 58, frameH: 68, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ cloth: rgb('#3B4B38'), clothAlt: rgb('#4E4434'), cloak: rgb('#46553F'), helmet: 'hood', weaponL: { kind: 'bow', wood: MAT.woodDark }, hair: rgb('#54402C'), seed: 205 }) },
  { key: 'npc_gardener', bundle: 'core', frameW: 58, frameH: 68, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ cloth: rgb('#5E6A42'), clothAlt: rgb('#6E6046'), trousers: rgb('#4A4430'), hair: rgb('#6E6250'), seed: 207 }) },
  { key: 'npc_healer', bundle: 'core', frameW: 58, frameH: 68, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ cloth: MAT.clothCream, clothAlt: rgb('#8A7E60'), cloak: rgb('#C6B792'), trousers: rgb('#6E6450'), weaponR: { kind: 'lantern' }, hair: rgb('#8A7A62'), seed: 209 }) },
  { key: 'npc_mason', bundle: 'core', frameW: 60, frameH: 70, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ skin: MAT.skinTan, cloth: rgb('#6A6458'), clothAlt: rgb('#54503E'), trousers: rgb('#454136'), bulk: 1.1, weaponR: { kind: 'pick', metal: MAT.iron, wood: MAT.woodDark, scale: 0.7 }, hair: rgb('#3A3129'), seed: 211 }) },
  { key: 'npc_chronicler', bundle: 'core', frameW: 58, frameH: 68, scale: 50, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ cloth: rgb('#3E4652'), clothAlt: rgb('#54596B'), cloak: rgb('#46506B'), helmet: 'hood', weaponR: { kind: 'lantern' }, hair: rgb('#6E6A62'), seed: 213 }) },
  { key: 'npc_survivor', bundle: 'core', frameW: 56, frameH: 66, scale: 48, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ height: 0.94, cloth: rgb('#6A5F4C'), clothAlt: rgb('#54493A'), trousers: rgb('#453D30'), tattered: true, hair: rgb('#4E4236'), seed: 215 }) },
  { key: 'npc_child', bundle: 'core', frameW: 48, frameH: 56, scale: 40, footRatio: 0.88, anims: NPC_ANIMS,
    spec: villager({ height: 0.7, bulk: 0.94, cloth: rgb('#7A6A4E'), clothAlt: rgb('#5E523E'), hair: rgb('#6E5A3E'), seed: 217 }) },
];

export function allCharacters(): CharEntry[] {
  return [...playerEntries(), ...ENEMY_DEFS, ...BOSS_DEFS, ...RESIDENT_DEFS];
}

export const _unused = { shade, mix };
