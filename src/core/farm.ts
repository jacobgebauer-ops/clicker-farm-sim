// Land, plots, crops, buildings, animals, and passive producers.
import { CONFIG } from './config';
import { C, resolveId } from './content';
import { emit } from './events';
import {
  addItem, addXp, earn, growMultiplier, payWithMaterials, spend, track, currentSeason, animalCapacity,
  animalsOfKind, addAnimal, isUnlocked, levelOf, missingCost,
} from './economy';
import type { GameState, Plot, AnimalState } from './state';
import type { CropDef, BuildingDef } from '../../content/schema';

export type Result = { ok: true; msg?: string } | { ok: false; msg: string };
const ok = (msg?: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

// ---------- parcels ----------
export function parcelUsable(s: GameState, parcelId: string): boolean {
  return s.parcels[parcelId] === 'cleared' || s.parcels[parcelId] === 'restored';
}

export function restoredCount(s: GameState): number {
  return Object.values(s.parcels).filter((p) => p === 'restored').length;
}

export function restorationPercent(s: GameState): number {
  const c = C();
  let done = 0;
  let total = 0;
  for (const p of c.raw.parcels) {
    total += 2;
    done += s.parcels[p.id] === 'restored' ? 2 : s.parcels[p.id] === 'cleared' ? 1 : 0;
  }
  for (const b of c.raw.buildings) {
    if (!b.core) continue;
    total += 2;
    done += s.buildings[b.id]?.stage ?? 0;
  }
  return Math.round((done / total) * 100);
}

export function clearParcel(s: GameState, parcelId: string): Result {
  const p = C().parcels.get(parcelId);
  if (!p) return fail('Unknown parcel');
  if (s.parcels[parcelId] !== 'overgrown') return fail('Already cleared');
  if (!payWithMaterials(s, p.clear.coins, p.clear.materials)) return fail('Not enough coins');
  s.parcels[parcelId] = 'cleared';
  track(s, 'parcelClear', parcelId);
  emit({ type: 'toast', text: `${p.name} cleared! The brambles are gone.`, icon: 'sparkle' });
  emit({ type: 'sfx', name: 'fanfare' });
  return ok();
}

export function restoreParcel(s: GameState, parcelId: string, now: number): Result {
  const p = C().parcels.get(parcelId);
  if (!p) return fail('Unknown parcel');
  if (s.parcels[parcelId] !== 'cleared') return fail(s.parcels[parcelId] === 'restored' ? 'Already restored' : 'Clear it first');
  if (!payWithMaterials(s, p.restore.coins, p.restore.materials)) return fail('Not enough coins');
  s.parcels[parcelId] = 'restored';
  track(s, 'parcelRestore', parcelId);
  addXp(s, 50 + Math.sqrt(p.restore.coins), now);
  emit({ type: 'toast', text: `${p.name} fully restored! Fences up, paint fresh.`, icon: 'star' });
  emit({ type: 'sfx', name: 'fanfare' });
  return ok();
}

export function parcelCost(parcelId: string, kind: 'clear' | 'restore') {
  return C().parcels.get(parcelId)![kind];
}

// ---------- plots ----------
export function plotDef(plot: Plot) {
  const p = C().parcels.get(plot.parcel);
  if (!p || plot.greenhouse) return null;
  const idx = Number(plot.id.split('_').pop());
  return p.plots[idx] ?? null;
}

export function plotAvailable(s: GameState, plot: Plot): boolean {
  if (plot.greenhouse) return s.buildings.greenhouse?.stage === 2;
  const def = plotDef(plot);
  if (!def) return false;
  const st = s.parcels[plot.parcel];
  return def.needs === 'cleared' ? st === 'cleared' || st === 'restored' : st === 'restored';
}

export function clearPlot(s: GameState, plotId: string): Result {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot) return fail('Unknown plot');
  if (plot.cleared) return fail('Already cleared');
  if (!plotAvailable(s, plot)) return fail('This plot is still part of an overgrown parcel');
  const def = plotDef(plot);
  const cost = def?.cost ?? 0;
  if (!spend(s, cost)) return fail('Not enough coins');
  plot.cleared = true;
  track(s, 'clearPlot');
  emit({ type: 'sfx', name: 'pop' });
  return ok();
}

