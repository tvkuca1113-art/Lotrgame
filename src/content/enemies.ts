import type { EnemyDef } from '@/types';

/**
 * Enemy families. Behaviour archetypes are implemented once in
 * src/entities/enemy.ts; the differences that matter to the player are reach,
 * telegraph length, poise and how each family approaches.
 *
 * Health and damage here are the stage-1 baseline. Stages scale them through
 * `scaleEnemy()` so an early region keeps its original difficulty when a
 * stronger player returns.
 */
export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'goblin_scout', art: 'goblin_scout', nameKey: 'enemy.goblin_scout', family: 'goblin',
    health: 34, damage: 7, speed: 104, reach: 46, telegraph: 420, recovery: 380,
    behaviour: 'melee', xp: 8, gold: [3, 7], poise: 6, scale: 0.92,
  },
  {
    id: 'goblin_archer', art: 'goblin_archer', nameKey: 'enemy.goblin_archer', family: 'goblin',
    health: 28, damage: 8, speed: 86, reach: 330, telegraph: 620, recovery: 620,
    behaviour: 'ranged', xp: 10, gold: [4, 8], poise: 4, projectile: 'arrow', scale: 0.92,
  },
  {
    id: 'goblin_sapper', art: 'goblin_sapper', nameKey: 'enemy.goblin_sapper', family: 'goblin',
    health: 42, damage: 12, speed: 92, reach: 120, telegraph: 760, recovery: 700,
    behaviour: 'bomber', xp: 14, gold: [6, 12], poise: 8, projectile: 'bomb', scale: 0.95,
  },
  {
    id: 'orc_raider', art: 'orc_raider', nameKey: 'enemy.orc_raider', family: 'orc',
    health: 56, damage: 10, speed: 92, reach: 56, telegraph: 520, recovery: 440,
    behaviour: 'melee', xp: 13, gold: [5, 10], poise: 12,
  },
  {
    id: 'orc_axe', art: 'orc_axe', nameKey: 'enemy.orc_axe', family: 'orc',
    health: 78, damage: 15, speed: 80, reach: 66, telegraph: 760, recovery: 680,
    behaviour: 'heavy', xp: 18, gold: [7, 14], poise: 20, armour: 2,
  },
  {
    id: 'orc_shield', art: 'orc_shield', nameKey: 'enemy.orc_shield', family: 'orc',
    health: 86, damage: 11, speed: 74, reach: 58, telegraph: 560, recovery: 620,
    behaviour: 'shield', xp: 21, gold: [8, 15], poise: 28, armour: 5,
  },
  {
    id: 'uruk_soldier', art: 'uruk_soldier', nameKey: 'enemy.uruk_soldier', family: 'uruk',
    health: 120, damage: 17, speed: 94, reach: 62, telegraph: 560, recovery: 480,
    behaviour: 'melee', xp: 30, gold: [11, 20], poise: 26, armour: 5,
  },
  {
    id: 'uruk_pikeman', art: 'uruk_pikeman', nameKey: 'enemy.uruk_pikeman', family: 'uruk',
    health: 108, damage: 19, speed: 86, reach: 104, telegraph: 700, recovery: 620,
    behaviour: 'heavy', xp: 32, gold: [11, 21], poise: 24, armour: 4,
  },
  {
    id: 'uruk_crossbow', art: 'uruk_crossbow', nameKey: 'enemy.uruk_crossbow', family: 'uruk',
    health: 92, damage: 20, speed: 78, reach: 400, telegraph: 820, recovery: 900,
    behaviour: 'ranged', xp: 32, gold: [12, 22], poise: 16, armour: 3, projectile: 'bolt',
  },
  {
    id: 'marauder', art: 'marauder', nameKey: 'enemy.marauder', family: 'human',
    health: 96, damage: 15, speed: 102, reach: 58, telegraph: 480, recovery: 420,
    behaviour: 'flanker', xp: 27, gold: [12, 24], poise: 14, armour: 2,
  },
  {
    id: 'warg', art: 'warg', nameKey: 'enemy.warg', family: 'warg',
    health: 62, damage: 12, speed: 138, reach: 52, telegraph: 440, recovery: 520,
    behaviour: 'flanker', xp: 17, gold: [5, 11], poise: 10,
  },
  {
    id: 'warg_alpha', art: 'warg_alpha', nameKey: 'enemy.warg_alpha', family: 'warg',
    health: 128, damage: 19, speed: 146, reach: 58, telegraph: 480, recovery: 560,
    behaviour: 'flanker', xp: 38, gold: [14, 26], poise: 22, elite: true,
  },
  {
    id: 'ash_hound', art: 'ash_hound', nameKey: 'enemy.ash_hound', family: 'beast',
    health: 118, damage: 21, speed: 142, reach: 54, telegraph: 460, recovery: 520,
    behaviour: 'flanker', xp: 40, gold: [14, 27], poise: 18,
  },
  {
    id: 'troll', art: 'troll', nameKey: 'enemy.troll', family: 'troll',
    health: 230, damage: 26, speed: 62, reach: 86, telegraph: 900, recovery: 980,
    behaviour: 'heavy', xp: 62, gold: [20, 38], poise: 48, armour: 6, elite: true,
  },
  {
    id: 'cave_troll', art: 'cave_troll', nameKey: 'enemy.cave_troll', family: 'troll',
    health: 310, damage: 32, speed: 58, reach: 94, telegraph: 980, recovery: 1050,
    behaviour: 'heavy', xp: 82, gold: [26, 48], poise: 58, armour: 8, elite: true,
  },
  {
    id: 'spider_broodling', art: 'spider_broodling', nameKey: 'enemy.spider_broodling', family: 'spider',
    health: 30, damage: 8, speed: 122, reach: 46, telegraph: 400, recovery: 420,
    behaviour: 'flanker', xp: 9, gold: [3, 6], poise: 5, scale: 0.9,
  },
  {
    id: 'spider_weaver', art: 'spider_weaver', nameKey: 'enemy.spider_weaver', family: 'spider',
    health: 74, damage: 13, speed: 96, reach: 320, telegraph: 680, recovery: 700,
    behaviour: 'ranged', xp: 24, gold: [8, 16], poise: 14, projectile: 'web',
  },
  {
    id: 'barrow_wight', art: 'barrow_wight', nameKey: 'enemy.barrow_wight', family: 'wight',
    health: 96, damage: 16, speed: 72, reach: 300, telegraph: 820, recovery: 760,
    behaviour: 'caster', xp: 29, gold: [10, 20], poise: 18, projectile: 'shade_bolt',
  },
  {
    id: 'shade', art: 'shade', nameKey: 'enemy.shade', family: 'wight',
    health: 82, damage: 18, speed: 116, reach: 56, telegraph: 460, recovery: 440,
    behaviour: 'flanker', xp: 31, gold: [11, 21], poise: 10,
  },
  {
    id: 'frost_wight', art: 'frost_wight', nameKey: 'enemy.frost_wight', family: 'wight',
    health: 132, damage: 21, speed: 80, reach: 300, telegraph: 860, recovery: 820,
    behaviour: 'caster', xp: 42, gold: [15, 28], poise: 24, armour: 4, projectile: 'frost_bolt',
  },
] as const;

