// Loads every /content JSON file, validates it with the Zod schemas, and builds lookup maps.
// Pure: works the same in the browser, in Vitest, and in the Node pacing sim.
import crops from '../../content/crops.json';
import animals from '../../content/animals.json';
import items from '../../content/items.json';
import recipes from '../../content/recipes.json';
import wines from '../../content/wines.json';
import buildings from '../../content/buildings.json';
import parcels from '../../content/parcels.json';
import decor from '../../content/decor.json';
import cosmetics from '../../content/cosmetics.json';
import quests from '../../content/quests.json';
import dialogue from '../../content/dialogue.json';
import seasons from '../../content/seasons.json';
import events from '../../content/events.json';
import almanac from '../../content/almanac.json';
import changelog from '../../content/changelog.json';
import aliases from '../../content/aliases.json';
import achievements from '../../content/achievements.json';
import heirloom from '../../content/heirloom.json';
import luna from '../../content/luna.json';
import journal from '../../content/journal.json';
import daily from '../../content/daily.json';
import wishes from '../../content/wishes.json';
import minigames from '../../content/minigames.json';
import defaultPersonal from '../../content/personal/personal.json';
import {
  ContentFiles,
  Personal,
  type RawContent,
  type ContentFileName,
  type SeasonId,
  type CropDef,
  type RecipeDef,
  type WineDef,
  type BuildingDef,
  type ParcelDef,
  type DecorDef,
  type CosmeticDef,
  type QuestDef,
  type AchievementDef,
  type HeirloomDef,
  type AnimalDef,
  type Personal as PersonalT,
} from '../../content/schema';

export const RAW_FILES: Record<ContentFileName, unknown> = {
  crops, animals, items, recipes, wines, buildings, parcels, decor, cosmetics, quests, dialogue,
  seasons, events, almanac, changelog, aliases, achievements, heirloom, luna, journal, daily, wishes, minigames,
};

export type ItemKind = 'crop' | 'product' | 'animal' | 'material' | 'wine';

export interface ItemInfo {
  id: string;
  name: string;
  kind: ItemKind;
  basePrice: number;
  /** Rough hours of work that went into one unit (grow time, ingredients, processing). */
  effort: number;
  tags: string[];
  color: string;
  seasons?: SeasonId[];
  requires?: string;
  deprecated?: boolean;
  buyable?: boolean;
}

export interface ContentIssue {
  file: string;
  message: string;
}

export interface Content {
  raw: RawContent;
  personal: PersonalT;
  crops: Map<string, CropDef>;
  animals: Map<string, AnimalDef>;
  recipes: Map<string, RecipeDef>;
  wines: Map<string, WineDef>;
  buildings: Map<string, BuildingDef>;
  parcels: Map<string, ParcelDef>;
  decor: Map<string, DecorDef>;
  cosmetics: Map<string, CosmeticDef>;
  quests: Map<string, QuestDef>;
  achievements: Map<string, AchievementDef>;
  heirloom: Map<string, HeirloomDef>;
  items: Map<string, ItemInfo>;
  aliases: Record<string, string>;
}

/** Validate all raw files. Returns parsed data plus a list of human-readable problems. */
export function validateRaw(files: Record<string, unknown>): { data: RawContent | null; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(ContentFiles) as ContentFileName[]) {
    const res = ContentFiles[name].safeParse(files[name]);
    if (!res.success) {
      for (const iss of res.error.issues) {
        issues.push({ file: `content/${name}.json`, message: `${iss.path.join('.') || '(root)'}: ${iss.message}` });
      }
    } else out[name] = res.data;
  }
  if (issues.length) return { data: null, issues };
  const data = out as RawContent;
  issues.push(...crossCheck(data));
  return { data, issues };
}