export function cropAvailable(s: GameState, crop: CropDef, now: number, greenhouse = false): { ok: boolean; reason?: string } {
  if (crop.deprecated) return { ok: false, reason: 'Retired' };
  if (!isUnlocked(s, crop.requires)) return { ok: false, reason: 'Heirloom unlock' };
  if (crop.minLevel && levelOf(s) < crop.minLevel) return { ok: false, reason: `Level ${crop.minLevel}` };
  if (!greenhouse && !crop.seasons.includes(currentSeason(s, now))) return { ok: false, reason: 'Out of season' };
  return { ok: true };
}

export function availableCrops(s: GameState, now: number, greenhouse = false): CropDef[] {
  return C().raw.crops.filter((c) => cropAvailable(s, c, now, greenhouse).ok);
}

export function plant(s: GameState, plotId: string, cropId: string, now: number): Result {
  const plot = s.plots.find((p) => p.id === plotId);
  const crop = C().crops.get(resolveId(cropId));
  if (!plot || !crop) return fail('Unknown plot or crop');
  if (!plot.cleared) return fail('Clear the plot first');
  if (!plotAvailable(s, plot)) return fail('Plot unavailable');
  if (plot.crop) return fail('Already planted');
  const avail = cropAvailable(s, crop, now, !!plot.greenhouse);
  if (!avail.ok) return fail(avail.reason ?? 'Unavailable');
  if (!spend(s, crop.seedCost)) return fail('Not enough coins for seeds');
  const growMs = Math.round(crop.growMin * 60_000 * growMultiplier(s));
  plot.crop = crop.id;
  plot.plantedAt = now;
  plot.readyAt = now + growMs;
  plot.growMs = growMs;
  plot.tendShaved = 0;
  plot.tendUntil = 0;
  s.lastSeed = crop.id;
  track(s, 'plant', crop.id);
  return ok();
}

export function plantAll(s: GameState, cropId: string, now: number, greenhouse = false): number {
  let n = 0;
  for (const p of s.plots) {
    if (!!p.greenhouse !== greenhouse || !p.cleared || p.crop || !plotAvailable(s, p)) continue;
    if (!plant(s, p.id, cropId, now).ok) break;
    n++;
  }
  return n;
}

export function isReady(p: Plot, now: number): boolean {
  return !!p.crop && p.readyAt !== undefined && now >= p.readyAt && !!C().crops.get(resolveId(p.crop));
}

export function growthProgress(p: Plot, now: number): number {
  if (!p.crop || p.readyAt === undefined || p.growMs === undefined) return 0;
  return Math.min(1, Math.max(0, 1 - (p.readyAt - now) / p.growMs));
}

export function tend(s: GameState, plotId: string, now: number): Result {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot?.crop || plot.readyAt === undefined || plot.growMs === undefined) return fail('Nothing growing');
  if (now >= plot.readyAt) return fail('Already ready');
  if (now < (plot.tendUntil ?? 0)) return fail('Just tended');
  const maxShave = plot.growMs * CONFIG.TEND_MAX_SHAVE;
  const shaved = plot.tendShaved ?? 0;
  if (shaved >= maxShave) return fail('This crop is as happy as it gets');
  const shave = Math.min(Math.max(1000, plot.growMs * CONFIG.TEND_SHAVE), maxShave - shaved, plot.readyAt - now);
  plot.readyAt -= shave;
  plot.tendShaved = shaved + shave;
  plot.tendUntil = now + CONFIG.TEND_COOLDOWN_MS;
  track(s, 'tend');
  emit({ type: 'sfx', name: 'water' });
  return ok();
}

