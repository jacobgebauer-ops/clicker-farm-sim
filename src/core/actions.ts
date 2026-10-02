// Higher-level actions that combine systems: Collect All, decor editing, Almanac, ribbon rushes.
import { C } from './content';
import { emit } from './events';
import { CONFIG } from './config';
import { harvest, isReady, collectAnimal, collectProducer, buildingDef, plotAvailable, type Result } from './farm';
import { collectCraft, bottleWine, nextTierIn } from './crafting';
import { payWithMaterials, track } from './economy';
import { finishRepairs } from './farm';
import type { GameState, PlacedDecor } from './state';
import { nextUid } from './state';

const fail = (msg: string): Result => ({ ok: false, msg });

export interface CollectSummary {
  crops: number;
  animals: number;
  crafts: number;
  coins: number;
  items: number;
  wines: number;
}

/** Grab everything that is ready. Wine is only auto-bottled once it reaches Reserve. */
export function collectAll(s: GameState, now: number): CollectSummary {
  const out: CollectSummary = { crops: 0, animals: 0, crafts: 0, coins: 0, items: 0, wines: 0 };
  for (const p of s.plots) if (isReady(p, now) && harvest(s, p.id, now).ok) out.crops++;
  for (const a of s.animals) if (collectAnimal(s, a.id, now) > 0) out.animals++;
  for (const j of [...s.kitchen.jobs]) if (now >= j.endsAt && collectCraft(s, j.id, now)) out.crafts++;
  for (const id of Object.keys(s.buildings)) {
    const b = buildingDef(id);
    if (!b?.produces) continue;
    const n = collectProducer(s, id, now);
    if (b.produces.item === 'coins') out.coins += n;
    else out.items += n;
  }
  for (const b of [...s.winery.batches]) if (now >= b.readyAt && !nextTierIn(b, now) && bottleWine(s, b.id, now).ok) out.wines++;
  finishRepairs(s, now);
  if (out.crops + out.animals + out.crafts + out.coins + out.items + out.wines > 0) emit({ type: 'sfx', name: 'harvest' });
  return out;
}

// ---------- Almanac ----------
export function almanacNext(s: GameState) {
  return C().raw.almanac.levels.find((l) => l.level === s.almanacLevel + 1) ?? null;
}

export function upgradeAlmanac(s: GameState): Result {
  const next = almanacNext(s);
  if (!next) return fail('The Almanac is already legendary');
  if (s.buildings.farmhouse?.stage !== 2) return fail('Restore the farmhouse first');
  if (!payWithMaterials(s, next.cost, next.materials)) return fail('Not enough coins');
  s.almanacLevel = next.level;
  emit({ type: 'toast', text: `Almanac upgraded: ${next.text}`, icon: 'book' });
  return { ok: true };
}

// ---------- ribbon speedups (small) ----------
export function rushCost(msLeft: number): number {
  return Math.max(1, Math.ceil(msLeft / (2 * 3_600_000)));
}

export function rushRepair(s: GameState, buildingId: string, now: number): Result {
  const st = s.buildings[buildingId];
  if (st?.stage !== 1 || st.repairEndsAt === undefined) return fail('Nothing to rush');
  const cost = rushCost(st.repairEndsAt - now);
  if (s.ribbons < cost) return fail(`Needs ${cost} ribbons`);
  s.ribbons -= cost;
  st.repairEndsAt = now;
  finishRepairs(s, now);
  return { ok: true };
}

export function rushCraft(s: GameState, jobId: string, now: number): Result {
  const j = s.kitchen.jobs.find((x) => x.id === jobId);
  if (!j || j.endsAt <= now) return fail('Nothing to rush');
  const cost = rushCost(j.endsAt - now);
  if (s.ribbons < cost) return fail(`Needs ${cost} ribbons`);
  s.ribbons -= cost;
  j.endsAt = now;
  return { ok: true };
}

// ---------- decor ----------
export function placedCount(s: GameState, id: string): number {
  return s.placed.filter((p) => p.id === id).length;
}

export function stashCount(s: GameState, id: string): number {
  return (s.owned.decor[id] ?? 0) - placedCount(s, id);
}

function footprint(id: string, rot: 0 | 1) {
  const d = C().decor.get(id);
  if (!d) return { w: 1, h: 1, walkable: true };
  return rot ? { w: d.h, h: d.w, walkable: d.walkable } : { w: d.w, h: d.h, walkable: d.walkable };
}

const FIXED_TILES = ['14,12', '13,12', '8,11', '23,16', '20,19', '21,19', '20,20', '21,20', '23,23'];

/** Tiles blocked by buildings, plots, fixed props, and other decor (except `ignoreUid`). */
export function blockedTiles(s: GameState, ignoreUid?: string): Set<string> {
  const set = new Set<string>();
  const c = C();
  for (const b of c.raw.buildings) {
    const p = c.parcels.get(b.parcel)!;
    if (b.requires === 'prestige' && !s.flags.includes('fair_open')) continue;
    for (let x = 0; x < b.w; x++) for (let y = 0; y < b.h; y++) set.add(`${p.gx * 8 + b.x + x},${p.gy * 8 + b.y + y}`);
  }
  for (const pl of s.plots) if (!pl.greenhouse && plotAvailable(s, pl)) set.add(`${pl.x},${pl.y}`);
  // fixed farm features: the well, Luke's spot, the player's spot, the mailbox, Claire's van, Andrew's sign
  for (const t of FIXED_TILES) set.add(t);
  for (const d of s.placed) {
    if (d.uid === ignoreUid) continue;
    const f = footprint(d.id, d.rot);
    if (f.walkable) continue;
    for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) set.add(`${d.x + x},${d.y + y}`);
  }
  return set;
}

