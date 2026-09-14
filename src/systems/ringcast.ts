import type { Season } from '@/types';
import { ringById } from '@/content/rings';
import type { GameState } from './state';
import type { DerivedStats } from './progression';
import { ringPower, activeSynergies, recordSynergyDiscovery, type EffectSource, canTriggerSynergy } from './rings';
import { type Status, type AttackShape, shapeHits, CooldownTimer } from './combat';
import { seasonDamageModifier, seasonProfile } from './seasons';
import { normalise } from './iso';

/**
 * Ring ability execution.
 *
 * The world is supplied through a small interface so this file stays free of
 * Phaser and can be unit tested: it is the one place that decides what a ring
 * actually does, how synergies fire, and how the non-recursion rule is enforced.
 */

export interface CombatTarget {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  applyDamage(amount: number, source: EffectSource, tags: string[], poise?: number): number;
  applyStatus(s: Status): void;
  push(dx: number, dy: number): void;
}

export interface CombatWorld {
  season: Season;
  playerX: number;
  playerY: number;
  aimX: number;
  aimY: number;
  enemies(): CombatTarget[];
  /** Named VFX at a world position. */
  vfx(id: string, x: number, y: number, opts?: { angle?: number; scale?: number }): void;
  sound(id: string, x: number, y: number): void;
  /** Ignite a marked, burnable prop within radius. Returns how many burned. */
  igniteProps(x: number, y: number, radius: number): number;
  /** Freeze marked water within radius, opening a crossing. */
  freezeWater(x: number, y: number, radius: number): number;
  /** Break visible dark wards. Returns how many were disrupted. */
  disruptWards(x: number, y: number, radius: number): number;
  /** Ask the world to move the player (dash, blink). */
  movePlayer(dx: number, dy: number): void;
  /** Grant the player a shield value. */
  shieldPlayer(amount: number, seconds: number): void;
  /** Grant brief invulnerability frames. */
  grantIFrames(seconds: number): void;
  /** Queue a repeat of the player's next weapon attack. */
  queueEcho(power: number, seconds: number): void;
  /** Raise a timed guard that staggers a blocked attacker. */
  raiseGuard(seconds: number, staggerPower: number): void;
  /** Raise a shelter circle that intercepts projectiles. */
  raiseShelter(x: number, y: number, radius: number, intercepts: number, seconds: number): void;
  /** Leave a distracting shadow that draws attention. */
  spawnShadow(x: number, y: number, seconds: number): void;
  /** Place a root patch. */
  spawnRoots(x: number, y: number, radius: number, seconds: number, power: number): void;
  /** Fire a projectile of a named kind. */
  fireProjectile(kind: string, x: number, y: number, dx: number, dy: number, damage: number, tags: string[]): void;
  /** Report a synergy trigger so the journal and HUD can react. */
  onSynergy(id: string): void;
  notify(key: string, ...args: (string | number)[]): void;
}

export interface CastContext {
  state: GameState;
  stats: DerivedStats;
  world: CombatWorld;
}

export interface RingRuntime {
  id: string;
  cooldown: CooldownTimer;
  /** Per-synergy internal cooldowns. */
  synergyIcd: Map<string, number>;
}

export function createRuntime(id: string): RingRuntime {
  return { id, cooldown: new CooldownTimer(), synergyIcd: new Map() };
}

export interface RingSlotRuntime {
  slot: 'active1' | 'active2';
  runtime: RingRuntime | null;
}

const SOUND_FOR: Record<string, string> = {
  ember: 'ring_ember', stoneward: 'ring_stoneward', windstep: 'ring_windstep',
  thornwake: 'ring_thornwake', dawnward: 'ring_dawnward', venomcoil: 'ring_venomcoil',
  frostwake: 'ring_frostwake', iron_oath: 'ring_iron_oath', echo: 'ring_echo',
  stormcall: 'ring_stormcall', duskveil: 'ring_duskveil', last_hearth: 'ring_last_hearth',
};

export interface CastResult {
  cast: boolean;
  reason?: 'cooldown' | 'unknown' | 'silenced';
  hits: number;
  synergies: string[];
}

/**
 * Cast a ring's active ability.
 *
 * Effects spawned here are tagged `ring`; anything a synergy spawns is tagged
 * `synergy`, and `canTriggerSynergy` refuses to chain from those, which is what
 * stops Echo, chain lightning and the synergies themselves from recursing.
 */
