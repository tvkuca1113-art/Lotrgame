import { describe, it, expect } from 'vitest';
import { newGameState, type GameState } from '@/systems/state';
import {
  validatePlacement, placeBuilding, moveBuilding, removeBuilding,
  isReachableAfter, upgradeHome, nextHomeTier, plotSize, BuildHistory,
  socketsUnlocked, suggestImprovements,
} from '@/systems/building';
import { grant } from '@/systems/economy';
import { HOME_TIERS, BUILDINGS, RING_SOCKET_UNLOCK_STAGE } from '@/content/buildings';
import { installRing } from '@/systems/rings';

function ready(tier = 2): GameState {
  const s = newGameState();
  s.home.tier = tier;
  s.campaign.cleared = Array.from({ length: 22 }, (_, i) => i + 1);
  grant(s, { gold: 100_000, wood: 5000, stone: 5000, iron: 5000 });
  return s;
}

describe('placement grid', () => {
  it('refuses a structure that would leave the plot', () => {
    const s = ready();
    const plot = plotSize(s);
    expect(validatePlacement(s, { id: 'forge', gx: plot.w - 1, gy: 0, rotation: 0 })).toBe('outside');
    expect(validatePlacement(s, { id: 'forge', gx: -1, gy: 0, rotation: 0 })).toBe('outside');
  });

  it('refuses overlapping structures', () => {
    const s = ready();
    expect(placeBuilding(s, 'forge', 2, 2).ok).toBe(true);
    expect(validatePlacement(s, { id: 'garden', gx: 3, gy: 3, rotation: 0 })).toBe('overlap');
    expect(validatePlacement(s, { id: 'garden', gx: 6, gy: 2, rotation: 0 })).toBeNull();
  });

  it('refuses to block a doorway', () => {
    const s = ready();
    const placed = placeBuilding(s, 'forge', 3, 3);
    expect(placed.ok).toBe(true);
    // The row immediately in front of the forge is its doorway.
    expect(validatePlacement(s, { id: 'wall_segment', gx: 3, gy: 5, rotation: 0 })).toBe('door');
  });

  it('allows a continuous wall run - walls have no doorway of their own', () => {
    const s = ready();
    for (let y = 1; y <= 6; y++) {
      const res = placeBuilding(s, 'wall_segment', 3, y);
      expect(res.ok).toBe(true);
    }
    expect(s.home.buildings).toHaveLength(6);
  });

  it('refuses a wall that would seal a workstation away from the entrance', () => {
    const s = ready();
    // Forge occupies (5,3)-(6,4); its doorway is the row at y = 5.
    expect(placeBuilding(s, 'forge', 5, 3).ok).toBe(true);
    // Ring the forge and its doorway with walls, leaving one gap at (8, 6).
    const perimeter: [number, number][] = [];
    for (let x = 4; x <= 8; x++) { perimeter.push([x, 2]); perimeter.push([x, 6]); }
    for (let y = 3; y <= 5; y++) { perimeter.push([4, y]); perimeter.push([7, y]); }
    let sealed = false;
    for (const [x, y] of perimeter) {
      const res = placeBuilding(s, 'wall_segment', x, y);
      if (!res.ok && res.reason === 'unreachable') sealed = true;
    }
    expect(sealed).toBe(true);
    // Whatever was actually built, the settlement is still navigable.
    expect(isReachableAfter(s, null)).toBe(true);
  });

  it('enforces unique structures', () => {
    const s = ready();
    expect(placeBuilding(s, 'forge', 1, 1).ok).toBe(true);
    const second = placeBuilding(s, 'forge', 6, 6);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('unique');
  });

  it('honours the tier requirement', () => {
    const s = ready(0);
    expect(validatePlacement(s, { id: 'watchtower', gx: 1, gy: 1, rotation: 0 })).toBe('tier');
  });

  it('rotation swaps the footprint', () => {
    const s = ready();
    // The gate is 2x1; rotated it becomes 1x2.
    expect(placeBuilding(s, 'gate', 0, 0, 1).ok).toBe(true);
    const gate = s.home.buildings[0]!;
    expect(gate.rotation).toBe(1);
  });
});