function crossCheck(d: RawContent): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Map<string, string>();
  const reg = (file: string, id: string) => {
    if (seen.has(id)) issues.push({ file, message: `duplicate id "${id}" (also in ${seen.get(id)})` });
    else seen.set(id, file);
  };
  d.crops.forEach((x) => reg('crops', x.id));
  d.items.forEach((x) => reg('items', x.id));
  d.recipes.forEach((x) => reg('recipes', x.id));
  d.wines.forEach((x) => reg('wines', x.id));
  const sellable = new Set(seen.keys());
  d.decor.forEach((x) => reg('decor', x.id));
  d.cosmetics.forEach((x) => reg('cosmetics', x.id));
  d.buildings.forEach((x) => reg('buildings', x.id));
  d.parcels.forEach((x) => reg('parcels', x.id));
  d.animals.forEach((x) => reg('animals', x.id));
  const need = (file: string, id: string, set: Set<string> | Map<string, unknown>, what: string) => {
    if (!set.has(id)) issues.push({ file, message: `unknown ${what} "${id}"` });
  };
  const recipeIds = new Set(d.recipes.map((r) => r.id));
  for (const r of d.recipes) for (const i of r.inputs) need(`recipes:${r.id}`, i.id, sellable, 'ingredient');
  for (const w of d.wines) {
    need(`wines:${w.id}`, w.fruit, sellable, 'fruit');
    for (const e of w.extras) need(`wines:${w.id}`, e.id, sellable, 'extra');
  }
  const parcelIds = new Set(d.parcels.map((p) => p.id));
  for (const b of d.buildings) need(`buildings:${b.id}`, b.parcel, parcelIds, 'parcel');
  const decorIds = new Set(d.decor.map((x) => x.id));
  const cosIds = new Set(d.cosmetics.map((x) => x.id));
  const questIds = new Set(d.quests.map((q) => q.id));
  const checkReward = (file: string, r: { items?: { id: string }[]; decor?: string[]; cosmetics?: string[]; recipes?: string[] } | undefined) => {
    if (!r) return;
    r.items?.forEach((i) => need(file, i.id, sellable, 'item'));
    r.decor?.forEach((i) => need(file, i, decorIds, 'decor'));
    r.cosmetics?.forEach((i) => need(file, i, cosIds, 'cosmetic'));
    r.recipes?.forEach((i) => need(file, i, recipeIds, 'recipe'));
  };
  for (const q of d.quests) {
    q.prereq.forEach((p) => need(`quests:${q.id}`, p, questIds, 'prereq quest'));
    checkReward(`quests:${q.id}`, q.reward);
  }
  for (const a of d.achievements) checkReward(`achievements:${a.id}`, a.reward);
  for (const r of d.recipes) if (r.unlock.quest) need(`recipes:${r.id}`, r.unlock.quest, questIds, 'unlock quest');
  for (const [season, pool] of Object.entries(d.journal.pools)) {
    for (const p of pool) need(`journal:${season}`, p.id, p.type === 'decor' ? decorIds : cosIds, p.type);
  }
  d.seasons.forEach((s) => s.props.forEach((p) => need(`seasons:${s.id}`, p, decorIds, 'prop decor')));
  for (const [from, to] of Object.entries(d.aliases)) if (!seen.has(to)) issues.push({ file: 'aliases', message: `alias ${from} -> unknown "${to}"` });
  return issues;
}

function computeEffort(items: Map<string, ItemInfo>, d: RawContent) {
  // crops: grow hours plus a small handling cost
  for (const c of d.crops) {
    const it = items.get(c.id)!;
    it.effort = c.effort ?? +(c.growMin / 60 + 0.05 + c.seedCost / 400).toFixed(3);
  }
  for (const a of d.items) {
    const it = items.get(a.id)!;
    it.effort = a.effort ?? (a.kind === 'animal' ? (a.id === 'milk' ? 0.8 : a.id === 'egg' ? 0.25 : 1.2) : 0.05);
  }
  // recipes may depend on other recipes; iterate until stable
  for (let pass = 0; pass < 4; pass++) {
    for (const r of d.recipes) {
      const sum = r.inputs.reduce((s, i) => s + (items.get(i.id)?.effort ?? 0.1) * i.qty, 0);
      items.get(r.id)!.effort = +(sum + r.craftMin / 60).toFixed(3);
    }
  }
  for (const w of d.wines) {
    const fruit = (items.get(w.fruit)?.effort ?? 1) * w.fruitQty;
    const extras = w.extras.reduce((s, e) => s + (items.get(e.id)?.effort ?? 0.05) * e.qty, 0);
    items.get(w.id)!.effort = +((fruit + extras + w.fermentMin / 60) / 3).toFixed(3);
  }
}