export function enemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}

/**
 * Stage scaling. Region difficulty is fixed at authoring time so revisiting an
 * early stage at level 30 feels like power growth, not a treadmill.
 */
export function scaleEnemy(def: EnemyDef, stage: number): EnemyDef {
  const k = 1 + 0.115 * (stage - 1);
  const d = 1 + 0.085 * (stage - 1);
  return {
    ...def,
    health: Math.round(def.health * k),
    damage: Math.round(def.damage * d),
    xp: Math.round(def.xp * (1 + 0.1 * (stage - 1))),
    gold: [Math.round(def.gold[0] * (1 + 0.09 * (stage - 1))), Math.round(def.gold[1] * (1 + 0.09 * (stage - 1)))],
  };
}

export const PROJECTILES: Record<string, { speed: number; life: number; radius: number; vfx: string; piercing?: boolean }> = {
  arrow: { speed: 300, life: 2.2, radius: 6, vfx: 'hit_spark' },
  bolt: { speed: 380, life: 2.2, radius: 7, vfx: 'hit_spark' },
  bomb: { speed: 200, life: 1.6, radius: 10, vfx: 'impact' },
  web: { speed: 250, life: 2.0, radius: 9, vfx: 'venom_bolt' },
  shade_bolt: { speed: 230, life: 2.4, radius: 9, vfx: 'dusk_blink' },
  frost_bolt: { speed: 250, life: 2.4, radius: 9, vfx: 'freeze_shatter' },
  player_arrow: { speed: 460, life: 1.8, radius: 6, vfx: 'hit_spark' },
  venom: { speed: 340, life: 2.0, radius: 8, vfx: 'venom_bolt' },
  boss_bolt: { speed: 300, life: 2.6, radius: 10, vfx: 'hit_spark' },
};