export function harvest(s: GameState, plotId: string, now: number): Result {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot || !isReady(plot, now)) return fail('Not ready');
  const crop = C().crops.get(resolveId(plot.crop!))!;
  addItem(s, crop.id, 1);
  if (!s.codex.crops.includes(crop.id)) {
    s.codex.crops.push(crop.id);
    emit({ type: 'toast', text: `New in the Crop Codex: ${crop.name}`, icon: 'book' });
  }
  track(s, 'harvest', crop.id);
  addXp(s, crop.xp, now);
  emit({ type: 'harvest', plot: plot.id, item: crop.id });
  plot.crop = undefined;
  plot.plantedAt = plot.readyAt = plot.growMs = undefined;
  plot.tendShaved = 0;
  return ok();
}

// ---------- buildings ----------
export function buildingDef(id: string): BuildingDef | undefined {
  return C().buildings.get(id);
}

export function buildingVisible(s: GameState, id: string): boolean {
  const b = buildingDef(id);
  if (!b) return false;
  if (b.requires === 'prestige') return prestigeUnlockedFlag(s);
  return isUnlocked(s, b.requires);
}

function prestigeUnlockedFlag(s: GameState): boolean {
  return s.flags.includes('fair_open');
}

export function canRepair(s: GameState, id: string): Result {
  const b = buildingDef(id);
  const st = s.buildings[id];
  if (!b || !st) return fail('Unknown building');
  if (!buildingVisible(s, id)) return fail('Locked');
  if (st.stage !== 0) return fail('Already repaired');
  if (!s.parcels[b.parcel] || s.parcels[b.parcel] === 'overgrown') return fail(`Clear ${C().parcels.get(b.parcel)!.name} first`);
  return ok();
}

export function repairTotal(s: GameState, id: string) {
  const b = buildingDef(id)!;
  const miss = missingCost(s, b.repair.materials);
  return { coins: b.repair.coins + miss.coins, ok: miss.ok };
}

export function startRepair(s: GameState, id: string, now: number): Result {
  const can = canRepair(s, id);
  if (!can.ok) return can;
  const b = buildingDef(id)!;
  if (!payWithMaterials(s, b.repair.coins, b.repair.materials)) return fail('Not enough coins');
  const st = s.buildings[id];
  st.stage = 1;
  st.repairStartedAt = now;
  st.repairEndsAt = now + b.repair.minutes * 60_000;
  track(s, 'repairStart', id);
  emit({ type: 'sfx', name: 'hammer' });
  finishRepairs(s, now);
  return ok();
}

export function finishRepairs(s: GameState, now: number): string[] {
  const done: string[] = [];
  for (const [id, st] of Object.entries(s.buildings)) {
    if (st.stage === 1 && st.repairEndsAt !== undefined && now >= st.repairEndsAt) {
      st.stage = 2;
      st.level = Math.max(1, st.level);
      st.producedAt = now;
      st.repairEndsAt = undefined;
      done.push(id);
      onBuildingChange(s, id, now);
      track(s, 'repair', id);
      const b = buildingDef(id);
      addXp(s, 20 + Math.sqrt(b?.repair.coins ?? 0), now);
      emit({ type: 'building', id, stage: 2, level: st.level });
      emit({ type: 'toast', text: `${b?.name ?? id} restored!`, icon: 'hammer' });
      emit({ type: 'sfx', name: 'fanfare' });
    }
  }
  return done;
}

export function upgradeCost(id: string, level: number) {
  const b = buildingDef(id)!;
  const coins = Math.round(b.upgrade.base * Math.pow(b.upgrade.growth, level - 1));
  const materials = (b.upgrade.materials ?? []).map((m) => ({ id: m.id, qty: m.qty * (1 + Math.floor((level - 1) / 2)) }));
  return { coins, materials };
}

export function upgrade(s: GameState, id: string, now: number): Result {
  const b = buildingDef(id);
  const st = s.buildings[id];
  if (!b || !st || st.stage !== 2) return fail('Restore it first');
  if (st.level >= b.maxLevel) return fail('Max level');
  const cost = upgradeCost(id, st.level);
  if (!payWithMaterials(s, cost.coins, cost.materials)) return fail('Not enough coins');
  // producers pay out what they have before the rate changes
  if (b.produces) collectProducer(s, id, now);
  st.level++;
  onBuildingChange(s, id, now);
  track(s, 'upgrade', id);
  addXp(s, 10 + st.level * 5, now);
  emit({ type: 'building', id, stage: 2, level: st.level });
  if (b.visibleLevels.includes(st.level)) emit({ type: 'toast', text: `${b.name} looks fancier at level ${st.level}!`, icon: 'star' });
  emit({ type: 'sfx', name: 'levelup' });
  return ok();
}