export function castRing(ctx: CastContext, rt: RingRuntime, silenced = false): CastResult {
  const { state, stats, world } = ctx;
  const view = ringPower(state, rt.id, stats);
  const def = ringById(rt.id);
  if (!view || !def) return { cast: false, reason: 'unknown', hits: 0, synergies: [] };
  if (silenced) return { cast: false, reason: 'silenced', hits: 0, synergies: [] };
  if (!rt.cooldown.ready) return { cast: false, reason: 'cooldown', hits: 0, synergies: [] };

  rt.cooldown.start(view.cooldown);
  const aim = normalise(world.aimX - world.playerX, world.aimY - world.playerY);
  const angle = Math.atan2(aim.y, aim.x);
  const px = world.playerX;
  const py = world.playerY;
  const seasonMod = 1 + seasonDamageModifier(world.season, def.tags);
  const damage = Math.round(view.damage * seasonMod);
  const profile = seasonProfile(world.season);
  const sound = SOUND_FOR[rt.id];
  if (sound) world.sound(sound, px, py);

  let hits = 0;
  const hitTargets: CombatTarget[] = [];

  const hitShape = (shape: AttackShape, dmg: number, tags: string[], source: EffectSource, poise = 0, onHit?: (t: CombatTarget) => void) => {
    for (const t of world.enemies()) {
      if (!t.alive) continue;
      if (!shapeHits(shape, t)) continue;
      const dealt = t.applyDamage(dmg, source, tags, poise);
      if (dealt >= 0) {
        hits++;
        hitTargets.push(t);
        onHit?.(t);
      }
    }
  };

  switch (rt.id) {
    case 'ember': {
      const arc = view.evolved4 ? 0.62 : 0.48;
      world.vfx('ember_arc', px, py, { angle, scale: view.range / 210 });
      hitShape(
        { kind: 'cone', x: px, y: py, angle, range: view.range, arc },
        damage, ['fire'], 'ring', 8,
        (t) => t.applyStatus({ kind: 'burn', time: view.evolved4 ? 5 : 3, stacks: 1, dps: damage * 0.16 * (1 + stats.burnDamage), power: 1 }),
      );
      world.igniteProps(px + aim.x * view.range * 0.5, py + aim.y * view.range * 0.5, view.range * 0.55);
      break;
    }
    case 'stoneward': {
      const shield = Math.round(46 * view.power * (1 + stats.armour * 0.01));
      world.shieldPlayer(shield, view.evolved4 ? 7 : 5.5);
      world.vfx('stone_barrier', px, py, { scale: 1 + view.rank * 0.02 });
      break;
    }
    case 'windstep': {
      const dist = view.range * (view.evolved4 ? 1.2 : 1);
      world.movePlayer(aim.x * dist, aim.y * dist);
      world.grantIFrames(0.18);
      world.vfx('wind_gust', px, py, { angle, scale: dist / 260 });
      hitShape(
        { kind: 'line', x: px, y: py, angle, range: dist, width: 34 },
        damage, ['wind'], 'ring', 10,
        (t) => { if (view.evolved7) { t.push(aim.x * 90, aim.y * 90); t.applyStatus({ kind: 'slow', time: 1.6, stacks: 1, dps: 0, power: 0.3 }); } },
      );
      break;
    }
    case 'thornwake': {
      const tx = px + aim.x * view.range * 0.6;
      const ty = py + aim.y * view.range * 0.6;
      const radius = 96 * (view.evolved4 ? 1.25 : 1) * (1 + stats.ringRange);
      const duration = (view.evolved4 ? 3.6 : 2.6) * (1 + stats.rootDuration) * (1 + view.crowdControl);
      world.spawnRoots(tx, ty, radius, duration, view.power);
      world.vfx('root_patch', tx, ty, { scale: radius / 96 });
      hitShape(
        { kind: 'circle', x: tx, y: ty, angle: 0, range: radius },
        damage, ['nature'], 'ring', 6,
        (t) => t.applyStatus({ kind: 'root', time: duration, stacks: 1, dps: 0, power: 1 }),
      );
      break;
    }
    case 'dawnward': {
      world.vfx('light_pulse', px, py, { scale: view.range / 230 });
      const broken = world.disruptWards(px, py, view.range);
      hitShape(
        { kind: 'circle', x: px, y: py, angle: 0, range: view.range },
        damage, ['light'], 'ring', 14,
        (t) => { if (view.evolved4) t.applyStatus({ kind: 'slow', time: 1.4, stacks: 1, dps: 0, power: 0.25 }); },
      );
      if (broken > 0) world.notify('hud.ward_broken', broken);
      break;
    }
    case 'venomcoil': {
      const shots = view.evolved4 ? 2 : 1;
      for (let i = 0; i < shots; i++) {
        const spread = (i - (shots - 1) / 2) * 0.16;
        const a = angle + spread;
        world.fireProjectile('venom', px, py, Math.cos(a), Math.sin(a), damage, ['poison']);
      }
      break;
    }
    case 'frostwake': {
      const arc = view.evolved4 ? 0.66 : 0.52;
      world.vfx('frost_cone', px, py, { angle, scale: view.range / 250 });
      const slowPower = Math.min(0.55, (0.28 + view.crowdControl) * (1 + stats.slowPower));
      hitShape(
        { kind: 'cone', x: px, y: py, angle, range: view.range, arc },
        damage, ['frost'], 'ring', 10,
        (t) => {
          t.applyStatus({ kind: 'slow', time: 3, stacks: 1, dps: 0, power: slowPower });
          if (view.evolved7 && slowPower >= 0.5) t.applyStatus({ kind: 'freeze', time: 1.1, stacks: 1, dps: 0, power: 1 });
        },
      );
      if (profile.frozenWater || world.season === 'winter') {
        world.freezeWater(px + aim.x * view.range * 0.5, py + aim.y * view.range * 0.5, view.range * 0.6);
      }
      break;
    }
    case 'iron_oath': {
      const window = (view.evolved4 ? 1.0 : 0.75) * (1 + stats.blockWindow);
      world.raiseGuard(window, view.power * stats.parryStagger * (1 + view.crowdControl));
      world.vfx('oath_flash', px, py, { scale: 1 });
      break;
    }
    case 'echo': {
      const power = (view.evolved4 ? 0.62 : 0.48) * view.power;
      world.queueEcho(power, view.evolved7 ? 8 : 6);
      world.vfx('echo_ghost', px, py, { angle });
      break;
    }
    case 'stormcall': {
      const maxJumps = (view.evolved4 ? 4 : 3) + (profile.wetGround ? 1 : 0);
      const targets = world.enemies()
        .filter((t) => t.alive && Math.hypot(t.x - px, t.y - py) <= view.range)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, maxJumps);
      let falloff = 1;
      let prev = { x: px, y: py };
      for (const t of targets) {
        world.vfx('storm_bolt', t.x, t.y);
        world.vfx('chain_link', (prev.x + t.x) / 2, (prev.y + t.y) / 2, { angle: Math.atan2(t.y - prev.y, t.x - prev.x) });
        const dmg = Math.round(damage * falloff * (1 + stats.shockDamage));
        t.applyDamage(dmg, 'ring', ['lightning'], 12);
        if (view.evolved7 && t === targets[0]) t.applyStatus({ kind: 'shock', time: 0.8, stacks: 1, dps: 0, power: 1 });
        hits++;
        hitTargets.push(t);
        prev = t;
        falloff *= view.evolved4 ? 0.86 : 0.74;
      }
      break;
    }
    case 'duskveil': {
      const dist = view.range * (view.evolved4 ? 1.2 : 1);
      world.spawnShadow(px, py, view.evolved4 ? 4.5 : 3.2);
      world.movePlayer(aim.x * dist, aim.y * dist);
      world.grantIFrames(0.22 + stats.dodgeIFrames * 0.5);
      world.vfx('dusk_blink', px, py);
      world.vfx('dusk_blink', px + aim.x * dist, py + aim.y * dist);
      if (view.evolved7) {
        hitShape({ kind: 'circle', x: px, y: py, angle: 0, range: 110 }, Math.round(damage * 0.8), ['shadow'], 'ring', 8);
      }
      break;
    }
    case 'last_hearth': {
      const radius = view.range * (view.evolved4 ? 1.25 : 1);
      const intercepts = view.evolved4 ? 6 : 4;
      world.raiseShelter(px, py, radius, intercepts, view.evolved7 ? 7 : 5.5);
      world.vfx('hearth_circle', px, py, { scale: radius / 160 });
      break;
    }
    default:
      break;
  }

  // ------------------------------------------------------------- synergies
  const fired: string[] = [];
  const syns = activeSynergies(state, stats.synergyIcd);
  for (const syn of syns) {
    const pair = syn.id.split('_');
    void pair;
    const involves = syn.id.includes(rt.id);
    if (!involves) continue;
    const left = rt.synergyIcd.get(syn.id) ?? 0;
    if (left > 0) continue;
    if (!canTriggerSynergy('ring')) continue;
    const applied = applySynergy(syn.id, ctx, view.power * (1 + stats.synergyPower), syn.cap, hitTargets, { px, py, angle, aim });
    if (applied) {
      rt.synergyIcd.set(syn.id, syn.icd);
      fired.push(syn.id);
      world.onSynergy(syn.id);
      if (recordSynergyDiscovery(state, syn.id)) world.notify('journal.synergy_found', syn.nameKey);
      world.sound('synergy', px, py);
    }
  }

  return { cast: true, hits, synergies: fired };
}

