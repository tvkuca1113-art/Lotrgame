import Phaser from 'phaser';
import type { WeaponFamily } from '@/types';
import { Actor, type ActorConfig } from './actor';
import type { EffectPool } from './effects';
import type { WorldRenderer } from '@/world/renderer';
import type { StageMap } from '@/world/stagegen';
import type { DerivedStats } from '@/systems/progression';
import { BASE_STATS } from '@/systems/progression';
import {
  type StaminaState, spendStamina, tickStamina, CooldownTimer,
  type AttackShape, flaskHeal,
} from '@/systems/combat';
import { normalise } from '@/systems/iso';
import { play } from '@/audio/library';

/**
 * The player.
 *
 * Basic attacks are always available, even at zero stamina. Dodge costs
 * stamina, grants a short window of invulnerability and has its own cooldown;
 * stamina regenerates after a short delay rather than continuously.
 */

export interface WeaponProfile {
  family: WeaponFamily;
  /** Combo of light attacks. */
  combo: { anim: string; damage: number; windup: number; active: number; recovery: number; range: number; arc: number; poise: number }[];
  /** Secondary action: guard for sword, charged shot for bow, heavy for axe. */
  secondary: 'guard' | 'charge' | 'heavy';
  staminaPerSwing: number;
}

export const WEAPON_PROFILES: Record<WeaponFamily, WeaponProfile> = {
  sword: {
    family: 'sword',
    combo: [
      { anim: 'attack', damage: 1.0, windup: 0.1, active: 0.09, recovery: 0.2, range: 76, arc: 1.15, poise: 10 },
      { anim: 'attack2', damage: 1.15, windup: 0.12, active: 0.1, recovery: 0.26, range: 82, arc: 1.5, poise: 14 },
    ],
    secondary: 'guard',
    staminaPerSwing: 8,
  },
  bow: {
    family: 'bow',
    combo: [
      { anim: 'attack', damage: 0.85, windup: 0.14, active: 0.05, recovery: 0.24, range: 0, arc: 0, poise: 4 },
    ],
    secondary: 'charge',
    staminaPerSwing: 6,
  },
  axe: {
    family: 'axe',
    combo: [
      { anim: 'attack', damage: 1.3, windup: 0.18, active: 0.12, recovery: 0.3, range: 92, arc: 1.4, poise: 20 },
      { anim: 'attack2', damage: 1.45, windup: 0.2, active: 0.13, recovery: 0.36, range: 98, arc: 1.9, poise: 26 },
    ],
    secondary: 'heavy',
    staminaPerSwing: 12,
  },
};

export type PlayerPhase = 'idle' | 'move' | 'windup' | 'active' | 'recovery' | 'dodge' | 'guard' | 'charge' | 'hurt' | 'dead';

export interface PlayerShield { amount: number; time: number }
export interface EchoQueued { power: number; time: number }
export interface GuardState { time: number; staggerPower: number; perfectWindow: number }

export class Player extends Actor {
  stats: DerivedStats;
  stamina: StaminaState;
  weapon: WeaponProfile;
  phase: PlayerPhase = 'idle';
  phaseTime = 0;
  comboIndex = 0;
  comboWindow = 0;
  dodgeCd = new CooldownTimer();
  attackCd = new CooldownTimer();
  flask: number;
  flaskMax: number;
  shield: PlayerShield = { amount: 0, time: 0 };
  echo: EchoQueued | null = null;
  guard: GuardState = { time: 0, staggerPower: 0, perfectWindow: 0 };
  shelter: { x: number; y: number; radius: number; intercepts: number; time: number } | null = null;
  chargeTime = 0;
  lastStandUsed = false;
  /** Pending hit for the current swing, consumed by the scene. */
  pendingHit: { shape: AttackShape; damage: number; poise: number; echo: boolean } | null = null;
  dodgeDir = { x: 1, y: 0 };
  facingLocked = false;

  constructor(
    scene: Phaser.Scene,
    renderer: WorldRenderer,
    effects: EffectPool,
    map: StageMap | null,
    cfg: ActorConfig,
    stats: DerivedStats,
    family: WeaponFamily,
    flask: number,
    flaskMax: number,
  ) {
    super(scene, renderer, effects, map, { ...cfg, maxHealth: stats.maxHealth, team: 'player' });
    this.stats = stats;
    this.weapon = WEAPON_PROFILES[family];
    this.stamina = { value: stats.maxStamina, max: stats.maxStamina, delay: 0 };
    this.flask = flask;
    this.flaskMax = flaskMax;
    this.maxHealth = stats.maxHealth;
    this.health = stats.maxHealth;
    this.speed = stats.moveSpeed;
    this.armour = stats.armour;
    this.poise = { value: 40, max: 40, staggered: 0 };
  }

  setStats(stats: DerivedStats, family: WeaponFamily): void {
    const healthRatio = this.health / Math.max(1, this.maxHealth);
    this.stats = stats;
    this.maxHealth = stats.maxHealth;
    this.health = Math.max(1, Math.round(stats.maxHealth * healthRatio));
    this.stamina.max = stats.maxStamina;
    this.stamina.value = Math.min(this.stamina.value, stats.maxStamina);
    this.speed = stats.moveSpeed;
    this.armour = stats.armour;
    this.weapon = WEAPON_PROFILES[family];
  }

