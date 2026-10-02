import { describe, it, expect } from 'vitest';
import * as G from '../src/core';
import { at, freshGame, HOUR, MIN } from './helpers';

function farmWithStuff(t0: number) {
  const s = freshGame(t0);
  s.coins = 100_000;
  s.parcels.coop_orchard = 'cleared';
  s.parcels.roadside = 'cleared';
  s.buildings.coop = { stage: 2, level: 1, producedAt: t0 };
  s.buildings.honor_box = { stage: 2, level: 1, producedAt: t0 };
  G.addAnimal(s, 'hen', t0, true);
  const plots = s.plots.filter((p) => p.parcel === 'homestead').slice(0, 2);
  for (const p of plots) G.clearPlot(s, p.id);
  G.plant(s, plots[0].id, 'pumpkin', t0); // 8 h
  G.plant(s, plots[1].id, 'plum', t0); // 12 h
  s.lastSeen = t0;
  G.drainEvents();
  return { s, plots };
}

describe('offline progress', () => {
  it('computes progress in one step and reports a summary', () => {
    const t0 = at(2026, 10, 6, 8);
    const { s } = farmWithStuff(t0);
    const sum = G.applyOffline(s, t0 + 9 * HOUR)!;
    expect(sum).toBeTruthy();
    expect(sum.crops).toBe(1); // pumpkin ready, plum not yet
    expect(sum.products.egg).toBe(4); // capped at storage
    expect(sum.coins).toBeGreaterThan(0);
    expect(s.pendingAway).toBe(sum);
  });

  it('caps credited time at 10 hours and pushes unfinished timers later', () => {
    const t0 = at(2026, 10, 6, 8);
    const { s, plots } = farmWithStuff(t0);
    const plumReady = s.plots.find((p) => p.id === plots[1].id)!.readyAt!;
    const now = t0 + 30 * HOUR;
    const sum = G.applyOffline(s, now)!;
    expect(sum.cappedMs).toBe(10 * HOUR);
    // plum needed 12 h; only 10 h were credited, so 2 h remain from now
    expect(s.plots.find((p) => p.id === plots[1].id)!.readyAt! - now).toBe(plumReady - t0 - 10 * HOUR);
    // honor box pays at most 10 hours
    expect(G.producerPending(s, 'honor_box', now)).toBe(10 * G.producerAmount(s, 'honor_box'));
  });

  it('respects a raised cap from the Heirloom Tree', () => {
    const t0 = at(2026, 10, 6, 8);
    const { s } = farmWithStuff(t0);
    s.heirloom.h_offline = 6;
    expect(G.offlineCapHours(s)).toBe(16);
    const sum = G.applyOffline(s, t0 + 30 * HOUR)!;
    expect(sum.cappedMs).toBe(16 * HOUR);
  });

  it('grants nothing when the clock goes backward, and never corrupts state', () => {
    const t0 = at(2026, 10, 6, 8);
    const { s } = farmWithStuff(t0);
    s.lastSeen = t0 + 5 * HOUR;
    const before = JSON.stringify(s.plots);
    const res = G.applyOffline(s, t0 + 2 * HOUR);
    expect(res).toBeNull();
    expect(s.lastSeen).toBe(t0 + 2 * HOUR);
    expect(JSON.stringify(s.plots)).toBe(before);
    expect(() => G.tick(s, t0 + 2 * HOUR)).not.toThrow();
    expect(s.coins).toBeGreaterThan(0);
  });

  it('skips the summary for short breaks', () => {
    const t0 = at(2026, 10, 6, 8);
    const { s } = farmWithStuff(t0);
    expect(G.applyOffline(s, t0 + 2 * MIN)).toBeNull();
  });
});

describe('season rollover', () => {
  it('composts out-of-season growing crops with a 50% refund; ready crops stay', () => {
    const sun = at(2026, 10, 11, 20); // Sunday of Fall week
    const s = freshGame(sun);
    s.coins = 10_000;
    const [a, b, c] = s.plots.filter((p) => p.parcel === 'homestead');
    for (const p of [a, b, c]) G.clearPlot(s, p.id);
    G.plant(s, a.id, 'kale', sun); // ready before midnight
    G.plant(s, b.id, 'pumpkin', sun); // still growing at rollover, Fall only
    G.plant(s, c.id, 'winter_squash', sun); // Fall and Winter: survives
    const coins = s.coins;
    const mon = at(2026, 10, 12, 8);
    expect(G.processRollover(s, mon)).toBe(true);
    expect(s.pendingRollover?.season).toBe('winter');
    expect(s.plots.find((p) => p.id === a.id)!.crop).toBe('kale');
    expect(s.plots.find((p) => p.id === b.id)!.crop).toBeUndefined();
    expect(s.plots.find((p) => p.id === c.id)!.crop).toBe('winter_squash');
    const pumpkin = G.C().crops.get('pumpkin')!;
    expect(s.pendingRollover?.refund).toBe(Math.round(pumpkin.seedCost * 0.5));
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.journal.points).toBe(0);
    expect(G.processRollover(s, mon + HOUR)).toBe(false);
  });

  it('leaves greenhouse beds and animals alone', () => {
    const sun = at(2026, 10, 11, 20);
    const s = freshGame(sun);
    s.buildings.greenhouse = { stage: 2, level: 1 };
    G.onBuildingChange(s, 'greenhouse', sun);
    const bed = s.plots.find((p) => p.greenhouse)!;
    s.coins = 1000;
    expect(G.plant(s, bed.id, 'strawberry', sun).ok).toBe(true); // out of season, allowed in the greenhouse
    G.processRollover(s, at(2026, 10, 12, 8));
    expect(s.plots.find((p) => p.id === bed.id)!.crop).toBe('strawberry');
  });
});
