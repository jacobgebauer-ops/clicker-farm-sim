import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as G from '../src/core';

describe('content', () => {
  it('validates against the schemas with no cross-reference problems', () => {
    const { data, issues } = G.validateRaw(G.RAW_FILES);
    expect(issues).toEqual([]);
    expect(data).not.toBeNull();
  });

  it('meets the launch content minimums', () => {
    const c = G.C().raw;
    expect(c.crops.length).toBeGreaterThanOrEqual(24);
    expect(c.wines.filter((w) => !w.family).length).toBeGreaterThanOrEqual(6);
    expect(c.recipes.length).toBeGreaterThanOrEqual(12);
    expect(c.decor.length).toBeGreaterThanOrEqual(40);
    expect(c.cosmetics.length).toBeGreaterThanOrEqual(30);
    expect(c.quests.length).toBeGreaterThanOrEqual(25);
    expect(c.minigames.length).toBeGreaterThanOrEqual(3);
    expect(c.achievements.length).toBeGreaterThanOrEqual(20);
    for (const group of ['greeting', 'tip', 'market_hint', 'rollover', 'chatter']) {
      expect(c.dialogue.lines.filter((l) => l.trigger === group).length).toBeGreaterThanOrEqual(40);
    }
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      const set = [...c.decor, ...c.cosmetics].filter((x) => x.season === season);
      expect(set.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('catches bad content with a clear message', () => {
    const broken = { ...G.RAW_FILES, crops: [{ id: 'Bad Id', name: 'x' }] };
    const { issues } = G.validateRaw(broken);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].file).toBe('content/crops.json');
  });

  it('catches dangling references', () => {
    const recipes = JSON.parse(JSON.stringify(G.RAW_FILES.recipes));
    recipes[0].inputs[0].id = 'unobtainium';
    const { issues } = G.validateRaw({ ...G.RAW_FILES, recipes });
    expect(issues.some((i) => i.message.includes('unobtainium'))).toBe(true);
  });

  it('has no em dashes in player-facing text or docs', () => {
    const root = path.join(__dirname, '..');
    const files = [
      ...fs.readdirSync(path.join(root, 'content')).filter((f) => f.endsWith('.json')).map((f) => path.join(root, 'content', f)),
      ...['README.md', 'DECISIONS.md', 'CONTENT_GUIDE.md', 'ART_PROMPTS.md', 'ASSETS_LICENSES.md'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)),
    ];
    for (const f of files) expect(fs.readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), f).toBe(false);
  });

  it('never calls Date.now() outside the clock', () => {
    const root = path.join(__dirname, '..', 'src');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(root).filter((x) => /\.(ts|tsx)$/.test(x))) {
      if (f.endsWith(path.join('core', 'clock.ts'))) continue;
      expect(fs.readFileSync(f, 'utf8').includes('Date.now('), f).toBe(false);
    }
  });

  it('keeps the core free of Phaser and DOM imports', () => {
    const dir = path.join(__dirname, '..', 'src', 'core');
    for (const f of fs.readdirSync(dir)) {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(txt, f).not.toMatch(/from 'phaser'|from 'preact|document\.|window\./);
    }
  });

  it('applies the personal overlay (names, family wine)', () => {
    G.usePersonal({ playerName: 'Test', farmName: 'Test Farm', townName: 'Town', cows: ['Moo'], chickens: ['Cluck'], dedication: 'hi', easterEggs: [], familyWine: null });
    expect(G.C().personal.playerName).toBe('Test');
    expect(G.C().wines.has('wine_family')).toBe(false);
    G.usePersonal(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'personal', 'personal.json'), 'utf8')));
    expect(G.C().wines.has('wine_family')).toBe(true);
  });
});
