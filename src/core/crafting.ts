// Kitchen (recipes) and Winery (fermentation, aging, bottling).
import { CONFIG, type WineTier } from './config';
import { C } from './content';
import { emit } from './events';
import { addItem, addXp, hasItems, heirloomLevel, isUnlocked, missingCost, payWithMaterials, track, currentSeason } from './economy';
import type { GameState, WineBatch } from './state';
import { nextUid } from './state';
import type { Result } from './farm';
import type { RecipeDef } from '../../content/schema';

const fail = (msg: string): Result => ({ ok: false, msg });

// ---------- kitchen ----------
export function kitchenSlots(s: GameState): number {
  const st = s.buildings.kitchen;
  if (st?.stage !== 2) return 0;
  return 2 + Math.floor((st.level - 1) / 3) + heirloomLevel(s, 'h_kitchen');
}

export function kitchenSpeed(s: GameState): number {
  const lvl = s.buildings.kitchen?.level ?? 1;
  return Math.max(0.5, 1 - 0.04 * (lvl - 1));
}

export function recipeUnlocked(s: GameState, r: RecipeDef): boolean {
  if (r.deprecated || !isUnlocked(s, r.requires)) return false;
  const st = s.buildings.kitchen;
  if (st?.stage !== 2) return false;
  if (r.unlock.quest) return s.recipesUnlocked.includes(r.id);
  if (r.unlock.start) return true;
  if (r.unlock.building === 'kitchen') return st.level >= (r.unlock.level ?? 0) + 1;
  return s.recipesUnlocked.includes(r.id);
}

export function recipeInSeason(s: GameState, r: RecipeDef, now: number): boolean {
  return !r.seasons || r.seasons.includes(currentSeason(s, now));
}

export function canCraft(s: GameState, recipeId: string, now: number): { ok: boolean; reason?: string; buyCoins: number } {
  const r = C().recipes.get(recipeId);
  if (!r) return { ok: false, reason: 'Unknown recipe', buyCoins: 0 };
  if (!recipeUnlocked(s, r)) return { ok: false, reason: 'Locked', buyCoins: 0 };
  if (!recipeInSeason(s, r, now)) return { ok: false, reason: 'Out of season', buyCoins: 0 };
  if (s.kitchen.jobs.length >= kitchenSlots(s)) return { ok: false, reason: 'Kitchen is full', buyCoins: 0 };
  const miss = missingCost(s, r.inputs);
  if (!miss.ok) return { ok: false, reason: 'Missing ingredients', buyCoins: miss.coins };
  if (miss.coins > s.coins) return { ok: false, reason: 'Not enough coins for pantry items', buyCoins: miss.coins };
  return { ok: true, buyCoins: miss.coins };
}

export function startCraft(s: GameState, recipeId: string, now: number): Result {
  const can = canCraft(s, recipeId, now);
  if (!can.ok) return fail(can.reason!);
  const r = C().recipes.get(recipeId)!;
  if (!payWithMaterials(s, 0, r.inputs)) return fail('Missing ingredients');
  const ms = Math.round(r.craftMin * 60_000 * kitchenSpeed(s));
  s.kitchen.jobs.push({ id: nextUid(s, 'job'), recipe: r.id, startedAt: now, endsAt: now + ms });
  emit({ type: 'sfx', name: 'tap' });
  return { ok: true };
}

export function collectCraft(s: GameState, jobId: string, now: number): boolean {
  const i = s.kitchen.jobs.findIndex((j) => j.id === jobId);
  if (i < 0) return false;
  const job = s.kitchen.jobs[i];
  if (now < job.endsAt) return false;
  const r = C().recipes.get(job.recipe);
  s.kitchen.jobs.splice(i, 1);
  if (!r) return true; // unknown recipe from a newer save: nothing to give, but free the slot
  addItem(s, r.id, 1);
  if (!s.codex.recipes.includes(r.id)) s.codex.recipes.push(r.id);
  track(s, 'craft', r.id);
  addXp(s, r.xp, now);
  emit({ type: 'collect', item: r.id, qty: 1 });
  emit({ type: 'sfx', name: 'ding' });
  return true;
}

// ---------- winery ----------
export function barrels(s: GameState): number {
  const st = s.buildings.winery;
  if (st?.stage !== 2) return 0;
  return st.level + heirloomLevel(s, 'h_cellar');
}

export function wineSpeed(s: GameState): number {
  const lvl = s.buildings.winery?.level ?? 1;
  return Math.max(0.6, 1 - 0.03 * (lvl - 1));
}

