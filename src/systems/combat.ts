import type { DerivedStats } from './progression';
import type { EffectSource } from './rings';

/**
 * Combat maths. Kept pure and free of Phaser so the numbers can be unit tested
 * and so a designer can read one file to understand how a hit resolves.
 */

export interface DamageInput {
  base: number;
  /** Multiplicative modifiers: charged shot, backstab, ring power, difficulty. */
  multipliers?: number[];
  /** Flat armour of the target. */
  armour?: number;
  /** 0..1 percentage reduction, e.g. a raised guard. */
  reduction?: number;
  source: EffectSource;
  /** True when the hit cannot be reduced below 1 (damage-over-time ticks). */
  minimumOne?: boolean;
}

/**
 * Armour is a flat subtraction with diminishing returns, so stacking armour
 * never reaches immunity and a level-1 player is never one-shot by chip damage.
 */
export function applyArmour(raw: number, armour: number): number {
  if (armour <= 0) return raw;
  const soak = armour * (raw / (raw + armour * 1.8));
  return Math.max(raw * 0.2, raw - soak);
}

export function computeDamage(input: DamageInput): number {
  let d = input.base;
  for (const m of input.multipliers ?? []) d *= m;
  d = applyArmour(d, input.armour ?? 0);
  if (input.reduction) d *= 1 - Math.max(0, Math.min(0.9, input.reduction));
  const out = Math.round(d);
  return input.minimumOne ? Math.max(1, out) : Math.max(0, out);
}

// -------------------------------------------------------------- cooldowns

export class CooldownTimer {
  private remaining = 0;
  private duration = 0;

  start(seconds: number): void {
    this.duration = Math.max(0, seconds);
    this.remaining = this.duration;
  }

  tick(dt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }

  /** Shorten the remaining time, e.g. the Ringkeeper "struck sparks" talent. */
  reduce(seconds: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - Math.max(0, seconds));
  }

  get ready(): boolean { return this.remaining <= 0; }
  get left(): number { return this.remaining; }
  get total(): number { return this.duration; }
  /** 0 when ready, 1 when just triggered. */
  get ratio(): number { return this.duration <= 0 ? 0 : this.remaining / this.duration; }
  reset(): void { this.remaining = 0; this.duration = 0; }
}

// ---------------------------------------------------------------- stamina

export interface StaminaState {
  value: number;
  max: number;
  /** Seconds until regeneration resumes. */
  delay: number;
}

export const STAMINA_REGEN_DELAY = 0.6;

export function spendStamina(s: StaminaState, cost: number): boolean {
  if (s.value < cost) return false;
  s.value -= cost;
  s.delay = STAMINA_REGEN_DELAY;
  return true;
}

export function tickStamina(s: StaminaState, dt: number, regenPerSecond: number): void {
  if (s.delay > 0) {
    s.delay = Math.max(0, s.delay - dt);
    return;
  }
  s.value = Math.min(s.max, s.value + regenPerSecond * dt);
}

// ------------------------------------------------------------------ hits

export interface AttackShape {
  kind: 'arc' | 'circle' | 'line' | 'ring' | 'cone';
  /** World-space origin. */
  x: number;
  y: number;
  /** Facing angle in world radians (only for arc / line / cone). */
  angle: number;
  range: number;
  /** Half-width in radians for arc/cone, or half-thickness in pixels for line. */
  arc?: number;
  width?: number;
  /** Inner radius for ring shapes. */
  inner?: number;
}

export interface Target {
  x: number;
  y: number;
  radius: number;
}

