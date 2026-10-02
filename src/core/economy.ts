// Shared economy helpers: levels, multipliers, inventory, rewards, and stat tracking.
import { CONFIG, type WineTier } from './config';
import { C, itemInfo, resolveId } from './content';
import { emit } from './events';
import { seasonAt, mmdd, inDateRange, weekIndex } from './calendar';
import type { GameState, AnimalState } from './state';
import { nextUid, hasFlag } from './state';
import type { Reward, SeasonId, SeasonEventDef } from '../../content/schema';

// ---------- levels ----------
export function xpForLevel(level: number): number {
  // total xp needed to reach `level` (level 1 = 0)
  return level <= 1 ? 0 : Math.round(50 * Math.pow(level - 1, 2.1));
}

export function levelFromXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp && l < 999) l++;
  return l;
}

export function levelOf(s: GameState): number {
  return levelFromXp(s.xp);
}

export function heirloomLevel(s: GameState, id: string): number {
  return s.heirloom[id] ?? 0;
}

// ---------- multipliers ----------
export function sellMultiplier(s: GameState): number {
  return reputationMult(s) * (1 + 0.005 * (levelOf(s) - 1)) * (1 + 0.1 * heirloomLevel(s, 'h_yield'));
}

/** Farm reputation: the farmhouse level compounds, and every fully restored parcel adds a bit. */
export function reputationMult(s: GameState): number {
  const farmhouse = s.buildings.farmhouse?.stage === 2 ? s.buildings.farmhouse.level : 1;
  const restored = Object.values(s.parcels).filter((p) => p === 'restored').length;
  return Math.pow(1.08, Math.max(0, farmhouse - 1)) * (1 + 0.05 * restored);
}

export function growMultiplier(s: GameState): number {
  return Math.max(0.4, 1 - 0.05 * heirloomLevel(s, 'h_speed'));
}

export function activeSeasonEvents(s: GameState, now: number): SeasonEventDef[] {
  const season = seasonAt(now, s.forcedSeason);
  const md = mmdd(now);
  return C().raw.events.season.filter((e) => {
    if (e.when.dates) return inDateRange(md, e.when.dates.from, e.when.dates.to);
    if (e.when.seasons) return e.when.seasons.includes(season);
    return false;
  });
}

export function eventPriceMult(s: GameState, itemId: string, now: number): number {
  const info = itemInfo(itemId);
  if (!info) return 1;
  let m = 1;
  for (const e of activeSeasonEvents(s, now)) {
    for (const pm of e.effects.priceMult ?? []) if (info.tags.includes(pm.tag)) m *= pm.mult;
  }
  return m;
}

export function xpMult(s: GameState, now: number): number {
  return activeSeasonEvents(s, now).reduce((m, e) => m * (e.effects.xpMult ?? 1), 1);
}

export function luckyRate(s: GameState, now: number): number {
  return activeSeasonEvents(s, now).reduce((m, e) => m * (e.effects.luckyRate ?? 1), 1);
}

export function currentSeason(s: GameState, now: number): SeasonId {
  return seasonAt(now, s.forcedSeason);
}

// ---------- items ----------
export function wineTierMult(tier: string | undefined): number {
  return CONFIG.WINE_TIERS.find((t) => t.id === tier)?.mult ?? 1;
}

/** Base value of one unit of an inventory key (wines carry their tier as `wine_x@reserve`). */
export function baseValue(key: string): number {
  const [id, tier] = key.split('@');
  const info = itemInfo(id);
  if (!info) return 0;
  return info.basePrice * wineTierMult(tier as WineTier | undefined);
}

export function count(s: GameState, id: string): number {
  return s.inventory[id] ?? 0;
}

export function addItem(s: GameState, id: string, qty: number) {
  const key = id.includes('@') ? id : resolveId(id);
  s.inventory[key] = (s.inventory[key] ?? 0) + qty;
  if (s.inventory[key] <= 0) delete s.inventory[key];
}

export function hasItems(s: GameState, list: { id: string; qty: number }[]): boolean {
  return list.every((i) => count(s, i.id) >= i.qty);
}

export function takeItems(s: GameState, list: { id: string; qty: number }[]) {
  for (const i of list) addItem(s, i.id, -i.qty);
}

/** Coins needed to buy whatever buyable materials are missing from `list` at Andrew's. */
export function missingCost(s: GameState, list: { id: string; qty: number }[]): { coins: number; ok: boolean } {
  let coins = 0;
  let ok = true;
  for (const i of list) {
    const lack = i.qty - count(s, i.id);
    if (lack <= 0) continue;
    const info = itemInfo(i.id);
    if (!info?.buyable) ok = false;
    else coins += info.basePrice * lack;
  }
  return { coins, ok };
}

/** Pay coins plus materials, auto-buying missing buyable materials. Returns false if unaffordable. */
export function payWithMaterials(s: GameState, coins: number, materials: { id: string; qty: number }[]): boolean {
  const miss = missingCost(s, materials);
  if (!miss.ok || s.coins < coins + miss.coins) return false;
  for (const i of materials) {
    const lack = i.qty - count(s, i.id);
    if (lack > 0) {
      addItem(s, i.id, lack);
      track(s, 'buy', i.id, lack);
    }
  }
  takeItems(s, materials);
  spend(s, coins + miss.coins);
  return true;
}

