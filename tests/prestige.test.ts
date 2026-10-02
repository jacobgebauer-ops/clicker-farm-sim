import { describe, it, expect } from 'vitest';
import * as G from '../src/core';
import { freshGame, at } from './helpers';

describe('Heirloom Years (prestige)', () => {
  it('uses floor(sqrt(lifetimeCoinsThisYear / 250000)) plus first-time achievements', () => {
    expect(G.heirloomSeedsFor(0)).toBe(0);
    expect(G.heirloomSeedsFor(249_999)).toBe(0);
    expect(G.heirloomSeedsFor(250_000)).toBe(1);
    expect(G.heirloomSeedsFor(1_000_000)).toBe(2);
    expect(G.heirloomSeedsFor(15_000_000)).toBe(7);
    expect(G.heirloomSeedsFor(15_000_000, 4)).toBe(11);
  });

  it('unlocks at 100% restoration or the lifetime coin goal', () => {
    const s = freshGame();
    expect(G.prestigeAvailable(s)).toBe(false);
    s.lifetimeCoins = G.CONFIG.PRESTIGE_COIN_GOAL;
    expect(G.prestigeAvailable(s)).toBe(true);
    const r = freshGame();
    for (const p of Object.keys(r.parcels)) r.parcels[p] = 'restored';
    for (const b of G.C().raw.buildings) if (b.core) r.buildings[b.id] = { stage: 2, level: 1 };
    expect(G.restorationPercent(r)).toBe(100);
    expect(G.prestigeAvailable(r)).toBe(true);
  });

  it('opens the County Fair when available', () => {
    const s = freshGame();
    s.lifetimeCoins = G.CONFIG.PRESTIGE_COIN_GOAL;
    G.tick(s, at(2026, 10, 6));
    expect(s.flags).toContain('fair_open');
    expect(G.buildingVisible(s, 'county_fair')).toBe(true);
  });

  it('resets coins, goods, and upgrade levels but keeps land, cosmetics, collections, and friendships', () => {
    const now = at(2026, 10, 6);
    const s = freshGame(now);
    s.yearCoins = 4_000_000;
    s.lifetimeCoins = 16_000_000;
    s.coins = 3_000_000;
    s.parcels.homestead = 'restored';
    s.buildings.farmhouse = { stage: 2, level: 9 };
    s.buildings.kitchen = { stage: 2, level: 5 };
    s.almanacLevel = 4;
    s.inventory = { pumpkin: 50, lumber: 30, 'wine_plum@reserve': 3, from_the_future: 2 };
    s.owned.cosmetics.push('hat_tiny_top');
    s.codex.crops.push('pumpkin');
    s.claire.friendship = 400;
    s.ribbons = 12;
    G.addAnimal(s, 'highland_cow', now, true);
    s.kitchen.jobs.push({ id: 'j', recipe: 'butter', startedAt: now, endsAt: now + 1 });
    const r = G.startHeirloomYear(s, now);
    expect(r.ok).toBe(true);
    expect(s.farmYear).toBe(2);
    expect(s.heirloomSeeds).toBe(4);
    expect(s.coins).toBe(G.CONFIG.START_COINS);
    expect(s.yearCoins).toBe(0);
    expect(s.lifetimeCoins).toBe(16_000_000);
    expect(s.inventory.pumpkin).toBeUndefined();
    expect(s.inventory['wine_plum@reserve']).toBeUndefined();
    expect(s.inventory.lumber).toBe(30);
    expect(s.inventory.from_the_future).toBe(2); // unknown ids are never deleted
    expect(s.buildings.farmhouse).toMatchObject({ stage: 2, level: 1 });
    expect(s.kitchen.jobs).toEqual([]);
    expect(s.almanacLevel).toBe(1);
    expect(s.parcels.homestead).toBe('restored');
    expect(s.owned.cosmetics).toContain('hat_tiny_top');
    expect(s.codex.crops).toContain('pumpkin');
    expect(s.claire.friendship).toBe(400);
    expect(s.ribbons).toBe(12);
    expect(s.animals.length).toBe(1);
  });

  it('spends seeds on the Heirloom Tree with prerequisites and unlock flags', () => {
    const s = freshGame();
    s.heirloomSeeds = 20;
    expect(G.buyHeirloom(s, 'h_hillside_orchard').ok).toBe(false);
    expect(G.buyHeirloom(s, 'h_creek_crops').ok).toBe(true);
    expect(s.flags).toContain('heirloom:creek_crops');
    expect(G.availableCrops(s, at(2026, 10, 6)).some((c) => c.id === 'cranberry')).toBe(true);
    expect(G.buyHeirloom(s, 'h_yield').ok).toBe(true);
    expect(G.sellMultiplier(s)).toBeGreaterThan(1.09);
    expect(G.buyHeirloom(s, 'h_almanac').ok).toBe(true);
  });
});