/** Keep derived structures (greenhouse beds) in sync with building levels. */
export function onBuildingChange(s: GameState, id: string, _now: number) {
  if (id === 'greenhouse') {
    const st = s.buildings.greenhouse;
    const want = st.stage === 2 ? greenhouseBeds(s) : 0;
    const b = buildingDef('greenhouse')!;
    const p = C().parcels.get(b.parcel)!;
    const have = s.plots.filter((x) => x.greenhouse);
    for (let i = have.length; i < want; i++) {
      s.plots.push({ id: `greenhouse_${i}`, parcel: b.parcel, x: p.gx * 8 + b.x + (i % 2), y: p.gy * 8 + b.y + Math.floor(i / 2) % 2, cleared: true, greenhouse: true });
    }
  }
}

export function greenhouseBeds(s: GameState): number {
  const st = s.buildings.greenhouse;
  return st?.stage === 2 ? Math.max(1, st.level) : 0;
}

// ---------- producers (honor box, hive) ----------
export function producerAmount(s: GameState, id: string): number {
  const b = buildingDef(id);
  const st = s.buildings[id];
  if (!b?.produces || st?.stage !== 2) return 0;
  return Math.round(b.produces.perLevel * Math.pow(st.level, 1.5));
}

export function producerPending(s: GameState, id: string, now: number): number {
  const b = buildingDef(id);
  const st = s.buildings[id];
  if (!b?.produces || st?.stage !== 2 || st.producedAt === undefined) return 0;
  const cycles = Math.min(b.produces.cap, Math.floor((now - st.producedAt) / (b.produces.everyMin * 60_000)));
  return Math.max(0, cycles) * producerAmount(s, id);
}

export function collectProducer(s: GameState, id: string, now: number): number {
  const b = buildingDef(id);
  const st = s.buildings[id];
  if (!b?.produces || st?.stage !== 2 || st.producedAt === undefined) return 0;
  const period = b.produces.everyMin * 60_000;
  const rawCycles = Math.floor((now - st.producedAt) / period);
  const cycles = Math.min(b.produces.cap, rawCycles);
  if (cycles <= 0) return 0;
  const amount = cycles * producerAmount(s, id);
  st.producedAt = rawCycles > b.produces.cap ? now : st.producedAt + cycles * period;
  if (b.produces.item === 'coins') earn(s, amount);
  else {
    addItem(s, b.produces.item, amount);
    track(s, 'collect', b.produces.item, amount);
  }
  emit({ type: 'collect', item: b.produces.item, qty: amount });
  return amount;
}

// ---------- animals ----------
export function bondLevel(a: AnimalState): number {
  const t = CONFIG.BOND_THRESHOLDS;
  let l = 0;
  for (let i = 0; i < t.length; i++) if (a.bond >= t[i]) l = i;
  return l;
}

export function animalPeriod(s: GameState, a: AnimalState): number {
  const def = C().animals.get(a.kind);
  if (!def) return Infinity;
  const home = def.kind === 'cow' ? s.buildings.barn : s.buildings.coop;
  const speed = (1 - 0.05 * bondLevel(a)) * (1 - 0.03 * Math.max(0, (home?.level ?? 1) - 1));
  return def.everyMin * 60_000 * Math.max(0.4, speed);
}

export function animalYield(a: AnimalState): number {
  return bondLevel(a) >= 3 ? 2 : 1;
}

