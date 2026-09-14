/**
 * The explicit top-level state machine.
 *
 * Every scene reports the state it is in, and transitions are logged in
 * development so a stuck state is obvious. Timers, listeners and transient
 * entities are cleaned up on every transition by the owning scene.
 */
export type GamePhase =
  | 'BOOT' | 'TITLE' | 'HOME' | 'EXPLORING' | 'BOSS_INTRO' | 'BOSS_FIGHT'
  | 'STAGE_COMPLETE' | 'PAUSED' | 'DEFEATED' | 'ENDING';

const ALLOWED: Record<GamePhase, GamePhase[]> = {
  BOOT: ['TITLE'],
  TITLE: ['HOME', 'EXPLORING', 'BOOT'],
  HOME: ['EXPLORING', 'TITLE', 'PAUSED', 'ENDING'],
  EXPLORING: ['BOSS_INTRO', 'BOSS_FIGHT', 'PAUSED', 'DEFEATED', 'HOME', 'STAGE_COMPLETE', 'TITLE'],
  BOSS_INTRO: ['BOSS_FIGHT', 'PAUSED', 'DEFEATED', 'TITLE'],
  BOSS_FIGHT: ['STAGE_COMPLETE', 'DEFEATED', 'PAUSED', 'TITLE'],
  STAGE_COMPLETE: ['HOME', 'ENDING', 'TITLE'],
  PAUSED: ['EXPLORING', 'BOSS_INTRO', 'BOSS_FIGHT', 'HOME', 'TITLE'],
  DEFEATED: ['EXPLORING', 'BOSS_INTRO', 'HOME', 'TITLE'],
  ENDING: ['HOME', 'TITLE'],
};

type Listener = (next: GamePhase, prev: GamePhase) => void;

class PhaseMachine {
  private phase: GamePhase = 'BOOT';
  private prev: GamePhase = 'BOOT';
  private listeners = new Set<Listener>();
  private history: { phase: GamePhase; at: number }[] = [];

  get current(): GamePhase { return this.phase; }
  get previous(): GamePhase { return this.prev; }

  canEnter(next: GamePhase): boolean {
    return next === this.phase || ALLOWED[this.phase].includes(next);
  }

  set(next: GamePhase): boolean {
    if (next === this.phase) return true;
    if (!this.canEnter(next)) {
      if (import.meta.env?.DEV) {
        console.warn(`[phase] illegal transition ${this.phase} -> ${next}`);
      }
      return false;
    }
    this.prev = this.phase;
    this.phase = next;
    this.history.push({ phase: next, at: Date.now() });
    if (this.history.length > 64) this.history.shift();
    for (const l of this.listeners) l(next, this.prev);
    return true;
  }

  /** Used when resuming from pause back to whatever was underneath. */
  resumeFromPause(): boolean {
    if (this.phase !== 'PAUSED') return false;
    return this.set(this.prev === 'PAUSED' ? 'HOME' : this.prev);
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get trail(): string {
    return this.history.map((h) => h.phase).join(' > ');
  }

  reset(): void {
    this.phase = 'BOOT';
    this.prev = 'BOOT';
    this.history.length = 0;
  }

  /** True while combat should be simulating. */
  get inCombat(): boolean {
    return this.phase === 'EXPLORING' || this.phase === 'BOSS_FIGHT';
  }

  /** Major menus and the inventory pause combat. */
  get isPaused(): boolean {
    return this.phase === 'PAUSED';
  }
}

export const phase = new PhaseMachine();

/**
 * A fixed-step accumulator. Movement, damage, regeneration and cooldowns all
 * advance on this step, never on frame count, and a long stall (a hidden tab,
 * a garbage collection pause) is clamped rather than replayed.
 */
export class FixedStep {
  readonly step: number;
  private acc = 0;
  private readonly maxFrame: number;

  constructor(hz = 60, maxFrameMs = 250) {
    this.step = 1 / hz;
    this.maxFrame = maxFrameMs / 1000;
  }

  /** Feed the frame delta in milliseconds; returns how many steps to run. */
  advance(deltaMs: number): number {
    const dt = Math.min(this.maxFrame, Math.max(0, deltaMs / 1000));
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.step && steps < 8) {
      this.acc -= this.step;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
    return steps;
  }

  /** 0..1 position between the last two steps, for render interpolation. */
  get alpha(): number { return this.acc / this.step; }

  reset(): void { this.acc = 0; }
}
