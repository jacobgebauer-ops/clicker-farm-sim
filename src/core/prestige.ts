// Heirloom Years: an optional, gentle prestige loop. The land stays restored.
import { CONFIG } from './config';
import { C } from './content';
import { emit } from './events';
import { heirloomLevel } from './economy';
import { restorationPercent, onBuildingChange, type Result } from './farm';
import type { GameState } from './state';

export function prestigeAvailable(s: GameState): boolean {
  return restorationPercent(s) >= 100 || s.lifetimeCoins >= CONFIG.PRESTIGE_COIN_GOAL;
}

export function heirloomSeedsFor(yearCoins: number, achievementBonus = 0): number {
  return Math.floor(Math.sqrt(Math.max(0, yearCoins) / CONFIG.SEEDS_DIVISOR)) + achievementBonus;
}

export function pendingSeeds(s: GameState): number {
  return heirloomSeedsFor(s.yearCoins, s.yearAchievements ?? 0);
}

export function offlineCapHours(s: GameState): number {
  return Math.min(CONFIG.OFFLINE_CAP_MAX_HOURS, CONFIG.OFFLINE_CAP_HOURS + heirloomLevel(s, 'h_offline'));
}

/** Start a new Heirloom Year. Keeps land, cosmetics, decor, collections, story, friendships. */
export function startHeirloomYear(s: GameState, now: number): Result {
  if (!prestigeAvailable(s)) return { ok: false, msg: 'Not available yet' };
  const seeds = pendingSeeds(s);
  const materials = new Set(C().raw.items.filter((i) => i.kind === 'material').map((i) => i.id));
  s.heirloomSeeds += seeds;
  s.farmYear += 1;
  s.coins = CONFIG.START_COINS + 2000 * heirloomLevel(s, 'h_start_coins');
  s.yearCoins = 0;
  s.yearAchievements = 0;
  // goods reset, materials stay
  for (const k of Object.keys(s.inventory)) {
    const known = C().items.has(k.split('@')[0]);
    if (known && !materials.has(k)) delete s.inventory[k];
  }
  for (const [id, b] of Object.entries(s.buildings)) {
    if (b.stage === 2) b.level = 1;
    if (b.stage === 1) {
      b.stage = 2;
      b.level = 1;
      b.repairEndsAt = undefined;
    }
    b.producedAt = now;
    onBuildingChange(s, id, now);
  }
  // greenhouse beds beyond level 1 go away
  s.plots = s.plots.filter((p) => !p.greenhouse || p.id === 'greenhouse_0');
  for (const p of s.plots) {
    p.crop = undefined;
    p.readyAt = p.plantedAt = p.growMs = undefined;
    p.tendShaved = 0;
  }
  s.kitchen.jobs = [];
  s.winery.batches = [];
  s.almanacLevel = Math.min(C().raw.almanac.levels.length, 1 + heirloomLevel(s, 'h_almanac'));
  s.market.dayCoins = 0;
  for (const slot of s.claire.slots) {
    slot.order = undefined;
    slot.refillAt = now;
  }
  emit({ type: 'toast', text: `Welcome to Farm Year ${s.farmYear}! +${seeds} Heirloom Seeds`, icon: 'seed' });
  emit({ type: 'sfx', name: 'fireworks' });
  return { ok: true, msg: String(seeds) };
}

export function heirloomCost(s: GameState, id: string): number | null {
  const u = C().heirloom.get(id);
  if (!u) return null;
  const lvl = heirloomLevel(s, id);
  return lvl >= u.maxLevel ? null : u.costs[Math.min(lvl, u.costs.length - 1)];
}

export function buyHeirloom(s: GameState, id: string): Result {
  const u = C().heirloom.get(id);
  if (!u) return { ok: false, msg: 'Unknown upgrade' };
  if (!u.prereq.every((p) => heirloomLevel(s, p) > 0)) return { ok: false, msg: 'Unlock the earlier branch first' };
  const cost = heirloomCost(s, id);
  if (cost === null) return { ok: false, msg: 'Maxed out' };
  if (s.heirloomSeeds < cost) return { ok: false, msg: 'Not enough Heirloom Seeds' };
  s.heirloomSeeds -= cost;
  s.heirloom[id] = heirloomLevel(s, id) + 1;
  if (u.effect.type === 'unlock' && u.effect.flag && !s.flags.includes(u.effect.flag)) s.flags.push(u.effect.flag);
  emit({ type: 'toast', text: `${u.name} unlocked!`, icon: 'seed' });
  emit({ type: 'sfx', name: 'levelup' });
  return { ok: true };
}
