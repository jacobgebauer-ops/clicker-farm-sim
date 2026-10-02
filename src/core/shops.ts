// Claire's Cafe orders, Andrew's General Store, the farm stand, and the traveling tourist.
import { CONFIG } from './config';
import { C, itemInfo } from './content';
import { emit } from './events';
import { Rng } from './rng';
import {
  addItem, addRibbons, addXp, baseValue, count, earn, eventPriceMult, levelOf, sellMultiplier, spend, track,
  animalsOfKind, isUnlocked, currentSeason, describeReward, grantReward,
} from './economy';
import { availableCrops, type Result } from './farm';
import { recipeUnlocked, recipeInSeason } from './crafting';
import { weekIndex, dayKey } from './calendar';
import type { GameState, Order } from './state';
import { nextUid } from './state';

const fail = (msg: string): Result => ({ ok: false, msg });

// ---------- Claire ----------
const CAFE_THRESHOLDS = [0, 30, 90, 200, 400, 700, 1100, 1600, 2300, 3200];

export function cafeLevel(s: GameState): number {
  let l = 1;
  CAFE_THRESHOLDS.forEach((t, i) => {
    if (s.claire.friendship >= t) l = i + 1;
  });
  return l;
}

export function cafeNextLevelAt(s: GameState): number | null {
  const l = cafeLevel(s);
  return CAFE_THRESHOLDS[l] ?? null;
}

export function orderSlotCount(s: GameState): number {
  return Math.min(6, 3 + Math.floor((cafeLevel(s) - 1) / 2));
}

/** Amount of an order item on hand. Wine orders accept any quality tier. */
export function haveForOrder(s: GameState, id: string): number {
  if (itemInfo(id)?.kind === 'wine') {
    return ['young', 'cellared', 'reserve'].reduce((n, t) => n + count(s, `${id}@${t}`), 0);
  }
  return count(s, id);
}

function takeForOrder(s: GameState, id: string, qty: number) {
  if (itemInfo(id)?.kind === 'wine') {
    let left = qty;
    for (const t of ['young', 'cellared', 'reserve']) {
      const take = Math.min(left, count(s, `${id}@${t}`));
      addItem(s, `${id}@${t}`, -take);
      left -= take;
    }
    return;
  }
  addItem(s, id, -qty);
}

export function orderCandidates(s: GameState, now: number): string[] {
  const c = C();
  const out = new Set<string>();
  for (const crop of availableCrops(s, now)) out.add(crop.id);
  for (const [id, n] of Object.entries(s.inventory)) {
    const info = itemInfo(id);
    if (n > 0 && info && info.kind !== 'material' && info.kind !== 'wine' && !info.deprecated) out.add(info.id);
  }
  if (animalsOfKind(s, 'chicken').some((a) => a.kind === 'hen')) out.add('egg');
  if (animalsOfKind(s, 'cow').length) out.add('milk');
  for (const r of c.raw.recipes) if (recipeUnlocked(s, r) && recipeInSeason(s, r, now)) out.add(r.id);
  if (cafeLevel(s) >= 3 && s.buildings.winery?.stage === 2) {
    for (const w of c.raw.wines) if (isUnlocked(s, w.requires) && !w.deprecated) out.add(w.id);
  }
  return [...out].filter((id) => itemInfo(id)?.basePrice);
}

export function makeOrder(s: GameState, now: number): Order | null {
  const rng = new Rng(`order:${s.createdAt}:${s.claire.counter++}`);
  const level = levelOf(s);
  let picks: { id: string; qty: number }[];
  if ((s.stats.orderFill ?? 0) === 0 && !s.claire.slots.some((x) => x.order)) {
    // the very first order is always easy: a couple of the cheapest crop in season
    const crop = availableCrops(s, now).filter((c) => !c.requires).sort((a, b) => a.growMin - b.growMin)[0];
    if (!crop) return null;
    picks = [{ id: crop.id, qty: 2 }];
  } else {
    const cands = orderCandidates(s, now);
    if (!cands.length) return null;
    const n = Math.min(cands.length, rng.weighted([1, 2, 3], (k) => (k === 1 ? 5 : k === 2 ? 4 : level >= 6 ? 2 : 0.5)));
    const chosen = rng.shuffle(cands).slice(0, n);
    const target = 25 + 18 * Math.pow(level, 1.35);
    picks = chosen.map((id) => {
      const price = baseValue(id);
      const qty = Math.max(1, Math.min(itemInfo(id)?.kind === 'wine' ? 3 : 12, Math.round((target / n / price) * rng.range(0.7, 1.3))));
      return { id, qty };
    });
  }
  const value = picks.reduce((sum, p) => sum + baseValue(p.id) * p.qty * eventPriceMult(s, p.id, now), 0);
  const effort = picks.reduce((sum, p) => sum + (itemInfo(p.id)?.effort ?? 0.2) * p.qty, 0);
  return {
    id: nextUid(s, 'ord'),
    items: picks,
    coins: Math.max(5, Math.round(value * CONFIG.ORDER_MARKUP * sellMultiplier(s))),
    xp: Math.round(5 + effort * 6),
    ribbon: (s.stats.orderFill ?? 0) > 0 && rng.chance(0.15),
    createdAt: now,
    fastUntil: now + CONFIG.ORDER_FAST_MS,
  };
}

