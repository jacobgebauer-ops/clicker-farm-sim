// Quests, achievements, daily wishes, the Season Journal, the Daily Basket, and codex sets.
import { C } from './content';
import { emit } from './events';
import { Rng } from './rng';
import { dayKey, weekIndex } from './calendar';
import { addRibbons, grantReward, levelOf, stat, animalsOfKind, currentSeason, describeReward } from './economy';
import { restoredCount } from './farm';
import type { GameState, Wish } from './state';
import type { Objective, QuestDef, Reward, SeasonId } from '../../content/schema';

// ---------- objectives ----------
export function objectiveProgress(s: GameState, o: Objective): { have: number; need: number } {
  switch (o.type) {
    case 'stat':
      return { have: stat(s, o.stat, o.id), need: o.count };
    case 'building': {
      const b = s.buildings[o.id];
      if (o.level !== undefined) return { have: b?.stage === 2 ? b.level : 0, need: o.level };
      return { have: b?.stage ?? 0, need: o.stage ?? 2 };
    }
    case 'parcel': {
      const st = s.parcels[o.id];
      const rank = st === 'restored' ? 2 : st === 'cleared' ? 1 : 0;
      return { have: rank, need: o.state === 'restored' ? 2 : 1 };
    }
    case 'parcelsRestored':
      return { have: restoredCount(s), need: o.count };
    case 'own':
      return { have: s.inventory[o.id] ?? 0, need: o.count };
    case 'animals':
      return { have: s.animals.filter((a) => a.kind === o.kind).length, need: o.count };
    case 'collection':
      return { have: collectionCount(s, o.set), need: o.count };
    case 'coinsLifetime':
      return { have: s.lifetimeCoins, need: o.count };
    case 'level':
      return { have: levelOf(s), need: o.count };
  }
}

export function objectiveDone(s: GameState, o: Objective): boolean {
  const p = objectiveProgress(s, o);
  return p.have >= p.need;
}

export function collectionCount(s: GameState, set: string): number {
  const c = C();
  switch (set) {
    case 'crops':
      return s.codex.crops.length;
    case 'wines':
      return s.codex.wines.filter((w) => w !== 'wine_family').length;
    case 'recipes':
      return s.codex.recipes.length;
    case 'lunaSpots':
      return s.codex.lunaSpots.length;
    case 'lunaGifts':
      return s.codex.lunaGifts.length;
    case 'hats':
      return s.owned.cosmetics.filter((id) => ['cow_hat', 'chicken_hat'].includes(c.cosmetics.get(id)?.slot ?? '')).length;
    default:
      return 0;
  }
}

// ---------- quests ----------
export function activeQuests(s: GameState): QuestDef[] {
  const done = new Set(s.quests.done);
  return C().raw.quests.filter((q) => !q.deprecated && !done.has(q.id) && q.prereq.every((p) => done.has(p)));
}

export function checkQuests(s: GameState, now: number): string[] {
  const finished: string[] = [];
  // loop because finishing one quest can immediately satisfy the next
  for (let guard = 0; guard < 10; guard++) {
    const ready = activeQuests(s).filter((q) => objectiveDone(s, q.objective));
    if (!ready.length) break;
    for (const q of ready) {
      s.quests.done.push(q.id);
      grantReward(s, q.reward, now);
      finished.push(q.id);
      emit({ type: 'quest', id: q.id, title: q.title });
      emit({ type: 'sfx', name: 'fanfare' });
    }
  }
  if (!s.tutorial.done && C().raw.quests.filter((q) => q.tutorial).every((q) => s.quests.done.includes(q.id))) {
    s.tutorial.done = true;
  }
  return finished;
}

export function tutorialQuest(s: GameState): QuestDef | null {
  if (s.tutorial.done || s.tutorial.skipped) return null;
  return activeQuests(s).find((q) => q.tutorial) ?? null;
}