  get busy(): boolean {
    return this.phase === 'windup' || this.phase === 'active' || this.phase === 'recovery' || this.phase === 'dodge' || this.phase === 'hurt';
  }

  get canAct(): boolean {
    return this.alive && this.phase !== 'dodge' && this.phase !== 'hurt' && this.poise.staggered <= 0;
  }

  /** Movement. Attacks do not stop movement outright, they slow it. */
  moveInput(dx: number, dy: number, dt: number): void {
    if (!this.alive) return;
    if (this.phase === 'dodge') {
      const boost = 430;
      this.moveBy(this.dodgeDir.x * boost * dt, this.dodgeDir.y * boost * dt);
      return;
    }
    const slow = this.phase === 'windup' || this.phase === 'active' ? 0.34
      : this.phase === 'recovery' ? 0.55
        : this.phase === 'guard' ? 0.5
          : this.phase === 'charge' ? 0.55 : 1;
    const mult = this.moveMultiplier() * slow;
    if (dx === 0 && dy === 0) {
      if (this.phase === 'move') this.phase = 'idle';
      return;
    }
    this.moveBy(dx * this.speed * mult * dt, dy * this.speed * mult * dt);
    if (this.phase === 'idle' || this.phase === 'move') this.phase = 'move';
  }

  aimAt(x: number, y: number): void {
    if (this.facingLocked) return;
    const n = normalise(x - this.x, y - this.y);
    if (n.x || n.y) this.facing = n;
  }

  tryAttack(): boolean {
    if (!this.canAct) return false;
    if (this.phase === 'windup' || this.phase === 'active') return false;
    if (this.phase === 'recovery' && this.comboWindow <= 0) return false;
    if (!this.attackCd.ready && this.phase !== 'recovery') return false;
    const stepIdx = this.phase === 'recovery' && this.comboWindow > 0
      ? (this.comboIndex + 1) % this.weapon.combo.length
      : 0;
    this.comboIndex = stepIdx;
    const step = this.weapon.combo[stepIdx]!;
    // Basic attacks stay available at zero stamina; they simply do not drain it.
    spendStamina(this.stamina, Math.min(this.stamina.value, this.weapon.staminaPerSwing));
    this.phase = 'windup';
    this.phaseTime = step.windup / this.stats.attackSpeed;
    this.comboWindow = 0;
    this.playAnim(step.anim, (step.windup + step.active + step.recovery) * 1000 / this.stats.attackSpeed, true);
    play(this.weapon.family === 'axe' ? 'swing_heavy' : this.weapon.family === 'bow' ? 'bow_release' : 'swing_light', { volume: 0.9 });
    return true;
  }

  tryDodge(): boolean {
    if (!this.canAct || !this.dodgeCd.ready) return false;
    if (this.stamina.value < this.stats.dodgeCost) return false;
    spendStamina(this.stamina, this.stats.dodgeCost);
    this.phase = 'dodge';
    this.phaseTime = 0.34;
    this.dodgeDir = { ...this.facing };
    this.invulnerable = Math.max(this.invulnerable, this.stats.dodgeIFrames);
    this.ethereal = 0.34;
    this.dodgeCd.start(BASE_STATS.dodgeCooldown);
    this.playAnim('dodge', 340, true);
    play('dodge', { volume: 0.8 });
    return true;
  }

  startSecondary(): void {
    if (!this.canAct) return;
    if (this.weapon.secondary === 'guard') {
      this.phase = 'guard';
      this.guard.perfectWindow = this.stats.parryWindow;
      this.playAnim('block', 0, true);
      play('guard', { volume: 0.6 });
    } else if (this.weapon.secondary === 'charge') {
      this.phase = 'charge';
      this.chargeTime = 0;
      this.playAnim('shoot', 0, true);
      play('bow_draw', { volume: 0.7 });
    } else {
      if (this.stamina.value < 18) return;
      spendStamina(this.stamina, 18);
      this.phase = 'windup';
      this.phaseTime = 0.3 / this.stats.attackSpeed;
      this.comboIndex = -1;
      this.playAnim('heavy', 900, true);
      play('swing_heavy', { volume: 1 });
    }
  }

  releaseSecondary(): { charged: number } | null {
    if (this.phase === 'guard') {
      this.phase = 'idle';
      this.guard.perfectWindow = 0;
      return null;
    }
    if (this.phase === 'charge') {
      const charged = Math.min(1, this.chargeTime / 0.8);
      this.phase = 'recovery';
      this.phaseTime = 0.26;
      return { charged };
    }
    return null;
  }

  drinkFlask(): boolean {
    if (!this.alive || this.flask <= 0 || this.busy) return false;
    this.flask -= 1;
    const healed = this.heal(flaskHeal(this.maxHealth, this.stats.healPower));
    play('heal', { volume: 0.9 });
    void healed;
    return true;
  }

