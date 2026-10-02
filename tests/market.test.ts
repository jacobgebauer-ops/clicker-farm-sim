import { describe, it, expect } from 'vitest';
import * as G from '../src/core';
import { at, freshGame } from './helpers';

describe('farmers market prices', () => {
  it('is deterministic per week', () => {
    const a = G.weekPrices(7);
    const b = G.weekPrices(7);
    expect(a.hot).toEqual(b.hot);
    expect(a.slow).toEqual(b.slow);
    expect(a.mult('kale')).toBe(b.mult('kale'));
  });

  it('picks 2 to 3 hot items and a couple of slow ones with the right ranges', () => {
    for (let w = 0; w < 40; w++) {
      const p = G.weekPrices(w);
      expect(p.hot.length).toBeGreaterThanOrEqual(2);
      expect(p.hot.length).toBeLessThanOrEqual(3);
      expect(p.slow.length).toBe(2);
      for (const h of p.hot) expect(h.mult).toBeGreaterThanOrEqual(1.5), expect(h.mult).toBeLessThanOrEqual(2.5);
      for (const h of p.slow) expect(h.mult).toBeGreaterThanOrEqual(0.6), expect(h.mult).toBeLessThanOrEqual(0.8);
      const hotIds = new Set([...p.hot, ...p.slow].map((x) => x.id));
      for (const item of G.eligibleItems(w)) if (!hotIds.has(item.id)) {
        expect(p.mult(item.id)).toBeGreaterThanOrEqual(0.9);
        expect(p.mult(item.id)).toBeLessThanOrEqual(1.1);
      }
    }
  });

  it('varies between weeks', () => {
    const sets = new Set(Array.from({ length: 12 }, (_, w) => G.weekPrices(w).hot.map((h) => h.id).join(',')));
    expect(sets.size).toBeGreaterThan(6);
  });

  it('only picks hot items that are in season or stockpiled from last season', () => {
    for (let w = 0; w < 16; w++) {
      const season = G.seasonForWeek(w);
      const ok = [season, G.previousSeason(season)];
      for (const h of G.weekPrices(w).hot) {
        const crop = G.C().crops.get(h.id);
        if (crop) expect(crop.seasons.some((x) => ok.includes(x))).toBe(true);
      }
    }
  });

  it('drops the price about 3% per unit sold that day, recovering the next day', () => {
    const sat = at(2026, 10, 10, 10);
    const s = freshGame(sat);
    s.buildings.market_stall = { stage: 2, level: 1 };
    G.addItem(s, 'pumpkin', 20);
    const p0 = G.marketUnitPrice(s, 'pumpkin', sat);
    expect(G.sellAtMarket(s, 'pumpkin', 10, sat).ok).toBe(true);
    const p10 = G.marketUnitPrice(s, 'pumpkin', sat);
    expect(p10 / p0).toBeCloseTo(Math.pow(0.97, 10), 1);
    const sun = at(2026, 10, 11, 10);
    G.resetMarketDay(s, sun);
    expect(G.marketUnitPrice(s, 'pumpkin', sun)).toBeGreaterThan(p10);
  });

  it('is closed on weekdays and limits distinct items by stall slots', () => {
    const s = freshGame(at(2026, 10, 7));
    s.buildings.market_stall = { stage: 2, level: 1 };
    G.addItem(s, 'kale', 5);
    expect(G.sellAtMarket(s, 'kale', 1, at(2026, 10, 7)).ok).toBe(false);
    const sat = at(2026, 10, 10);
    for (const id of ['kale', 'potato', 'pumpkin', 'apple']) G.addItem(s, id, 2);
    expect(G.sellAtMarket(s, 'kale', 1, sat).ok).toBe(true);
    expect(G.sellAtMarket(s, 'potato', 1, sat).ok).toBe(true);
    expect(G.sellAtMarket(s, 'pumpkin', 1, sat).ok).toBe(true);
    expect(G.sellAtMarket(s, 'apple', 1, sat).ok).toBe(false);
    expect(G.sellAtMarket(s, 'kale', 1, sat).ok).toBe(true);
  });

  it('honors debug-forced hot items', () => {
    const s = freshGame();
    s.market.forced = { week: 3, items: ['plum_jam'] };
    expect(G.pricesFor(s, 3).hot.map((h) => h.id)).toEqual(['plum_jam']);
  });

  it('records a recap with profit versus effort', () => {
    const sat = at(2026, 10, 10);
    const s = freshGame(sat);
    s.buildings.market_stall = { stage: 2, level: 1 };
    G.addItem(s, 'plum_jam', 5);
    G.addItem(s, 'kale', 30);
    G.sellAtMarket(s, 'plum_jam', 5, sat);
    G.sellAtMarket(s, 'kale', 30, sat);
    expect(G.pendingRecap(s, at(2026, 10, 12))?.week).toBe(0);
    const r = G.recapFor(s, 0)!;
    expect(r.rows.length).toBe(2);
    expect(r.message).toMatch(/per hour of effort/);
  });
});

describe('market hints', () => {
  it('arrive midweek, are deterministic, and the top Almanac names the exact hot items', () => {
    const s = freshGame();
    s.almanacLevel = 5;
    const wed = at(2026, 10, 7);
    expect(G.hintsFor(s, at(2026, 10, 6), 'almanac')).toEqual([]);
    const a = G.hintsFor(s, wed, 'almanac');
    expect(a).toEqual(G.hintsFor(s, wed, 'almanac'));
    const hot = G.pricesFor(s, 1).hot.map((h) => G.C().items.get(h.id)!.name);
    for (const line of a) expect(hot.some((n) => line.includes(n))).toBe(true);
  });

  it('can be wrong at a low Almanac level', () => {
    const s = freshGame();
    s.almanacLevel = 1;
    let wrongOrVague = 0;
    for (let w = 0; w < 30; w++) {
      const wed = G.weekStartMs(w) + 2 * 86_400_000 + 3_600_000;
      const hints = G.hintsFor(s, wed, 'almanac');
      const hot = G.pricesFor(s, w + 1).hot.map((h) => G.describeHint(G.C().items.get(h.id)!, 0));
      for (const h of hints) if (!hot.includes(h)) wrongOrVague++;
    }
    expect(wrongOrVague).toBeGreaterThan(0);
  });

  it("Claire's chalkboard only talks about food", () => {
    const s = freshGame();
    for (let w = 0; w < 20; w++) {
      const wed = G.weekStartMs(w) + 2 * 86_400_000 + 3_600_000;
      for (const h of G.hintsFor(s, wed, 'claire')) expect(h).not.toMatch(/wine|flowers|bouquet/i);
    }
  });
});
