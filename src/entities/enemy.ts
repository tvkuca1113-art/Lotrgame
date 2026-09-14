import Phaser from 'phaser';
import type { EnemyDef } from '@/types';
import { Actor } from './actor';
import type { EffectPool } from './effects';
import type { WorldRenderer } from '@/world/renderer';
import { isBlockedAt, type StageMap } from '@/world/stagegen';
import { hasLineOfSight, type AttackShape } from '@/systems/combat';
import { normalise } from '@/systems/iso';
import { play } from '@/audio/library';

/**
 * Enemy AI.
 *
 * Every family runs the same explicit state machine - patrol, notice, approach,
 * telegraph, attack, recovery, stagger, death - and differs in how it closes
 * distance and what it does at range. Ranged enemies keep their distance, wargs
 * flank, shield enemies open up after a committed swing, and heavy enemies
 * punish standing still.
 */
export type EnemyState = 'patrol' | 'notice' | 'approach' | 'strafe' | 'telegraph' | 'attack' | 'recover' | 'stagger' | 'dead';

export interface EnemyAttackRequest {
  shape: AttackShape;
  damage: number;
  poise: number;
}

export interface ProjectileRequest {
  kind: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
}

export class Enemy extends Actor {
  readonly def: EnemyDef;
  state: EnemyState = 'patrol';
  stateTime = 0;
  target: { x: number; y: number } | null = null;
  home: { x: number; y: number };
  noticeRange = 340;
  leashRange = 900;
  attackRequest: EnemyAttackRequest | null = null;
  projectileRequest: ProjectileRequest | null = null;
  telegraphShown = false;
  private strafeDir = 1;
  private repathTimer = 0;
  private patrolTarget: { x: number; y: number } | null = null;
  readonly group: number;
  readonly elite: boolean;
  /** Set while a shield enemy is presenting its guard. */
  guarding = false;
  private attackCooldown = 0;
  private difficultyTelegraph: number;

  constructor(
    scene: Phaser.Scene,
    renderer: WorldRenderer,
    effects: EffectPool,
    map: StageMap,
    def: EnemyDef,
    x: number,
    y: number,
    group: number,
    elite: boolean,
    telegraphScale: number,
  ) {
    const scale = (def.scale ?? 1) * (elite ? 1.15 : 1);
    super(scene, renderer, effects, map, {
      sheet: def.art, x, y,
      radius: 17 * scale,
      maxHealth: Math.round(def.health * (elite ? 1.7 : 1)),
      speed: def.speed,
      scale,
      team: 'enemy',
      poise: def.poise ?? 14,
      armour: def.armour ?? 0,
      shadowScale: scale,
    });
    this.def = def;
    this.group = group;
    this.elite = elite;
    this.home = { x, y };
    this.difficultyTelegraph = telegraphScale;
    this.noticeRange = def.behaviour === 'ranged' || def.behaviour === 'caster' ? 460 : 340;
    if (elite) this.sprite.setTint(0xffd9a8);
  }

  private setState(s: EnemyState, time = 0): void {
    this.state = s;
    this.stateTime = time;
    this.telegraphShown = false;
  }

  /** Preferred engagement distance for this family. */
  private preferredRange(): number {
    switch (this.def.behaviour) {
      case 'ranged': return this.def.reach * 0.72;
      case 'caster': return this.def.reach * 0.7;
      case 'bomber': return this.def.reach * 0.8;
      case 'flanker': return this.def.reach * 0.6;
      default: return this.def.reach * 0.62;
    }
  }

  think(dt: number, player: { x: number; y: number; alive: boolean }, blockedAt: (x: number, y: number) => boolean): void {
    if (!this.alive) { this.setState('dead'); return; }
    if (this.poise.staggered > 0) {
      if (this.state !== 'stagger') {
        this.setState('stagger', this.poise.staggered);
        this.playAnim('hit', 300, true);
        this.attackRequest = null;
      }
      return;
    }
    if (this.state === 'stagger') this.setState('approach');

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.repathTimer = Math.max(0, this.repathTimer - dt);
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const canSee = hasLineOfSight(this.x, this.y, player.x, player.y, blockedAt);

    switch (this.state) {
      case 'patrol': {
        if (player.alive && dist < this.noticeRange && canSee) {
          this.setState('notice', 0.35);
          this.faceTowards(player.x, player.y);
          break;
        }
        this.patrol(dt);
        break;
      }
      case 'notice': {
        this.faceTowards(player.x, player.y);
        this.playAnim('idle');
        this.stateTime -= dt;
        if (this.stateTime <= 0) this.setState('approach');
        break;
      }
      case 'approach': {
        if (!player.alive || dist > this.leashRange) { this.setState('patrol'); break; }
        this.target = { x: player.x, y: player.y };
        this.faceTowards(player.x, player.y);
        const want = this.preferredRange();
        if (dist <= this.def.reach && canSee && this.attackCooldown <= 0) {
          this.beginTelegraph();
          break;
        }
        if (this.def.behaviour === 'ranged' || this.def.behaviour === 'caster' || this.def.behaviour === 'bomber') {
          if (dist < want * 0.65) {
            this.stepAway(player, dt);
          } else if (dist > this.def.reach * 0.95 || !canSee) {
            this.stepToward(player, dt, 1);
          } else {
            this.setState('strafe', 0.6 + Math.random() * 0.6);
          }
          break;
        }
        if (this.def.behaviour === 'flanker' && dist < 260 && this.repathTimer <= 0) {
          this.setState('strafe', 0.5 + Math.random() * 0.5);
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          this.repathTimer = 1.6;
          break;
        }
        this.stepToward(player, dt, this.def.behaviour === 'heavy' ? 0.82 : 1);
        break;
      }
      case 'strafe': {
        this.stateTime -= dt;
        this.faceTowards(player.x, player.y);
        const n = normalise(player.x - this.x, player.y - this.y);
        const perp = { x: -n.y * this.strafeDir, y: n.x * this.strafeDir };
        const speed = this.speed * 0.72 * this.moveMultiplier();
        this.moveBy(perp.x * speed * dt, perp.y * speed * dt);
        this.playAnim('walk');
        if (this.stateTime <= 0) this.setState('approach');
        if (dist <= this.def.reach && this.attackCooldown <= 0 && canSee) this.beginTelegraph();
        break;
      }
      case 'telegraph': {
        this.stateTime -= dt;
        // Shield enemies present their guard during the windup.
        this.guarding = this.def.behaviour === 'shield';
        if (this.def.behaviour !== 'heavy') this.faceTowards(player.x, player.y);
        if (this.stateTime <= 0) {
          this.setState('attack', 0.12);
          this.fire(player);
        }
        break;
      }
      case 'attack': {
        this.guarding = false;
        this.stateTime -= dt;
        if (this.stateTime <= 0) {
          this.setState('recover', this.def.recovery / 1000);
          this.playAnim('idle');
        }
        break;
      }
      case 'recover': {
        this.stateTime -= dt;
        if (this.stateTime <= 0) {
          this.attackCooldown = this.def.behaviour === 'heavy' ? 0.7 : 0.35;
          this.setState('approach');
        }
        break;
      }
      default:
        break;
    }
  }