  /** Damage with guard, shield and Last Stand applied in that order. */
  override takeDamage(ev: Parameters<Actor['takeDamage']>[0], reduction = 0): number {
    if (!this.alive || this.invulnerable > 0) return 0;
    let extraReduction = reduction;
    let perfect = false;
    if (this.phase === 'guard' || this.guard.time > 0) {
      perfect = this.guard.perfectWindow > 0;
      extraReduction = Math.max(extraReduction, perfect ? 1 : 0.55 + this.stats.blockReduction);
      const cost = perfect ? 0 : 14 * this.stats.guardStaminaCost;
      spendStamina(this.stamina, Math.min(this.stamina.value, cost));
      play(perfect ? 'parry' : 'hit_shield', { volume: 1 });
    }
    let amount = super.takeDamage(ev, extraReduction);
    if (amount > 0 && this.shield.amount > 0) {
      const absorbed = Math.min(this.shield.amount, amount);
      this.shield.amount -= absorbed;
      this.health = Math.min(this.maxHealth, this.health + absorbed);
      amount -= absorbed;
    }
    if (this.health <= 0 && this.stats.lastStand > 0 && !this.lastStandUsed) {
      this.lastStandUsed = true;
      this.health = 1;
      this.alive = true;
      this.invulnerable = 1.2;
    }
    if (amount > 0 && this.alive && !perfect && this.phase !== 'guard') {
      this.phase = 'hurt';
      this.phaseTime = 0.22;
      this.playAnim('hit', 260, true);
      play('player_hurt', { volume: 0.9 });
    }
    return amount;
  }

  override step(dt: number): number {
    const dot = super.step(dt);
    this.dodgeCd.tick(dt);
    this.attackCd.tick(dt);
    if (this.comboWindow > 0) this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (this.shield.time > 0) {
      this.shield.time = Math.max(0, this.shield.time - dt);
      if (this.shield.time === 0) this.shield.amount = 0;
    }
    if (this.echo) {
      this.echo.time -= dt;
      if (this.echo.time <= 0) this.echo = null;
    }
    if (this.guard.time > 0) {
      this.guard.time = Math.max(0, this.guard.time - dt);
    }
    if (this.guard.perfectWindow > 0) this.guard.perfectWindow = Math.max(0, this.guard.perfectWindow - dt);
    if (this.shelter) {
      this.shelter.time -= dt;
      if (this.shelter.time <= 0 || this.shelter.intercepts <= 0) this.shelter = null;
    }
    tickStamina(this.stamina, dt, this.stats.staminaRegen);

    if (this.phase === 'charge') this.chargeTime += dt;

    if (this.phaseTime > 0) {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) this.advancePhase();
    }
    if (!this.alive) this.phase = 'dead';
    return dot;
  }

  private advancePhase(): void {
    const step = this.comboIndex >= 0 ? this.weapon.combo[this.comboIndex] : null;
    switch (this.phase) {
      case 'windup': {
        this.phase = 'active';
        if (this.comboIndex < 0) {
          // Two-handed heavy.
          this.phaseTime = 0.14;
          this.pendingHit = {
            shape: { kind: 'arc', x: this.x, y: this.y, angle: Math.atan2(this.facing.y, this.facing.x), range: 108, arc: 1.6 },
            damage: 1.9, poise: 34, echo: false,
          };
        } else if (step) {
          this.phaseTime = step.active / this.stats.attackSpeed;
          if (step.range > 0) {
            this.pendingHit = {
              shape: { kind: 'arc', x: this.x, y: this.y, angle: Math.atan2(this.facing.y, this.facing.x), range: step.range, arc: step.arc },
              damage: step.damage, poise: step.poise, echo: false,
            };
          }
        }
        break;
      }
      case 'active':
        this.phase = 'recovery';
        this.phaseTime = (step?.recovery ?? 0.3) / this.stats.attackSpeed;
        this.comboWindow = 0.32;
        this.attackCd.start(0.12);
        break;
      case 'recovery':
      case 'hurt':
      case 'dodge':
        this.phase = 'idle';
        this.comboIndex = 0;
        break;
      default:
        this.phase = 'idle';
        break;
    }
  }

  /** Idle/move animation selection, called after input each frame. */
  updateAnim(moving: boolean, running: boolean): void {
    if (!this.alive) return;
    if (this.animLocked > 0) { this.refreshFacing(); return; }
    if (this.phase === 'guard') { this.playAnim('block'); return; }
    if (this.phase === 'charge') { this.playAnim('shoot'); return; }
    if (this.poise.staggered > 0) { this.playAnim('hit'); return; }
    this.playAnim(moving ? (running ? 'run' : 'walk') : 'idle');
    this.refreshFacing();
  }

  interceptProjectile(px: number, py: number): boolean {
    if (!this.shelter) return false;
    if (Math.hypot(px - this.shelter.x, py - this.shelter.y) > this.shelter.radius) return false;
    this.shelter.intercepts -= 1;
    if (this.shelter.intercepts <= 0) this.shelter = null;
    return true;
  }
}
