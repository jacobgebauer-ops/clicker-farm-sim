// Picks Luke's lines by trigger, rotating so he does not repeat himself often.
import { C } from './content';
import type { DialogueLineDef, SeasonId } from '../../content/schema';

const recent = new Map<string, string[]>();

export function linesFor(trigger: string, season?: SeasonId): DialogueLineDef[] {
  return C().raw.dialogue.lines.filter((l) => l.trigger === trigger && (!l.season || l.season === season));
}

export function pickLine(trigger: string, vars: Record<string, string | number> = {}, season?: SeasonId, rand: () => number = Math.random): DialogueLineDef | null {
  const lines = linesFor(trigger, season);
  if (!lines.length) return null;
  const seen = recent.get(trigger) ?? [];
  const fresh = lines.filter((l) => !seen.includes(l.id));
  const pool = fresh.length ? fresh : lines;
  const total = pool.reduce((s, l) => s + l.weight, 0);
  let r = rand() * total;
  let line = pool[pool.length - 1];
  for (const l of pool) {
    r -= l.weight;
    if (r <= 0) {
      line = l;
      break;
    }
  }
  seen.push(line.id);
  // remember up to 2/3 of the pool so variety stays high
  while (seen.length > Math.max(1, Math.floor(lines.length * 0.66))) seen.shift();
  recent.set(trigger, seen);
  return { ...line, text: fill(line.text, vars) };
}

export function fill(text: string, vars: Record<string, string | number>): string {
  const p = C().personal;
  const all: Record<string, string | number> = { name: p.playerName, farm: p.farmName, town: p.townName, ...vars };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}
