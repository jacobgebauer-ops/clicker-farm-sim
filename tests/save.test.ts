import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as G from '../src/core';
import { at, freshGame } from './helpers';

const fixtureDir = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(fixtureDir).filter((f) => /^save_v\d+\.json$/.test(f));

describe('save migrations', () => {
  it('has a fixture for every schema version up to the current one', () => {
    for (let v = 1; v <= G.CONFIG.SCHEMA_VERSION; v++) expect(fixtures).toContain(`save_v${v}.json`);
  });

  it('has a migration for every past version', () => {
    for (let v = 1; v < G.CONFIG.SCHEMA_VERSION; v++) expect(typeof G.migrations[v]).toBe('function');
  });

  for (const f of fixtures) {
    it(`loads ${f} cleanly into the current schema`, () => {
      const json = fs.readFileSync(path.join(fixtureDir, f), 'utf8');
      const raw = JSON.parse(json);
      const now = at(2026, 10, 20);
      const res = G.loadSave(json, now);
      const s = res.state;
      expect(s.schemaVersion).toBe(G.CONFIG.SCHEMA_VERSION);
      if (raw.schemaVersion < G.CONFIG.SCHEMA_VERSION) {
        expect(res.migratedFrom).toBe(raw.schemaVersion);
        expect(res.backup).toBe(json); // the old blob is kept for the backup_prev slot
      }
      // the game can run on it
      expect(() => {
        G.applyOffline(s, now);
        G.tick(s, now);
        G.collectAll(s, now);
        G.serialize(s);
      }).not.toThrow();
      expect(s.plots.length).toBeGreaterThanOrEqual(G.buildPlots().length);
      expect(typeof s.coins).toBe('number');
      expect(Array.isArray(s.quests.done)).toBe(true);
      expect(s.settings.numberFormat).toBeDefined();
    });
  }

  it('v1: money becomes coins, quest list becomes an object, animal timers carry over', () => {
    const json = fs.readFileSync(path.join(fixtureDir, 'save_v1.json'), 'utf8');
    const s = G.loadSave(json, at(2026, 10, 20)).state;
    expect(s.coins).toBe(1234);
    expect(s.money).toBeUndefined();
    expect(s.quests.done).toContain('q_coop');
    expect(s.animals[0].prodAt).toBe(1791186000000);
  });

  it('keeps unknown ids and fields instead of deleting them', () => {
    const json = fs.readFileSync(path.join(fixtureDir, 'save_v1.json'), 'utf8');
    const s = G.loadSave(json, at(2026, 10, 20)).state;
    expect(s.inventory.moon_melon).toBe(4);
    expect(s.plots.find((p) => p.id === 'homestead_2')!.crop).toBe('space_bean');
    expect(s.futureThing).toEqual({ keep: 'me' });
    // an unknown crop is ignored by harvest instead of crashing
    expect(G.harvest(s, 'homestead_2', at(2026, 10, 20)).ok).toBe(false);
  });

  it('accepts a save from a newer build without losing anything', () => {
    const s = freshGame();
    const newer = { ...JSON.parse(G.serialize(s)), schemaVersion: 99, brandNew: [1, 2, 3] };
    const res = G.loadSave(JSON.stringify(newer), at(2026, 10, 7));
    expect(res.state.brandNew).toEqual([1, 2, 3]);
  });
});

describe('save codes and storage', () => {
  it('round-trips through a gzip + base64 code with a checksum', () => {
    const s = freshGame();
    s.coins = 987_654;
    s.owned.cosmetics.push('hat_tiny_top');
    const code = G.encodeSaveCode(s);
    expect(code.startsWith('SH1.')).toBe(true);
    const back = G.loadSave(G.decodeSaveCode(code), at(2026, 10, 7)).state;
    expect(back.coins).toBe(987_654);
    expect(back.owned.cosmetics).toContain('hat_tiny_top');
  });

  it('rejects damaged codes', () => {
    const code = G.encodeSaveCode(freshGame());
    expect(() => G.decodeSaveCode('hello')).toThrow();
    const parts = code.split('.');
    expect(() => G.decodeSaveCode(`${parts[0]}.00000000.${parts[2]}`)).toThrow(/checksum/);
    expect(() => G.decodeSaveCode(`${parts[0]}.${parts[1]}.${parts[2].slice(0, -12)}AAAA`)).toThrow();
  });

  it('picks the newest valid copy between localStorage and IndexedDB', () => {
    const a = freshGame();
    a.lastSeen = 1000;
    const b = freshGame();
    b.lastSeen = 2000;
    expect(G.pickNewest([G.serialize(a), G.serialize(b)])).toBe(G.serialize(b));
    expect(G.pickNewest(['{garbage', G.serialize(a), null])).toBe(G.serialize(a));
    expect(G.pickNewest([null, undefined])).toBeNull();
  });
});
