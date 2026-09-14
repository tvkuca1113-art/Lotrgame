import { describe, it, expect } from 'vitest';
import {
  computeDamage, applyArmour, CooldownTimer, shapeHits, hasLineOfSight,
  addStatus, tickStatuses, STATUS_CAPS, spendStamina, tickStamina,
  applyPoise, flaskHeal, type Status,
} from '@/systems/combat';
import { BOSSES } from '@/content/bosses';

describe('damage', () => {
  it('applies multipliers before armour', () => {
    const plain = computeDamage({ base: 100, source: 'weapon' });
    const doubled = computeDamage({ base: 100, multipliers: [2], source: 'weapon' });
    expect(doubled).toBeGreaterThan(plain);
    expect(doubled).toBe(200);
  });

  it('armour reduces damage but never to zero', () => {
    for (const armour of [0, 5, 20, 100, 1000]) {
      const d = computeDamage({ base: 50, armour, source: 'weapon' });
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(50);
    }
    // Diminishing returns: a huge armour value still leaves a floor.
    expect(applyArmour(50, 10_000)).toBeGreaterThanOrEqual(50 * 0.2 - 0.001);
  });

  it('guard reduction is clamped so nothing is fully immune', () => {
    const d = computeDamage({ base: 100, reduction: 5, source: 'weapon' });
    expect(d).toBeGreaterThan(0);
  });

  it('damage-over-time ticks always land for at least one point', () => {
    const d = computeDamage({ base: 0.2, armour: 50, source: 'dot', minimumOne: true });
    expect(d).toBe(1);
  });
});

describe('cooldowns', () => {
  it('counts down and reports a ratio', () => {
    const cd = new CooldownTimer();
    cd.start(4);
    expect(cd.ready).toBe(false);
    expect(cd.ratio).toBeCloseTo(1);
    cd.tick(2);
    expect(cd.ratio).toBeCloseTo(0.5);
    cd.tick(2);
    expect(cd.ready).toBe(true);
    expect(cd.ratio).toBe(0);
  });

  it('never goes negative and can be shortened', () => {
    const cd = new CooldownTimer();
    cd.start(3);
    cd.reduce(10);
    expect(cd.left).toBe(0);
    cd.tick(5);
    expect(cd.left).toBe(0);
  });
});

describe('stamina', () => {
  it('refuses a spend it cannot afford and leaves the pool untouched', () => {
    const s = { value: 10, max: 100, delay: 0 };
    expect(spendStamina(s, 25)).toBe(false);
    expect(s.value).toBe(10);
  });

  it('waits out the regeneration delay before refilling', () => {
    const s = { value: 50, max: 100, delay: 0 };
    spendStamina(s, 25);
    expect(s.value).toBe(25);
    expect(s.delay).toBeCloseTo(0.6);
    tickStamina(s, 0.3, 20);
    expect(s.value).toBe(25);
    tickStamina(s, 0.4, 20);
    tickStamina(s, 1, 20);
    expect(s.value).toBeGreaterThan(25);
    expect(s.value).toBeLessThanOrEqual(100);
  });
});

describe('attack shapes', () => {
  const target = { x: 100, y: 0, radius: 16 };

  it('an arc hits in front and misses behind', () => {
    const front = shapeHits({ kind: 'arc', x: 0, y: 0, angle: 0, range: 140, arc: 0.8 }, target);
    const behind = shapeHits({ kind: 'arc', x: 0, y: 0, angle: Math.PI, range: 140, arc: 0.8 }, target);
    expect(front).toBe(true);
    expect(behind).toBe(false);
  });

  it('range is respected', () => {
    expect(shapeHits({ kind: 'circle', x: 0, y: 0, angle: 0, range: 50 }, target)).toBe(false);
    expect(shapeHits({ kind: 'circle', x: 0, y: 0, angle: 0, range: 120 }, target)).toBe(true);
  });

  it('a ring misses the safe middle', () => {
    const near = { x: 10, y: 0, radius: 8 };
    expect(shapeHits({ kind: 'ring', x: 0, y: 0, angle: 0, range: 200, inner: 120 }, near)).toBe(false);
    expect(shapeHits({ kind: 'ring', x: 0, y: 0, angle: 0, range: 200, inner: 120 }, target)).toBe(false);
    expect(shapeHits({ kind: 'ring', x: 0, y: 0, angle: 0, range: 200, inner: 60 }, target)).toBe(true);
  });

  it('a line only hits inside its width', () => {
    const off = { x: 100, y: 90, radius: 10 };
    expect(shapeHits({ kind: 'line', x: 0, y: 0, angle: 0, range: 300, width: 24 }, target)).toBe(true);
    expect(shapeHits({ kind: 'line', x: 0, y: 0, angle: 0, range: 300, width: 24 }, off)).toBe(false);
  });
});

