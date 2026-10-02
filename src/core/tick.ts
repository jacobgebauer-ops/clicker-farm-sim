// The heartbeat: offline catch-up, season rollover, and per-second upkeep.
import { CONFIG } from './config';
import { C, resolveId } from './content';
import { emit } from './events';
import { weekIndex, weekStartMs, seasonForWeek } from './calendar';
import { addItem, earn, grantReward, activeSeasonEvents } from './economy';
import { finishRepairs, updateAnimal, isReady, producerPending, buildingDef } from './farm';
import { refreshOrders } from './shops';
import { resetMarketDay } from './market';
import { rollWishes, checkWishes, checkQuests, checkAchievements, resetJournal } from './progress';
import { prestigeAvailable, offlineCapHours } from './prestige';
import type { GameState, AwaySummary } from './state';

const AWAY_SUMMARY_MIN_MS = 5 * 60_000;

/**
 * Catch up after time away in one step (no tick simulation). Timers are absolute `endsAt`
 * timestamps, so most progress is implicit. Time beyond the offline cap is "frozen" by
 * pushing unfinished timers later. A clock that moved backward grants nothing.
 */
export function applyOffline(s: GameState, now: number): AwaySummary | null {
  const elapsed = now - s.lastSeen;
  if (elapsed < 0) {
    // device clock went backward: no offline time, no penalty, just carry on from here
    s.lastSeen = now;
    return null;
  }
  if (elapsed < 1000) return null;
  const capMs = offlineCapHours(s) * 3_600_000;
  const credited = Math.min(elapsed, capMs);
  const creditEnd = s.lastSeen + credited;
  const shift = elapsed - credited;
  const from = s.lastSeen;

  const summary: AwaySummary = { ms: elapsed, cappedMs: credited, crops: 0, products: {}, crafts: 0, wines: 0, coins: 0, repairs: [] };

  // animals and producers accrue up to the end of the credited window
  const storedBefore = new Map(s.animals.map((a) => [a.id, a.stored]));
  for (const a of s.animals) updateAnimal(s, a, creditEnd);
  for (const a of s.animals) {
    const def = C().animals.get(a.kind);
    const gained = a.stored - (storedBefore.get(a.id) ?? 0);
    if (def?.product && gained > 0) summary.products[def.product] = (summary.products[def.product] ?? 0) + gained;
  }
  for (const id of Object.keys(s.buildings)) {
    const b = buildingDef(id);
    if (!b?.produces) continue;
    const pending = producerPending(s, id, creditEnd) - producerPending(s, id, from);
    if (pending > 0) {
      if (b.produces.item === 'coins') summary.coins += pending;
      else summary.products[b.produces.item] = (summary.products[b.produces.item] ?? 0) + pending;
    }
  }

  const push = (t: number | undefined) => (t !== undefined && t > creditEnd ? t + shift : t);
  if (shift > 0) {
    for (const p of s.plots) p.readyAt = push(p.readyAt);
    for (const j of s.kitchen.jobs) j.endsAt = push(j.endsAt)!;
    for (const b of s.winery.batches) b.readyAt = push(b.readyAt)!;
    for (const st of Object.values(s.buildings)) {
      st.repairEndsAt = push(st.repairEndsAt);
      if (st.producedAt !== undefined) st.producedAt += shift;
    }
    for (const a of s.animals) {
      a.prodAt += shift;
      a.growsAt = push(a.growsAt);
    }
  }

  for (const p of s.plots) if (p.crop && p.readyAt !== undefined && p.readyAt > from && p.readyAt <= now && C().crops.get(resolveId(p.crop))) summary.crops++;
  summary.crafts = s.kitchen.jobs.filter((j) => j.endsAt > from && j.endsAt <= now).length;
  summary.wines = s.winery.batches.filter((b) => b.readyAt > from && b.readyAt <= now).length;
  for (const [id, st] of Object.entries(s.buildings)) if (st.stage === 1 && st.repairEndsAt !== undefined && st.repairEndsAt <= now) summary.repairs.push(id);

  s.lastSeen = now;
  if (elapsed >= AWAY_SUMMARY_MIN_MS) {
    s.pendingAway = summary;
    return summary;
  }
  return null;
}

/** Handle a new week (and therefore a new season). Cozy: nothing is lost. */
export function processRollover(s: GameState, now: number): boolean {
  const w = weekIndex(now);
  if (w === s.lastWeek) return false;
  const forward = w > s.lastWeek;
  s.lastWeek = w;
  if (!forward) return false; // clock moved back across a week: don't re-run rollover
  const season = seasonForWeek(w);
  const boundary = weekStartMs(w);
  let composted = 0;
  let refund = 0;
  for (const p of s.plots) {
    if (!p.crop || p.greenhouse) continue;
    const crop = C().crops.get(resolveId(p.crop));
    if (!crop) continue; // unknown crop from a newer version: leave it alone
    const readyByBoundary = p.readyAt !== undefined && p.readyAt <= boundary;
    if (readyByBoundary || crop.seasons.includes(season)) continue;
    composted++;
    refund += Math.round(crop.seedCost * CONFIG.COMPOST_REFUND);
    p.crop = undefined;
    p.readyAt = p.plantedAt = p.growMs = undefined;
    p.tendShaved = 0;
  }
  if (refund > 0) earn(s, refund);
  const seasonDef = C().raw.seasons.find((x) => x.id === season)!;
  grantReward(s, seasonDef.gift, now);
  resetJournal(s, w);
  s.forcedSeason = null;
  s.pendingRollover = { week: w, season, composted, refund, gift: seasonDef.gift };
  emit({ type: 'sfx', name: 'fanfare' });
  return true;
}

/** Called every second by the UI and after loading. Idempotent. */
export function tick(s: GameState, now: number) {
  finishRepairs(s, now);
  for (const a of s.animals) updateAnimal(s, a, now);
  processRollover(s, now);
  resetMarketDay(s, now);
  refreshOrders(s, now);
  rollWishes(s, now);
  checkWishes(s);
  checkQuests(s, now);
  checkAchievements(s, now);
  // dated season events (Spooky Week, Holiday Lights) hand out a small gift once per year
  for (const ev of activeSeasonEvents(s, now)) {
    if (!ev.gift) continue;
    const key = `event:${ev.id}:${new Date(now).getFullYear()}`;
    if (s.flags.includes(key)) continue;
    s.flags.push(key);
    grantReward(s, ev.gift, now);
    emit({ type: 'toast', text: `${ev.name}! ${ev.text}`, icon: 'gift' });
  }
  if (prestigeAvailable(s) && !s.flags.includes('fair_open')) {
    s.flags.push('fair_open');
    s.buildings.county_fair = { stage: 2, level: 1 };
    emit({ type: 'toast', text: 'The County Fair has come to the Roadside!', icon: 'star' });
  }
  if (now > s.lastSeen) s.lastSeen = now;
}

export function readyCounts(s: GameState, now: number) {
  const crops = s.plots.filter((p) => isReady(p, now)).length;
  const animals = s.animals.filter((a) => a.stored > 0).length;
  const crafts = s.kitchen.jobs.filter((j) => now >= j.endsAt).length;
  const wines = s.winery.batches.filter((b) => now >= b.readyAt).length;
  let producers = 0;
  for (const id of Object.keys(s.buildings)) if (producerPending(s, id, now) > 0) producers++;
  return { crops, animals, crafts, wines, producers, total: crops + animals + crafts + producers };
}

export function addInventory(s: GameState, id: string, qty: number) {
  addItem(s, id, qty);
}