// ---------- achievements ----------
export function checkAchievements(s: GameState, now: number): string[] {
  const got: string[] = [];
  for (const a of C().raw.achievements) {
    if (a.deprecated || s.achievements.includes(a.id)) continue;
    if (!objectiveDone(s, a.condition)) continue;
    s.achievements.push(a.id);
    s.yearAchievements = (s.yearAchievements ?? 0) + 1;
    addRibbons(s, a.ribbons);
    grantReward(s, a.reward, now);
    got.push(a.id);
    emit({ type: 'achievement', id: a.id, name: a.name });
  }
  return got;
}

// ---------- daily wishes ----------
export function rollWishes(s: GameState, now: number) {
  const day = dayKey(now);
  if (s.wishes.day === day) return;
  const rng = new Rng(`wishes:${day}:${s.createdAt}`);
  const eligible = C().raw.wishes.templates.filter((t) => !t.needs || s.buildings[t.needs]?.stage === 2 && (t.needs !== 'barn' || animalsOfKind(s, 'cow').length > 0));
  const picks = rng.shuffle(eligible).slice(0, 3);
  s.wishes = {
    day,
    list: picks.map<Wish>((t) => {
      const target = rng.int(t.min, t.max);
      return { tid: t.id, stat: t.stat, id: t.id2, target, base: stat(s, t.stat, t.id2), ribbons: t.ribbons, done: false };
    }),
  };
}

export function wishText(w: Wish): string {
  const t = C().raw.wishes.templates.find((x) => x.id === w.tid);
  return (t?.text ?? w.tid).replace('{n}', String(w.target));
}

export function wishProgress(s: GameState, w: Wish): number {
  return Math.min(w.target, stat(s, w.stat, w.id) - w.base);
}

export function checkWishes(s: GameState) {
  for (const w of s.wishes.list) {
    if (!w.done && wishProgress(s, w) >= w.target) {
      w.done = true;
      addRibbons(s, w.ribbons);
      emit({ type: 'wish', text: wishText(w) });
    }
  }
}

// ---------- Season Journal ----------
export function journalTier(s: GameState): number {
  const tiers = C().raw.journal.tiers;
  let t = 0;
  for (const need of tiers) if (s.journal.points >= need) t++;
  return t;
}

export function resetJournal(s: GameState, week: number) {
  s.journal.week = week;
  s.journal.points = 0;
  s.journal.claimed = 0;
}

/** What the reward at tier index `i` (0-based) would be right now. */
export function journalRewardAt(s: GameState, i: number, now: number): { reward: Reward; label: string } {
  const j = C().raw.journal;
  const season = currentSeason(s, now);
  if (j.poolTiers.includes(i + 1)) {
    // next unowned item from this season's pool
    const pool = j.pools[season] ?? [];
    const slot = j.poolTiers.indexOf(i + 1);
    const unowned = pool.filter((p) => (p.type === 'cosmetic' ? !s.owned.cosmetics.includes(p.id) : !(s.owned.decor[p.id] > 0)));
    const pick = unowned[slot] ?? unowned[0];
    if (pick) {
      const reward: Reward = pick.type === 'cosmetic' ? { cosmetics: [pick.id] } : { decor: [pick.id] };
      return { reward, label: describeReward(reward) };
    }
    const fallback: Reward = { ribbons: 2, coins: 500 * (1 + Math.floor(levelOf(s) / 5)) };
    return { reward: fallback, label: describeReward(fallback) };
  }
  const filler = j.filler[i % j.filler.length];
  const scale = 1 + Math.floor(levelOf(s) / 5) * 0.5;
  const reward: Reward = { ...filler, coins: filler.coins ? Math.round(filler.coins * scale) : undefined };
  return { reward, label: describeReward(reward) };
}