/** Does an attack shape overlap a target circle? All in world coordinates. */
export function shapeHits(shape: AttackShape, target: Target): boolean {
  const dx = target.x - shape.x;
  const dy = target.y - shape.y;
  const dist = Math.hypot(dx, dy);
  switch (shape.kind) {
    case 'circle':
      return dist <= shape.range + target.radius;
    case 'ring': {
      const inner = shape.inner ?? 0;
      return dist + target.radius >= inner && dist - target.radius <= shape.range;
    }
    case 'arc':
    case 'cone': {
      if (dist > shape.range + target.radius) return false;
      if (dist <= target.radius) return true;
      const half = shape.arc ?? Math.PI / 3;
      let diff = Math.atan2(dy, dx) - shape.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Allow for the target's own radius widening the effective angle.
      const slack = Math.atan2(target.radius, Math.max(1, dist));
      return Math.abs(diff) <= half + slack;
    }
    case 'line': {
      const half = shape.width ?? 24;
      const ux = Math.cos(shape.angle);
      const uy = Math.sin(shape.angle);
      const along = dx * ux + dy * uy;
      if (along < -target.radius || along > shape.range + target.radius) return false;
      const perp = Math.abs(-dx * uy + dy * ux);
      return perp <= half + target.radius;
    }
  }
}

/** Line of sight against a blocking-tile predicate, sampled along the ray. */
export function hasLineOfSight(
  x0: number, y0: number, x1: number, y1: number,
  blocked: (x: number, y: number) => boolean,
  step = 16,
): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- stagger

export interface PoiseState {
  value: number;
  max: number;
  /** Seconds of stagger remaining. */
  staggered: number;
}

export function applyPoise(p: PoiseState, amount: number, resist = 0): boolean {
  p.value -= amount * (1 - Math.max(0, Math.min(0.8, resist)));
  if (p.value <= 0) {
    p.value = p.max;
    p.staggered = 0.75;
    return true;
  }
  return false;
}

export function tickPoise(p: PoiseState, dt: number, regen = 6): void {
  if (p.staggered > 0) {
    p.staggered = Math.max(0, p.staggered - dt);
    return;
  }
  p.value = Math.min(p.max, p.value + regen * dt);
}

// ------------------------------------------------- status effects (capped)

export type StatusKind = 'burn' | 'poison' | 'slow' | 'root' | 'shock' | 'freeze';

export interface Status {
  kind: StatusKind;
  /** Remaining seconds. */
  time: number;
  /** Stack count, always clamped by STATUS_CAPS. */
  stacks: number;
  /** Damage per second per stack, for damage-over-time kinds. */
  dps: number;
  power: number;
}

/** Hard stack limits, so poison and burn can never spiral. */
export const STATUS_CAPS: Record<StatusKind, number> = {
  burn: 3,
  poison: 5,
  slow: 1,
  root: 1,
  shock: 1,
  freeze: 1,
};

export function addStatus(list: Status[], next: Status): Status {
  const cap = STATUS_CAPS[next.kind];
  const found = list.find((s) => s.kind === next.kind);
  if (!found) {
    const created = { ...next, stacks: Math.min(cap, Math.max(1, next.stacks)) };
    list.push(created);
    return created;
  }
  found.stacks = Math.min(cap, found.stacks + Math.max(1, next.stacks));
  found.time = Math.max(found.time, next.time);
  found.dps = Math.max(found.dps, next.dps);
  found.power = Math.max(found.power, next.power);
  return found;
}

export function tickStatuses(list: Status[], dt: number): number {
  let dot = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]!;
    s.time -= dt;
    if (s.dps > 0) dot += s.dps * s.stacks * dt;
    if (s.time <= 0) list.splice(i, 1);
  }
  return dot;
}

export function statusMoveMultiplier(list: Status[]): number {
  let m = 1;
  for (const s of list) {
    if (s.kind === 'slow') m *= 1 - Math.min(0.6, s.power);
    if (s.kind === 'root' || s.kind === 'freeze') return 0;
  }
  return m;
}

export function hasStatus(list: Status[], kind: StatusKind): boolean {
  return list.some((s) => s.kind === kind);
}

// ------------------------------------------------------------------ misc

export function weaponSwingDamage(stats: DerivedStats, multiplier = 1): number {
  return computeDamage({
    base: stats.attack,
    multipliers: [multiplier, 1 + stats.weaponDamage],
    source: 'weapon',
  });
}

/** Flask healing: a fixed fraction of max health, improved by Last Hearth support. */
export function flaskHeal(maxHealth: number, healPower = 0): number {
  return Math.round(maxHealth * 0.42 * (1 + healPower));
}
