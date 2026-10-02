// The save-able game state. Everything here is plain JSON.
import { CONFIG } from './config';
import { C } from './content';
import { weekIndex, dayKey } from './calendar';
import type { SeasonId } from '../../content/schema';

export type ParcelState = 'overgrown' | 'cleared' | 'restored';

export interface Plot {
  id: string;
  parcel: string;
  /** world tile coords */
  x: number;
  y: number;
  cleared: boolean;
  crop?: string;
  plantedAt?: number;
  readyAt?: number;
  growMs?: number;
  tendUntil?: number;
  tendShaved?: number;
  greenhouse?: boolean;
}

export interface AnimalState {
  id: string;
  kind: string;
  name: string;
  bond: number;
  prodAt: number;
  stored: number;
  brushUntil: number;
  hat?: string;
  neck?: string;
  bornAt: number;
  growsAt?: number;
}

export interface BuildingState {
  stage: 0 | 1 | 2;
  level: number;
  repairEndsAt?: number;
  repairStartedAt?: number;
  producedAt?: number;
  paint?: string;
  roof?: string;
  skin?: string;
}

export interface CraftJob {
  id: string;
  recipe: string;
  startedAt: number;
  endsAt: number;
}

export interface WineBatch {
  id: string;
  wine: string;
  startedAt: number;
  readyAt: number;
}

export interface Order {
  id: string;
  items: { id: string; qty: number }[];
  coins: number;
  xp: number;
  ribbon: boolean;
  createdAt: number;
  fastUntil: number;
}

export interface OrderSlot {
  order?: Order;
  refillAt: number;
}

export interface PlacedDecor {
  uid: string;
  id: string;
  x: number;
  y: number;
  rot: 0 | 1;
}

export interface WeekMarketLog {
  coins: number;
  byItem: Record<string, { coins: number; qty: number; effort: number }>;
}

export interface Wish {
  tid: string;
  stat: string;
  id?: string;
  target: number;
  base: number;
  ribbons: number;
  done: boolean;
}

export interface AwaySummary {
  ms: number;
  cappedMs: number;
  crops: number;
  products: Record<string, number>;
  crafts: number;
  wines: number;
  coins: number;
  repairs: string[];
}

export interface RolloverInfo {
  week: number;
  season: SeasonId;
  composted: number;
  refund: number;
  gift: { coins?: number; items?: { id: string; qty: number }[] };
}

export interface Settings {
  music: number;
  sfx: number;
  mute: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  numberFormat: 'short' | 'full';
}

export interface GameState {
  schemaVersion: number;
  createdAt: number;
  lastSeen: number;
  coins: number;
  ribbons: number;
  heirloomSeeds: number;
  xp: number;
  lifetimeCoins: number;
  yearCoins: number;
  yearAchievements: number;
  farmYear: number;
  inventory: Record<string, number>;
  parcels: Record<string, ParcelState>;
  buildings: Record<string, BuildingState>;
  plots: Plot[];
  animals: AnimalState[];
  kitchen: { jobs: CraftJob[] };
  winery: { batches: WineBatch[] };
  cellarLog: { wine: string; tier: string; name: string; label: string; at: number }[];
  wineNames: Record<string, { name: string; label: string }>;
  claire: { friendship: number; slots: OrderSlot[]; counter: number };
  market: {
    day: string;
    sold: Record<string, number>;
    distinct: string[];
    dayCoins: number;
    goalDay?: string;
    weeks: Record<string, WeekMarketLog>;
    recapSeen: number;
    forced?: { week: number; items: string[] };
  };
  almanacLevel: number;
  journal: { week: number; points: number; claimed: number; cycles: Partial<Record<SeasonId, number>> };
  wishes: { day: string; list: Wish[] };
  daily: { lastDay?: string; streak: number };
  quests: { done: string[] };
  stats: Record<string, number>;
  achievements: string[];
  codex: { crops: string[]; wines: string[]; recipes: string[]; lunaSpots: string[]; lunaGifts: string[]; claimed: string[] };
  owned: { cosmetics: string[]; decor: Record<string, number> };
  placed: PlacedDecor[];
  layouts: Record<string, PlacedDecor[]>;
  avatar: { hair: string; outfit: string; hat: string; acc: string; skin: string; hairColor: string; outfitColor: string };
  recipesUnlocked: string[];
  minigames: { cooldown: Record<string, number>; best: Record<string, number> };
  heirloom: Record<string, number>;
  flags: string[];
  luna: { moments: number; lastGiftDay?: string };
  lastWeek: number;
  forcedSeason?: SeasonId | null;
  pendingRollover?: RolloverInfo | null;
  pendingAway?: AwaySummary | null;
  settings: Settings;
  tutorial: { done: boolean; skipped: boolean };
  seenChangelog: string;
  dedicationSeen: boolean;
  lastBackupPrompt: number;
  lastSeed?: string;
  easterEggsSeen: string[];
  decorTaps: Record<string, number>;
  uid: number;
  /** Fields from newer/older versions we don't understand. Kept, never deleted. */
  [extra: string]: unknown;
}

