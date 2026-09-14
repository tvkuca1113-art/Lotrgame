import { describe, it, expect } from 'vitest';
import { newGameState, type GameState } from '@/systems/state';
import { canAfford, spend, grant, claimOnce, isClaimed, rewardId, explorationIncome, replayPool } from '@/systems/economy';
import { completeStage, claimExploration } from '@/systems/campaign';
import { STAGES } from '@/content/stages';
import { HOME_TIERS, BUILDINGS } from '@/content/buildings';
import { EQUIPMENT } from '@/content/equipment';
import { ringUpgradeCost } from '@/content/rings';
import { upgradeHome, placeBuilding, removeBuilding } from '@/systems/building';
import { buyEquipment, addItem, salvageUnlocked, toggleLock, equipItem, isFull, reclaimStash } from '@/systems/inventory';

describe('transactions', () => {
  it('never allow a negative balance', () => {
    const s = newGameState();
    s.resources.gold = 10;
    expect(spend(s, { gold: 25 })).toBe(false);
    expect(s.resources.gold).toBe(10);
    expect(spend(s, { gold: 10 })).toBe(true);
    expect(s.resources.gold).toBe(0);
  });

  it('are atomic: a partial shortfall changes nothing', () => {
    const s = newGameState();
    s.resources.gold = 100;
    s.resources.iron = 1;
    expect(canAfford(s, { gold: 50, iron: 10 })).toBe(false);
    expect(spend(s, { gold: 50, iron: 10 })).toBe(false);
    expect(s.resources.gold).toBe(100);
    expect(s.resources.iron).toBe(1);
  });

  it('dismantling refunds the listed construction resources in full', () => {
    const s = newGameState();
    s.home.tier = 2;
    s.campaign.cleared = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const def = BUILDINGS.find((b) => b.id === 'forge')!;
    grant(s, def.cost);
    const before = { ...s.resources };
    const placed = placeBuilding(s, 'forge', 1, 1);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(s.resources.gold).toBeLessThan(before.gold);
    const removed = removeBuilding(s, placed.uid);
    expect(removed.ok).toBe(true);
    expect(s.resources).toEqual(before);
  });

  it('a double purchase cannot happen from one payment', () => {
    const s = newGameState();
    s.campaign.cleared = [1, 2, 3, 4, 5];
    const def = EQUIPMENT.find((e) => e.id === 'sword_valley')!;
    grant(s, def.cost);
    expect(buyEquipment(s, 'sword_valley').ok).toBe(true);
    const second = buyEquipment(s, 'sword_valley');
    expect(second.ok).toBe(false);
    expect(s.inventory.items.filter((i) => i.defId === 'sword_valley')).toHaveLength(1);
  });
});

describe('one-time rewards', () => {
  it('a first clear is granted exactly once no matter how often it is repeated', () => {
    const s = newGameState();
    const first = completeStage(s, 1, 60_000);
    expect(first.firstClear).toBe(true);
    const goldAfterFirst = s.resources.gold;
    const second = completeStage(s, 1, 60_000);
    expect(second.firstClear).toBe(false);
    expect(second.ringDiscovered).toBeNull();
    // A replay still pays, but far less, and never re-grants the story rewards.
    expect(s.resources.gold - goldAfterFirst).toBe(replayPool(1).gold);
  });

  it('death, retry and reload cannot duplicate a claimed reward', () => {
    const s = newGameState();
    const id = rewardId('stage', 3, 'first');
    const a = claimOnce(s, id, { gold: 100 });
    expect(a.granted).toBe(true);
    expect(s.resources.gold).toBe(100);
    // Simulate a reload: the claimed list travels with the save.
    const reloaded: GameState = JSON.parse(JSON.stringify(s));
    expect(isClaimed(reloaded, id)).toBe(true);
    const b = claimOnce(reloaded, id, { gold: 100 });
    expect(b.granted).toBe(false);
    expect(reloaded.resources.gold).toBe(100);
  });

  it('exploration income is claimed once per stage and then pays a reduced rate', () => {
    const s = newGameState();
    const first = claimExploration(s, 4, 1);
    expect(first.gold).toBe(explorationIncome(4).gold);
    const goldAfter = s.resources.gold;
    claimExploration(s, 4, 1);
    const replayGold = s.resources.gold - goldAfter;
    expect(replayGold).toBeGreaterThan(0);
    expect(replayGold).toBeLessThan(first.gold!);
  });

  it('a ring is only ever discovered once; the rest become shards', () => {
    const s = newGameState();
    const r1 = completeStage(s, 1, 1000);
    expect(r1.ringDiscovered).toBe('ember');
    s.campaign.claimedRewards = s.campaign.claimedRewards.filter((x) => x !== rewardId('stage', 1, 'first'));
    const r2 = completeStage(s, 1, 1000);
    expect(r2.ringDiscovered).toBeNull();
    expect(r2.duplicateShards).toBeGreaterThan(0);
  });
});

