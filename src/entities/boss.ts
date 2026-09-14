import Phaser from 'phaser';
import type { BossAttackDef, BossDef, BossPhaseDef } from '@/types';
import { bossBaseDamage } from '@/content/bosses';
import { Actor } from './actor';
import type { EffectPool } from './effects';
import type { WorldRenderer } from '@/world/renderer';
import type { StageMap } from '@/world/stagegen';
import type { AttackShape } from '@/systems/combat';
import { normalise } from '@/systems/iso';
import { play, type SoundId } from '@/audio/library';

/**
 * Boss controller.
 *
 * Attacks are data (see src/content/bosses.ts); this file runs them. Every
 * attack telegraphs, goes active for a fixed window and then recovers, and a
 * `hook` name selects the extra mechanic that makes each fight its own puzzle.
 *
 * No attack is unavoidable, no stun is permanent, and no phase grants
 * unexplained invulnerability: `armourWindow` is the only damage reduction and
 * it is always tied to a visible stance.
 */

export type BossState = 'intro' | 'idle' | 'reposition' | 'telegraph' | 'active' | 'recover' | 'phase' | 'dead';

export interface BossHitRequest {
  shape: AttackShape;
  damage: number;
  poise: number;
  attack: BossAttackDef;
}

export interface BossSpawnRequest { kind: 'brood' | 'guards' | 'banner'; count: number; x: number; y: number }
export interface BossGroundRequest {
  kind: 'pools' | 'mines' | 'vents' | 'fissures' | 'sectors' | 'charges' | 'siege' | 'season' | 'conduit' | 'anchors' | 'weave' | 'mirrors';
  x: number; y: number; radius: number; duration: number; damage: number;
}
export interface BossProjectileRequest { kind: string; x: number; y: number; dx: number; dy: number; damage: number; redirectable: boolean }

export class Boss extends Actor {
  readonly def: BossDef;
  readonly stage: number;
  state: BossState = 'intro';
  stateTime = 0;
  phaseIndex = 0;
  currentAttack: BossAttackDef | null = null;
  hitRequest: BossHitRequest | null = null;
  spawnRequest: BossSpawnRequest | null = null;
  groundRequest: BossGroundRequest | null = null;
  projectileRequest: BossProjectileRequest | null = null;
  telegraphSprite: Phaser.GameObjects.Sprite | null = null;
  /** Visible stance-based damage reduction, 0 unless guarding. */
  armourWindow = 0;
  /** Exposed weak point after a committed slam; hitting it is the reward. */
  weakPoint = 0;
  /** Named mechanic flags the scene reads. */
  flags = new Set<string>();
  onPhaseChange: ((phase: BossPhaseDef, index: number) => void) | null = null;
  private cooldowns = new Map<string, number>();
  private baseDamage: number;
  private telegraphScale: number;
  private damageScale: number;
  private aggroPauseRange: [number, number];
  private chargeDir = { x: 1, y: 0 };
  private chargeSpeed = 0;
  private echoQueue: { at: number; attack: BossAttackDef; angle: number; x: number; y: number }[] = [];
  private stanceIndex = 0;
  private elapsed = 0;
  private arenaCentre: { x: number; y: number };

  constructor(
    scene: Phaser.Scene,
    renderer: WorldRenderer,
    effects: EffectPool,
    map: StageMap,
    def: BossDef,
    x: number,
    y: number,
    opts: { telegraphScale: number; damageScale: number; healthScale: number },
  ) {
    super(scene, renderer, effects, map, {
      sheet: def.art, x, y,
      radius: 24 * def.scale,
      maxHealth: Math.round(def.health * opts.healthScale),
      speed: def.phases[0]?.moveSpeed ?? 60,
      scale: def.scale,
      team: 'enemy',
      poise: def.poise,
      armour: def.armour,
      shadowScale: def.scale * 1.15,
    });
    this.def = def;
    this.stage = def.stage;
    this.baseDamage = bossBaseDamage(def.stage);
    this.telegraphScale = opts.telegraphScale;
    this.damageScale = opts.damageScale;
    this.aggroPauseRange = def.phases[0]?.aggression ?? [900, 1400];
    this.arenaCentre = { x, y };
  }

  get phase(): BossPhaseDef { return this.def.phases[this.phaseIndex]!; }
  get healthRatio(): number { return this.health / Math.max(1, this.maxHealth); }
  get phaseCount(): number { return this.def.phases.length; }

  beginFight(): void {
    this.state = 'idle';
    this.stateTime = 0.6;
  }

