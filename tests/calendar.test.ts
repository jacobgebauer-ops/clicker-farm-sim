import { describe, it, expect } from 'vitest';
import * as G from '../src/core';
import { at, HOUR } from './helpers';

describe('calendar and seasons', () => {
  it('runs in a DST timezone for these tests', () => {
    expect(process.env.TZ).toBe('America/Los_Angeles');
  });

  it('anchors week 0 to Monday 2026-10-05 as Fall', () => {
    expect(G.weekIndex(at(2026, 10, 5, 0, 0))).toBe(0);
    expect(G.seasonForWeek(0)).toBe('fall');
    expect(G.dayOfWeek(at(2026, 10, 5))).toBe(0);
  });

  it('cycles Fall, Winter, Spring, Summer each week', () => {
    expect([0, 1, 2, 3, 4].map(G.seasonForWeek)).toEqual(['fall', 'winter', 'spring', 'summer', 'fall']);
  });

  it('treats pre-launch days as Fall', () => {
    expect(G.weekIndex(at(2026, 10, 2))).toBe(-1);
    expect(G.seasonAt(at(2026, 10, 2))).toBe('fall');
  });

  it('flips the week exactly at Monday 00:00 local time', () => {
    expect(G.weekIndex(at(2026, 10, 11, 23, 59))).toBe(0);
    expect(G.weekIndex(at(2026, 10, 12, 0, 0))).toBe(1);
    expect(G.weekStartMs(1)).toBe(at(2026, 10, 12, 0, 0));
  });

  it('handles the fall-back DST week (Nov 1 2026 has 25 hours)', () => {
    // week 4 starts Mon Nov 2 2026; DST ended Sun Nov 1
    expect(G.weekIndex(at(2026, 11, 1, 23, 59))).toBe(3);
    expect(G.weekIndex(at(2026, 11, 2, 0, 0))).toBe(4);
    expect(G.weekStartMs(4)).toBe(at(2026, 11, 2, 0, 0));
    expect(G.weekStartMs(4) - G.weekStartMs(3)).toBe(7 * 24 * HOUR + HOUR);
  });

  it('handles the spring-forward DST week (Mar 14 2027 has 23 hours)', () => {
    const w = G.weekIndex(at(2027, 3, 15, 0, 0));
    expect(G.weekIndex(at(2027, 3, 14, 23, 59))).toBe(w - 1);
    expect(G.weekStartMs(w)).toBe(at(2027, 3, 15, 0, 0));
    expect(G.weekStartMs(w) - G.weekStartMs(w - 1)).toBe(7 * 24 * HOUR - HOUR);
  });

  it('opens the market on weekends and hints midweek', () => {
    expect(G.isMarketOpen(at(2026, 10, 10))).toBe(true); // Saturday
    expect(G.isMarketOpen(at(2026, 10, 11))).toBe(true); // Sunday
    expect(G.isMarketOpen(at(2026, 10, 9))).toBe(false); // Friday
    expect(G.hintsAvailable(at(2026, 10, 6))).toBe(false); // Tuesday
    expect(G.hintsAvailable(at(2026, 10, 7))).toBe(true); // Wednesday
  });

  it('counts days left in the week', () => {
    expect(G.daysLeftInWeek(at(2026, 10, 5))).toBe(7);
    expect(G.daysLeftInWeek(at(2026, 10, 11))).toBe(1);
  });

  it('time of day tint buckets', () => {
    expect(G.timeOfDay(at(2026, 10, 5, 7))).toBe('morning');
    expect(G.timeOfDay(at(2026, 10, 5, 13))).toBe('day');
    expect(G.timeOfDay(at(2026, 10, 5, 19))).toBe('evening');
    expect(G.timeOfDay(at(2026, 10, 5, 23))).toBe('night');
  });

  it('date ranges wrap past New Year', () => {
    expect(G.inDateRange('12-30', '12-20', '01-05')).toBe(true);
    expect(G.inDateRange('01-03', '12-20', '01-05')).toBe(true);
    expect(G.inDateRange('06-01', '12-20', '01-05')).toBe(false);
  });
});

describe('clock', () => {
  it('uses one injectable clock with an offset for time travel', () => {
    const src = G.manualSource(1000);
    G.Clock.setSource(src);
    expect(G.Clock.now()).toBe(1000);
    G.Clock.advance(500);
    expect(G.Clock.now()).toBe(1500);
    src.add(100);
    expect(G.Clock.now()).toBe(1600);
    G.Clock.setOffset(0);
    G.Clock.setSource(null);
  });
});