export function worldOrigin(parcelId: string): [number, number] {
  const p = C().parcels.get(parcelId)!;
  return [p.gx * 8, p.gy * 8];
}

export function buildPlots(): Plot[] {
  const plots: Plot[] = [];
  for (const p of C().raw.parcels) {
    const [ox, oy] = [p.gx * 8, p.gy * 8];
    p.plots.forEach((pl, i) => {
      plots.push({ id: `${p.id}_${i}`, parcel: p.id, x: ox + pl.x, y: oy + pl.y, cleared: false });
    });
  }
  return plots;
}

export function newGame(now: number): GameState {
  const c = C();
  const parcels: Record<string, ParcelState> = {};
  for (const p of c.raw.parcels) parcels[p.id] = p.start;
  const buildings: Record<string, BuildingState> = {};
  for (const b of c.raw.buildings) buildings[b.id] = { stage: 0, level: 0 };
  const startCos = c.raw.cosmetics.filter((x) => x.source === 'start').map((x) => x.id);
  const decor: Record<string, number> = {};
  for (const d of c.raw.decor) if (d.source === 'start') decor[d.id] = 1;
  return {
    schemaVersion: CONFIG.SCHEMA_VERSION,
    createdAt: now,
    lastSeen: now,
    coins: CONFIG.START_COINS,
    ribbons: 0,
    heirloomSeeds: 0,
    xp: 0,
    lifetimeCoins: 0,
    yearCoins: 0,
    yearAchievements: 0,
    farmYear: 1,
    inventory: {},
    parcels,
    buildings,
    plots: buildPlots(),
    animals: [],
    kitchen: { jobs: [] },
    winery: { batches: [] },
    cellarLog: [],
    wineNames: {},
    claire: { friendship: 0, slots: [{ refillAt: 0 }, { refillAt: 0 }, { refillAt: 0 }], counter: 0 },
    market: { day: dayKey(now), sold: {}, distinct: [], dayCoins: 0, weeks: {}, recapSeen: weekIndex(now) - 1 },
    almanacLevel: 1,
    journal: { week: weekIndex(now), points: 0, claimed: 0, cycles: {} },
    wishes: { day: '', list: [] },
    daily: { streak: 0 },
    quests: { done: [] },
    stats: {},
    achievements: [],
    codex: { crops: [], wines: [], recipes: [], lunaSpots: [], lunaGifts: [], claimed: [] },
    owned: { cosmetics: startCos, decor },
    placed: [],
    layouts: {},
    avatar: { hair: 'av_hair_long', outfit: 'av_outfit_overalls', hat: 'av_hat_sun', acc: 'av_acc_none', skin: '#F1C7A5', hairColor: '#7A4A2A', outfitColor: '#7B4FB5' },
    recipesUnlocked: [],
    minigames: { cooldown: {}, best: {} },
    heirloom: {},
    flags: [],
    luna: { moments: 0 },
    lastWeek: weekIndex(now),
    forcedSeason: null,
    pendingRollover: null,
    pendingAway: null,
    settings: { music: 0.5, sfx: 0.7, mute: false, reduceMotion: false, haptics: true, numberFormat: 'short' },
    tutorial: { done: false, skipped: false },
    seenChangelog: '',
    dedicationSeen: false,
    lastBackupPrompt: now,
    easterEggsSeen: [],
    decorTaps: {},
    uid: 1,
  };
}

export function nextUid(s: GameState, prefix: string): string {
  s.uid = (s.uid ?? 1) + 1;
  return `${prefix}${s.uid}`;
}

export function hasFlag(s: GameState, flag: string | undefined): boolean {
  if (!flag) return true;
  if (flag === 'prestige') return s.flags.includes('prestige');
  return s.flags.includes(flag);
}
