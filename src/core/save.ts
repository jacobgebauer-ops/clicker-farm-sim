// Save serialization, validation, normalization, and portable save codes.
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';
import { CONFIG } from './config';
import { C, resolveId } from './content';
import { hashString } from './rng';
import { migrate, type AnySave } from './migrations';
import { newGame, buildPlots, type GameState } from './state';
import { onBuildingChange } from './farm';

export const SAVE_KEY = 'sh_save_v1';
export const BACKUP_KEY = 'sh_backup_prev';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function isSaveLike(x: unknown): x is AnySave {
  return !!x && typeof x === 'object' && typeof (x as AnySave).createdAt === 'number' && typeof (x as AnySave).lastSeen === 'number';
}

/** Fill any fields missing from older saves with defaults. Unknown fields are kept untouched. */
export function normalize(raw: AnySave, now: number): GameState {
  const base = newGame(raw.createdAt ?? now) as unknown as AnySave;
  const s: AnySave = { ...base, ...raw };
  for (const key of ['market', 'journal', 'wishes', 'daily', 'codex', 'owned', 'avatar', 'minigames', 'luna', 'settings', 'tutorial', 'claire', 'kitchen', 'winery', 'quests']) {
    if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) s[key] = { ...base[key], ...(raw[key] ?? {}) };
  }
  s.codex = { ...base.codex, ...(raw.codex ?? {}) };
  // new parcels / buildings / plots added by content updates
  for (const [id, v] of Object.entries(base.parcels)) if (!(id in s.parcels)) s.parcels[id] = v;
  for (const [id, v] of Object.entries(base.buildings as Record<string, unknown>)) if (!(id in s.buildings)) s.buildings[id] = v;
  const have = new Set((s.plots as { id: string }[]).map((p) => p.id));
  for (const p of buildPlots()) if (!have.has(p.id)) s.plots.push(p);
  // retired ids resolve through aliases; unknown ids stay as they are
  const inv: Record<string, number> = {};
  for (const [k, n] of Object.entries(s.inventory as Record<string, number>)) {
    const [id, tier] = k.split('@');
    const key = tier ? `${resolveId(id)}@${tier}` : resolveId(id);
    inv[key] = (inv[key] ?? 0) + n;
  }
  s.inventory = inv;
  s.owned.cosmetics = [...new Set((s.owned.cosmetics as string[]).map(resolveId))];
  for (const c of C().raw.cosmetics) if (c.source === 'start' && !s.owned.cosmetics.includes(c.id)) s.owned.cosmetics.push(c.id);
  s.schemaVersion = CONFIG.SCHEMA_VERSION;
  const gs = s as GameState;
  onBuildingChange(gs, 'greenhouse', now);
  return gs;
}

export interface LoadResult {
  state: GameState;
  migratedFrom: number | null;
  backup: string | null;
}

/** Parse, migrate, and normalize a save. Throws on garbage. */
export function loadSave(json: string, now: number): LoadResult {
  const raw = JSON.parse(json);
  if (!isSaveLike(raw)) throw new Error('Not a save');
  const version = Number(raw.schemaVersion ?? 1);
  if (version > CONFIG.SCHEMA_VERSION) {
    // a save from a newer build: keep everything, just make sure required fields exist
    return { state: normalize({ ...raw, schemaVersion: version }, now), migratedFrom: null, backup: null };
  }
  if (version < CONFIG.SCHEMA_VERSION) {
    const { save } = migrate(raw, CONFIG.SCHEMA_VERSION);
    return { state: normalize(save, now), migratedFrom: version, backup: json };
  }
  return { state: normalize(raw, now), migratedFrom: null, backup: null };
}

/** Given candidate save strings (localStorage, IndexedDB), return the newest valid one. */
export function pickNewest(candidates: (string | null | undefined)[]): string | null {
  let best: { json: string; t: number } | null = null;
  for (const json of candidates) {
    if (!json) continue;
    try {
      const raw = JSON.parse(json);
      if (!isSaveLike(raw)) continue;
      if (!best || raw.lastSeen > best.t) best = { json, t: raw.lastSeen };
    } catch {
      /* ignore corrupt copy */
    }
  }
  return best?.json ?? null;
}

// ---------- portable save codes ----------
function toB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function encodeSaveCode(s: GameState): string {
  const json = serialize(s);
  const sum = hashString(json).toString(16).padStart(8, '0');
  return `SH1.${sum}.${toB64(gzipSync(strToU8(json), { level: 9 }))}`;
}

export function decodeSaveCode(code: string): string {
  const clean = code.trim().replace(/\s+/g, '');
  const m = /^SH1\.([0-9a-f]{8})\.([A-Za-z0-9+/=]+)$/.exec(clean);
  if (!m) throw new Error('That does not look like a save code.');
  let json: string;
  try {
    json = strFromU8(gunzipSync(fromB64(m[2])));
  } catch {
    throw new Error('The save code is damaged (could not unpack).');
  }
  if (hashString(json).toString(16).padStart(8, '0') !== m[1]) throw new Error('The save code is damaged (checksum mismatch).');
  if (!isSaveLike(JSON.parse(json))) throw new Error('The save code does not contain a farm.');
  return json;
}