export function canPlace(s: GameState, id: string, x: number, y: number, rot: 0 | 1 = 0, ignoreUid?: string): boolean {
  const f = footprint(id, rot);
  const blocked = blockedTiles(s, ignoreUid);
  for (let dx = 0; dx < f.w; dx++) {
    for (let dy = 0; dy < f.h; dy++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= 24 || ty >= 24) return false;
      const parcel = C().raw.parcels.find((p) => p.gx === Math.floor(tx / 8) && p.gy === Math.floor(ty / 8));
      if (!parcel || s.parcels[parcel.id] === 'overgrown') return false;
      if (!f.walkable && blocked.has(`${tx},${ty}`)) return false;
    }
  }
  return true;
}

export function placeDecor(s: GameState, id: string, x: number, y: number, rot: 0 | 1 = 0): Result {
  if (stashCount(s, id) <= 0) return fail('None left in your stash');
  if (!canPlace(s, id, x, y, rot)) return fail('Something is in the way');
  s.placed.push({ uid: nextUid(s, 'dec'), id, x, y, rot });
  track(s, 'decorPlace', id);
  emit({ type: 'sfx', name: 'pop' });
  return { ok: true };
}

export function moveDecor(s: GameState, uid: string, x: number, y: number): Result {
  const d = s.placed.find((p) => p.uid === uid);
  if (!d) return fail('Unknown decor');
  if (!canPlace(s, d.id, x, y, d.rot, uid)) return fail('Something is in the way');
  d.x = x;
  d.y = y;
  return { ok: true };
}

export function rotateDecor(s: GameState, uid: string): Result {
  const d = s.placed.find((p) => p.uid === uid);
  if (!d) return fail('Unknown decor');
  const rot = (d.rot ? 0 : 1) as 0 | 1;
  if (!canPlace(s, d.id, d.x, d.y, rot, uid)) return fail('No room to turn it');
  d.rot = rot;
  return { ok: true };
}

export function stashDecor(s: GameState, uid: string): Result {
  const i = s.placed.findIndex((p) => p.uid === uid);
  if (i < 0) return fail('Unknown decor');
  s.placed.splice(i, 1);
  return { ok: true };
}

export function saveLayout(s: GameState, name: string): Result {
  const clean = name.trim().slice(0, 20) || `Layout ${Object.keys(s.layouts).length + 1}`;
  s.layouts[clean] = s.placed.map((p) => ({ ...p }));
  return { ok: true, msg: clean };
}

export function loadLayout(s: GameState, name: string): Result {
  const layout = s.layouts[name];
  if (!layout) return fail('Unknown layout');
  s.placed = [];
  let skipped = 0;
  for (const p of layout) {
    if (stashCount(s, p.id) > 0 && canPlace(s, p.id, p.x, p.y, p.rot)) s.placed.push({ ...p, uid: nextUid(s, 'dec') } as PlacedDecor);
    else skipped++;
  }
  return { ok: true, msg: skipped ? `${skipped} pieces did not fit` : undefined };
}

// ---------- cosmetics on buildings and avatar ----------
export function setBuildingStyle(s: GameState, buildingId: string, slot: 'paint' | 'roof' | 'skin', cosmeticId: string | null): Result {
  const st = s.buildings[buildingId];
  if (!st) return fail('Unknown building');
  if (cosmeticId) {
    const cos = C().cosmetics.get(cosmeticId);
    const want = slot === 'paint' ? 'building_paint' : slot === 'roof' ? 'building_roof' : 'building_skin';
    if (!cos || cos.slot !== want || !s.owned.cosmetics.includes(cosmeticId)) return fail('Not owned');
  }
  st[slot] = cosmeticId ?? undefined;
  return { ok: true };
}

export function setAvatar(s: GameState, patch: Partial<GameState['avatar']>): Result {
  const c = C();
  for (const [k, v] of Object.entries(patch)) {
    if (['hair', 'outfit', 'hat', 'acc'].includes(k) && !s.owned.cosmetics.includes(v as string) && c.cosmetics.has(v as string)) return fail('Not owned');
  }
  Object.assign(s.avatar, patch);
  return { ok: true };
}

export function setWineName(s: GameState, wineId: string, name: string, label: string): Result {
  if (!C().wines.has(wineId)) return fail('Unknown wine');
  if (!s.owned.cosmetics.includes(label)) return fail('Label not owned');
  s.wineNames[wineId] = { name: name.trim().slice(0, 28) || C().wines.get(wineId)!.name, label };
  return { ok: true };
}

export function backupReminderDue(s: GameState, now: number): boolean {
  return now - s.lastBackupPrompt > CONFIG.BACKUP_REMINDER_MS;
}