export function refreshOrders(s: GameState, now: number) {
  const want = orderSlotCount(s);
  while (s.claire.slots.length < want) s.claire.slots.push({ refillAt: now });
  for (const slot of s.claire.slots) {
    if (slot.order && now - slot.order.createdAt > CONFIG.ORDER_MAX_AGE_MS) {
      slot.order = undefined;
      slot.refillAt = now;
    }
    if (!slot.order && now >= slot.refillAt) {
      slot.order = makeOrder(s, now) ?? undefined;
      if (!slot.order) slot.refillAt = now + 60_000;
    }
  }
}

export function canFill(s: GameState, order: Order): boolean {
  return order.items.every((i) => haveForOrder(s, i.id) >= i.qty);
}

export function fillOrder(s: GameState, slotIndex: number, now: number): Result {
  const slot = s.claire.slots[slotIndex];
  const order = slot?.order;
  if (!order) return fail('No order here');
  if (!canFill(s, order)) return fail('Missing items');
  for (const i of order.items) takeForOrder(s, i.id, i.qty);
  const fast = now <= order.fastUntil;
  earn(s, Math.round(order.coins * (fast ? 1.1 : 1)));
  addXp(s, Math.round(order.xp * (fast ? 1.25 : 1)), now);
  if (order.ribbon) addRibbons(s, 1);
  s.claire.friendship += 1 + order.items.length + (fast ? 1 : 0);
  slot.order = undefined;
  slot.refillAt = now + ((s.stats.orderFill ?? 0) < 3 ? 20_000 : CONFIG.ORDER_REFILL_MS);
  track(s, 'orderFill');
  emit({ type: 'sfx', name: 'coin' });
  return { ok: true, msg: fast ? 'Speedy delivery bonus!' : undefined };
}

export function skipOrder(s: GameState, slotIndex: number, now: number): Result {
  const slot = s.claire.slots[slotIndex];
  if (!slot?.order) return fail('No order here');
  slot.order = undefined;
  slot.refillAt = now + 3 * 60_000;
  return { ok: true };
}

// ---------- farm stand (any day, a bit less than market) ----------
export function standPrice(s: GameState, key: string, now: number): number {
  return Math.max(1, Math.round(baseValue(key) * CONFIG.STAND_RATE * sellMultiplier(s) * eventPriceMult(s, key.split('@')[0], now)));
}

export function sellAtStand(s: GameState, key: string, qty: number, now: number): Result {
  const info = itemInfo(key.split('@')[0]);
  if (!info || info.kind === 'material') return fail('The stand does not buy that');
  const n = Math.min(qty, count(s, key));
  if (n <= 0) return fail('None to sell');
  const price = standPrice(s, key, now);
  addItem(s, key, -n);
  earn(s, price * n);
  track(s, 'sell', undefined, n);
  track(s, 'standSell', undefined, n);
  emit({ type: 'sfx', name: 'coin' });
  return { ok: true };
}

// ---------- Andrew's General Store ----------
export function buyMaterial(s: GameState, id: string, qty: number): Result {
  const info = itemInfo(id);
  if (!info?.buyable) return fail('Andrew does not stock that');
  if (!spend(s, info.basePrice * qty)) return fail('Not enough coins');
  addItem(s, id, qty);
  track(s, 'buy', id, qty);
  emit({ type: 'sfx', name: 'coin' });
  return { ok: true };
}

export interface ShopEntry {
  type: 'decor' | 'cosmetic';
  id: string;
  name: string;
  coins?: number;
  ribbons?: number;
  weekly: boolean;
}