describe('line of sight', () => {
  it('is blocked by a wall between two points', () => {
    const wall = (x: number) => x > 40 && x < 60;
    expect(hasLineOfSight(0, 0, 100, 0, (x) => wall(x), 4)).toBe(false);
    expect(hasLineOfSight(0, 0, 30, 0, (x) => wall(x), 4)).toBe(true);
  });
});

describe('status effects', () => {
  it('stacks are hard capped per kind', () => {
    const list: Status[] = [];
    for (let i = 0; i < 20; i++) {
      addStatus(list, { kind: 'poison', time: 5, stacks: 1, dps: 3, power: 1 });
    }
    expect(list).toHaveLength(1);
    expect(list[0]!.stacks).toBe(STATUS_CAPS.poison);
  });

  it('burn and poison cannot exceed their caps even in one call', () => {
    const list: Status[] = [];
    addStatus(list, { kind: 'burn', time: 3, stacks: 99, dps: 4, power: 1 });
    expect(list[0]!.stacks).toBe(STATUS_CAPS.burn);
  });

  it('ticks damage and expires', () => {
    const list: Status[] = [];
    addStatus(list, { kind: 'poison', time: 1, stacks: 2, dps: 5, power: 1 });
    const dot = tickStatuses(list, 0.5);
    expect(dot).toBeCloseTo(5);
    tickStatuses(list, 0.6);
    expect(list).toHaveLength(0);
  });
});

describe('poise', () => {
  it('staggers when broken and then resets', () => {
    const p = { value: 20, max: 20, staggered: 0 };
    expect(applyPoise(p, 10)).toBe(false);
    expect(applyPoise(p, 15)).toBe(true);
    expect(p.staggered).toBeGreaterThan(0);
    expect(p.value).toBe(20);
  });

  it('resistance reduces incoming stagger', () => {
    const a = { value: 20, max: 20, staggered: 0 };
    const b = { value: 20, max: 20, staggered: 0 };
    applyPoise(a, 10, 0);
    applyPoise(b, 10, 0.5);
    expect(b.value).toBeGreaterThan(a.value);
  });
});

describe('boss fairness', () => {
  it('every damaging boss attack telegraphs and has a recovery window', () => {
    const bad: string[] = [];
    for (const boss of BOSSES) {
      for (const a of boss.attacks) {
        if (a.damage <= 0) continue;
        // The Iron Echo's delayed repeat is the one deliberate exception: it
        // echoes a strike the player already saw telegraphed.
        if (a.id === 'echo') continue;
        if (a.shape !== 'projectile' && a.telegraph < 260) bad.push(`${boss.id}:${a.id} telegraph ${a.telegraph}`);
        if (a.recovery <= 0) bad.push(`${boss.id}:${a.id} no recovery`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every boss has at least one phase and every phase has attacks it owns', () => {
    for (const boss of BOSSES) {
      expect(boss.phases.length).toBeGreaterThan(0);
      const ids = new Set(boss.attacks.map((a) => a.id));
      for (const p of boss.phases) {
        expect(p.attacks.length).toBeGreaterThan(0);
        for (const a of p.attacks) expect(ids.has(a)).toBe(true);
      }
    }
  });

  it('phase health triggers descend so phases cannot be skipped or repeated', () => {
    for (const boss of BOSSES) {
      let last = Infinity;
      for (const p of boss.phases) {
        expect(p.trigger.atHealthPct).toBeLessThanOrEqual(last);
        last = p.trigger.atHealthPct;
      }
    }
  });
});

describe('flask', () => {
  it('heals a proportion of maximum health and scales with Last Hearth support', () => {
    expect(flaskHeal(100)).toBe(42);
    expect(flaskHeal(100, 0.3)).toBeGreaterThan(flaskHeal(100));
  });
});