  private attackById(id: string): BossAttackDef | undefined {
    return this.def.attacks.find((a) => a.id === id);
  }

  private pickAttack(distance: number): BossAttackDef | null {
    const options = this.phase.attacks
      .map((id) => this.attackById(id))
      .filter((a): a is BossAttackDef => !!a)
      .filter((a) => (this.cooldowns.get(a.id) ?? 0) <= 0)
      .filter((a) => distance >= a.band[0] - 24 && distance <= a.band[1] + 40);
    if (options.length === 0) return null;
    // The Black Castellan rotates stances rather than choosing freely.
    if (this.flags.has('stance_locked')) {
      const stance = options.filter((a) => a.hook?.startsWith('stance_'));
      if (stance.length) return stance[this.stanceIndex % stance.length]!;
    }
    return options[Math.floor(Math.random() * options.length)]!;
  }

  think(dt: number, player: { x: number; y: number; alive: boolean }): void {
    if (!this.alive) { this.state = 'dead'; return; }
    this.elapsed += dt;
    for (const [k, v] of this.cooldowns) {
      const left = v - dt;
      if (left <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, left);
    }
    if (this.weakPoint > 0) this.weakPoint = Math.max(0, this.weakPoint - dt);
    if (this.armourWindow > 0) this.armourWindow = Math.max(0, this.armourWindow - dt);

    // Delayed echo strikes (the Iron Echo).
    for (let i = this.echoQueue.length - 1; i >= 0; i--) {
      const e = this.echoQueue[i]!;
      if (this.elapsed >= e.at) {
        this.emitHit(e.attack, e.angle, e.x, e.y, 0.85);
        this.effects.play('echo_ghost', e.x, e.y, { angle: e.angle });
        this.echoQueue.splice(i, 1);
      }
    }

    // Phase transitions.
    const next = this.def.phases[this.phaseIndex + 1];
    if (next && this.healthRatio <= next.trigger.atHealthPct && this.state !== 'phase') {
      this.enterPhase(this.phaseIndex + 1);
      return;
    }

    if (this.poise.staggered > 0 && this.state !== 'phase') {
      this.playAnim('hit', 300, true);
      this.clearTelegraph();
      return;
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    switch (this.state) {
      case 'intro':
        this.playAnim('idle');
        break;
      case 'phase':
        this.stateTime -= dt;
        this.playAnim('roar', 0, false);
        if (this.stateTime <= 0) { this.state = 'idle'; this.stateTime = 0.4; }
        break;
      case 'idle': {
        this.faceTowards(player.x, player.y);
        this.playAnim('idle');
        this.stateTime -= dt;
        if (this.stateTime <= 0) {
          const attack = this.pickAttack(dist);
          if (attack) this.beginAttack(attack, player);
          else { this.state = 'reposition'; this.stateTime = 0.5 + Math.random() * 0.5; }
        }
        break;
      }
      case 'reposition': {
        this.stateTime -= dt;
        this.faceTowards(player.x, player.y);
        const want = 110;
        const n = normalise(player.x - this.x, player.y - this.y);
        const speed = this.phase.moveSpeed * this.moveMultiplier();
        if (dist > want) this.moveBy(n.x * speed * dt, n.y * speed * dt);
        else this.moveBy(-n.y * speed * 0.6 * dt, n.x * speed * 0.6 * dt);
        this.playAnim(this.phase.moveSpeed > 70 ? 'run' : 'walk');
        if (this.stateTime <= 0) { this.state = 'idle'; this.stateTime = 0.1; }
        break;
      }
      case 'telegraph': {
        this.stateTime -= dt;
        if (this.currentAttack && !this.currentAttack.hook?.includes('committed')) {
          this.faceTowards(player.x, player.y);
        }
        if (this.stateTime <= 0 && this.currentAttack) {
          this.executeAttack(this.currentAttack, player);
        }
        break;
      }
      case 'active': {
        this.stateTime -= dt;
        if (this.chargeSpeed > 0) {
          this.moveBy(this.chargeDir.x * this.chargeSpeed * dt, this.chargeDir.y * this.chargeSpeed * dt);
          if (this.currentAttack) {
            this.hitRequest = {
              shape: { kind: 'circle', x: this.x, y: this.y, angle: 0, range: this.radius + 22 },
              damage: this.damageFor(this.currentAttack),
              poise: 30,
              attack: this.currentAttack,
            };
          }
        }
        if (this.stateTime <= 0) {
          this.chargeSpeed = 0;
          this.state = 'recover';
          this.stateTime = (this.currentAttack?.recovery ?? 600) / 1000;
          if (this.currentAttack?.hook === 'expose_weakpoint' || this.currentAttack?.hook === 'punishable') {
            this.weakPoint = this.stateTime;
          }
          this.playAnim('idle');
        }
        break;
      }
      case 'recover': {
        this.stateTime -= dt;
        this.faceTowards(player.x, player.y);
        if (this.stateTime <= 0) {
          const [lo, hi] = this.phase.aggression;
          this.state = 'idle';
          this.stateTime = (lo + Math.random() * (hi - lo)) / 1000;
          this.currentAttack = null;
        }
        break;
      }
      default:
        break;
    }
    void this.aggroPauseRange;
  }

  private enterPhase(index: number): void {
    this.phaseIndex = index;
    const p = this.phase;
    this.state = 'phase';
    this.stateTime = 1.4;
    this.speed = p.moveSpeed;
    this.cooldowns.clear();
    this.clearTelegraph();
    this.chargeSpeed = 0;
    this.poise.staggered = 0;
    this.flags.add(`arena:${p.arena ?? 'none'}`);
    if (this.def.id === 'boss_castellan') this.flags.add('stance_locked');
    play('boss_phase', { volume: 1 });
    this.playAnim('roar', 1300, true);
    this.onPhaseChange?.(p, index);
  }

  private damageFor(a: BossAttackDef): number {
    return Math.max(1, Math.round(this.baseDamage * a.damage * this.damageScale));
  }

  private beginAttack(a: BossAttackDef, player: { x: number; y: number }): void {
    this.currentAttack = a;
    this.state = 'telegraph';
    this.stateTime = (a.telegraph / 1000) * this.telegraphScale;
    this.cooldowns.set(a.id, a.cooldown / 1000);
    this.faceTowards(player.x, player.y);
    this.playAnim(a.anim, a.telegraph + a.active + a.recovery, true);
    if (a.sfx) play(a.sfx.replace('sfx_', '') as SoundId, { volume: 0.8 });
    else play('boss_telegraph', { volume: 0.5 });

    if (a.hook === 'guard_stance' || a.hook === 'frontal_block' || a.hook === 'stance_guard') {
      this.armourWindow = (a.telegraph + a.active) / 1000;
    }
    if (a.hook === 'swap_stance') this.stanceIndex = (this.stanceIndex + 1) % 3;
  }

  private executeAttack(a: BossAttackDef, player: { x: number; y: number }): void {
    this.state = 'active';
    this.stateTime = a.active / 1000;
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const damage = this.damageFor(a);

    switch (a.shape) {
      case 'projectile': {
        const n = normalise(player.x - this.x, player.y - this.y);
        const count = a.projectiles ?? 1;
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * 0.2;
          const ca = Math.atan2(n.y, n.x) + spread;
          this.projectileRequest = {
            kind: 'boss_bolt', x: this.x, y: this.y,
            dx: Math.cos(ca), dy: Math.sin(ca), damage,
            redirectable: a.hook === 'redirect_ballista',
          };
        }
        break;
      }
      case 'summon': {
        this.spawnRequest = {
          kind: a.hook === 'summon_brood' ? 'brood' : a.hook === 'banner_summon' ? 'banner' : 'guards',
          count: a.hook === 'summon_brood' ? 3 : 2,
          x: this.x, y: this.y,
        };
        break;
      }
      case 'ground': {
        this.groundRequest = {
          kind: groundKindFor(a.hook),
          x: a.hook === 'season_field' || a.hook === 'rotating_sectors' || a.hook === 'conduit_break' ? this.arenaCentre.x : player.x,
          y: a.hook === 'season_field' || a.hook === 'rotating_sectors' || a.hook === 'conduit_break' ? this.arenaCentre.y : player.y,
          radius: a.range,
          duration: a.active / 1000,
          damage,
        };
        break;
      }
      case 'chain': {
        this.hitRequest = {
          shape: { kind: 'circle', x: this.x, y: this.y, angle, range: a.range },
          damage, poise: 12, attack: a,
        };
        break;
      }
      default:
        this.emitHit(a, angle, this.x, this.y, 1);
        break;
    }

    // Committed charges keep moving through the active window.
    if (a.hook === 'committed_charge') {
      this.chargeDir = normalise(player.x - this.x, player.y - this.y);
      this.chargeSpeed = 330;
      this.stateTime = a.active / 1000;
      play('boss_charge', { volume: 0.9 });
    }
    if (a.hook === 'leap' || a.hook === 'landing_marker' || a.hook === 'landing_marker_double') {
      this.x = player.x + (Math.random() - 0.5) * 40;
      this.y = player.y + (Math.random() - 0.5) * 40;
      this.emitHit(a, angle, this.x, this.y, 1);
    }
    if (a.hook === 'blink_reposition') {
      const ang = Math.random() * Math.PI * 2;
      this.x = player.x + Math.cos(ang) * 150;
      this.y = player.y + Math.sin(ang) * 150;
    }
    if (a.hook === 'echo_strike') {
      this.echoQueue.push({ at: this.elapsed + 0.75, attack: a, angle, x: this.x, y: this.y });
    }
    if (a.hook === 'expose_anchors') this.flags.add('anchors_exposed');
    if (a.hook === 'spawn_mirrors') this.flags.add('mirrors');
    if (a.hook === 'reweave_arena') this.flags.add('reweave');
    if (a.hook === 'trench_collapse' || a.hook === 'collapse_ring') this.flags.add('collapse');
    if (a.hook === 'pillar_bait') this.flags.add('pillar_bait');
    if (a.hook === 'cooling_window') this.weakPoint = (a.active + a.recovery) / 1000;
  }