  private beginTelegraph(): void {
    this.setState('telegraph', (this.def.telegraph / 1000) * this.difficultyTelegraph);
    this.playAnim(this.def.behaviour === 'ranged' ? 'shoot' : 'attack', this.def.telegraph + this.def.recovery, true);
    if (this.def.behaviour === 'heavy') play('boss_telegraph', { volume: 0.4 });
  }

  private fire(player: { x: number; y: number }): void {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    if (this.def.projectile) {
      const n = normalise(player.x - this.x, player.y - this.y);
      this.projectileRequest = {
        kind: this.def.projectile, x: this.x, y: this.y,
        dx: n.x, dy: n.y, damage: this.def.damage,
      };
      play(this.def.projectile === 'bolt' ? 'crossbow' : 'bow_release', { volume: 0.7 });
      return;
    }
    this.attackRequest = {
      shape: {
        kind: this.def.behaviour === 'heavy' ? 'arc' : 'arc',
        x: this.x, y: this.y, angle,
        range: this.def.reach + 14,
        arc: this.def.behaviour === 'heavy' ? 1.1 : 0.85,
      },
      damage: this.def.damage,
      poise: this.def.behaviour === 'heavy' ? 26 : 12,
    };
    play(this.def.behaviour === 'heavy' ? 'swing_heavy' : 'swing_light', { volume: 0.7 });
  }

  private stepToward(p: { x: number; y: number }, dt: number, factor: number): void {
    const n = normalise(p.x - this.x, p.y - this.y);
    const speed = this.speed * factor * this.moveMultiplier();
    // Simple obstacle slide: if blocked ahead, try the two perpendicular ways.
    const nx = this.x + n.x * speed * dt;
    const ny = this.y + n.y * speed * dt;
    if (this.map && isBlockedAt(this.map, nx + n.x * this.radius, ny + n.y * this.radius)) {
      const perp = { x: -n.y, y: n.x };
      const s = this.strafeDir;
      this.moveBy(perp.x * s * speed * dt, perp.y * s * speed * dt);
    } else {
      this.moveBy(n.x * speed * dt, n.y * speed * dt);
    }
    this.playAnim(this.def.speed > 120 ? 'run' : 'walk');
  }

  private stepAway(p: { x: number; y: number }, dt: number): void {
    const n = normalise(this.x - p.x, this.y - p.y);
    const speed = this.speed * 0.8 * this.moveMultiplier();
    this.moveBy(n.x * speed * dt, n.y * speed * dt);
    this.playAnim('walk');
  }

  private patrol(dt: number): void {
    if (!this.patrolTarget || Math.hypot(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y) < 16) {
      const ang = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 90;
      this.patrolTarget = { x: this.home.x + Math.cos(ang) * r, y: this.home.y + Math.sin(ang) * r };
      this.repathTimer = 2 + Math.random() * 2;
    }
    this.repathTimer -= dt;
    if (this.repathTimer <= 0) { this.patrolTarget = null; this.playAnim('idle'); return; }
    const n = normalise(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y);
    this.facing = n;
    this.moveBy(n.x * this.speed * 0.4 * dt, n.y * this.speed * 0.4 * dt);
    this.playAnim('walk');
    this.refreshFacing();
  }

  /** Shield enemies reduce frontal damage while guarding. */
  damageReduction(fromX: number, fromY: number): number {
    if (!this.guarding) return 0;
    const n = normalise(fromX - this.x, fromY - this.y);
    const dot = n.x * this.facing.x + n.y * this.facing.y;
    return dot > 0.35 ? 0.72 : 0;
  }

  override kill(): void {
    super.kill();
    this.setState('dead');
    this.attackRequest = null;
    this.projectileRequest = null;
    play('enemy_die', { volume: 0.7 });
  }
}