// ---------- currency ----------
export function earn(s: GameState, coins: number, at?: { x: number; y: number }) {
  const n = Math.round(coins);
  if (n <= 0) return;
  s.coins += n;
  s.lifetimeCoins += n;
  s.yearCoins += n;
  track(s, 'coinsEarned', undefined, n);
  emit({ type: 'coins', amount: n, x: at?.x, y: at?.y });
}

export function spend(s: GameState, coins: number): boolean {
  const n = Math.round(coins);
  if (s.coins < n) return false;
  s.coins -= n;
  return true;
}

export function addXp(s: GameState, xp: number, now: number) {
  if (xp <= 0) return;
  const before = levelOf(s);
  s.xp += Math.round(xp * xpMult(s, now));
  const after = levelOf(s);
  if (after > before) {
    emit({ type: 'levelUp', level: after });
    emit({ type: 'sfx', name: 'levelup' });
  }
}

export function addRibbons(s: GameState, n: number) {
  if (n <= 0) return;
  s.ribbons += n;
  emit({ type: 'ribbons', amount: n });
}

// ---------- rewards ----------
export function grantReward(s: GameState, r: Reward | undefined, now: number) {
  if (!r) return;
  const c = C();
  if (r.coins) earn(s, r.coins);
  if (r.ribbons) addRibbons(s, r.ribbons);
  if (r.xp) addXp(s, r.xp, now);
  for (const i of r.items ?? []) addItem(s, i.id, i.qty);
  for (const id of r.cosmetics ?? []) {
    if (!s.owned.cosmetics.includes(id)) {
      s.owned.cosmetics.push(id);
      emit({ type: 'unlock', text: `New cosmetic: ${c.cosmetics.get(id)?.name ?? id}` });
    }
  }
  for (const id of r.decor ?? []) {
    s.owned.decor[id] = (s.owned.decor[id] ?? 0) + 1;
    emit({ type: 'unlock', text: `New decor: ${c.decor.get(id)?.name ?? id}` });
  }
  for (const id of r.recipes ?? []) {
    if (!s.recipesUnlocked.includes(id)) {
      s.recipesUnlocked.push(id);
      emit({ type: 'unlock', text: `New recipe: ${c.recipes.get(id)?.name ?? id}` });
    }
  }
  for (const a of r.animals ?? []) for (let i = 0; i < a.qty; i++) addAnimal(s, a.kind, now, true);
}

export function describeReward(r: Reward | undefined): string {
  if (!r) return '';
  const c = C();
  const parts: string[] = [];
  if (r.coins) parts.push(`${formatShort(r.coins)} coins`);
  if (r.ribbons) parts.push(`${r.ribbons} ribbon${r.ribbons > 1 ? 's' : ''}`);
  if (r.xp) parts.push(`${r.xp} XP`);
  for (const i of r.items ?? []) parts.push(`${i.qty} ${itemInfo(i.id)?.name ?? i.id}`);
  for (const i of r.cosmetics ?? []) parts.push(c.cosmetics.get(i)?.name ?? i);
  for (const i of r.decor ?? []) parts.push(c.decor.get(i)?.name ?? i);
  for (const i of r.recipes ?? []) parts.push(`Recipe: ${c.recipes.get(i)?.name ?? i}`);
  for (const a of r.animals ?? []) parts.push(`${a.qty} ${c.animals.get(a.kind)?.name ?? a.kind}${a.qty > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function formatShort(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

// ---------- animals (shared so rewards can grant them) ----------
export function animalCapacity(s: GameState, kind: 'cow' | 'chicken'): number {
  if (kind === 'cow') {
    const b = s.buildings.barn;
    return b?.stage === 2 ? 2 + b.level : 0;
  }
  const b = s.buildings.coop;
  return b?.stage === 2 ? 4 + 2 * b.level : 0;
}

export function animalsOfKind(s: GameState, kind: 'cow' | 'chicken'): AnimalState[] {
  const c = C();
  return s.animals.filter((a) => c.animals.get(a.kind)?.kind === kind);
}

export function addAnimal(s: GameState, kindId: string, now: number, free = false): AnimalState | null {
  const c = C();
  const def = c.animals.get(kindId);
  if (!def) return null;
  const group = animalsOfKind(s, def.kind);
  if (!free && group.length >= animalCapacity(s, def.kind)) return null;
  const names = def.kind === 'cow' ? c.personal.cows : c.personal.chickens;
  const used = new Set(s.animals.map((a) => a.name));
  const name = names.find((n) => !used.has(n)) ?? `${def.name} ${group.length + 1}`;
  const a: AnimalState = {
    id: nextUid(s, 'an'), kind: kindId, name, bond: 0, prodAt: now, stored: 0, brushUntil: 0, bornAt: now,
    growsAt: def.growMin ? now + def.growMin * 60_000 : undefined,
  };
  s.animals.push(a);
  track(s, 'buyAnimal', kindId);
  return a;
}

// ---------- stats ----------
export function stat(s: GameState, key: string, id?: string): number {
  return s.stats[id ? `${key}:${id}` : key] ?? 0;
}

/** Record that something happened. Feeds quests, wishes, achievements, and the Season Journal. */
export function track(s: GameState, key: string, id?: string, qty = 1) {
  s.stats[key] = (s.stats[key] ?? 0) + qty;
  if (id) s.stats[`${key}:${id}`] = (s.stats[`${key}:${id}`] ?? 0) + qty;
  const pts = C().raw.journal.points[key];
  if (pts) s.journal.points += pts * qty;
}

export function isUnlocked(s: GameState, requires: string | undefined): boolean {
  return hasFlag(s, requires);
}

export function currentWeek(now: number) {
  return weekIndex(now);
}