/** Andrew's catalog: always-available shop items plus a few "this week only" picks. */
export function andrewStock(s: GameState, now: number): ShopEntry[] {
  const c = C();
  const out: ShopEntry[] = [];
  const add = (type: 'decor' | 'cosmetic', x: { id: string; name: string; price?: { coins?: number; ribbons?: number } }, weekly: boolean, discount = 1) =>
    out.push({ type, id: x.id, name: x.name, coins: x.price?.coins ? Math.round(x.price.coins * discount) : undefined, ribbons: x.price?.ribbons, weekly });
  const season = currentSeason(s, now);
  const weekly = [...c.raw.decor.map((d) => ({ ...d, t: 'decor' as const })), ...c.raw.cosmetics.map((d) => ({ ...d, t: 'cosmetic' as const }))]
    .filter((x) => x.source === 'andrew_weekly' && !x.deprecated && isUnlocked(s, x.requires));
  const rng = new Rng(`andrew:${weekIndex(now)}`);
  const inSeason = weekly.filter((x) => x.season === season);
  const others = rng.shuffle(weekly.filter((x) => x.season !== season)).slice(0, 1);
  for (const x of [...inSeason, ...others]) add(x.t, x, true);
  // one regular item on sale each week
  const regular = [...c.raw.decor.map((d) => ({ ...d, t: 'decor' as const })), ...c.raw.cosmetics.map((d) => ({ ...d, t: 'cosmetic' as const }))]
    .filter((x) => x.source === 'shop' && !x.deprecated && isUnlocked(s, x.requires));
  const sale = regular.length ? rng.pick(regular.filter((x) => x.price?.coins)) : null;
  if (sale) add(sale.t, { ...sale, name: `${sale.name} (20% off)` }, true, 0.8);
  for (const x of regular) add(x.t, x, false);
  return out;
}

export function buyShopItem(s: GameState, entry: ShopEntry): Result {
  if (entry.type === 'cosmetic' && s.owned.cosmetics.includes(entry.id)) return fail('Already owned');
  if (entry.coins && s.coins < entry.coins) return fail('Not enough coins');
  if (entry.ribbons && s.ribbons < entry.ribbons) return fail('Not enough ribbons');
  if (entry.coins) spend(s, entry.coins);
  if (entry.ribbons) s.ribbons -= entry.ribbons;
  if (entry.type === 'cosmetic') s.owned.cosmetics.push(entry.id);
  else s.owned.decor[entry.id] = (s.owned.decor[entry.id] ?? 0) + 1;
  track(s, 'shopBuy', entry.id);
  emit({ type: 'sfx', name: 'coin' });
  return { ok: true };
}

// ---------- lucky events ----------
export function claimLucky(s: GameState, eventId: string, now: number): string {
  const ev = C().raw.events.lucky.find((e) => e.id === eventId);
  if (!ev || ev.kind === 'tourist') return '';
  const lvl = levelOf(s);
  const scaled = { ...ev.reward, coins: ev.reward.coins ? Math.round(ev.reward.coins * (1 + lvl * 0.25)) : undefined };
  grantReward(s, scaled, now);
  track(s, 'lucky', ev.kind);
  emit({ type: 'sfx', name: 'sparkle' });
  return `${ev.text} (${describeReward(scaled)})`;
}

export function touristOffer(s: GameState, now: number): { key: string; qty: number; price: number } | null {
  const keys = Object.keys(s.inventory).filter((k) => {
    const info = itemInfo(k.split('@')[0]);
    return info && info.kind !== 'material' && s.inventory[k] > 0;
  });
  if (!keys.length) return null;
  const rng = new Rng(`tourist:${dayKey(now)}:${s.stats.lucky ?? 0}`);
  const key = rng.pick(keys);
  const qty = Math.min(s.inventory[key], rng.int(1, 3));
  return { key, qty, price: Math.round(baseValue(key) * 2 * sellMultiplier(s)) };
}

export function acceptTourist(s: GameState, offer: { key: string; qty: number; price: number }): Result {
  if (count(s, offer.key) < offer.qty) return fail('You no longer have that');
  addItem(s, offer.key, -offer.qty);
  earn(s, offer.price * offer.qty);
  track(s, 'lucky', 'tourist');
  track(s, 'sell', undefined, offer.qty);
  emit({ type: 'sfx', name: 'coin' });
  return { ok: true };
}