export function buildContent(raw: RawContent, personal: PersonalT): Content {
  const d: RawContent = structuredClone(raw);
  if (personal.familyWine) {
    const fw = personal.familyWine;
    const base = d.wines.find((w) => w.fruit === fw.fruit) ?? d.wines[0];
    d.wines.push({
      ...base, id: 'wine_family', name: fw.name, blurb: fw.description, labelColor: fw.label, family: true,
      tags: [...base.tags, 'family'], fermentMin: base.fermentMin * 1.5,
    });
  }
  const items = new Map<string, ItemInfo>();
  for (const c of d.crops) items.set(c.id, { id: c.id, name: c.name, kind: 'crop', basePrice: c.sellPrice, effort: 1, tags: c.tags, color: c.color, seasons: c.seasons, requires: c.requires, deprecated: c.deprecated });
  for (const a of d.items) items.set(a.id, { id: a.id, name: a.name, kind: a.kind === 'animal' ? 'animal' : 'material', basePrice: a.basePrice, effort: 1, tags: a.tags, color: a.color, requires: a.requires, deprecated: a.deprecated, buyable: a.buyable });
  for (const r of d.recipes) items.set(r.id, { id: r.id, name: r.name, kind: 'product', basePrice: 0, effort: 1, tags: r.tags, color: r.color, seasons: r.seasons, requires: r.requires, deprecated: r.deprecated });
  for (const w of d.wines) items.set(w.id, { id: w.id, name: w.name, kind: 'wine', basePrice: 0, effort: 1, tags: w.tags, color: w.labelColor, requires: w.requires, deprecated: w.deprecated });
  // derived prices: products are worth more than their ingredients
  for (let pass = 0; pass < 4; pass++) {
    for (const r of d.recipes) {
      const inputs = r.inputs.reduce((s, i) => s + (items.get(i.id)?.basePrice ?? 0) * i.qty, 0);
      items.get(r.id)!.basePrice = r.sellPrice ?? Math.round(inputs * 1.3 + r.craftMin * 0.6 + 4);
    }
  }
  for (const w of d.wines) {
    const fruit = (items.get(w.fruit)?.basePrice ?? 0) * w.fruitQty;
    const extras = w.extras.reduce((s, e) => s + (items.get(e.id)?.basePrice ?? 0) * e.qty, 0);
    // price per bottle; a batch makes several bottles
    items.get(w.id)!.basePrice = w.basePrice ?? Math.round(((fruit + extras) * 1.5 + w.fermentMin * 0.5) / 3);
  }
  computeEffort(items, d);
  const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x] as const));
  return {
    raw: d,
    personal,
    crops: byId(d.crops),
    animals: byId(d.animals),
    recipes: byId(d.recipes),
    wines: byId(d.wines),
    buildings: byId(d.buildings),
    parcels: byId(d.parcels),
    decor: byId(d.decor),
    cosmetics: byId(d.cosmetics),
    quests: byId(d.quests),
    achievements: byId(d.achievements),
    heirloom: byId(d.heirloom),
    items,
    aliases: d.aliases,
  };
}

let current: Content | null = null;

/** The active content set. Built lazily from the bundled JSON and default personal file. */
export function C(): Content {
  if (!current) {
    const { data, issues } = validateRaw(RAW_FILES);
    if (!data || issues.length) {
      throw new Error('Invalid content:\n' + issues.map((i) => `  ${i.file}: ${i.message}`).join('\n'));
    }
    current = buildContent(data, Personal.parse(defaultPersonal));
  }
  return current;
}

/** Apply a personalization overlay (gift or public build). */
export function usePersonal(personal: unknown) {
  const base = C();
  current = buildContent(base.raw.wines.some((w) => w.id === 'wine_family') ? stripFamily(base.raw) : base.raw, Personal.parse(personal));
}

function stripFamily(raw: RawContent): RawContent {
  return { ...raw, wines: raw.wines.filter((w) => w.id !== 'wine_family') };
}

/** Resolve retired ids through content/aliases.json. */
export function resolveId(id: string): string {
  const a = C().aliases;
  let cur = id;
  for (let i = 0; i < 8 && a[cur]; i++) cur = a[cur];
  return cur;
}

export function itemInfo(id: string): ItemInfo | undefined {
  const c = C();
  const [base] = id.split('@');
  return c.items.get(resolveId(base));
}

export function itemName(id: string): string {
  const [base, tier] = id.split('@');
  const info = itemInfo(base);
  if (!info) return id;
  if (tier) return `${info.name} (${tier[0].toUpperCase()}${tier.slice(1)})`;
  return info.name;
}
