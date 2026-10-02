import { describe, it, expect } from 'vitest';
import * as G from '../src/core';
import { at, freshGame, MIN, HOUR, DAY } from './helpers';

describe('first session loop', () => {
  it('clears, plants, tends, harvests, fills the first order, and fixes the coop', () => {
    let t = at(2026, 10, 6, 9);
    const s = freshGame(t);
    const plots = s.plots.filter((p) => p.parcel === 'homestead').slice(0, 3);
    for (const p of plots) expect(G.clearPlot(s, p.id).ok).toBe(true);
    const crop = G.availableCrops(s, t).sort((a, b) => a.growMin - b.growMin)[0];
    for (const p of plots) expect(G.plant(s, p.id, crop.id, t).ok).toBe(true);
    for (const p of plots) expect(G.tend(s, p.id, t).ok).toBe(true);
    G.tick(s, t);
    expect(s.quests.done).toEqual(expect.arrayContaining(['q_welcome', 'q_first_plant', 'q_tend']));
    t += crop.growMin * MIN;
    for (const p of plots) expect(G.harvest(s, p.id, t).ok).toBe(true);
    G.tick(s, t);
    expect(s.quests.done).toContain('q_first_harvest');
    expect(G.startRepair(s, 'farmhouse', t).ok).toBe(true);
    t += 2 * MIN;
    G.tick(s, t);
    expect(s.buildings.farmhouse.stage).toBe(2);
    // the very first order is easy: two of the quickest crop
    const slot = s.claire.slots.findIndex((x) => x.order && G.canFill(s, x.order));
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(G.fillOrder(s, slot, t).ok).toBe(true);
    G.tick(s, t);
    expect(s.quests.done).toContain('q_claire_first');
    expect(G.clearParcel(s, 'coop_orchard').ok).toBe(true);
    G.tick(s, t);
    expect(G.startRepair(s, 'coop', t).ok).toBe(true);
    t += 2 * MIN;
    G.tick(s, t);
    expect(s.buildings.coop.stage).toBe(2);
    expect(G.animalsOfKind(s, 'chicken').length).toBe(3); // quest reward: two hens and a rooster
  });

  it('cannot plant out of season outside the greenhouse', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    const p = s.plots.find((x) => x.parcel === 'homestead')!;
    G.clearPlot(s, p.id);
    expect(G.plant(s, p.id, 'strawberry', t).ok).toBe(false);
  });
});

describe('cooldowns', () => {
  it('tending shaves time with a per-plot cooldown and a cap', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.coins = 1000;
    const p = s.plots.find((x) => x.parcel === 'homestead')!;
    G.clearPlot(s, p.id);
    G.plant(s, p.id, 'pumpkin', t);
    const ready0 = p.readyAt!;
    expect(G.tend(s, p.id, t).ok).toBe(true);
    expect(p.readyAt!).toBeLessThan(ready0);
    expect(G.tend(s, p.id, t + 1000).ok).toBe(false); // cooldown
    let n = t;
    for (let i = 0; i < 20; i++) {
      n += G.CONFIG.TEND_COOLDOWN_MS;
      G.tend(s, p.id, n);
    }
    expect(ready0 - p.readyAt!).toBeLessThanOrEqual(p.growMs! * G.CONFIG.TEND_MAX_SHAVE + 1);
  });

  it('mini game rewards skip timers and then cool down for 20 minutes', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.buildings.coop = { stage: 2, level: 1 };
    const hen = G.addAnimal(s, 'hen', t, true)!;
    const period = G.animalPeriod(s, hen);
    const r1 = G.applyMinigameResult(s, 'egg_catch', 50, 3, t);
    expect(r1.rewarded).toBe(true);
    expect(r1.skipShare).toBe(0.5);
    expect(hen.prodAt).toBe(t - period * 0.5);
    expect(G.cooldownLeft(s, 'coop', t)).toBe(20 * MIN);
    const r2 = G.applyMinigameResult(s, 'egg_catch', 10, 1, t + MIN);
    expect(r2.rewarded).toBe(false);
    expect(G.cooldownLeft(s, 'coop', t + 20 * MIN)).toBe(0);
    expect(G.applyMinigameResult(s, 'egg_catch', 20, 1, t + 20 * MIN).skipShare).toBe(0.15);
    expect(s.minigames.best.egg_catch).toBe(50);
  });

  it('Weed Pull skips a share of every growing crop', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.coins = 1000;
    s.buildings.greenhouse = { stage: 2, level: 1 };
    const p = s.plots.find((x) => x.parcel === 'homestead')!;
    G.clearPlot(s, p.id);
    G.plant(s, p.id, 'pumpkin', t);
    const left = p.readyAt! - t;
    G.applyMinigameResult(s, 'weed_pull', 30, 2, t);
    expect(p.readyAt! - t).toBe(left - Math.round(left * 0.3));
  });

  it('brushing a cow raises bond with a cooldown', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.buildings.barn = { stage: 2, level: 1 };
    const cow = G.addAnimal(s, 'highland_cow', t, true)!;
    expect(G.brush(s, cow.id, t).ok).toBe(true);
    expect(G.brush(s, cow.id, t + MIN).ok).toBe(false);
    expect(G.brush(s, cow.id, t + 31 * MIN).ok).toBe(true);
    expect(cow.bond).toBe(2);
  });
});

