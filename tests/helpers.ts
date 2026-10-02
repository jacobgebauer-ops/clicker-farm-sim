import * as G from '../src/core';

/** Local-time timestamp helper (month is 1-based for readability). */
export function at(y: number, m: number, d: number, h = 9, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** A fresh game a few steps into the tutorial, with coins to spare. */
export function freshGame(now = at(2026, 10, 6)) {
  const s = G.newGame(now);
  G.tick(s, now);
  G.drainEvents();
  return s;
}
