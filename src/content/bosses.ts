import type { BossDef } from '@/types';

/**
 * Boss roster. Every stage ends with one; stages 5/10/15/20/25/30 are the six
 * chapter bosses. Health scales with the stage, base hit damage scales with the
 * player's expected max health so a fair hit always costs a similar share of
 * the bar, and every attack carries an explicit telegraph, active and recovery
 * window. `hook` names a mechanic implemented in src/entities/boss.ts.
 *
 * Every boss is beatable with the base combat kit: no attack is unavoidable,
 * no stun is permanent, and no phase grants unexplained invulnerability.
 */

/** Boss health: a steady curve with a step up for the six chapter bosses. */
export function bossHealth(stage: number, mult: number): number {
  return Math.round(320 * (1 + 0.42 * (stage - 1)) * mult);
}

/**
 * Base hit damage. Expected player max health at the stage's recommended level
 * is 100 + 8 * (level - 1); a standard boss hit costs about 18% of that.
 */
export function bossBaseDamage(stage: number): number {
  const expectedLevel = Math.min(30, stage + 1);
  const expectedHealth = 100 + 8 * (expectedLevel - 1);
  return Math.round(expectedHealth * 0.18);
}

export const BOSSES: readonly BossDef[] = [
  {
    id: 'boss_gritch',
    stage: 1,
    art: 'boss_gritch',
    nameKey: 'boss.boss_gritch.name',
    titleKey: 'boss.boss_gritch.title',
    introKey: 'boss.boss_gritch.intro',
    defeatKey: 'boss.boss_gritch.defeat',
    health: bossHealth(1, 1.0),
    armour: 0,
    poise: 20,
    scale: 1.0,
    arena: 'road_toll',
    attacks: [
      {
        id: 'swing1',
        anim: 'attack',
        telegraph: 620,
        active: 140,
        recovery: 420,
        damage: 1.0,
        shape: 'arc',
        range: 86,
        cooldown: 2600,
        band: [0, 110],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'swing2',
        anim: 'attack2',
        telegraph: 420,
        active: 140,
        recovery: 760,
        damage: 1.0,
        shape: 'arc',
        range: 92,
        cooldown: 2600,
        band: [0, 120],
        arc: 1.7,
        hook: 'combo_follow',
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'overhead',
        anim: 'heavy',
        telegraph: 900,
        active: 160,
        recovery: 980,
        damage: 1.7,
        shape: 'circle',
        range: 96,
        cooldown: 7000,
        band: [0, 130],
        hook: 'punishable',
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['swing1', 'swing2', 'overhead'],
        moveSpeed: 62,
        aggression: [900, 1500],
        introKey: 'boss.boss_gritch.intro'
      }
    ],
    tipKey: 'stage.1.test',
    trophyArt: 0
  },
  {
    id: 'boss_kruk',
    stage: 2,
    art: 'boss_kruk',
    nameKey: 'boss.boss_kruk.name',
    titleKey: 'boss.boss_kruk.title',
    introKey: 'boss.boss_kruk.intro',
    defeatKey: 'boss.boss_kruk.defeat',
    health: bossHealth(2, 1.0),
    armour: 0,
    poise: 22,
    scale: 1.0,
    arena: 'mill_yard',
    attacks: [
      {
        id: 'hook',
        anim: 'attack',
        telegraph: 780,
        active: 170,
        recovery: 900,
        damage: 1.2,
        shape: 'line',
        range: 260,
        cooldown: 5200,
        band: [110, 280],
        hook: 'pull',
        vfx: 'tele_line',
        sfx: 'sfx_chain'
      },
      {
        id: 'sweep',
        anim: 'attack2',
        telegraph: 520,
        active: 150,
        recovery: 520,
        damage: 0.9,
        shape: 'arc',
        range: 96,
        cooldown: 3000,
        band: [0, 120],
        arc: 2.2,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'lunge',
        anim: 'heavy',
        telegraph: 760,
        active: 220,
        recovery: 1050,
        damage: 1.5,
        shape: 'line',
        range: 190,
        cooldown: 6400,
        band: [90, 220],
        hook: 'committed',
        vfx: 'tele_line',
        sfx: 'sfx_slam'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['hook', 'sweep', 'lunge'],
        moveSpeed: 66,
        aggression: [850, 1400],
        introKey: 'boss.boss_kruk.intro'
      }
    ],
    tipKey: 'stage.2.test',
    trophyArt: 0
  },
  {
    id: 'boss_bellwight',
    stage: 3,
    art: 'boss_bellwight',
    nameKey: 'boss.boss_bellwight.name',
    titleKey: 'boss.boss_bellwight.title',
    introKey: 'boss.boss_bellwight.intro',
    defeatKey: 'boss.boss_bellwight.defeat',
    health: bossHealth(3, 1.05),
    armour: 2,
    poise: 26,
    scale: 1.0,
    arena: 'barrow_ring',
    attacks: [
      {
        id: 'toll',
        anim: 'cast',
        telegraph: 1100,
        active: 1500,
        recovery: 900,
        damage: 1.1,
        shape: 'ring',
        range: 420,
        cooldown: 6200,
        band: [0, 420],
        hook: 'ring_gaps',
        vfx: 'tele_ring',
        sfx: 'sfx_bell'
      },
      {
        id: 'double_toll',
        anim: 'cast',
        telegraph: 1200,
        active: 2200,
        recovery: 1000,
        damage: 1.1,
        shape: 'ring',
        range: 460,
        cooldown: 9000,
        band: [0, 460],
        hook: 'ring_gaps_double',
        vfx: 'tele_ring',
        sfx: 'sfx_bell'
      },
      {
        id: 'grasp',
        anim: 'attack',
        telegraph: 600,
        active: 150,
        recovery: 560,
        damage: 0.9,
        shape: 'arc',
        range: 84,
        cooldown: 3400,
        band: [0, 110],
        arc: 1.6,
        vfx: 'slash_light',
        sfx: 'sfx_wight'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['toll', 'grasp'],
        moveSpeed: 54,
        aggression: [1100, 1700],
        introKey: 'boss.boss_bellwight.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['toll', 'double_toll', 'grasp'],
        moveSpeed: 58,
        aggression: [900, 1400],
        arena: 'bells_lit'
      }
    ],
    tipKey: 'stage.3.test',
    trophyArt: 0
  },
  {
    id: 'boss_greyfang',
    stage: 4,
    art: 'boss_greyfang',
    nameKey: 'boss.boss_greyfang.name',
    titleKey: 'boss.boss_greyfang.title',
    introKey: 'boss.boss_greyfang.intro',
    defeatKey: 'boss.boss_greyfang.defeat',
    health: bossHealth(4, 1.05),
    armour: 0,
    poise: 24,
    scale: 1.0,
    arena: 'wolf_pass',
    attacks: [
      {
        id: 'charge',
        anim: 'run',
        telegraph: 820,
        active: 420,
        recovery: 1000,
        damage: 1.4,
        shape: 'line',
        range: 340,
        cooldown: 4800,
        band: [140, 380],
        hook: 'committed_charge',
        vfx: 'tele_line',
        sfx: 'sfx_warg_charge'
      },
      {
        id: 'bite',
        anim: 'attack',
        telegraph: 480,
        active: 130,
        recovery: 480,
        damage: 0.9,
        shape: 'arc',
        range: 82,
        cooldown: 2400,
        band: [0, 100],
        arc: 1.3,
        vfx: 'slash_light',
        sfx: 'sfx_bite'
      },
      {
        id: 'pounce',
        anim: 'attack2',
        telegraph: 700,
        active: 180,
        recovery: 820,
        damage: 1.2,
        shape: 'circle',
        range: 120,
        cooldown: 6000,
        band: [120, 260],
        hook: 'leap',
        vfx: 'tele_circle',
        sfx: 'sfx_warg_charge'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['charge', 'bite', 'pounce'],
        moveSpeed: 86,
        aggression: [800, 1300],
        introKey: 'boss.boss_greyfang.intro'
      }
    ],
    tipKey: 'stage.4.test',
    trophyArt: 0
  },
  {
    id: 'boss_mogrun',
    stage: 5,
    art: 'boss_mogrun',
    nameKey: 'boss.boss_mogrun.name',
    titleKey: 'boss.boss_mogrun.title',
    introKey: 'boss.boss_mogrun.intro',
    defeatKey: 'boss.boss_mogrun.defeat',
    health: bossHealth(5, 1.55),
    armour: 3,
    poise: 44,
    scale: 1.25,
    arena: 'rootbound_pillars',
    attacks: [
      {
        id: 'smash',
        anim: 'heavy',
        telegraph: 920,
        active: 200,
        recovery: 1100,
        damage: 1.5,
        shape: 'circle',
        range: 122,
        cooldown: 5200,
        band: [0, 150],
        hook: 'pillar_bait',
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'sweep',
        anim: 'attack',
        telegraph: 640,
        active: 170,
        recovery: 620,
        damage: 1.0,
        shape: 'arc',
        range: 118,
        cooldown: 3200,
        band: [0, 140],
        arc: 2.0,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'boulder',
        anim: 'attack2',
        telegraph: 980,
        active: 200,
        recovery: 900,
        damage: 1.2,
        shape: 'projectile',
        range: 420,
        cooldown: 6500,
        band: [180, 440],
        hook: 'throw',
        vfx: 'tele_circle',
        sfx: 'sfx_throw'
      },
      {
        id: 'quake',
        anim: 'slam',
        telegraph: 1150,
        active: 260,
        recovery: 1250,
        damage: 1.8,
        shape: 'ring',
        range: 300,
        cooldown: 9000,
        band: [0, 300],
        hook: 'shockwave',
        vfx: 'tele_ring',
        sfx: 'sfx_quake'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['smash', 'sweep', 'boulder'],
        moveSpeed: 54,
        aggression: [1000, 1600],
        introKey: 'boss.boss_mogrun.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['smash', 'sweep', 'boulder', 'quake'],
        moveSpeed: 62,
        aggression: [800, 1300],
        arena: 'pillars_broken',
        introKey: 'boss.boss_mogrun.phase2'
      }
    ],
    tipKey: 'stage.5.test',
    trophyArt: 1
  },
  {
    id: 'boss_ssilka',
    stage: 6,
    art: 'boss_ssilka',
    nameKey: 'boss.boss_ssilka.name',
    titleKey: 'boss.boss_ssilka.title',
    introKey: 'boss.boss_ssilka.intro',
    defeatKey: 'boss.boss_ssilka.defeat',
    health: bossHealth(6, 1.1),
    armour: 1,
    poise: 28,
    scale: 1.05,
    arena: 'web_hollow',
    attacks: [
      {
        id: 'spit',
        anim: 'shoot',
        telegraph: 700,
        active: 160,
        recovery: 700,
        damage: 1.0,
        shape: 'projectile',
        range: 380,
        cooldown: 4200,
        band: [140, 400],
        hook: 'web_slow',
        vfx: 'venom_bolt',
        sfx: 'sfx_spit'
      },
      {
        id: 'legsweep',
        anim: 'attack',
        telegraph: 560,
        active: 150,
        recovery: 560,
        damage: 0.95,
        shape: 'arc',
        range: 104,
        cooldown: 3000,
        band: [0, 120],
        arc: 2.4,
        vfx: 'slash_light',
        sfx: 'sfx_chitter'
      },
      {
        id: 'brood',
        anim: 'cast',
        telegraph: 1000,
        active: 200,
        recovery: 1100,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 11000,
        band: [0, 600],
        hook: 'summon_brood',
        vfx: 'root_patch',
        sfx: 'sfx_chitter'
      },
      {
        id: 'pounce',
        anim: 'attack2',
        telegraph: 740,
        active: 170,
        recovery: 780,
        damage: 1.25,
        shape: 'circle',
        range: 130,
        cooldown: 6800,
        band: [120, 280],
        hook: 'leap',
        vfx: 'tele_circle',
        sfx: 'sfx_chitter'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['spit', 'legsweep', 'brood'],
        moveSpeed: 66,
        aggression: [900, 1450],
        introKey: 'boss.boss_ssilka.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.45
        },
        attacks: ['spit', 'legsweep', 'brood', 'pounce'],
        moveSpeed: 72,
        aggression: [750, 1250],
        arena: 'webs_thick'
      }
    ],
    tipKey: 'stage.6.test',
    trophyArt: 0
  },
  {
    id: 'boss_briararcher',
    stage: 7,
    art: 'boss_briararcher',
    nameKey: 'boss.boss_briararcher.name',
    titleKey: 'boss.boss_briararcher.title',
    introKey: 'boss.boss_briararcher.intro',
    defeatKey: 'boss.boss_briararcher.defeat',
    health: bossHealth(7, 1.05),
    armour: 0,
    poise: 20,
    scale: 1.0,
    arena: 'waystation',
    attacks: [
      {
        id: 'aimed',
        anim: 'shoot',
        telegraph: 900,
        active: 120,
        recovery: 720,
        damage: 1.35,
        shape: 'line',
        range: 520,
        cooldown: 3600,
        band: [160, 560],
        hook: 'aimed_lane',
        vfx: 'tele_line',
        sfx: 'sfx_bow'
      },
      {
        id: 'volley',
        anim: 'shoot',
        telegraph: 1150,
        active: 180,
        recovery: 900,
        damage: 0.9,
        shape: 'line',
        range: 520,
        cooldown: 7200,
        band: [160, 560],
        hook: 'volley_lanes',
        vfx: 'tele_line',
        sfx: 'sfx_bow',
        projectiles: 3
      },
      {
        id: 'kick',
        anim: 'attack',
        telegraph: 420,
        active: 130,
        recovery: 520,
        damage: 0.8,
        shape: 'arc',
        range: 78,
        cooldown: 3000,
        band: [0, 96],
        arc: 1.4,
        hook: 'disengage',
        vfx: 'slash_light',
        sfx: 'sfx_swing_light'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['aimed', 'volley', 'kick'],
        moveSpeed: 74,
        aggression: [850, 1350],
        introKey: 'boss.boss_briararcher.intro'
      }
    ],
    tipKey: 'stage.7.test',
    trophyArt: 0
  },
  {
    id: 'boss_norgath',
    stage: 8,
    art: 'boss_norgath',
    nameKey: 'boss.boss_norgath.name',
    titleKey: 'boss.boss_norgath.title',
    introKey: 'boss.boss_norgath.intro',
    defeatKey: 'boss.boss_norgath.defeat',
    health: bossHealth(8, 1.12),
    armour: 3,
    poise: 40,
    scale: 1.2,
    arena: 'mire_shrine',
    attacks: [
      {
        id: 'sweep',
        anim: 'attack',
        telegraph: 680,
        active: 180,
        recovery: 700,
        damage: 1.05,
        shape: 'arc',
        range: 130,
        cooldown: 3000,
        band: [0, 150],
        arc: 2.6,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'mire',
        anim: 'cast',
        telegraph: 1000,
        active: 260,
        recovery: 900,
        damage: 0.9,
        shape: 'ground',
        range: 300,
        cooldown: 7000,
        band: [0, 320],
        hook: 'spawn_pools',
        vfx: 'root_patch',
        sfx: 'sfx_bog'
      },
      {
        id: 'slam',
        anim: 'heavy',
        telegraph: 940,
        active: 200,
        recovery: 1080,
        damage: 1.6,
        shape: 'circle',
        range: 124,
        cooldown: 6000,
        band: [0, 150],
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['sweep', 'mire', 'slam'],
        moveSpeed: 52,
        aggression: [1000, 1550],
        introKey: 'boss.boss_norgath.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['sweep', 'mire', 'slam'],
        moveSpeed: 58,
        aggression: [850, 1300],
        arena: 'pools_spread'
      }
    ],
    tipKey: 'stage.8.test',
    trophyArt: 0
  },
  {
    id: 'boss_hushcaller',
    stage: 9,
    art: 'boss_hushcaller',
    nameKey: 'boss.boss_hushcaller.name',
    titleKey: 'boss.boss_hushcaller.title',
    introKey: 'boss.boss_hushcaller.intro',
    defeatKey: 'boss.boss_hushcaller.defeat',
    health: bossHealth(9, 1.08),
    armour: 2,
    poise: 26,
    scale: 1.0,
    arena: 'grove_wards',
    attacks: [
      {
        id: 'silence',
        anim: 'cast',
        telegraph: 950,
        active: 2000,
        recovery: 900,
        damage: 0.7,
        shape: 'circle',
        range: 170,
        cooldown: 6000,
        band: [0, 420],
        hook: 'silence_zone',
        vfx: 'tele_circle',
        sfx: 'sfx_hush'
      },
      {
        id: 'channel',
        anim: 'cast',
        telegraph: 1400,
        active: 2600,
        recovery: 1300,
        damage: 2.0,
        shape: 'ground',
        range: 600,
        cooldown: 11000,
        band: [0, 600],
        hook: 'interruptible_channel',
        vfx: 'tele_ring',
        sfx: 'sfx_hush'
      },
      {
        id: 'bolt',
        anim: 'shoot',
        telegraph: 720,
        active: 140,
        recovery: 660,
        damage: 1.0,
        shape: 'projectile',
        range: 420,
        cooldown: 3800,
        band: [120, 460],
        vfx: 'venom_bolt',
        sfx: 'sfx_bolt'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['silence', 'bolt'],
        moveSpeed: 58,
        aggression: [1000, 1500],
        introKey: 'boss.boss_hushcaller.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.55
        },
        attacks: ['silence', 'bolt', 'channel'],
        moveSpeed: 62,
        aggression: [880, 1350],
        arena: 'wards_active'
      }
    ],
    tipKey: 'stage.9.test',
    trophyArt: 0
  },
  {
    id: 'boss_ashweb_queen',
    stage: 10,
    art: 'boss_ashweb_queen',
    nameKey: 'boss.boss_ashweb_queen.name',
    titleKey: 'boss.boss_ashweb_queen.title',
    introKey: 'boss.boss_ashweb_queen.intro',
    defeatKey: 'boss.boss_ashweb_queen.defeat',
    health: bossHealth(10, 1.6),
    armour: 3,
    poise: 48,
    scale: 1.35,
    arena: 'ashweb_throne',
    attacks: [
      {
        id: 'spit',
        anim: 'shoot',
        telegraph: 760,
        active: 160,
        recovery: 720,
        damage: 1.1,
        shape: 'projectile',
        range: 420,
        cooldown: 3800,
        band: [140, 460],
        hook: 'web_slow',
        vfx: 'venom_bolt',
        sfx: 'sfx_spit'
      },
      {
        id: 'legsweep',
        anim: 'attack',
        telegraph: 600,
        active: 170,
        recovery: 600,
        damage: 1.0,
        shape: 'arc',
        range: 140,
        cooldown: 2800,
        band: [0, 160],
        arc: 2.6,
        vfx: 'slash_heavy',
        sfx: 'sfx_chitter'
      },
      {
        id: 'weave',
        anim: 'cast',
        telegraph: 1200,
        active: 300,
        recovery: 1150,
        damage: 0,
        shape: 'ground',
        range: 520,
        cooldown: 10000,
        band: [0, 600],
        hook: 'reweave_arena',
        vfx: 'root_patch',
        sfx: 'sfx_web'
      },
      {
        id: 'brood',
        anim: 'cast',
        telegraph: 1050,
        active: 200,
        recovery: 1000,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 12000,
        band: [0, 600],
        hook: 'summon_brood',
        vfx: 'root_patch',
        sfx: 'sfx_chitter'
      },
      {
        id: 'drop',
        anim: 'attack2',
        telegraph: 900,
        active: 200,
        recovery: 900,
        damage: 1.5,
        shape: 'circle',
        range: 150,
        cooldown: 7000,
        band: [140, 340],
        hook: 'leap',
        vfx: 'tele_circle',
        sfx: 'sfx_chitter'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['spit', 'legsweep', 'weave', 'brood'],
        moveSpeed: 62,
        aggression: [950, 1450],
        introKey: 'boss.boss_ashweb_queen.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['spit', 'legsweep', 'weave', 'brood', 'drop'],
        moveSpeed: 70,
        aggression: [780, 1250],
        arena: 'webs_rebuilt',
        introKey: 'boss.boss_ashweb_queen.phase2'
      }
    ],
    tipKey: 'stage.10.test',
    trophyArt: 2
  },
  {
    id: 'boss_rockjaw',
    stage: 11,
    art: 'boss_rockjaw',
    nameKey: 'boss.boss_rockjaw.name',
    titleKey: 'boss.boss_rockjaw.title',
    introKey: 'boss.boss_rockjaw.intro',
    defeatKey: 'boss.boss_rockjaw.defeat',
    health: bossHealth(11, 1.14),
    armour: 4,
    poise: 46,
    scale: 1.22,
    arena: 'quarry_floor',
    attacks: [
      {
        id: 'quick',
        anim: 'attack',
        telegraph: 440,
        active: 130,
        recovery: 440,
        damage: 0.85,
        shape: 'arc',
        range: 116,
        cooldown: 2200,
        band: [0, 136],
        arc: 1.8,
        vfx: 'slash_light',
        sfx: 'sfx_swing_light'
      },
      {
        id: 'delayed',
        anim: 'heavy',
        telegraph: 1150,
        active: 190,
        recovery: 1050,
        damage: 1.75,
        shape: 'circle',
        range: 124,
        cooldown: 5200,
        band: [0, 150],
        hook: 'delayed_slam',
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'kick',
        anim: 'attack2',
        telegraph: 560,
        active: 150,
        recovery: 620,
        damage: 1.0,
        shape: 'arc',
        range: 102,
        cooldown: 3400,
        band: [0, 120],
        arc: 1.4,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['quick', 'delayed', 'kick'],
        moveSpeed: 56,
        aggression: [900, 1400],
        introKey: 'boss.boss_rockjaw.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.45
        },
        attacks: ['quick', 'delayed', 'kick'],
        moveSpeed: 62,
        aggression: [720, 1150]
      }
    ],
    tipKey: 'stage.11.test',
    trophyArt: 0
  },
  {
    id: 'boss_bragg',
    stage: 12,
    art: 'boss_bragg',
    nameKey: 'boss.boss_bragg.name',
    titleKey: 'boss.boss_bragg.title',
    introKey: 'boss.boss_bragg.intro',
    defeatKey: 'boss.boss_bragg.defeat',
    health: bossHealth(12, 1.12),
    armour: 4,
    poise: 34,
    scale: 1.05,
    arena: 'furnace_hall',
    attacks: [
      {
        id: 'vent',
        anim: 'cast',
        telegraph: 1050,
        active: 900,
        recovery: 900,
        damage: 1.3,
        shape: 'ground',
        range: 260,
        cooldown: 6000,
        band: [0, 420],
        hook: 'vent_burst',
        vfx: 'tele_circle',
        sfx: 'sfx_steam'
      },
      {
        id: 'mine',
        anim: 'cast',
        telegraph: 900,
        active: 200,
        recovery: 880,
        damage: 1.5,
        shape: 'ground',
        range: 320,
        cooldown: 7000,
        band: [0, 460],
        hook: 'arm_mines',
        vfx: 'tele_circle',
        sfx: 'sfx_clank'
      },
      {
        id: 'hammer',
        anim: 'heavy',
        telegraph: 880,
        active: 180,
        recovery: 980,
        damage: 1.6,
        shape: 'arc',
        range: 104,
        cooldown: 5000,
        band: [0, 126],
        arc: 1.7,
        vfx: 'slash_heavy',
        sfx: 'sfx_slam'
      },
      {
        id: 'jab',
        anim: 'attack',
        telegraph: 480,
        active: 130,
        recovery: 470,
        damage: 0.85,
        shape: 'arc',
        range: 88,
        cooldown: 2600,
        band: [0, 104],
        arc: 1.3,
        vfx: 'slash_light',
        sfx: 'sfx_swing_light'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['vent', 'hammer', 'jab'],
        moveSpeed: 58,
        aggression: [920, 1400],
        introKey: 'boss.boss_bragg.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['vent', 'mine', 'hammer', 'jab'],
        moveSpeed: 62,
        aggression: [800, 1250],
        arena: 'furnace_open'
      }
    ],
    tipKey: 'stage.12.test',
    trophyArt: 0
  },
  {
    id: 'boss_whitefang',
    stage: 13,
    art: 'boss_whitefang',
    nameKey: 'boss.boss_whitefang.name',
    titleKey: 'boss.boss_whitefang.title',
    introKey: 'boss.boss_whitefang.intro',
    defeatKey: 'boss.boss_whitefang.defeat',
    health: bossHealth(13, 1.14),
    armour: 2,
    poise: 30,
    scale: 1.1,
    arena: 'ice_bridge',
    attacks: [
      {
        id: 'leap',
        anim: 'attack2',
        telegraph: 760,
        active: 200,
        recovery: 760,
        damage: 1.35,
        shape: 'circle',
        range: 130,
        cooldown: 3600,
        band: [120, 300],
        hook: 'landing_marker',
        vfx: 'tele_circle',
        sfx: 'sfx_warg_charge'
      },
      {
        id: 'double_leap',
        anim: 'attack2',
        telegraph: 820,
        active: 200,
        recovery: 980,
        damage: 1.35,
        shape: 'circle',
        range: 134,
        cooldown: 6800,
        band: [120, 320],
        hook: 'landing_marker_double',
        vfx: 'tele_circle',
        sfx: 'sfx_warg_charge'
      },
      {
        id: 'bite',
        anim: 'attack',
        telegraph: 460,
        active: 130,
        recovery: 460,
        damage: 0.9,
        shape: 'arc',
        range: 86,
        cooldown: 2400,
        band: [0, 104],
        arc: 1.3,
        vfx: 'slash_light',
        sfx: 'sfx_bite'
      },
      {
        id: 'breath',
        anim: 'cast',
        telegraph: 900,
        active: 700,
        recovery: 900,
        damage: 1.1,
        shape: 'cone',
        range: 260,
        cooldown: 7200,
        band: [0, 280],
        arc: 1.0,
        hook: 'frost_cone',
        vfx: 'frost_cone',
        sfx: 'sfx_frost'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['leap', 'bite', 'breath'],
        moveSpeed: 88,
        aggression: [820, 1300],
        introKey: 'boss.boss_whitefang.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['leap', 'double_leap', 'bite', 'breath'],
        moveSpeed: 94,
        aggression: [700, 1150],
        arena: 'ice_cracked'
      }
    ],
    tipKey: 'stage.13.test',
    trophyArt: 0
  },
  {
    id: 'boss_ironecho',
    stage: 14,
    art: 'boss_ironecho',
    nameKey: 'boss.boss_ironecho.name',
    titleKey: 'boss.boss_ironecho.title',
    introKey: 'boss.boss_ironecho.intro',
    defeatKey: 'boss.boss_ironecho.defeat',
    health: bossHealth(14, 1.16),
    armour: 6,
    poise: 40,
    scale: 1.1,
    arena: 'anvil_hall',
    attacks: [
      {
        id: 'strike',
        anim: 'attack',
        telegraph: 620,
        active: 150,
        recovery: 600,
        damage: 1.1,
        shape: 'arc',
        range: 100,
        cooldown: 2800,
        band: [0, 120],
        arc: 1.6,
        hook: 'echo_strike',
        vfx: 'slash_heavy',
        sfx: 'sfx_anvil'
      },
      {
        id: 'echo',
        anim: 'attack',
        telegraph: 0,
        active: 150,
        recovery: 500,
        damage: 0.85,
        shape: 'arc',
        range: 100,
        cooldown: 0,
        band: [0, 120],
        arc: 1.6,
        hook: 'echo_repeat',
        vfx: 'echo_ghost',
        sfx: 'sfx_anvil'
      },
      {
        id: 'quake',
        anim: 'slam',
        telegraph: 1000,
        active: 220,
        recovery: 1080,
        damage: 1.5,
        shape: 'ring',
        range: 250,
        cooldown: 6600,
        band: [0, 260],
        hook: 'echo_ring',
        vfx: 'tele_ring',
        sfx: 'sfx_quake'
      },
      {
        id: 'guard',
        anim: 'block',
        telegraph: 500,
        active: 900,
        recovery: 600,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 8000,
        band: [0, 200],
        hook: 'guard_stance',
        sfx: 'sfx_guard'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['strike', 'quake', 'guard'],
        moveSpeed: 56,
        aggression: [950, 1420],
        introKey: 'boss.boss_ironecho.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['strike', 'quake', 'guard'],
        moveSpeed: 60,
        aggression: [800, 1250],
        arena: 'anvils_ringing'
      }
    ],
    tipKey: 'stage.14.test',
    trophyArt: 0
  },
  {
    id: 'boss_durnok',
    stage: 15,
    art: 'boss_durnok',
    nameKey: 'boss.boss_durnok.name',
    titleKey: 'boss.boss_durnok.title',
    introKey: 'boss.boss_durnok.intro',
    defeatKey: 'boss.boss_durnok.defeat',
    health: bossHealth(15, 1.62),
    armour: 5,
    poise: 54,
    scale: 1.4,
    arena: 'chained_deep',
    attacks: [
      {
        id: 'chainsweep',
        anim: 'attack',
        telegraph: 780,
        active: 220,
        recovery: 780,
        damage: 1.25,
        shape: 'ring',
        range: 300,
        cooldown: 4200,
        band: [0, 300],
        hook: 'chain_sweep',
        vfx: 'tele_ring',
        sfx: 'sfx_chain'
      },
      {
        id: 'chainpull',
        anim: 'attack2',
        telegraph: 900,
        active: 200,
        recovery: 1000,
        damage: 1.3,
        shape: 'line',
        range: 360,
        cooldown: 6000,
        band: [130, 380],
        hook: 'pull',
        vfx: 'tele_line',
        sfx: 'sfx_chain'
      },
      {
        id: 'stomp',
        anim: 'heavy',
        telegraph: 1000,
        active: 200,
        recovery: 1120,
        damage: 1.7,
        shape: 'circle',
        range: 140,
        cooldown: 6400,
        band: [0, 160],
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'anchorcall',
        anim: 'roar',
        telegraph: 1200,
        active: 300,
        recovery: 1200,
        damage: 0,
        shape: 'ground',
        range: 600,
        cooldown: 14000,
        band: [0, 600],
        hook: 'expose_anchors',
        vfx: 'light_pulse',
        sfx: 'sfx_roar'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['chainsweep', 'chainpull', 'stomp'],
        moveSpeed: 52,
        aggression: [980, 1500],
        introKey: 'boss.boss_durnok.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['chainsweep', 'chainpull', 'stomp', 'anchorcall'],
        moveSpeed: 58,
        aggression: [820, 1280],
        arena: 'anchors_exposed',
        introKey: 'boss.boss_durnok.phase2'
      }
    ],
    tipKey: 'stage.15.test',
    trophyArt: 3
  },
  {
    id: 'boss_karg',
    stage: 16,
    art: 'boss_karg',
    nameKey: 'boss.boss_karg.name',
    titleKey: 'boss.boss_karg.title',
    introKey: 'boss.boss_karg.intro',
    defeatKey: 'boss.boss_karg.defeat',
    health: bossHealth(16, 1.18),
    armour: 7,
    poise: 44,
    scale: 1.08,
    arena: 'flooded_ford',
    attacks: [
      {
        id: 'shieldwall',
        anim: 'block',
        telegraph: 400,
        active: 1400,
        recovery: 700,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 6000,
        band: [0, 200],
        hook: 'frontal_block',
        sfx: 'sfx_guard'
      },
      {
        id: 'bash',
        anim: 'attack2',
        telegraph: 700,
        active: 160,
        recovery: 980,
        damage: 1.2,
        shape: 'line',
        range: 150,
        cooldown: 4200,
        band: [0, 170],
        hook: 'bash_opening',
        vfx: 'tele_line',
        sfx: 'sfx_shield_bash'
      },
      {
        id: 'chop',
        anim: 'attack',
        telegraph: 560,
        active: 150,
        recovery: 560,
        damage: 1.0,
        shape: 'arc',
        range: 96,
        cooldown: 2600,
        band: [0, 112],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'rally',
        anim: 'roar',
        telegraph: 1100,
        active: 200,
        recovery: 1100,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 14000,
        band: [0, 600],
        hook: 'summon_guards',
        vfx: 'light_pulse',
        sfx: 'sfx_horn'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['shieldwall', 'bash', 'chop'],
        moveSpeed: 58,
        aggression: [900, 1400],
        introKey: 'boss.boss_karg.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['shieldwall', 'bash', 'chop', 'rally'],
        moveSpeed: 62,
        aggression: [780, 1250],
        arena: 'ford_flooded'
      }
    ],
    tipKey: 'stage.16.test',
    trophyArt: 0
  },
  {
    id: 'boss_uzg',
    stage: 17,
    art: 'boss_uzg',
    nameKey: 'boss.boss_uzg.name',
    titleKey: 'boss.boss_uzg.title',
    introKey: 'boss.boss_uzg.intro',
    defeatKey: 'boss.boss_uzg.defeat',
    health: bossHealth(17, 1.16),
    armour: 4,
    poise: 32,
    scale: 1.05,
    arena: 'siegeworks',
    attacks: [
      {
        id: 'bolt',
        anim: 'shoot',
        telegraph: 760,
        active: 140,
        recovery: 700,
        damage: 1.1,
        shape: 'projectile',
        range: 480,
        cooldown: 3400,
        band: [150, 520],
        vfx: 'tele_line',
        sfx: 'sfx_crossbow'
      },
      {
        id: 'ballista',
        anim: 'cast',
        telegraph: 1600,
        active: 220,
        recovery: 1400,
        damage: 2.4,
        shape: 'line',
        range: 700,
        cooldown: 9000,
        band: [0, 700],
        hook: 'redirect_ballista',
        vfx: 'tele_line',
        sfx: 'sfx_ballista'
      },
      {
        id: 'grenade',
        anim: 'attack2',
        telegraph: 900,
        active: 200,
        recovery: 900,
        damage: 1.4,
        shape: 'circle',
        range: 170,
        cooldown: 6000,
        band: [100, 360],
        hook: 'timed_blast',
        vfx: 'tele_circle',
        sfx: 'sfx_blast'
      },
      {
        id: 'retreat',
        anim: 'dodge',
        telegraph: 300,
        active: 200,
        recovery: 500,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 5000,
        band: [0, 120],
        hook: 'disengage',
        sfx: 'sfx_step'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['bolt', 'grenade', 'retreat'],
        moveSpeed: 70,
        aggression: [880, 1350],
        introKey: 'boss.boss_uzg.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.55
        },
        attacks: ['bolt', 'ballista', 'grenade', 'retreat'],
        moveSpeed: 74,
        aggression: [760, 1200],
        arena: 'engines_live'
      }
    ],
    tipKey: 'stage.17.test',
    trophyArt: 0
  },
  {
    id: 'boss_wardrummer',
    stage: 18,
    art: 'boss_wardrummer',
    nameKey: 'boss.boss_wardrummer.name',
    titleKey: 'boss.boss_wardrummer.title',
    introKey: 'boss.boss_wardrummer.intro',
    defeatKey: 'boss.boss_wardrummer.defeat',
    health: bossHealth(18, 1.2),
    armour: 5,
    poise: 42,
    scale: 1.12,
    arena: 'bannerfield',
    attacks: [
      {
        id: 'drumwave',
        anim: 'cast',
        telegraph: 1000,
        active: 300,
        recovery: 1000,
        damage: 1.2,
        shape: 'ring',
        range: 320,
        cooldown: 5200,
        band: [0, 320],
        hook: 'drum_wave',
        vfx: 'tele_ring',
        sfx: 'sfx_drum'
      },
      {
        id: 'muster',
        anim: 'cast',
        telegraph: 1200,
        active: 200,
        recovery: 1200,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 10000,
        band: [0, 600],
        hook: 'banner_summon',
        vfx: 'light_pulse',
        sfx: 'sfx_horn'
      },
      {
        id: 'smash',
        anim: 'heavy',
        telegraph: 900,
        active: 180,
        recovery: 1000,
        damage: 1.6,
        shape: 'arc',
        range: 108,
        cooldown: 5400,
        band: [0, 128],
        arc: 1.8,
        vfx: 'slash_heavy',
        sfx: 'sfx_slam'
      },
      {
        id: 'swing',
        anim: 'attack',
        telegraph: 540,
        active: 150,
        recovery: 540,
        damage: 0.95,
        shape: 'arc',
        range: 96,
        cooldown: 2600,
        band: [0, 112],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['drumwave', 'muster', 'swing'],
        moveSpeed: 56,
        aggression: [950, 1450],
        introKey: 'boss.boss_wardrummer.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['drumwave', 'muster', 'smash', 'swing'],
        moveSpeed: 62,
        aggression: [820, 1300],
        arena: 'banners_burning'
      }
    ],
    tipKey: 'stage.18.test',
    trophyArt: 0
  },
  {
    id: 'boss_cinderknight',
    stage: 19,
    art: 'boss_cinderknight',
    nameKey: 'boss.boss_cinderknight.name',
    titleKey: 'boss.boss_cinderknight.title',
    introKey: 'boss.boss_cinderknight.intro',
    defeatKey: 'boss.boss_cinderknight.defeat',
    health: bossHealth(19, 1.2),
    armour: 6,
    poise: 46,
    scale: 1.14,
    arena: 'ember_watch',
    attacks: [
      {
        id: 'riposte',
        anim: 'block',
        telegraph: 520,
        active: 1100,
        recovery: 1000,
        damage: 1.3,
        shape: 'arc',
        range: 110,
        cooldown: 6200,
        band: [0, 130],
        arc: 1.4,
        hook: 'counter_stance',
        vfx: 'oath_flash',
        sfx: 'sfx_parry'
      },
      {
        id: 'flamesweep',
        anim: 'attack',
        telegraph: 700,
        active: 180,
        recovery: 720,
        damage: 1.15,
        shape: 'arc',
        range: 124,
        cooldown: 3200,
        band: [0, 142],
        arc: 2.2,
        vfx: 'ember_arc',
        sfx: 'sfx_fire_swing'
      },
      {
        id: 'emberfall',
        anim: 'heavy',
        telegraph: 1050,
        active: 220,
        recovery: 1150,
        damage: 1.8,
        shape: 'circle',
        range: 132,
        cooldown: 6000,
        band: [0, 150],
        hook: 'punishable',
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'dash',
        anim: 'attack2',
        telegraph: 620,
        active: 180,
        recovery: 760,
        damage: 1.1,
        shape: 'line',
        range: 210,
        cooldown: 4600,
        band: [110, 240],
        vfx: 'tele_line',
        sfx: 'sfx_step'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['riposte', 'flamesweep', 'dash'],
        moveSpeed: 64,
        aggression: [900, 1400],
        introKey: 'boss.boss_cinderknight.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['riposte', 'flamesweep', 'emberfall', 'dash'],
        moveSpeed: 70,
        aggression: [780, 1220],
        arena: 'watch_burning'
      }
    ],
    tipKey: 'stage.19.test',
    trophyArt: 0
  },
  {
    id: 'boss_varzug',
    stage: 20,
    art: 'boss_varzug',
    nameKey: 'boss.boss_varzug.name',
    titleKey: 'boss.boss_varzug.title',
    introKey: 'boss.boss_varzug.intro',
    defeatKey: 'boss.boss_varzug.defeat',
    health: bossHealth(20, 1.7),
    armour: 7,
    poise: 56,
    scale: 1.28,
    arena: 'red_banner_keep',
    attacks: [
      {
        id: 'duel',
        anim: 'attack',
        telegraph: 560,
        active: 150,
        recovery: 560,
        damage: 1.0,
        shape: 'arc',
        range: 104,
        cooldown: 2400,
        band: [0, 120],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'cleave',
        anim: 'attack2',
        telegraph: 780,
        active: 180,
        recovery: 820,
        damage: 1.35,
        shape: 'arc',
        range: 120,
        cooldown: 4000,
        band: [0, 140],
        arc: 2.2,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'charge',
        anim: 'run',
        telegraph: 900,
        active: 420,
        recovery: 1050,
        damage: 1.6,
        shape: 'line',
        range: 420,
        cooldown: 5200,
        band: [150, 460],
        hook: 'committed_charge',
        vfx: 'tele_line',
        sfx: 'sfx_charge'
      },
      {
        id: 'bannercall',
        anim: 'roar',
        telegraph: 1150,
        active: 200,
        recovery: 1150,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 12000,
        band: [0, 600],
        hook: 'summon_guards',
        vfx: 'light_pulse',
        sfx: 'sfx_horn'
      },
      {
        id: 'siegefire',
        anim: 'cast',
        telegraph: 1500,
        active: 600,
        recovery: 1300,
        damage: 1.9,
        shape: 'ground',
        range: 620,
        cooldown: 8000,
        band: [0, 620],
        hook: 'siege_fire',
        vfx: 'tele_circle',
        sfx: 'sfx_ballista'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['duel', 'cleave'],
        moveSpeed: 62,
        aggression: [950, 1450],
        introKey: 'boss.boss_varzug.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.66
        },
        attacks: ['duel', 'cleave', 'charge', 'bannercall'],
        moveSpeed: 70,
        aggression: [820, 1300],
        arena: 'keep_muster',
        introKey: 'boss.boss_varzug.phase2'
      },
      {
        id: 'p3',
        trigger: {
          atHealthPct: 0.33
        },
        attacks: ['duel', 'cleave', 'charge', 'siegefire'],
        moveSpeed: 74,
        aggression: [720, 1150],
        arena: 'keep_burning',
        introKey: 'boss.boss_varzug.phase3'
      }
    ],
    tipKey: 'stage.20.test',
    trophyArt: 4
  },
  {
    id: 'boss_glasswight',
    stage: 21,
    art: 'boss_glasswight',
    nameKey: 'boss.boss_glasswight.name',
    titleKey: 'boss.boss_glasswight.title',
    introKey: 'boss.boss_glasswight.intro',
    defeatKey: 'boss.boss_glasswight.defeat',
    health: bossHealth(21, 1.2),
    armour: 3,
    poise: 34,
    scale: 1.06,
    arena: 'mirror_barrows',
    attacks: [
      {
        id: 'shatter',
        anim: 'cast',
        telegraph: 900,
        active: 220,
        recovery: 900,
        damage: 1.2,
        shape: 'ring',
        range: 260,
        cooldown: 5000,
        band: [0, 260],
        vfx: 'freeze_shatter',
        sfx: 'sfx_glass'
      },
      {
        id: 'mirror',
        anim: 'cast',
        telegraph: 1100,
        active: 200,
        recovery: 1000,
        damage: 0,
        shape: 'summon',
        range: 0,
        cooldown: 9000,
        band: [0, 600],
        hook: 'spawn_mirrors',
        vfx: 'dusk_blink',
        sfx: 'sfx_glass'
      },
      {
        id: 'lunge',
        anim: 'attack',
        telegraph: 560,
        active: 150,
        recovery: 640,
        damage: 1.1,
        shape: 'line',
        range: 170,
        cooldown: 3000,
        band: [0, 190],
        hook: 'real_only',
        vfx: 'slash_light',
        sfx: 'sfx_wight'
      },
      {
        id: 'blink',
        anim: 'dodge',
        telegraph: 400,
        active: 120,
        recovery: 500,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 4200,
        band: [0, 600],
        hook: 'blink_reposition',
        vfx: 'dusk_blink',
        sfx: 'sfx_blink'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['shatter', 'mirror', 'lunge', 'blink'],
        moveSpeed: 62,
        aggression: [920, 1400],
        introKey: 'boss.boss_glasswight.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.45
        },
        attacks: ['shatter', 'mirror', 'lunge', 'blink'],
        moveSpeed: 68,
        aggression: [780, 1220],
        arena: 'mirrors_many'
      }
    ],
    tipKey: 'stage.21.test',
    trophyArt: 0
  },
  {
    id: 'boss_riftkeeper',
    stage: 22,
    art: 'boss_riftkeeper',
    nameKey: 'boss.boss_riftkeeper.name',
    titleKey: 'boss.boss_riftkeeper.title',
    introKey: 'boss.boss_riftkeeper.intro',
    defeatKey: 'boss.boss_riftkeeper.defeat',
    health: bossHealth(22, 1.22),
    armour: 3,
    poise: 36,
    scale: 1.08,
    arena: 'obsidian_pass',
    attacks: [
      {
        id: 'fissure',
        anim: 'cast',
        telegraph: 1150,
        active: 900,
        recovery: 1000,
        damage: 1.4,
        shape: 'ground',
        range: 600,
        cooldown: 5600,
        band: [0, 600],
        hook: 'alternating_fissures',
        vfx: 'tele_line',
        sfx: 'sfx_rift'
      },
      {
        id: 'rift_bolt',
        anim: 'shoot',
        telegraph: 740,
        active: 140,
        recovery: 680,
        damage: 1.05,
        shape: 'projectile',
        range: 440,
        cooldown: 3400,
        band: [120, 460],
        vfx: 'venom_bolt',
        sfx: 'sfx_bolt'
      },
      {
        id: 'collapse',
        anim: 'cast',
        telegraph: 1400,
        active: 320,
        recovery: 1300,
        damage: 1.8,
        shape: 'ring',
        range: 340,
        cooldown: 9000,
        band: [0, 340],
        hook: 'collapse_ring',
        vfx: 'tele_ring',
        sfx: 'sfx_quake'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['fissure', 'rift_bolt'],
        moveSpeed: 58,
        aggression: [980, 1480],
        introKey: 'boss.boss_riftkeeper.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['fissure', 'rift_bolt', 'collapse'],
        moveSpeed: 64,
        aggression: [840, 1300],
        arena: 'rifts_wide'
      }
    ],
    tipKey: 'stage.22.test',
    trophyArt: 0
  },
  {
    id: 'boss_paleflame',
    stage: 23,
    art: 'boss_paleflame',
    nameKey: 'boss.boss_paleflame.name',
    titleKey: 'boss.boss_paleflame.title',
    introKey: 'boss.boss_paleflame.intro',
    defeatKey: 'boss.boss_paleflame.defeat',
    health: bossHealth(23, 1.24),
    armour: 3,
    poise: 38,
    scale: 1.08,
    arena: 'winter_tower',
    attacks: [
      {
        id: 'sectors',
        anim: 'cast',
        telegraph: 1300,
        active: 2400,
        recovery: 1200,
        damage: 1.5,
        shape: 'ground',
        range: 600,
        cooldown: 8000,
        band: [0, 600],
        hook: 'rotating_sectors',
        vfx: 'tele_ring',
        sfx: 'sfx_pale'
      },
      {
        id: 'palebolt',
        anim: 'shoot',
        telegraph: 720,
        active: 140,
        recovery: 680,
        damage: 1.05,
        shape: 'projectile',
        range: 440,
        cooldown: 3200,
        band: [120, 460],
        vfx: 'frost_cone',
        sfx: 'sfx_bolt'
      },
      {
        id: 'nova',
        anim: 'cast',
        telegraph: 1100,
        active: 260,
        recovery: 1100,
        damage: 1.6,
        shape: 'ring',
        range: 300,
        cooldown: 7000,
        band: [0, 300],
        vfx: 'tele_ring',
        sfx: 'sfx_frost'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['sectors', 'palebolt'],
        moveSpeed: 56,
        aggression: [1000, 1500],
        introKey: 'boss.boss_paleflame.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['sectors', 'palebolt', 'nova'],
        moveSpeed: 60,
        aggression: [850, 1300],
        arena: 'tower_lit'
      }
    ],
    tipKey: 'stage.23.test',
    trophyArt: 0
  },
  {
    id: 'boss_oathbreaker',
    stage: 24,
    art: 'boss_oathbreaker',
    nameKey: 'boss.boss_oathbreaker.name',
    titleKey: 'boss.boss_oathbreaker.title',
    introKey: 'boss.boss_oathbreaker.intro',
    defeatKey: 'boss.boss_oathbreaker.defeat',
    health: bossHealth(24, 1.3),
    armour: 6,
    poise: 64,
    scale: 1.5,
    arena: 'fallen_courtyard',
    attacks: [
      {
        id: 'shockwave',
        anim: 'slam',
        telegraph: 1100,
        active: 240,
        recovery: 1250,
        damage: 1.7,
        shape: 'ring',
        range: 340,
        cooldown: 5000,
        band: [0, 340],
        hook: 'shockwave',
        vfx: 'tele_ring',
        sfx: 'sfx_quake'
      },
      {
        id: 'swing',
        anim: 'attack',
        telegraph: 700,
        active: 180,
        recovery: 720,
        damage: 1.1,
        shape: 'arc',
        range: 140,
        cooldown: 2800,
        band: [0, 160],
        arc: 2.0,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'overhead',
        anim: 'heavy',
        telegraph: 1200,
        active: 220,
        recovery: 1400,
        damage: 2.0,
        shape: 'circle',
        range: 150,
        cooldown: 6600,
        band: [0, 170],
        hook: 'expose_weakpoint',
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'sweepback',
        anim: 'attack2',
        telegraph: 760,
        active: 190,
        recovery: 800,
        damage: 1.25,
        shape: 'arc',
        range: 150,
        cooldown: 4200,
        band: [0, 170],
        arc: 2.4,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['shockwave', 'swing', 'overhead'],
        moveSpeed: 48,
        aggression: [1050, 1550],
        introKey: 'boss.boss_oathbreaker.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['shockwave', 'swing', 'overhead', 'sweepback'],
        moveSpeed: 54,
        aggression: [880, 1350],
        arena: 'courtyard_broken'
      }
    ],
    tipKey: 'stage.24.test',
    trophyArt: 0
  },
  {
    id: 'boss_nameless_nazgul',
    stage: 25,
    art: 'boss_nameless_nazgul',
    nameKey: 'boss.boss_nameless_nazgul.name',
    titleKey: 'boss.boss_nameless_nazgul.title',
    introKey: 'boss.boss_nameless_nazgul.intro',
    defeatKey: 'boss.boss_nameless_nazgul.defeat',
    health: bossHealth(25, 1.75),
    armour: 6,
    poise: 58,
    scale: 1.32,
    arena: 'black_causeway',
    attacks: [
      {
        id: 'ride',
        anim: 'run',
        telegraph: 1000,
        active: 460,
        recovery: 1100,
        damage: 1.6,
        shape: 'line',
        range: 460,
        cooldown: 4800,
        band: [160, 500],
        hook: 'committed_charge',
        vfx: 'tele_line',
        sfx: 'sfx_charge'
      },
      {
        id: 'cleave',
        anim: 'attack',
        telegraph: 640,
        active: 160,
        recovery: 640,
        damage: 1.15,
        shape: 'arc',
        range: 116,
        cooldown: 2600,
        band: [0, 134],
        arc: 1.7,
        vfx: 'slash_heavy',
        sfx: 'sfx_wraith_swing'
      },
      {
        id: 'dread',
        anim: 'cast',
        telegraph: 1250,
        active: 1400,
        recovery: 1200,
        damage: 1.1,
        shape: 'circle',
        range: 300,
        cooldown: 7000,
        band: [0, 320],
        hook: 'dread_field',
        vfx: 'tele_circle',
        sfx: 'sfx_dread'
      },
      {
        id: 'wail',
        anim: 'roar',
        telegraph: 1400,
        active: 600,
        recovery: 1300,
        damage: 1.4,
        shape: 'ring',
        range: 380,
        cooldown: 9500,
        band: [0, 380],
        hook: 'wail_push',
        vfx: 'tele_ring',
        sfx: 'sfx_wail'
      },
      {
        id: 'blink',
        anim: 'dodge',
        telegraph: 420,
        active: 140,
        recovery: 520,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 5200,
        band: [0, 600],
        hook: 'blink_reposition',
        vfx: 'dusk_blink',
        sfx: 'sfx_blink'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['ride', 'cleave', 'dread'],
        moveSpeed: 78,
        aggression: [950, 1400],
        introKey: 'boss.boss_nameless_nazgul.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.55
        },
        attacks: ['cleave', 'dread', 'wail', 'blink'],
        moveSpeed: 66,
        aggression: [820, 1250],
        arena: 'causeway_spectral',
        introKey: 'boss.boss_nameless_nazgul.phase2'
      }
    ],
    tipKey: 'stage.25.test',
    trophyArt: 5
  },
  {
    id: 'boss_gruk',
    stage: 26,
    art: 'boss_gruk',
    nameKey: 'boss.boss_gruk.name',
    titleKey: 'boss.boss_gruk.title',
    introKey: 'boss.boss_gruk.intro',
    defeatKey: 'boss.boss_gruk.defeat',
    health: bossHealth(26, 1.26),
    armour: 5,
    poise: 40,
    scale: 1.1,
    arena: 'siege_trench',
    attacks: [
      {
        id: 'charges',
        anim: 'cast',
        telegraph: 950,
        active: 200,
        recovery: 950,
        damage: 1.6,
        shape: 'ground',
        range: 420,
        cooldown: 5200,
        band: [0, 460],
        hook: 'timed_charges',
        vfx: 'tele_circle',
        sfx: 'sfx_clank'
      },
      {
        id: 'toss',
        anim: 'attack2',
        telegraph: 820,
        active: 180,
        recovery: 860,
        damage: 1.4,
        shape: 'circle',
        range: 170,
        cooldown: 4200,
        band: [110, 340],
        hook: 'timed_blast',
        vfx: 'tele_circle',
        sfx: 'sfx_blast'
      },
      {
        id: 'club',
        anim: 'attack',
        telegraph: 540,
        active: 150,
        recovery: 560,
        damage: 1.0,
        shape: 'arc',
        range: 100,
        cooldown: 2600,
        band: [0, 116],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'collapse',
        anim: 'cast',
        telegraph: 1350,
        active: 300,
        recovery: 1300,
        damage: 1.9,
        shape: 'ring',
        range: 330,
        cooldown: 9000,
        band: [0, 330],
        hook: 'trench_collapse',
        vfx: 'tele_ring',
        sfx: 'sfx_quake'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['charges', 'toss', 'club'],
        moveSpeed: 62,
        aggression: [920, 1400],
        introKey: 'boss.boss_gruk.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['charges', 'toss', 'club', 'collapse'],
        moveSpeed: 66,
        aggression: [790, 1240],
        arena: 'trench_breached'
      }
    ],
    tipKey: 'stage.26.test',
    trophyArt: 0
  },
  {
    id: 'boss_cindermaw',
    stage: 27,
    art: 'boss_cindermaw',
    nameKey: 'boss.boss_cindermaw.name',
    titleKey: 'boss.boss_cindermaw.title',
    introKey: 'boss.boss_cindermaw.intro',
    defeatKey: 'boss.boss_cindermaw.defeat',
    health: bossHealth(27, 1.3),
    armour: 5,
    poise: 48,
    scale: 1.28,
    arena: 'smouldering_forge',
    attacks: [
      {
        id: 'breath',
        anim: 'cast',
        telegraph: 1000,
        active: 1300,
        recovery: 1500,
        damage: 1.5,
        shape: 'cone',
        range: 340,
        cooldown: 6200,
        band: [0, 360],
        arc: 1.1,
        hook: 'cooling_window',
        vfx: 'ember_arc',
        sfx: 'sfx_fire_breath'
      },
      {
        id: 'bite',
        anim: 'attack',
        telegraph: 520,
        active: 140,
        recovery: 520,
        damage: 1.0,
        shape: 'arc',
        range: 96,
        cooldown: 2400,
        band: [0, 112],
        arc: 1.4,
        vfx: 'slash_light',
        sfx: 'sfx_bite'
      },
      {
        id: 'charge',
        anim: 'run',
        telegraph: 880,
        active: 400,
        recovery: 1000,
        damage: 1.5,
        shape: 'line',
        range: 380,
        cooldown: 5000,
        band: [150, 420],
        hook: 'committed_charge',
        vfx: 'tele_line',
        sfx: 'sfx_charge'
      },
      {
        id: 'emberburst',
        anim: 'slam',
        telegraph: 1050,
        active: 240,
        recovery: 1150,
        damage: 1.7,
        shape: 'ring',
        range: 300,
        cooldown: 7000,
        band: [0, 300],
        vfx: 'tele_ring',
        sfx: 'sfx_blast'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['breath', 'bite', 'charge'],
        moveSpeed: 82,
        aggression: [900, 1380],
        introKey: 'boss.boss_cindermaw.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['breath', 'bite', 'charge', 'emberburst'],
        moveSpeed: 88,
        aggression: [760, 1200],
        arena: 'forge_open'
      }
    ],
    tipKey: 'stage.27.test',
    trophyArt: 0
  },
  {
    id: 'boss_castellan',
    stage: 28,
    art: 'boss_castellan',
    nameKey: 'boss.boss_castellan.name',
    titleKey: 'boss.boss_castellan.title',
    introKey: 'boss.boss_castellan.intro',
    defeatKey: 'boss.boss_castellan.defeat',
    health: bossHealth(28, 1.32),
    armour: 8,
    poise: 52,
    scale: 1.18,
    arena: 'broken_citadel',
    attacks: [
      {
        id: 'stance_swap',
        anim: 'cast',
        telegraph: 700,
        active: 200,
        recovery: 600,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 7000,
        band: [0, 600],
        hook: 'swap_stance',
        vfx: 'oath_flash',
        sfx: 'sfx_stance'
      },
      {
        id: 'blade',
        anim: 'attack',
        telegraph: 540,
        active: 150,
        recovery: 540,
        damage: 1.05,
        shape: 'arc',
        range: 104,
        cooldown: 2400,
        band: [0, 120],
        arc: 1.5,
        hook: 'stance_blade',
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'axe',
        anim: 'heavy',
        telegraph: 980,
        active: 200,
        recovery: 1080,
        damage: 1.75,
        shape: 'arc',
        range: 124,
        cooldown: 4600,
        band: [0, 142],
        arc: 2.0,
        hook: 'stance_axe',
        vfx: 'slash_heavy',
        sfx: 'sfx_slam'
      },
      {
        id: 'guard',
        anim: 'block',
        telegraph: 480,
        active: 1200,
        recovery: 760,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 6000,
        band: [0, 200],
        hook: 'stance_guard',
        sfx: 'sfx_guard'
      },
      {
        id: 'thrust',
        anim: 'attack2',
        telegraph: 700,
        active: 160,
        recovery: 820,
        damage: 1.3,
        shape: 'line',
        range: 190,
        cooldown: 3800,
        band: [0, 210],
        hook: 'stance_thrust',
        vfx: 'tele_line',
        sfx: 'sfx_swing_heavy'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['stance_swap', 'blade', 'axe', 'guard'],
        moveSpeed: 62,
        aggression: [880, 1340],
        introKey: 'boss.boss_castellan.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['stance_swap', 'blade', 'axe', 'guard', 'thrust'],
        moveSpeed: 68,
        aggression: [760, 1180],
        arena: 'citadel_dark'
      }
    ],
    tipKey: 'stage.28.test',
    trophyArt: 0
  },
  {
    id: 'boss_oaththief',
    stage: 29,
    art: 'boss_oaththief',
    nameKey: 'boss.boss_oaththief.name',
    titleKey: 'boss.boss_oaththief.title',
    introKey: 'boss.boss_oaththief.intro',
    defeatKey: 'boss.boss_oaththief.defeat',
    health: bossHealth(29, 1.34),
    armour: 5,
    poise: 44,
    scale: 1.12,
    arena: 'last_beacon',
    attacks: [
      {
        id: 'stolen_ember',
        anim: 'cast',
        telegraph: 900,
        active: 220,
        recovery: 900,
        damage: 1.3,
        shape: 'cone',
        range: 300,
        cooldown: 5000,
        band: [0, 320],
        arc: 0.9,
        hook: 'copy_ember',
        vfx: 'ember_arc',
        sfx: 'sfx_fire_swing'
      },
      {
        id: 'stolen_frost',
        anim: 'cast',
        telegraph: 950,
        active: 260,
        recovery: 950,
        damage: 1.25,
        shape: 'cone',
        range: 300,
        cooldown: 5600,
        band: [0, 320],
        arc: 0.95,
        hook: 'copy_frost',
        vfx: 'frost_cone',
        sfx: 'sfx_frost'
      },
      {
        id: 'stolen_storm',
        anim: 'cast',
        telegraph: 1000,
        active: 200,
        recovery: 1000,
        damage: 1.4,
        shape: 'chain',
        range: 420,
        cooldown: 6400,
        band: [0, 440],
        hook: 'copy_storm',
        vfx: 'storm_bolt',
        sfx: 'sfx_thunder'
      },
      {
        id: 'stolen_dusk',
        anim: 'dodge',
        telegraph: 500,
        active: 160,
        recovery: 620,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 4600,
        band: [0, 600],
        hook: 'copy_dusk',
        vfx: 'dusk_blink',
        sfx: 'sfx_blink'
      },
      {
        id: 'dagger',
        anim: 'attack',
        telegraph: 500,
        active: 140,
        recovery: 520,
        damage: 1.0,
        shape: 'arc',
        range: 90,
        cooldown: 2600,
        band: [0, 106],
        arc: 1.4,
        vfx: 'slash_light',
        sfx: 'sfx_swing_light'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['stolen_ember', 'stolen_frost', 'dagger', 'stolen_dusk'],
        moveSpeed: 64,
        aggression: [900, 1360],
        introKey: 'boss.boss_oaththief.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.5
        },
        attacks: ['stolen_ember', 'stolen_frost', 'stolen_storm', 'dagger', 'stolen_dusk'],
        moveSpeed: 70,
        aggression: [770, 1190],
        arena: 'beacon_conduit'
      }
    ],
    tipKey: 'stage.29.test',
    trophyArt: 0
  },
  {
    id: 'boss_ashen_regent',
    stage: 30,
    art: 'boss_ashen_regent',
    nameKey: 'boss.boss_ashen_regent.name',
    titleKey: 'boss.boss_ashen_regent.title',
    introKey: 'boss.boss_ashen_regent.intro',
    defeatKey: 'boss.boss_ashen_regent.defeat',
    health: bossHealth(30, 1.85),
    armour: 8,
    poise: 66,
    scale: 1.42,
    arena: 'eclipse_summit',
    attacks: [
      {
        id: 'duel',
        anim: 'attack',
        telegraph: 560,
        active: 150,
        recovery: 560,
        damage: 1.05,
        shape: 'arc',
        range: 112,
        cooldown: 2300,
        band: [0, 128],
        arc: 1.5,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'cleave',
        anim: 'attack2',
        telegraph: 800,
        active: 180,
        recovery: 840,
        damage: 1.4,
        shape: 'arc',
        range: 130,
        cooldown: 3800,
        band: [0, 150],
        arc: 2.2,
        vfx: 'slash_heavy',
        sfx: 'sfx_swing_heavy'
      },
      {
        id: 'seasonfield',
        anim: 'cast',
        telegraph: 1350,
        active: 1600,
        recovery: 1200,
        damage: 1.4,
        shape: 'ground',
        range: 620,
        cooldown: 7000,
        band: [0, 620],
        hook: 'season_field',
        vfx: 'tele_circle',
        sfx: 'sfx_season'
      },
      {
        id: 'conduit',
        anim: 'cast',
        telegraph: 1600,
        active: 900,
        recovery: 1500,
        damage: 2.0,
        shape: 'ring',
        range: 400,
        cooldown: 9000,
        band: [0, 400],
        hook: 'conduit_break',
        vfx: 'light_pulse',
        sfx: 'sfx_conduit'
      },
      {
        id: 'ashfall',
        anim: 'slam',
        telegraph: 1150,
        active: 260,
        recovery: 1250,
        damage: 1.8,
        shape: 'circle',
        range: 150,
        cooldown: 6000,
        band: [0, 170],
        vfx: 'tele_circle',
        sfx: 'sfx_slam'
      },
      {
        id: 'blink',
        anim: 'dodge',
        telegraph: 420,
        active: 140,
        recovery: 540,
        damage: 0,
        shape: 'arc',
        range: 0,
        cooldown: 5400,
        band: [0, 600],
        hook: 'blink_reposition',
        vfx: 'dusk_blink',
        sfx: 'sfx_blink'
      }
    ],
    phases: [
      {
        id: 'p1',
        trigger: {
          atHealthPct: 1.0
        },
        attacks: ['duel', 'cleave', 'ashfall'],
        moveSpeed: 64,
        aggression: [900, 1380],
        introKey: 'boss.boss_ashen_regent.intro'
      },
      {
        id: 'p2',
        trigger: {
          atHealthPct: 0.66
        },
        attacks: ['duel', 'cleave', 'seasonfield', 'blink'],
        moveSpeed: 70,
        aggression: [800, 1260],
        arena: 'summit_seasons',
        introKey: 'boss.boss_ashen_regent.phase2'
      },
      {
        id: 'p3',
        trigger: {
          atHealthPct: 0.33
        },
        attacks: ['duel', 'cleave', 'conduit', 'ashfall', 'blink'],
        moveSpeed: 76,
        aggression: [700, 1120],
        arena: 'summit_conduit',
        introKey: 'boss.boss_ashen_regent.phase3'
      }
    ],
    tipKey: 'stage.30.test',
    trophyArt: 6
  },
] as const;

export function bossByStage(stage: number): BossDef | undefined {
  return BOSSES.find((b) => b.stage === stage);
}

export function bossById(id: string): BossDef | undefined {
  return BOSSES.find((b) => b.id === id);
}

/** The six chapter bosses, in gauntlet order. */
export const GAUNTLET_BOSSES = [5, 10, 15, 20, 25, 30].map((s) => bossByStage(s)!);