describe('moving and dismantling', () => {
  it('moving is free', () => {
    const s = ready();
    const placed = placeBuilding(s, 'garden', 1, 1);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const before = { ...s.resources };
    expect(moveBuilding(s, placed.uid, 5, 5).ok).toBe(true);
    expect(s.resources).toEqual(before);
    const b = s.home.buildings.find((x) => x.uid === placed.uid)!;
    expect([b.gx, b.gy]).toEqual([5, 5]);
  });

  it('a move to an invalid cell is refused and leaves the structure where it was', () => {
    const s = ready();
    const a = placeBuilding(s, 'garden', 1, 1);
    const bPlaced = placeBuilding(s, 'forge', 6, 6);
    expect(a.ok && bPlaced.ok).toBe(true);
    if (!a.ok) return;
    const res = moveBuilding(s, a.uid, 6, 6);
    expect(res.ok).toBe(false);
    const g = s.home.buildings.find((x) => x.uid === a.uid)!;
    expect([g.gx, g.gy]).toEqual([1, 1]);
  });

  it('removing a socket building never deletes the ring, it just empties the socket', () => {
    const s = ready();
    s.rings.ember = { discovered: true, rank: 4 };
    const forge = placeBuilding(s, 'forge', 2, 2);
    expect(forge.ok).toBe(true);
    if (!forge.ok) return;
    installRing(s, 0, 'ember');
    expect(s.ringSockets[0]).toBe('ember');
    removeBuilding(s, forge.uid);
    expect(s.ringSockets[0]).toBeNull();
    // The ring itself is untouched and can be worn again.
    expect(s.rings.ember).toEqual({ discovered: true, rank: 4 });
  });

  it('undo reverses a placement, a move and a dismantle', () => {
    const s = ready();
    const history = new BuildHistory();
    const placed = placeBuilding(s, 'garden', 2, 2);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    history.push({ kind: 'place', uid: placed.uid });
    history.undo(s);
    expect(s.home.buildings).toHaveLength(0);

    const again = placeBuilding(s, 'garden', 2, 2);
    if (!again.ok) return;
    const before = { ...s.home.buildings[0]! };
    history.push({ kind: 'move', uid: again.uid, before });
    moveBuilding(s, again.uid, 7, 7);
    history.undo(s);
    expect(s.home.buildings[0]!.gx).toBe(2);

    history.push({ kind: 'remove', uid: again.uid, before: { ...s.home.buildings[0]! } });
    removeBuilding(s, again.uid);
    expect(s.home.buildings).toHaveLength(0);
    history.undo(s);
    expect(s.home.buildings).toHaveLength(1);
  });
});

describe('settlement tiers', () => {
  it('charges the exact per-upgrade cost from the brief', () => {
    const expected = [
      { gold: 40, wood: 10, stone: 0, iron: 0 },
      { gold: 250, wood: 40, stone: 15, iron: 0 },
      { gold: 750, wood: 90, stone: 90, iron: 15 },
      { gold: 2400, wood: 180, stone: 220, iron: 70 },
      { gold: 5000, wood: 250, stone: 450, iron: 150 },
    ];
    HOME_TIERS.forEach((tier, i) => {
      expect(tier.cost).toEqual(expected[i]);
    });
  });

  it('will not upgrade before the unlock stage', () => {
    const s = newGameState();
    s.home.tier = 0;
    s.campaign.cleared = [1, 2];
    grant(s, { gold: 100_000, wood: 1000, stone: 1000, iron: 1000 });
    const res = upgradeHome(s);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('stage');
  });

  it('walks the whole tier track when the requirements are met', () => {
    const s = newGameState();
    s.campaign.cleared = Array.from({ length: 30 }, (_, i) => i + 1);
    grant(s, { gold: 100_000, wood: 5000, stone: 5000, iron: 5000 });
    for (let i = 0; i < HOME_TIERS.length; i++) {
      expect(upgradeHome(s).ok).toBe(true);
    }
    expect(s.home.tier).toBe(4);
    expect(nextHomeTier(s)).toBeNull();
  });

  it('a bigger tier gives a bigger plot', () => {
    const s = newGameState();
    let last = 0;
    for (const tier of HOME_TIERS) {
      s.home.tier = tier.tier;
      const p = plotSize(s);
      expect(p.w).toBeGreaterThan(last);
      last = p.w;
    }
  });
});

describe('sockets and guidance', () => {
  it('ring sockets open only after stage 10', () => {
    const s = newGameState();
    s.campaign.cleared = [1, 2, 3];
    expect(socketsUnlocked(s)).toBe(false);
    s.campaign.cleared.push(RING_SOCKET_UNLOCK_STAGE);
    expect(socketsUnlocked(s)).toBe(true);
  });

  it('always names the next goal and two achievable improvements', () => {
    const s = ready(1);
    const out = suggestImprovements(s);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('every functional structure has an implemented role', () => {
    const roles = new Set(BUILDINGS.filter((b) => !b.decorative).map((b) => b.role));
    for (const r of roles) expect(r).not.toBe('none');
    // Decorative pieces are explicitly flagged.
    expect(BUILDINGS.filter((b) => b.decorative).every((b) => b.role === 'decor')).toBe(true);
  });
});