  private emitHit(a: BossAttackDef, angle: number, ox: number, oy: number, scale: number): void {
    const damage = Math.round(this.damageFor(a) * scale);
    const kind: AttackShape['kind'] =
      a.shape === 'arc' ? 'arc'
        : a.shape === 'cone' ? 'cone'
          : a.shape === 'line' ? 'line'
            : a.shape === 'ring' ? 'ring'
              : 'circle';
    this.hitRequest = {
      shape: {
        kind, x: ox, y: oy, angle,
        range: a.range,
        arc: a.arc ?? 1.2,
        width: 34,
        inner: kind === 'ring' ? a.range * 0.55 : 0,
      },
      damage,
      poise: a.shape === 'circle' || a.shape === 'ring' ? 30 : 16,
      attack: a,
    };
  }

  /** Extra reduction from a visible guard stance. Never a blanket immunity. */
  damageReduction(fromX: number, fromY: number): number {
    if (this.armourWindow <= 0) return 0;
    const n = normalise(fromX - this.x, fromY - this.y);
    const dot = n.x * this.facing.x + n.y * this.facing.y;
    return dot > 0.25 ? 0.7 : 0;
  }

  /** Hitting an exposed weak point is rewarded with bonus damage. */
  weakPointMultiplier(): number {
    return this.weakPoint > 0 ? 1.6 : 1;
  }