/** Advance production and growth up to `now`. */
export function updateAnimal(s: GameState, a: AnimalState, now: number) {
  const def = C().animals.get(a.kind);
  if (!def) return;
  if (a.growsAt !== undefined && def.growsInto && now >= a.growsAt) {
    a.kind = def.growsInto;
    a.growsAt = undefined;
    a.prodAt = now;
    emit({ type: 'toast', text: `${a.name} is all grown up into a fine ${C().animals.get(a.kind)?.name.toLowerCase() ?? 'animal'}!`, icon: 'heart' });
    return;
  }
  if (!def.product) return;
  const period = animalPeriod(s, a);
  if (a.stored >= def.cap) {
    a.prodAt = Math.max(a.prodAt, now - period + 1);
    return;
  }
  const n = Math.floor((now - a.prodAt) / period);
  if (n > 0) {
    const room = def.cap - a.stored;
    a.stored += Math.min(n, room);
    a.prodAt = n >= room ? now : a.prodAt + n * period;
  }
}

export function animalReady(a: AnimalState): boolean {
  return a.stored > 0;
}

export function collectAnimal(s: GameState, animalId: string, now: number): number {
  const a = s.animals.find((x) => x.id === animalId);
  if (!a) return 0;
  updateAnimal(s, a, now);
  const def = C().animals.get(a.kind);
  if (!def?.product || a.stored <= 0) return 0;
  const wasFull = a.stored >= def.cap;
  const qty = a.stored * animalYield(a);
  addItem(s, def.product, qty);
  track(s, 'collect', def.product, qty);
  addXp(s, qty * (def.kind === 'cow' ? 4 : 1), now);
  a.stored = 0;
  if (wasFull) a.prodAt = now;
  emit({ type: 'collect', item: def.product, qty });
  emit({ type: 'sfx', name: def.kind === 'cow' ? 'moo' : 'cluck' });
  return qty;
}

export function brush(s: GameState, animalId: string, now: number): Result {
  const a = s.animals.find((x) => x.id === animalId);
  if (!a) return fail('Unknown animal');
  if (C().animals.get(a.kind)?.kind !== 'cow') return fail('Only cows get brushed');
  if (now < a.brushUntil) return fail('Already brushed. Fluffy enough for now!');
  const before = bondLevel(a);
  a.bond++;
  a.brushUntil = now + CONFIG.BRUSH_COOLDOWN_MS;
  track(s, 'brush');
  if (bondLevel(a) > before) emit({ type: 'toast', text: `${a.name} loves you more! Bond level ${bondLevel(a)}.`, icon: 'heart' });
  emit({ type: 'sfx', name: 'moo' });
  return ok();
}

export function buyAnimal(s: GameState, kindId: string, now: number): Result {
  const def = C().animals.get(kindId);
  if (!def) return fail('Unknown animal');
  if (animalsOfKind(s, def.kind).length >= animalCapacity(s, def.kind)) return fail(def.kind === 'cow' ? 'The barn is full. Upgrade it for more room.' : 'The coop is full. Upgrade it for more room.');
  if (!spend(s, def.buyCost)) return fail('Not enough coins');
  const a = addAnimal(s, kindId, now);
  if (!a) return fail('No room');
  emit({ type: 'toast', text: `Welcome to the farm, ${a.name}!`, icon: 'heart' });
  return ok();
}

export function renameAnimal(s: GameState, animalId: string, name: string): Result {
  const a = s.animals.find((x) => x.id === animalId);
  const clean = name.trim().slice(0, 18);
  if (!a || !clean) return fail('Pick a name');
  a.name = clean;
  track(s, 'nameAnimal');
  return ok();
}

export function equipAnimal(s: GameState, animalId: string, slot: 'hat' | 'neck', cosmeticId: string | null): Result {
  const a = s.animals.find((x) => x.id === animalId);
  if (!a) return fail('Unknown animal');
  if (cosmeticId) {
    const cos = C().cosmetics.get(cosmeticId);
    const kind = C().animals.get(a.kind)?.kind;
    if (!cos || !s.owned.cosmetics.includes(cosmeticId)) return fail('Not owned');
    const want = slot === 'neck' ? 'animal_neck' : kind === 'cow' ? 'cow_hat' : 'chicken_hat';
    if (cos.slot !== want) return fail('That does not fit');
  }
  a[slot] = cosmeticId ?? undefined;
  return ok();
}