export function wineUnlocked(s: GameState, wineId: string): boolean {
  const w = C().wines.get(wineId);
  return !!w && !w.deprecated && isUnlocked(s, w.requires) && s.buildings.winery?.stage === 2;
}

export function wineInputs(wineId: string) {
  const w = C().wines.get(wineId)!;
  return [{ id: w.fruit, qty: w.fruitQty }, ...w.extras];
}

export function canStartWine(s: GameState, wineId: string): { ok: boolean; reason?: string; buyCoins: number } {
  if (!wineUnlocked(s, wineId)) return { ok: false, reason: 'Locked', buyCoins: 0 };
  if (s.winery.batches.length >= barrels(s)) return { ok: false, reason: 'All barrels are busy', buyCoins: 0 };
  const miss = missingCost(s, wineInputs(wineId));
  if (!miss.ok) return { ok: false, reason: 'Need more fruit', buyCoins: miss.coins };
  if (miss.coins > s.coins) return { ok: false, reason: 'Not enough coins for sugar and bottles', buyCoins: miss.coins };
  return { ok: true, buyCoins: miss.coins };
}

export function startWine(s: GameState, wineId: string, now: number): Result {
  const can = canStartWine(s, wineId);
  if (!can.ok) return fail(can.reason!);
  if (!payWithMaterials(s, 0, wineInputs(wineId))) return fail('Missing ingredients');
  const w = C().wines.get(wineId)!;
  const ms = Math.round(w.fermentMin * 60_000 * wineSpeed(s));
  s.winery.batches.push({ id: nextUid(s, 'wine'), wine: wineId, startedAt: now, readyAt: now + ms });
  emit({ type: 'sfx', name: 'bubble' });
  return { ok: true };
}

export function wineTier(b: WineBatch, now: number): WineTier | null {
  if (now < b.readyAt) return null;
  const dur = Math.max(1, b.readyAt - b.startedAt);
  const extra = (now - b.readyAt) / dur;
  let tier: WineTier = 'young';
  for (const t of CONFIG.WINE_TIERS) if (extra >= t.minExtra) tier = t.id as WineTier;
  return tier;
}

/** ms until the batch reaches the next tier, or null at Reserve. */
export function nextTierIn(b: WineBatch, now: number): { tier: WineTier; ms: number } | null {
  const dur = Math.max(1, b.readyAt - b.startedAt);
  for (const t of CONFIG.WINE_TIERS) {
    const at = b.readyAt + t.minExtra * dur;
    if (at > now) return { tier: t.id as WineTier, ms: at - now };
  }
  return null;
}

export function bottleWine(s: GameState, batchId: string, now: number, name?: string, label?: string): Result {
  const i = s.winery.batches.findIndex((b) => b.id === batchId);
  if (i < 0) return fail('Unknown batch');
  const b = s.winery.batches[i];
  const tier = wineTier(b, now);
  if (!tier) return fail('Still fermenting');
  const w = C().wines.get(b.wine);
  s.winery.batches.splice(i, 1);
  if (!w) return { ok: true };
  const prev = s.wineNames[w.id];
  const finalName = (name ?? prev?.name ?? w.name).trim().slice(0, 28) || w.name;
  const finalLabel = label ?? prev?.label ?? 'label_classic';
  s.wineNames[w.id] = { name: finalName, label: finalLabel };
  addItem(s, `${w.id}@${tier}`, CONFIG.WINE_BOTTLES_PER_BATCH);
  if (!s.codex.wines.includes(w.id)) s.codex.wines.push(w.id);
  s.cellarLog.unshift({ wine: w.id, tier, name: finalName, label: finalLabel, at: now });
  if (s.cellarLog.length > 200) s.cellarLog.length = 200;
  track(s, 'wineBottle', w.id);
  if (tier === 'reserve') track(s, 'wineReserve', w.id);
  addXp(s, 30 + w.fermentMin / 20, now);
  emit({ type: 'toast', text: `Bottled ${CONFIG.WINE_BOTTLES_PER_BATCH} bottles of ${finalName} (${tier[0].toUpperCase() + tier.slice(1)})`, icon: 'wine' });
  emit({ type: 'sfx', name: 'cork' });
  return { ok: true };
}

export function hasIngredientsFor(s: GameState, recipeId: string): boolean {
  const r = C().recipes.get(recipeId);
  return !!r && hasItems(s, r.inputs);
}