export function claimJournal(s: GameState, now: number): number {
  const reached = journalTier(s);
  let n = 0;
  while (s.journal.claimed < reached) {
    const { reward } = journalRewardAt(s, s.journal.claimed, now);
    grantReward(s, reward, now);
    s.journal.claimed++;
    n++;
    if (s.journal.claimed === 20) {
      const season = currentSeason(s, now) as SeasonId;
      s.journal.cycles[season] = (s.journal.cycles[season] ?? 0) + 1;
      emit({ type: 'toast', text: 'Season Journal complete! You are a star.', icon: 'star' });
    }
  }
  if (n) emit({ type: 'sfx', name: 'chime' });
  return n;
}

// ---------- Daily Basket ----------
export function dailyAvailable(s: GameState, now: number): boolean {
  return s.daily.lastDay !== dayKey(now);
}

export function dailyRewardIndex(s: GameState): number {
  return s.daily.streak % 7;
}

export function claimDaily(s: GameState, now: number): Reward | null {
  if (!dailyAvailable(s, now)) return null;
  const base = C().raw.daily.basket[dailyRewardIndex(s)];
  const scale = 1 + Math.floor(levelOf(s) / 5) * 0.5;
  const reward: Reward = { ...base, coins: base.coins ? Math.round(base.coins * scale) : undefined };
  grantReward(s, reward, now);
  s.daily.lastDay = dayKey(now);
  s.daily.streak++;
  emit({ type: 'sfx', name: 'chime' });
  return reward;
}

// ---------- codex sets ----------
export interface CodexSet {
  id: string;
  name: string;
  have: number;
  total: number;
  ribbons: number;
}

export function codexSets(s: GameState): CodexSet[] {
  const c = C();
  const crops = c.raw.crops.filter((x) => !x.requires && !x.deprecated);
  const sets: CodexSet[] = (['spring', 'summer', 'fall', 'winter'] as SeasonId[]).map((season) => {
    const list = crops.filter((x) => x.seasons[0] === season);
    return { id: `crops_${season}`, name: `${season[0].toUpperCase() + season.slice(1)} Crops`, have: list.filter((x) => s.codex.crops.includes(x.id)).length, total: list.length, ribbons: 3 };
  });
  const wines = c.raw.wines.filter((w) => !w.family && !w.requires);
  sets.push({ id: 'wines', name: 'Wine Cellar', have: wines.filter((w) => s.codex.wines.includes(w.id)).length, total: wines.length, ribbons: 6 });
  const recipes = c.raw.recipes.filter((r) => !r.requires && !r.deprecated);
  sets.push({ id: 'recipes', name: 'Recipe Box', have: recipes.filter((r) => s.codex.recipes.includes(r.id)).length, total: recipes.length, ribbons: 8 });
  const hats = c.raw.cosmetics.filter((x) => (x.slot === 'cow_hat' || x.slot === 'chicken_hat') && !x.requires);
  sets.push({ id: 'hats', name: 'Hat Collection', have: hats.filter((h) => s.owned.cosmetics.includes(h.id)).length, total: hats.length, ribbons: 8 });
  sets.push({ id: 'luna_spots', name: 'Luna Moments: Napping Spots', have: s.codex.lunaSpots.length, total: c.raw.luna.spots.length, ribbons: 10 });
  sets.push({ id: 'luna_gifts', name: "Luna's Gifts", have: s.codex.lunaGifts.length, total: c.raw.luna.gifts.length, ribbons: 5 });
  const decor = c.raw.decor.filter((d) => !d.requires);
  sets.push({ id: 'decor', name: 'Decor Catalog', have: decor.filter((d) => (s.owned.decor[d.id] ?? 0) > 0).length, total: decor.length, ribbons: 10 });
  return sets;
}

export function claimCodex(s: GameState, setId: string): boolean {
  const set = codexSets(s).find((x) => x.id === setId);
  if (!set || set.have < set.total || s.codex.claimed.includes(setId)) return false;
  s.codex.claimed.push(setId);
  addRibbons(s, set.ribbons);
  emit({ type: 'toast', text: `${set.name} complete! +${set.ribbons} ribbons`, icon: 'ribbon' });
  return true;
}

export function journalWeekOk(s: GameState, now: number) {
  return s.journal.week === weekIndex(now);
}
