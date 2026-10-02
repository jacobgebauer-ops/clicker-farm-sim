// Calendar math. Weeks start Monday 00:00 local time and each week is a season.
// All week math goes through local Y/M/D components, so DST shifts (23h or 25h days)
// never move a boundary.
import { CONFIG } from './config';
import type { SeasonId } from '../../content/schema';

const DAY_MS = 86_400_000;

function parseYmd(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m - 1, d];
}

/** Whole days since 1970-01-01 for the local calendar date of `ms` (DST independent). */
export function localDayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

const [AY, AM, AD] = parseYmd(CONFIG.ANCHOR_MONDAY);
const ANCHOR_DAY = Math.round(Date.UTC(AY, AM, AD) / DAY_MS);

/** Week number relative to the anchor Monday. Negative before launch. */
export function weekIndex(ms: number): number {
  return Math.floor((localDayNumber(ms) - ANCHOR_DAY) / 7);
}

/** 0 = Monday ... 6 = Sunday (local). */
export function dayOfWeek(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

/** Local midnight on the Monday that starts week `w`. */
export function weekStartMs(w: number): number {
  return new Date(AY, AM, AD + w * 7).getTime();
}

export function nextWeekStartMs(ms: number): number {
  return weekStartMs(weekIndex(ms) + 1);
}

export function seasonForWeek(w: number): SeasonId {
  const order = CONFIG.SEASON_ORDER;
  const start = order.indexOf(CONFIG.ANCHOR_SEASON);
  // Pre-launch days count as the anchor season so the first week the player sees is Fall.
  if (w < 0) return CONFIG.ANCHOR_SEASON;
  return order[(start + w) % order.length];
}

export function seasonAt(ms: number, forced?: SeasonId | null): SeasonId {
  return forced ?? seasonForWeek(weekIndex(ms));
}

export function previousSeason(s: SeasonId): SeasonId {
  const o = CONFIG.SEASON_ORDER;
  return o[(o.indexOf(s) + o.length - 1) % o.length];
}

export function nextSeason(s: SeasonId): SeasonId {
  const o = CONFIG.SEASON_ORDER;
  return o[(o.indexOf(s) + 1) % o.length];
}

/** Calendar days left in the current week, counting today (Mon = 7, Sun = 1). */
export function daysLeftInWeek(ms: number): number {
  return 7 - dayOfWeek(ms);
}

export function msUntilNextWeek(ms: number): number {
  return nextWeekStartMs(ms) - ms;
}

/** Farmers Market runs Saturday and Sunday. */
export function isMarketOpen(ms: number): boolean {
  return dayOfWeek(ms) >= 5;
}

/** Hints for next week's market arrive midweek (Wednesday onward). */
export function hintsAvailable(ms: number): boolean {
  return dayOfWeek(ms) >= 2;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mmdd(ms: number): string {
  return dayKey(ms).slice(5);
}

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export function timeOfDay(ms: number): TimeOfDay {
  const h = new Date(ms).getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** True when MM-DD `md` falls in the inclusive range (handles ranges that wrap past New Year). */
export function inDateRange(md: string, from: string, to: string): boolean {
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
