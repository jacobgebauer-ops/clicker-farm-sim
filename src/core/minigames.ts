// Mini game reward rules (pure). The games themselves live in /src/game/minigames.
import { CONFIG } from './config';
import { C } from './content';
import { emit } from './events';
import { Rng } from './rng';
import { addRibbons, earn, track, heirloomLevel } from './economy';
import type { GameState } from './state';

export function starsFor(score: number, thresholds: [number, number, number]): number {
  return score >= thresholds[2] ? 3 : score >= thresholds[1] ? 2 : score >= thresholds[0] ? 1 : 0;
}

export function minigameBuilding(gameId: string): string | undefined {
  return C().raw.minigames.find((m) => m.id === gameId)?.building;
}

export function cooldownLeft(s: GameState, buildingId: string, now: number): number {
  return Math.max(0, (s.minigames.cooldown[buildingId] ?? 0) - now);
}

export function difficultyFor(s: GameState, gameId: string): number {
  const b = minigameBuilding(gameId);
  const lvl = b ? s.buildings[b]?.level ?? 1 : 1;
  return 1 + Math.max(0, lvl - 1) * 0.08;
}

export interface MiniGameOutcome {
  stars: number;
  rewarded: boolean;
  skipShare: number;
  coins: number;
  personalBest: boolean;
  ribbon: boolean;
}

/** Apply a finished round. Skips a share of the building's remaining timers when off cooldown. */
export function applyMinigameResult(s: GameState, gameId: string, score: number, stars: number, now: number): MiniGameOutcome {
  const buildingId = minigameBuilding(gameId) ?? gameId;
  const prevBest = s.minigames.best[gameId] ?? 0;
  const personalBest = score > prevBest;
  if (personalBest) s.minigames.best[gameId] = score;
  track(s, 'minigame', gameId);
  if (stars >= 3) track(s, 'minigameStars3', gameId);
  const out: MiniGameOutcome = { stars, rewarded: false, skipShare: 0, coins: 0, personalBest, ribbon: false };
  if (cooldownLeft(s, buildingId, now) > 0) {
    if (personalBest && prevBest > 0 && new Rng(`pb:${gameId}:${score}:${now}`).chance(0.3)) {
      addRibbons(s, 1);
      out.ribbon = true;
    }
    return out;
  }
  if (stars <= 0) return out;
  out.rewarded = true;
  out.skipShare = CONFIG.MINIGAME_SKIP[stars];
  s.minigames.cooldown[buildingId] = now + CONFIG.MINIGAME_COOLDOWN_MS;
  skipTimers(s, buildingId, out.skipShare, now);
  const level = s.buildings[buildingId]?.level ?? 1;
  out.coins = Math.round(15 * stars * (1 + level) * (1 + s.farmYear * 0.2));
  earn(s, out.coins);
  if (stars === 3 && heirloomLevel(s, 'h_more_minigames') > 0) {
    addRibbons(s, 1);
    out.ribbon = true;
  }
  emit({ type: 'sfx', name: 'fanfare' });
  return out;
}

/** Cut `share` of the remaining time off every timer the building owns. */
export function skipTimers(s: GameState, buildingId: string, share: number, now: number) {
  const c = C();
  if (buildingId === 'greenhouse') {
    for (const p of s.plots) {
      if (p.crop && p.readyAt !== undefined && p.readyAt > now) p.readyAt -= Math.round((p.readyAt - now) * share);
    }
    return;
  }
  const kind = buildingId === 'barn' ? 'cow' : buildingId === 'coop' ? 'chicken' : null;
  if (!kind) return;
  for (const a of s.animals) {
    const def = c.animals.get(a.kind);
    if (def?.kind !== kind || !def.product) continue;
    const period = def.everyMin * 60_000;
    const elapsed = Math.min(period, now - a.prodAt);
    const remaining = period - elapsed;
    a.prodAt -= Math.round(remaining * share);
  }
}