describe('campaign economy simulation', () => {
  /**
   * Walk the whole campaign on the main path only - first clears, their
   * exploration income and nothing repeated - and check that the settlement
   * track and a reasonable equipment path are affordable without farming.
   */
  function simulate() {
    const s = newGameState();
    const log: string[] = [];
    let homeSpend = 0;
    for (const def of STAGES) {
      completeStage(s, def.id, 300_000);
      claimExploration(s, def.id, 1);
      // Buy the settlement upgrade as soon as it unlocks and is affordable.
      for (;;) {
        const next = HOME_TIERS[s.home.tier + 1];
        if (!next) break;
        const highest = Math.max(0, ...s.campaign.cleared);
        if (next.tier > 0 && highest < next.unlockStage) break;
        if (!canAfford(s, next.cost)) break;
        const before = s.resources.gold;
        const res = upgradeHome(s);
        if (!res.ok) break;
        homeSpend += before - s.resources.gold;
        log.push(`stage ${def.id}: built ${next.id}`);
      }
    }
    return { state: s, log, homeSpend };
  }

  it('reaches the small castle on the main path', () => {
    const { state, log } = simulate();
    expect(log.some((l) => l.includes('home_camp'))).toBe(true);
    expect(log.some((l) => l.includes('home_cottage'))).toBe(true);
    expect(log.some((l) => l.includes('home_stonehouse'))).toBe(true);
    expect(log.some((l) => l.includes('home_courtyard'))).toBe(true);
    expect(log.some((l) => l.includes('home_castle'))).toBe(true);
    expect(state.home.tier).toBe(4);
  });

  it('leaves enough for equipment and ring upgrades after the castle', () => {
    const { state } = simulate();
    // Cost of one full weapon line plus armour and boots.
    const gearCost = EQUIPMENT
      .filter((e) => ['sword_valley', 'sword_warden', 'sword_oathkeeper', 'sword_hearthlight',
        'armour_traveller', 'armour_mail', 'armour_warden', 'armour_hearthplate',
        'boots_pathwalker', 'boots_scout', 'boots_stormstride', 'boots_snowmarch'].includes(e.id))
      .reduce((sum, e) => sum + (e.cost.gold ?? 0), 0);
    // Cost of taking one ring from rank 1 to rank 10.
    let ringCost = 0;
    for (let r = 1; r < 10; r++) ringCost += ringUpgradeCost(r).gold;
    expect(state.resources.gold).toBeGreaterThan(gearCost + ringCost);
  });

  it('collects enough shards to max a ring and advance several others', () => {
    const { state } = simulate();
    let shardsForOne = 0;
    for (let r = 1; r < 10; r++) shardsForOne += ringUpgradeCost(r).shards;
    expect(state.resources.shards).toBeGreaterThan(shardsForOne);
  });

  it('boss first-clear gold follows 80 + 35 * stage', () => {
    for (const def of STAGES) {
      expect(def.firstClear.gold).toBe(80 + 35 * def.id);
    }
  });

  it('every ring the campaign hands out is affordable near its usable ceiling', () => {
    const { state } = simulate();
    // Bringing a newly found ring up to the rank cap should cost a fraction of
    // the campaign's total income, not all of it.
    let toRank10 = 0;
    for (let r = 1; r < 10; r++) toRank10 += ringUpgradeCost(r).gold;
    expect(toRank10).toBeLessThan(state.resources.gold);
  });
});

describe('inventory safety', () => {
  it('never destroys a reward when full: it goes to the overflow stash', () => {
    const s = newGameState();
    s.inventory.capacity = 2;
    addItem(s, 'sword_valley');
    addItem(s, 'bow_hunting');
    expect(isFull(s)).toBe(true);
    const overflow = addItem(s, 'axe_quarry');
    expect(overflow.toStash).toBe(true);
    expect(s.inventory.stash).toHaveLength(1);
    // Nothing is lost: it comes back when there is room.
    s.inventory.capacity = 4;
    expect(reclaimStash(s)).toBe(1);
    expect(s.inventory.items).toHaveLength(3);
  });

  it('bulk salvage protects equipped and locked items', () => {
    const s = newGameState();
    const a = addItem(s, 'sword_valley');
    const b = addItem(s, 'bow_hunting');
    const c = addItem(s, 'axe_quarry');
    equipItem(s, a.item.uid);
    toggleLock(s, b.item.uid);
    const res = salvageUnlocked(s);
    expect(res.count).toBe(1);
    const left = s.inventory.items.map((i) => i.uid);
    expect(left).toContain(a.item.uid);
    expect(left).toContain(b.item.uid);
    expect(left).not.toContain(c.item.uid);
  });
});
