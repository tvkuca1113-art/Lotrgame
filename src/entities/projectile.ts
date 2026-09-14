import Phaser from 'phaser';
import { PROJECTILES } from '@/content/enemies';
import type { WorldRenderer } from '@/world/renderer';
import { DEPTH } from '@/world/renderer';
import type { EffectPool } from './effects';
import { isBlockedAt, type StageMap } from '@/world/stagegen';
import type { EffectSource } from '@/systems/rings';

export interface ProjectileOpts {
  kind: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  team: 'player' | 'enemy';
  tags?: string[];
  source?: EffectSource;
  redirectable?: boolean;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  readonly radius: number;
  readonly damage: number;
  readonly team: 'player' | 'enemy';
  readonly tags: string[];
  readonly source: EffectSource;
  readonly kind: string;
  redirectable: boolean;
  alive = true;
  private sprite: Phaser.GameObjects.Sprite;
  private renderer: WorldRenderer;
  private vfxId: string;

  constructor(scene: Phaser.Scene, renderer: WorldRenderer, opts: ProjectileOpts) {
    const def = PROJECTILES[opts.kind] ?? PROJECTILES.arrow!;
    this.kind = opts.kind;
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.dx * def.speed;
    this.vy = opts.dy * def.speed;
    this.life = def.life;
    this.radius = def.radius;
    this.damage = opts.damage;
    this.team = opts.team;
    this.tags = opts.tags ?? [];
    this.source = opts.source ?? 'weapon';
    this.redirectable = opts.redirectable ?? false;
    this.renderer = renderer;
    this.vfxId = def.vfx;

    const p = renderer.screenFor(this.x, this.y);
    this.sprite = scene.add.sprite(p.x, p.y, 'vfx', `${def.vfx}_0`);
    this.sprite.setDepth(DEPTH.actors + 40000);
    this.sprite.setScale(0.8);
    this.sprite.setRotation(Math.atan2(opts.dy, opts.dx) * 0.5);
    if (opts.team === 'player') this.sprite.setTint(0xe4d8bc);
  }

  /** Reverse a marked projectile - the Ballista redirect on stage 17. */
  redirect(dx: number, dy: number, speedScale = 1.2): void {
    const speed = Math.hypot(this.vx, this.vy) * speedScale;
    this.vx = dx * speed;
    this.vy = dy * speed;
    this.redirectable = false;
    (this as { team: 'player' | 'enemy' }).team = this.team === 'enemy' ? 'player' : 'enemy';
    this.sprite.setTint(0xffd9a8);
  }

  step(dt: number, map: StageMap | null): boolean {
    if (!this.alive) return false;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.destroy(); return false; }
    if (map && isBlockedAt(map, this.x, this.y)) { this.destroy(); return false; }
    return true;
  }

  render(): void {
    if (!this.alive) return;
    const p = this.renderer.screenFor(this.x, this.y);
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(this.renderer.depthFor(this.x, this.y, 60));
  }

  impact(effects: EffectPool): void {
    effects.play(this.vfxId, this.x, this.y);
    this.destroy();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}

export class ProjectilePool {
  private list: Projectile[] = [];
  private scene: Phaser.Scene;
  private renderer: WorldRenderer;
  private cap: number;

  constructor(scene: Phaser.Scene, renderer: WorldRenderer, cap = 80) {
    this.scene = scene;
    this.renderer = renderer;
    this.cap = cap;
  }

  spawn(opts: ProjectileOpts): Projectile | null {
    if (this.list.length >= this.cap) {
      const oldest = this.list.shift();
      oldest?.destroy();
    }
    const p = new Projectile(this.scene, this.renderer, opts);
    this.list.push(p);
    return p;
  }

  get all(): Projectile[] { return this.list; }

  step(dt: number, map: StageMap | null): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!;
      if (!p.step(dt, map) || !p.alive) this.list.splice(i, 1);
    }
  }

  render(): void {
    for (const p of this.list) p.render();
  }

  clear(): void {
    for (const p of this.list) p.destroy();
    this.list.length = 0;
  }
}