  clearTelegraph(): void {
    this.telegraphSprite?.destroy();
    this.telegraphSprite = null;
  }

  /** Full reset for a retry: the arena and the boss both go back to the start. */
  reset(x: number, y: number): void {
    this.x = x; this.y = y;
    this.health = this.maxHealth;
    this.alive = true;
    this.phaseIndex = 0;
    this.state = 'intro';
    this.stateTime = 0;
    this.cooldowns.clear();
    this.echoQueue.length = 0;
    this.flags.clear();
    this.statuses.length = 0;
    this.poise.value = this.poise.max;
    this.poise.staggered = 0;
    this.armourWindow = 0;
    this.weakPoint = 0;
    this.chargeSpeed = 0;
    this.elapsed = 0;
    this.speed = this.def.phases[0]?.moveSpeed ?? 60;
    this.sprite.setAlpha(1);
    this.shadow.setAlpha(0.8);
    this.clearTelegraph();
    this.playAnim('idle', 0, true);
  }

  override kill(): void {
    super.kill();
    this.state = 'dead';
    this.clearTelegraph();
    this.hitRequest = null;
    play('boss_defeat', { volume: 1 });
  }
}

function groundKindFor(hook: string | undefined): BossGroundRequest['kind'] {
  switch (hook) {
    case 'spawn_pools': return 'pools';
    case 'arm_mines': return 'mines';
    case 'vent_burst': return 'vents';
    case 'alternating_fissures': return 'fissures';
    case 'rotating_sectors': return 'sectors';
    case 'timed_charges': return 'charges';
    case 'siege_fire': return 'siege';
    case 'season_field': return 'season';
    case 'conduit_break': return 'conduit';
    case 'expose_anchors': return 'anchors';
    case 'reweave_arena': return 'weave';
    case 'spawn_mirrors': return 'mirrors';
    default: return 'pools';
  }
}