describe('crafting and wine', () => {
  it('cooks recipes, auto-buying pantry items', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.coins = 1000;
    s.buildings.kitchen = { stage: 2, level: 3 };
    G.addItem(s, 'apple', 3);
    G.addItem(s, 'butter', 1);
    expect(G.startCraft(s, 'apple_pie', t).ok).toBe(true);
    expect(G.count(s, 'flour')).toBe(0);
    expect(G.collectCraft(s, s.kitchen.jobs[0].id, t + 2 * HOUR)).toBe(true);
    expect(G.count(s, 'apple_pie')).toBe(1);
  });

  it('ages wine from Young to Cellared to Reserve', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.coins = 1000;
    s.buildings.winery = { stage: 2, level: 1 };
    G.addItem(s, 'apple', 5);
    expect(G.startWine(s, 'wine_apple', t).ok).toBe(true);
    const b = s.winery.batches[0];
    const dur = b.readyAt - b.startedAt;
    expect(G.wineTier(b, b.readyAt - 1)).toBeNull();
    expect(G.wineTier(b, b.readyAt)).toBe('young');
    expect(G.wineTier(b, b.readyAt + dur * 0.5)).toBe('cellared');
    expect(G.wineTier(b, b.readyAt + dur * 1.5)).toBe('reserve');
    expect(G.bottleWine(s, b.id, b.readyAt + dur * 2, 'Rachel Red', 'label_classic').ok).toBe(true);
    expect(G.count(s, 'wine_apple@reserve')).toBe(3);
    expect(s.wineNames.wine_apple.name).toBe('Rachel Red');
    expect(s.stats.wineReserve).toBe(1);
    expect(G.baseValue('wine_apple@reserve')).toBeGreaterThan(G.baseValue('wine_apple@young'));
  });
});

describe('retention systems', () => {
  it('the daily basket streak pauses instead of resetting', () => {
    const s = freshGame();
    expect(G.claimDaily(s, at(2026, 10, 6))).toBeTruthy();
    expect(G.claimDaily(s, at(2026, 10, 6, 20))).toBeNull();
    expect(G.claimDaily(s, at(2026, 10, 7))).toBeTruthy();
    // skip a few days
    expect(G.claimDaily(s, at(2026, 10, 12))).toBeTruthy();
    expect(s.daily.streak).toBe(3);
  });

  it('the Season Journal pays from the season pool, then repeat-friendly rewards', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.journal.points = 10_000;
    expect(G.journalTier(s)).toBe(20);
    expect(G.claimJournal(s, t)).toBe(20);
    expect(s.owned.cosmetics).toContain('hat_candy_corn');
    expect(s.journal.cycles.fall).toBe(1);
    // next fall cycle: pool items left over come first, then coins and ribbons
    const before = s.owned.cosmetics.length + Object.keys(s.owned.decor).length;
    G.resetJournal(s, 4);
    s.journal.points = 10_000;
    G.claimJournal(s, t + 28 * DAY);
    expect(s.owned.cosmetics.length + Object.keys(s.owned.decor).length).toBeGreaterThanOrEqual(before);
  });

  it('daily wishes roll per day and grant ribbons when done', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    G.rollWishes(s, t);
    expect(s.wishes.list.length).toBe(3);
    const w = s.wishes.list[0];
    G.track(s, w.stat, w.id, w.target);
    const r = s.ribbons;
    G.checkWishes(s);
    expect(w.done).toBe(true);
    expect(s.ribbons).toBe(r + w.ribbons);
  });

  it('Luna is useless but collectible', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    const coins = s.coins;
    const res = G.tapLuna(s, t);
    expect(res.newSpot).toBe(true);
    expect(s.luna.moments).toBe(1);
    expect(s.coins).toBe(coins);
    expect(G.lunaSpot(s, t).id).toBe(G.lunaSpot(s, t + 60_000).id);
  });

  it('decor snaps to the grid and avoids buildings and plots', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.owned.decor.wooden_bench = 2;
    expect(G.placeDecor(s, 'wooden_bench', 9, 8).ok).toBe(false); // farmhouse
    expect(G.placeDecor(s, 'wooden_bench', 2, 2).ok).toBe(false); // overgrown woods
    expect(G.placeDecor(s, 'wooden_bench', 13, 13).ok).toBe(true);
    expect(G.placeDecor(s, 'wooden_bench', 13, 13).ok).toBe(false); // occupied
    const uid = s.placed[0].uid;
    expect(G.moveDecor(s, uid, 12, 11).ok).toBe(true);
    expect(G.stashDecor(s, uid).ok).toBe(true);
    expect(G.stashCount(s, 'wooden_bench')).toBe(2);
  });

  it('formats big numbers', () => {
    expect(G.formatNumber(999)).toBe('999');
    expect(G.formatNumber(12_345)).toBe('12.3K');
    expect(G.formatNumber(1_500_000)).toBe('1.5M');
    expect(G.formatNumber(2_000_000_000)).toBe('2B');
    expect(G.formatNumber(12_345, 'full')).toBe('12,345');
  });
});
