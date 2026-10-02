// Tunable constants. Content lives in /content; numbers that shape the economy live here.
import type { SeasonId } from '../../content/schema';

export const CONFIG = {
  TITLE: 'Selleck Homestead',
  /** First Monday of the game calendar (local time). Week 0 is Fall. */
  ANCHOR_MONDAY: '2026-10-05',
  ANCHOR_SEASON: 'fall' as SeasonId,
  SEASON_ORDER: ['spring', 'summer', 'fall', 'winter'] as SeasonId[],

  START_COINS: 50,
  PRESTIGE_COIN_GOAL: 15_000_000,
  SEEDS_DIVISOR: 250_000,
  OFFLINE_CAP_HOURS: 10,
  OFFLINE_CAP_MAX_HOURS: 16,

  TEND_COOLDOWN_MS: 20_000,
  TEND_SHAVE: 0.05,
  TEND_MAX_SHAVE: 0.25,
  COMPOST_REFUND: 0.5,

  STAND_RATE: 0.75,
  MARKET_DECAY: 0.03,
  MARKET_BASE_SLOTS: 3,
  MARKET_GOAL_BASE: 300,
  MARKET_GOAL_RIBBONS: 2,

  ORDER_REFILL_MS: 8 * 60_000,
  ORDER_MAX_AGE_MS: 6 * 3_600_000,
  ORDER_FAST_MS: 20 * 60_000,
  ORDER_MARKUP: 1.35,

  BRUSH_COOLDOWN_MS: 30 * 60_000,
  BOND_THRESHOLDS: [0, 3, 8, 15, 25, 40],

  MINIGAME_COOLDOWN_MS: 20 * 60_000,
  MINIGAME_SKIP: [0, 0.15, 0.3, 0.5],

  WINE_TIERS: [
    { id: 'young', name: 'Young', minExtra: 0, mult: 1 },
    { id: 'cellared', name: 'Cellared', minExtra: 0.5, mult: 1.5 },
    { id: 'reserve', name: 'Reserve', minExtra: 1.5, mult: 2.2 },
  ],
  WINE_BOTTLES_PER_BATCH: 3,

  BACKUP_REMINDER_MS: 30 * 24 * 3_600_000,
  SCHEMA_VERSION: 3,
} as const;

export type WineTier = 'young' | 'cellared' | 'reserve';
