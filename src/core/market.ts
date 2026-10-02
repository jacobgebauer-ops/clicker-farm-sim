// Farmers Market: deterministic weekly prices, hints for next week, selling, and recaps.
import { CONFIG } from './config';
import { C, itemInfo, type ItemInfo } from './content';
import { Rng, hashString } from './rng';
import { emit } from './events';
import { seasonForWeek, previousSeason, isMarketOpen, weekIndex, dayKey, hintsAvailable } from './calendar';
import { addItem, addRibbons, baseValue, count, earn, eventPriceMult, sellMultiplier, track, levelOf } from './economy';
import type { GameState } from './state';
import type { Result } from './farm';
import type { SeasonId } from '../../content/schema';

const fail = (msg: string): Result => ({ ok: false, msg });

export interface WeekPrices {
  week: number;
  season: SeasonId;
  hot: { id: string; mult: number }[];
  slow: { id: string; mult: number }[];
  mult: (id: string) => number;
}

const COLORS = ['purple', 'red', 'orange', 'yellow', 'green', 'blue', 'pink', 'white', 'brown'];
const FLAVORS = ['sweet', 'tart', 'savory', 'crunchy', 'fragrant', 'festive', 'pretty', 'fancy', 'rich', 'spicy'];

/** Items that make sense at market in a given week: in season, last season (stockpiled), or season-free. */
export function eligibleItems(week: number): ItemInfo[] {
  const c = C();
  const season = seasonForWeek(week);
  const ok = new Set<SeasonId>([season, previousSeason(season)]);
  const cropOk = (id: string) => {
    const info = c.items.get(id);
    if (!info || info.kind !== 'crop') return true;
    return !!info.seasons?.some((x) => ok.has(x));
  };
  const out: ItemInfo[] = [];
  for (const info of c.items.values()) {
    if (info.deprecated || info.requires || info.kind === 'material' || info.id === 'wine_family') continue;
    if (info.kind === 'crop' && !cropOk(info.id)) continue;
    if (info.kind === 'product') {
      const r = c.recipes.get(info.id)!;
      if (r.seasons && !r.seasons.includes(season)) continue;
      if (!r.inputs.every((i) => cropOk(i.id) && !c.items.get(i.id)?.requires)) continue;
    }
    out.push(info);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

const cache = new Map<string, WeekPrices>();

export function weekPrices(week: number, forced?: string[] | null): WeekPrices {
  const key = `${week}:${forced?.join(',') ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(`market:${week}`);
  const pool = eligibleItems(week);
  const shuffled = rng.shuffle(pool);
  const hotCount = rng.int(2, 3);
  const round = (x: number) => Math.round(x * 20) / 20;
  let hot = shuffled.slice(0, hotCount).map((i) => ({ id: i.id, mult: round(rng.range(1.5, 2.5)) }));
  if (forced?.length) hot = forced.map((id) => ({ id, mult: 2 }));
  const hotIds = new Set(hot.map((h) => h.id));
  const slow = shuffled.filter((i) => !hotIds.has(i.id)).slice(hotCount, hotCount + 2).map((i) => ({ id: i.id, mult: round(rng.range(0.6, 0.8)) }));
  const table = new Map<string, number>();
  for (const h of [...hot, ...slow]) table.set(h.id, h.mult);
  const wp: WeekPrices = {
    week,
    season: seasonForWeek(week),
    hot,
    slow,
    mult: (id: string) => {
      const base = id.split('@')[0];
      const fixed = table.get(base);
      if (fixed !== undefined) return fixed;
      const n = new Rng(hashString(`noise:${week}:${base}`)).range(0.9, 1.1);
      return Math.round(n * 100) / 100;
    },
  };
  cache.set(key, wp);
  return wp;
}

export function pricesFor(s: GameState, week: number): WeekPrices {
  const forced = s.market.forced?.week === week ? s.market.forced.items : null;
  return weekPrices(week, forced);
}

export function stallLevel(s: GameState): number {
  return s.buildings.market_stall?.stage === 2 ? s.buildings.market_stall.level : 0;
}

export function stallSlots(s: GameState): number {
  return stallLevel(s) ? CONFIG.MARKET_BASE_SLOTS + stallLevel(s) - 1 : 0;
}

export function marketGoal(s: GameState): number {
  return Math.round(CONFIG.MARKET_GOAL_BASE * Math.pow(1.7, Math.max(0, stallLevel(s) - 1)) * (1 + levelOf(s) * 0.05));
}

export function resetMarketDay(s: GameState, now: number) {
  const day = dayKey(now);
  if (s.market.day !== day) {
    s.market.day = day;
    s.market.sold = {};
    s.market.distinct = [];
    s.market.dayCoins = 0;
  }
}

export function marketUnitPrice(s: GameState, key: string, now: number, extraSold = 0): number {
  const base = key.split('@')[0];
  const wp = pricesFor(s, weekIndex(now));
  const sold = (s.market.sold[key] ?? 0) + extraSold;
  const stallBonus = 1 + 0.02 * Math.max(0, stallLevel(s) - 1);
  const decay = Math.pow(1 - CONFIG.MARKET_DECAY, sold);
  return Math.max(1, Math.round(baseValue(key) * wp.mult(base) * eventPriceMult(s, base, now) * sellMultiplier(s) * stallBonus * decay));
}

export function marketStatus(s: GameState, now: number): { open: boolean; reason?: string } {
  if (!stallLevel(s)) return { open: false, reason: 'Restore the Market Stall on the Roadside first.' };
  if (!isMarketOpen(now)) return { open: false, reason: 'The Farmers Market is open Saturday and Sunday.' };
  return { open: true };
}

export function sellAtMarket(s: GameState, key: string, qty: number, now: number): Result {
  const st = marketStatus(s, now);
  if (!st.open) return fail(st.reason!);
  resetMarketDay(s, now);
  const info = itemInfo(key.split('@')[0]);
  if (!info || info.kind === 'material') return fail('Not sold at market');
  if (!s.market.distinct.includes(key) && s.market.distinct.length >= stallSlots(s)) return fail(`Your stall has ${stallSlots(s)} slots today. Upgrade it for more.`);
  const n = Math.min(qty, count(s, key));
  if (n <= 0) return fail('None to sell');
  let total = 0;
  for (let i = 0; i < n; i++) total += marketUnitPrice(s, key, now, i);
  if (!s.market.distinct.includes(key)) s.market.distinct.push(key);
  s.market.sold[key] = (s.market.sold[key] ?? 0) + n;
  s.market.dayCoins += total;
  addItem(s, key, -n);
  earn(s, total);
  const w = String(weekIndex(now));
  const log = (s.market.weeks[w] ??= { coins: 0, byItem: {} });
  log.coins += total;
  const row = (log.byItem[info.id] ??= { coins: 0, qty: 0, effort: 0 });
  row.coins += total;
  row.qty += n;
  row.effort += info.effort * n;
  track(s, 'marketSell', info.id, n);
  track(s, 'sell', undefined, n);
  if (pricesFor(s, weekIndex(now)).hot.some((h) => h.id === info.id)) track(s, 'marketHot', info.id, n);
  emit({ type: 'sfx', name: 'bell' });
  if (s.market.goalDay !== s.market.day && s.market.dayCoins >= marketGoal(s)) {
    s.market.goalDay = s.market.day;
    addRibbons(s, CONFIG.MARKET_GOAL_RIBBONS);
    emit({ type: 'toast', text: `Market goal reached! +${CONFIG.MARKET_GOAL_RIBBONS} ribbons`, icon: 'ribbon' });
  }
  return { ok: true };
}

// ---------- hints ----------
export type HintSource = 'luke' | 'claire' | 'almanac';

function colorOf(i: ItemInfo) {
  return i.tags.find((t) => COLORS.includes(t)) ?? 'colorful';
}
function flavorOf(i: ItemInfo) {
  return i.tags.find((t) => FLAVORS.includes(t));
}
function categoryOf(i: ItemInfo): string {
  if (i.kind === 'wine') return 'wine';
  if (i.kind === 'animal') return 'farm-fresh goods';
  if (i.kind === 'crop') return i.tags.includes('flower') ? 'flowers' : i.tags.includes('fruit') ? 'fruit' : i.tags.includes('festive') ? 'holiday greenery' : 'vegetables';
  const t = i.tags;
  if (t.includes('preserve')) return 'preserves';
  if (t.includes('dairy')) return 'dairy';
  if (t.includes('soup')) return 'soup';
  if (t.includes('dessert')) return 'desserts';
  if (t.includes('baked')) return 'baked goods';
  if (t.includes('flower')) return 'bouquets';
  return 'home cooking';
}

export function describeHint(info: ItemInfo, precision: number): string {
  const c = C();
  const color = colorOf(info);
  const cat = categoryOf(info);
  const flavor = flavorOf(info);
  switch (precision) {
    case 0:
      return flavor ? `Folks are craving something ${color} and ${flavor}.` : `Folks keep talking about something ${color}.`;
    case 1:
      return `People want ${color} ${cat}${flavor ? `, the ${flavor} kind` : ''}.`;
    case 2: {
      if (info.kind === 'product') {
        const r = c.recipes.get(info.id)!;
        const main = r.inputs.map((x) => c.items.get(x.id)!).filter((x) => x.kind !== 'material').sort((a, b) => b.basePrice - a.basePrice)[0];
        return `Shoppers want ${cat} made with ${main?.name.toLowerCase() ?? 'something homegrown'}.`;
      }
      if (info.kind === 'wine') return `Wine lovers are hunting for ${c.wines.get(info.id)?.fruit ?? 'fruit'} wine.`;
      return `Shoppers want ${color} ${cat} that starts with "${info.name[0]}".`;
    }
    default:
      return `${info.name} will be in high demand.`;
  }
}

function isFood(i: ItemInfo) {
  const decorative = i.tags.includes('flower') || i.tags.includes('pretty');
  if (i.kind === 'crop') return !decorative && !i.tags.includes('festive');
  return (i.kind === 'product' && !decorative) || i.kind === 'animal';
}

/** Hints about week `week + 1`'s hot items from one source. Deterministic per week, source, and level. */
export function hintsFor(s: GameState, now: number, source: HintSource): string[] {
  if (!hintsAvailable(now)) return [];
  const target = weekIndex(now) + 1;
  const wp = pricesFor(s, target);
  const pool = eligibleItems(target);
  const hotIds = new Set(wp.hot.map((h) => h.id));
  const decoys = pool.filter((i) => !hotIds.has(i.id));
  const level = C().raw.almanac.levels.find((l) => l.level === s.almanacLevel) ?? C().raw.almanac.levels[0];
  const cfg =
    source === 'luke'
      ? { precision: s.almanacLevel >= 3 ? 1 : 0, accuracy: 0.6, max: 1, filter: (_: ItemInfo) => true }
      : source === 'claire'
        ? { precision: 1, accuracy: 0.8, max: 2, filter: isFood }
        : { precision: level.precision, accuracy: level.accuracy, max: 3, filter: (_: ItemInfo) => true };
  const rng = new Rng(`hint:${source}:${target}:${s.almanacLevel}`);
  const hot = wp.hot.map((h) => C().items.get(h.id)!).filter((i) => i && cfg.filter(i));
  const out: string[] = [];
  for (const item of rng.shuffle(hot).slice(0, cfg.max)) {
    const right = rng.chance(cfg.accuracy);
    const decoyPool = decoys.filter(cfg.filter);
    const subject = right || !decoyPool.length ? item : rng.pick(decoyPool);
    out.push(describeHint(subject, cfg.precision));
  }
  return out;
}

// ---------- recap ----------
export interface MarketRecap {
  week: number;
  coins: number;
  rows: { id: string; name: string; coins: number; qty: number; effort: number; perEffort: number }[];
  best?: { name: string; ratio: number };
  message: string;
}

export function recapFor(s: GameState, week: number): MarketRecap | null {
  const log = s.market.weeks[String(week)];
  if (!log || log.coins <= 0) return null;
  const rows = Object.entries(log.byItem).map(([id, r]) => ({
    id, name: itemInfo(id)?.name ?? id, coins: r.coins, qty: r.qty, effort: r.effort,
    perEffort: r.coins / Math.max(0.05, r.effort),
  })).sort((a, b) => b.coins - a.coins);
  const totalEffort = rows.reduce((sum, r) => sum + r.effort, 0);
  const avg = log.coins / Math.max(0.05, totalEffort);
  const bestRow = [...rows].sort((a, b) => b.perEffort - a.perEffort)[0];
  const ratio = bestRow ? bestRow.perEffort / avg : 1;
  const best = bestRow ? { name: bestRow.name, ratio } : undefined;
  const message = rows.length > 1 && best
    ? `${best.name} made you ${ratio.toFixed(1)}x your average per hour of effort. Nice.`
    : best ? `${best.name} carried the whole weekend. Try a few different items next time!` : '';
  return { week, coins: log.coins, rows, best, message };
}

/** The most recent finished market weekend whose recap has not been shown. */
export function pendingRecap(s: GameState, now: number): MarketRecap | null {
  const current = weekIndex(now);
  const weeks = Object.keys(s.market.weeks).map(Number).filter((w) => w < current && w > s.market.recapSeen).sort((a, b) => b - a);
  return weeks.length ? recapFor(s, weeks[0]) : null;
}