interface SynergyGeometry { px: number; py: number; angle: number; aim: { x: number; y: number } }

/**
 * Synergy effects. Every one is capped, every one is tagged `synergy`, and none
 * of them can trigger another synergy, Echo, or a further chain.
 */
function applySynergy(
  id: string,
  ctx: CastContext,
  power: number,
  cap: number,
  alreadyHit: CombatTarget[],
  geo: SynergyGeometry,
): boolean {
  const { world, stats } = ctx;
  const source: EffectSource = 'synergy';
  const enemies = world.enemies().filter((t) => t.alive);

  switch (id) {
    case 'ember_windstep': {
      // Fire spreads along the gust to enemies that are not already burning.
      const line: AttackShape = { kind: 'line', x: geo.px, y: geo.py, angle: geo.angle, range: 300, width: 56 };
      let n = 0;
      for (const t of enemies) {
        if (n >= cap) break;
        if (!shapeHits(line, t)) continue;
        t.applyStatus({ kind: 'burn', time: 3.5, stacks: 1, dps: 16 * power * (1 + stats.burnDamage), power: 1 });
        world.vfx('burn_tick', t.x, t.y);
        n++;
      }
      return n > 0;
    }
    case 'frostwake_stormcall': {
      // Lightning shatters slowed or frozen targets for a burst.
      let n = 0;
      for (const t of enemies) {
        if (n >= cap) break;
        const chilled = alreadyHit.includes(t);
        if (!chilled) continue;
        t.applyDamage(Math.round(28 * power), source, ['frost', 'lightning'], 14);
        world.vfx('freeze_shatter', t.x, t.y);
        n++;
      }
      return n > 0;
    }
    case 'thornwake_venomcoil': {
      let n = 0;
      for (const t of enemies) {
        if (n >= cap) break;
        if (Math.hypot(t.x - geo.px, t.y - geo.py) > 260) continue;
        t.applyStatus({ kind: 'poison', time: 5, stacks: 2, dps: 9 * power * (1 + stats.poisonDamage), power: 1 });
        world.vfx('poison_tick', t.x, t.y);
        n++;
      }
      return n > 0;
    }
    case 'stoneward_iron_oath': {
      let n = 0;
      for (const t of enemies) {
        if (n >= cap) break;
        if (Math.hypot(t.x - geo.px, t.y - geo.py) > 150) continue;
        t.applyDamage(Math.round(34 * power), source, ['stone'], 26);
        t.push((t.x - geo.px) * 0.6, (t.y - geo.py) * 0.6);
        n++;
      }
      if (n > 0) world.vfx('barrier_break', geo.px, geo.py);
      return n > 0;
    }
    case 'echo_duskveil': {
      world.queueEcho(0.55 * power, 5);
      world.spawnShadow(geo.px, geo.py, 3.5);
      world.vfx('shadow_double', geo.px, geo.py);
      return true;
    }
    case 'dawnward_last_hearth': {
      world.raiseShelter(geo.px, geo.py, 200, 8, 7);
      world.shieldPlayer(Math.round(40 * power), 6);
      world.vfx('hearth_circle', geo.px, geo.py, { scale: 1.2 });
      world.vfx('light_pulse', geo.px, geo.py, { scale: 1.2 });
      return true;
    }
    default:
      return false;
  }
}

export function tickRuntime(rt: RingRuntime, dt: number): void {
  rt.cooldown.tick(dt);
  for (const [k, v] of rt.synergyIcd) {
    const left = v - dt;
    if (left <= 0) rt.synergyIcd.delete(k);
    else rt.synergyIcd.set(k, left);
  }
}
