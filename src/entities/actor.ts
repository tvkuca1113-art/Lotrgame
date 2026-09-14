import Phaser from 'phaser';
import { facingFor, normalise, TILE } from '@/systems/iso';
import {
  type Status, type StatusKind, addStatus, tickStatuses, statusMoveMultiplier,
  type PoiseState, applyPoise, tickPoise, computeDamage,
} from '@/systems/combat';
import type { EffectSource } from '@/systems/rings';
import type { WorldRenderer } from '@/world/renderer';
import type { EffectPool } from './effects';
import { isBlockedAt, type StageMap } from '@/world/stagegen';

export type ActorTeam = 'player' | 'enemy' | 'neutral';

export interface ActorConfig {
  sheet: string;
  x: number;
  y: number;
  radius: number;
  maxHealth: number;
  speed: number;
  scale?: number;
  team: ActorTeam;
  poise?: number;
  armour?: number;
  anchorY?: number;
  shadowScale?: number;
}

export interface DamageEvent {
  amount: number;
  source: EffectSource;
  fromX: number;
  fromY: number;
  kind?: StatusKind;
  poise?: number;
  tags?: string[];
}

/**
 * Shared actor behaviour: a sprite with a facing, a shadow, world-space
 * collision, health, statuses and poise. Player, enemies and bosses all build
 * on this so their feedback stays consistent.
 */
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly team: ActorTeam;
  readonly radius: number;
  readonly sheet: string;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing = { x: 1, y: 0 };
  health: number;
  maxHealth: number;
  speed: number;
  armour: number;
  poise: PoiseState;
  statuses: Status[] = [];
  alive = true;
  invulnerable = 0;
  hitFlash = 0;
  currentAnim = '';
  animLocked = 0;
  dead = false;
  /** Set while a dodge or blink makes the actor pass through enemies. */
  ethereal = 0;

  protected scene: Phaser.Scene;
  protected renderer: WorldRenderer;
  protected effects: EffectPool;
  protected map: StageMap | null;
  private baseScale: number;

  constructor(
    scene: Phaser.Scene,
    renderer: WorldRenderer,
    effects: EffectPool,
    map: StageMap | null,
    cfg: ActorConfig,
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.effects = effects;
    this.map = map;
    this.sheet = cfg.sheet;
    this.team = cfg.team;
    this.radius = cfg.radius;
    this.x = cfg.x;
    this.y = cfg.y;
    this.maxHealth = cfg.maxHealth;
    this.health = cfg.maxHealth;
    this.speed = cfg.speed;
    this.armour = cfg.armour ?? 0;
    this.poise = { value: cfg.poise ?? 20, max: cfg.poise ?? 20, staggered: 0 };
    this.baseScale = cfg.scale ?? 1;

    const p = renderer.screenFor(this.x, this.y);
    this.shadow = effects.shadow(this.x, this.y, (cfg.shadowScale ?? 1) * this.baseScale * 0.8);
    this.sprite = scene.add.sprite(p.x, p.y, cfg.sheet);
    this.sprite.setOrigin(0.5, cfg.anchorY ?? 0.88);
    this.sprite.setScale(this.baseScale);
    this.sprite.setDepth(renderer.depthFor(this.x, this.y));
  }

  get screenX(): number { return this.sprite.x; }
  get screenY(): number { return this.sprite.y; }

  /** Play an animation, respecting a lock set by attacks and hit reactions. */
  playAnim(name: string, lockMs = 0, force = false): void {
    const f = facingFor(this.facing.x, this.facing.y);
    const key = `${this.sheet}:${name}_${f.sheet}`;
    this.sprite.setFlipX(f.flip);
    if (!this.scene.anims.exists(key)) return;
    if (!force && this.animLocked > 0) return;
    if (this.currentAnim !== key || force) {
      this.currentAnim = key;
      this.sprite.play(key, true);
    }
    if (lockMs > 0) this.animLocked = lockMs / 1000;
  }

  /** Refresh the facing on the current animation without restarting it. */
  refreshFacing(): void {
    if (!this.currentAnim) return;
    const base = this.currentAnim.split(':')[1]?.replace(/_(s|se|e|ne|n)$/, '') ?? '';
    const f = facingFor(this.facing.x, this.facing.y);
    const key = `${this.sheet}:${base}_${f.sheet}`;
    this.sprite.setFlipX(f.flip);
    if (key !== this.currentAnim && this.scene.anims.exists(key)) {
      const progress = this.sprite.anims.getProgress();
      this.currentAnim = key;
      this.sprite.play(key, true);
      this.sprite.anims.setProgress(progress);
    }
  }

  faceTowards(tx: number, ty: number): void {
    const n = normalise(tx - this.x, ty - this.y);
    if (n.x || n.y) {
      this.facing = n;
      this.refreshFacing();
    }
  }

  /** Move with world-space collision against blocked tiles, axis by axis. */
  moveBy(dx: number, dy: number): void {
    if (!this.map) {
      this.x += dx;
      this.y += dy;
      return;
    }
    const r = this.radius;
    const tryX = this.x + dx;
    if (!isBlockedAt(this.map, tryX + Math.sign(dx) * r, this.y)) this.x = tryX;
    const tryY = this.y + dy;
    if (!isBlockedAt(this.map, this.x, tryY + Math.sign(dy) * r)) this.y = tryY;
    this.x = Phaser.Math.Clamp(this.x, r, this.map.worldW - r);
    this.y = Phaser.Math.Clamp(this.y, r, this.map.worldH - r);
  }

  /** Push actors apart so bodies never occupy the same space. */
  separateFrom(others: Actor[]): void {
    if (this.ethereal > 0) return;
    for (const o of others) {
      if (o === this || !o.alive || o.ethereal > 0) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = this.radius + o.radius;
      if (d > 0 && d < min) {
        const push = (min - d) / d * 0.5;
        this.moveBy(dx * push, dy * push);
      }
    }
  }

  applyStatus(s: Status): void {
    addStatus(this.statuses, s);
  }

  hasStatus(kind: StatusKind): boolean {
    return this.statuses.some((s) => s.kind === kind);
  }

  /** Resolve incoming damage. Returns the amount actually applied. */
  takeDamage(ev: DamageEvent, reduction = 0): number {
    if (!this.alive || this.invulnerable > 0) return 0;
    const amount = computeDamage({
      base: ev.amount,
      armour: this.armour,
      reduction,
      source: ev.source,
      minimumOne: ev.source === 'dot',
    });
    if (amount <= 0) return 0;
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = 0.14;
    if (ev.poise) applyPoise(this.poise, ev.poise);
    if (this.health <= 0) this.kill();
    return amount;
  }

  heal(amount: number): number {
    if (!this.alive) return 0;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - before;
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.playAnim('death', 1200, true);
    this.shadow.setAlpha(0.4);
  }

  /** Fixed-step update: statuses, timers and the visual transform. */
  step(dt: number): number {
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.ethereal > 0) this.ethereal = Math.max(0, this.ethereal - dt);
    if (this.animLocked > 0) this.animLocked = Math.max(0, this.animLocked - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    tickPoise(this.poise, dt);
    const dot = tickStatuses(this.statuses, dt);
    if (dot > 0 && this.alive) {
      this.takeDamage({ amount: dot, source: 'dot', fromX: this.x, fromY: this.y });
    }
    return dot;
  }

  /** Called once per rendered frame after the fixed steps. */
  render(): void {
    const p = this.renderer.screenFor(this.x, this.y);
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(this.renderer.depthFor(this.x, this.y));
    this.shadow.setPosition(p.x, p.y);
    if (this.hitFlash > 0) {
      this.sprite.setTintFill(0xffe9d2);
    } else {
      this.sprite.clearTint();
      if (this.hasStatus('burn')) this.sprite.setTint(0xffb08a);
      else if (this.hasStatus('poison')) this.sprite.setTint(0xb7e08a);
      else if (this.hasStatus('freeze') || this.hasStatus('slow')) this.sprite.setTint(0xbfe6f2);
    }
  }

  moveMultiplier(): number {
    return statusMoveMultiplier(this.statuses) * (this.poise.staggered > 0 ? 0 : 1);
  }

  distanceTo(o: { x: number; y: number }): number {
    return Math.hypot(o.x - this.x, o.y - this.y);
  }

  tileDistanceTo(o: { x: number; y: number }): number {
    return this.distanceTo(o) / TILE;
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
