import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fitScale } from '../src/game/artfit';
import * as G from '../src/core';
import { at, freshGame, DAY } from './helpers';

describe('final art fitting', () => {
  it('fills a building footprint by width and lets roofs grow taller', () => {
    // the barn is 3 tiles wide (96 px); 181 px wide art is scaled to fit that width
    const sc = fitScale({ category: 'buildings', w: 96, h: 112 }, 181, 132);
    expect(181 * sc).toBeCloseTo(96);
  });

  it('keeps animals and items inside their slot box', () => {
    const sc = fitScale({ category: 'animals', w: 48, h: 40 }, 97, 96);
    expect(97 * sc).toBeLessThanOrEqual(48);
    expect(96 * sc).toBeCloseTo(40);
  });

  it('leaves placeholders at their natural size', () => {
    expect(fitScale({ category: 'items', w: 32, h: 32 }, 32, 32)).toBe(1);
  });

  it('every final art file belongs to a manifest slot', () => {
    const root = path.join(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf8')) as { path: string }[];
    const known = new Set(manifest.map((e) => e.path));
    const walk = (d: string): string[] => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
    for (const f of walk(path.join(root, 'public/assets')).filter((x) => x.endsWith('.png'))) {
      const rel = path.relative(path.join(root, 'public'), f).split(path.sep).join('/').replace(/_f\d\.png$/, '.png');
      expect(known.has(rel), rel).toBe(true);
    }
  });
});

describe('Highland calves', () => {
  it('grow up into cows and count toward barn space', () => {
    const t = at(2026, 10, 6);
    const s = freshGame(t);
    s.coins = 5000;
    s.buildings.barn = { stage: 2, level: 1 };
    expect(G.buyAnimal(s, 'highland_calf', t).ok).toBe(true);
    expect(G.animalsOfKind(s, 'cow').length).toBe(1);
    const calf = s.animals[0];
    G.updateAnimal(s, calf, t + DAY);
    expect(calf.kind).toBe('highland_calf');
    G.updateAnimal(s, calf, t + 2 * DAY + 1);
    expect(calf.kind).toBe('highland_cow');
    G.updateAnimal(s, calf, t + 2 * DAY + 3 * 3_600_000);
    expect(calf.stored).toBeGreaterThan(0);
  });
});
