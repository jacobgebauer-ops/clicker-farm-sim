// Zod schemas for every content file under /content.
// `npm run content:check` and `npm run build` validate all data against these.
import { z } from 'zod';

export const SeasonId = z.enum(['spring', 'summer', 'fall', 'winter']);
export type SeasonId = z.infer<typeof SeasonId>;

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids are lowercase snake_case');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const qtyList = z.array(z.object({ id, qty: z.number().int().positive() }));

export const Reward = z.object({
  coins: z.number().nonnegative().optional(),
  ribbons: z.number().int().nonnegative().optional(),
  xp: z.number().nonnegative().optional(),
  items: qtyList.optional(),
  cosmetics: z.array(id).optional(),
  decor: z.array(id).optional(),
  recipes: z.array(id).optional(),
  animals: z.array(z.object({ kind: id, qty: z.number().int().positive() })).optional(),
});
export type Reward = z.infer<typeof Reward>;

// Objectives drive quests, achievements, wishes and the tutorial.
export const Objective = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stat'), stat: z.string(), id: z.string().optional(), count: z.number().positive() }),
  z.object({ type: z.literal('building'), id, stage: z.number().int().min(0).max(2).optional(), level: z.number().int().optional() }),
  z.object({ type: z.literal('parcel'), id, state: z.enum(['cleared', 'restored']) }),
  z.object({ type: z.literal('parcelsRestored'), count: z.number().int() }),
  z.object({ type: z.literal('own'), id, count: z.number().int().positive() }),
  z.object({ type: z.literal('animals'), kind: id, count: z.number().int().positive() }),
  z.object({ type: z.literal('collection'), set: z.string(), count: z.number().int().positive() }),
  z.object({ type: z.literal('coinsLifetime'), count: z.number().positive() }),
  z.object({ type: z.literal('level'), count: z.number().int().positive() }),
]);
export type Objective = z.infer<typeof Objective>;

const meta = { deprecated: z.boolean().optional(), requires: z.string().optional() };

export const Crop = z.object({
  id, name: z.string(), seasons: z.array(SeasonId).min(1),
  growMin: z.number().positive(), seedCost: z.number().nonnegative(), sellPrice: z.number().positive(),
  xp: z.number().nonnegative(), effort: z.number().positive().optional(),
  tags: z.array(z.string()), color: hex, minLevel: z.number().int().optional(),
  blurb: z.string().optional(), ...meta,
});
export const Animal = z.object({
  id, name: z.string(), kind: z.enum(['cow', 'chicken']), product: id.nullable(),
  everyMin: z.number().positive(), cap: z.number().int().positive(), buyCost: z.number().nonnegative(),
  growsInto: id.optional(), growMin: z.number().optional(), headAnchor: z.tuple([z.number(), z.number()]),
  hornSpan: z.number().optional(), ...meta,
});
export const Item = z.object({
  id, name: z.string(), kind: z.enum(['material', 'animal', 'special']),
  basePrice: z.number().nonnegative(), buyable: z.boolean().default(false),
  tags: z.array(z.string()), color: hex, effort: z.number().optional(), ...meta,
});
export const RecipeUnlock = z.object({
  building: id.optional(), level: z.number().int().optional(), quest: id.optional(), start: z.boolean().optional(),
});
export const Recipe = z.object({
  id, name: z.string(), inputs: qtyList.min(1), craftMin: z.number().positive(),
  sellPrice: z.number().positive().optional(), xp: z.number().nonnegative(),
  tags: z.array(z.string()), seasons: z.array(SeasonId).optional(), unlock: RecipeUnlock,
  color: hex, ...meta,
});
export const Wine = z.object({
  id, name: z.string(), fruit: id, fruitQty: z.number().int().positive(), extras: qtyList,
  fermentMin: z.number().positive(), basePrice: z.number().positive().optional(),
  labelColor: hex, tags: z.array(z.string()), blurb: z.string(), family: z.boolean().optional(), ...meta,
});
export const Building = z.object({
  id, name: z.string(), parcel: id, x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int(),
  repair: z.object({ coins: z.number(), materials: qtyList, minutes: z.number() }),
  upgrade: z.object({ base: z.number(), growth: z.number().default(1.6), materials: qtyList.optional() }),
  maxLevel: z.number().int(), visibleLevels: z.array(z.number().int()).default([]),
  produces: z.object({ item: z.string(), everyMin: z.number(), perLevel: z.number(), cap: z.number() }).optional(),
  minigame: id.optional(), core: z.boolean().default(true), blurb: z.string(), ...meta,
});
export const Parcel = z.object({
  id, name: z.string(), gx: z.number().int().min(0).max(2), gy: z.number().int().min(0).max(2),
  role: z.string(), start: z.enum(['overgrown', 'cleared']),
  clear: z.object({ coins: z.number(), materials: qtyList }),
  restore: z.object({ coins: z.number(), materials: qtyList }),
  plots: z.array(z.object({ x: z.number().int(), y: z.number().int(), cost: z.number(), needs: z.enum(['cleared', 'restored']) })),
  ground: z.enum(['grass', 'meadow', 'woods', 'creek', 'gravel']).default('grass'),
  blurb: z.string(), ...meta,
});
const Price = z.object({ coins: z.number().optional(), ribbons: z.number().optional() });
export const Decor = z.object({
  id, name: z.string(), w: z.number().int().positive(), h: z.number().int().positive(),
  season: SeasonId.optional(), price: Price.optional(),
  source: z.enum(['shop', 'journal', 'quest', 'achievement', 'andrew_weekly', 'start', 'heirloom', 'event']),
  walkable: z.boolean().default(false), animated: z.boolean().default(false), tags: z.array(z.string()), color: hex, ...meta,
});
export const Cosmetic = z.object({
  id, name: z.string(),
  slot: z.enum(['cow_hat', 'chicken_hat', 'animal_neck', 'avatar_hat', 'avatar_hair', 'avatar_outfit', 'avatar_accessory', 'wine_label', 'building_paint', 'building_roof', 'building_skin']),
  season: SeasonId.optional(), price: Price.optional(),
  source: z.enum(['shop', 'journal', 'quest', 'achievement', 'andrew_weekly', 'start', 'heirloom', 'event']),
  color: hex, ...meta,
});
export const Quest = z.object({
  id, chapter: z.number().int(), title: z.string(), giver: z.enum(['luke', 'claire', 'andrew', 'luna', 'rachel']),
  text: z.string(), prereq: z.array(id), objective: Objective, reward: Reward, tutorial: z.boolean().optional(),
  hint: z.string().optional(), ...meta,
});
export const DialogueLine = z.object({
  id, trigger: z.string(), mood: z.enum(['happy', 'sassy', 'sly', 'proud', 'sleepy', 'excited', 'gentle']),
  text: z.string(), season: SeasonId.optional(), weight: z.number().default(1),
});
export const Dialogue = z.object({ speakers: z.record(z.string(), z.object({ name: z.string(), color: hex })), lines: z.array(DialogueLine) });
export const Season = z.object({
  id: SeasonId, name: z.string(), theme: z.string(),
  palette: z.array(hex).length(4), grass: hex, grassDark: hex, particles: z.enum(['petals', 'sparkles', 'leaves', 'snow']),
  props: z.array(id), gift: Reward, banner: z.string(),
});
export const SeasonEvent = z.object({
  id, name: z.string(), text: z.string(),
  when: z.object({ seasons: z.array(SeasonId).optional(), dates: z.object({ from: z.string(), to: z.string() }).optional() }),
  effects: z.object({
    priceMult: z.array(z.object({ tag: z.string(), mult: z.number() })).optional(),
    luckyRate: z.number().optional(),
    xpMult: z.number().optional(),
  }),
  gift: Reward.optional(),
});
export const LuckyEvent = z.object({
  id, kind: z.enum(['butterfly', 'ladybug', 'tourist']), name: z.string(), weight: z.number(),
  reward: Reward, text: z.string(),
});
export const Events = z.object({ lucky: z.array(LuckyEvent), season: z.array(SeasonEvent) });
export const Almanac = z.object({
  levels: z.array(z.object({ level: z.number().int(), cost: z.number(), materials: qtyList, accuracy: z.number(), precision: z.number().int().min(0).max(3), text: z.string() })),
  covers: z.array(z.object({ year: z.number().int(), name: z.string(), color: hex })),
  pages: z.array(z.object({ id, title: z.string(), text: z.string() })),
});
export const Changelog = z.array(z.object({ version: z.string(), date: z.string(), title: z.string(), items: z.array(z.string()) }));
export const Aliases = z.record(z.string(), z.string());
export const Achievement = z.object({
  id, name: z.string(), desc: z.string(), condition: Objective, ribbons: z.number().int(), reward: Reward.optional(), hidden: z.boolean().optional(), ...meta,
});
export const HeirloomUpgrade = z.object({
  id, name: z.string(), desc: z.string(), maxLevel: z.number().int().positive(), costs: z.array(z.number().int().positive()),
  effect: z.object({ type: z.enum(['sellMult', 'growSpeed', 'offlineHours', 'kitchenSlots', 'cellarSlots', 'almanacStart', 'unlock', 'startCoins']), value: z.number(), flag: z.string().optional() }),
  prereq: z.array(id).default([]),
});
export const Luna = z.object({
  spots: z.array(z.object({ id, text: z.string(), x: z.number(), y: z.number(), parcel: id, on: z.string().optional() })),
  gifts: z.array(z.object({ id, name: z.string(), desc: z.string() })),
  stats: z.array(z.object({ label: z.string(), value: z.string() })),
});
export const Journal = z.object({
  tiers: z.array(z.number().int().positive()).length(20),
  points: z.record(z.string(), z.number()),
  filler: z.array(Reward),
  pools: z.record(SeasonId, z.array(z.object({ type: z.enum(['cosmetic', 'decor']), id }))),
  poolTiers: z.array(z.number().int()),
});
export const Daily = z.object({ basket: z.array(Reward).length(7) });
export const Wishes = z.object({
  templates: z.array(z.object({ id, text: z.string(), stat: z.string(), id2: z.string().optional(), needs: z.string().optional(), min: z.number().int(), max: z.number().int(), ribbons: z.number().int() })),
});
export const MiniGameDef = z.object({ id, name: z.string(), building: id, blurb: z.string(), howTo: z.string() });
export const Personal = z.object({
  playerName: z.string(), farmName: z.string(), townName: z.string(), husbandName: z.string().optional(),
  cows: z.array(z.string()), chickens: z.array(z.string()),
  dedication: z.string(),
  easterEggs: z.array(z.object({ trigger: z.string(), text: z.string() })),
  familyWine: z.object({ name: z.string(), description: z.string(), label: hex, fruit: id }).nullable(),
});
export type Personal = z.infer<typeof Personal>;

export const ContentFiles = {
  crops: z.array(Crop),
  animals: z.array(Animal),
  items: z.array(Item),
  recipes: z.array(Recipe),
  wines: z.array(Wine),
  buildings: z.array(Building),
  parcels: z.array(Parcel).length(9),
  decor: z.array(Decor),
  cosmetics: z.array(Cosmetic),
  quests: z.array(Quest),
  dialogue: Dialogue,
  seasons: z.array(Season).length(4),
  events: Events,
  almanac: Almanac,
  changelog: Changelog,
  aliases: Aliases,
  achievements: z.array(Achievement),
  heirloom: z.array(HeirloomUpgrade),
  luna: Luna,
  journal: Journal,
  daily: Daily,
  wishes: Wishes,
  minigames: z.array(MiniGameDef),
} as const;

export type ContentFileName = keyof typeof ContentFiles;
export type RawContent = { [K in ContentFileName]: z.infer<(typeof ContentFiles)[K]> };
export type CropDef = z.infer<typeof Crop>;
export type AnimalDef = z.infer<typeof Animal>;
export type ItemDef = z.infer<typeof Item>;
export type RecipeDef = z.infer<typeof Recipe>;
export type WineDef = z.infer<typeof Wine>;
export type BuildingDef = z.infer<typeof Building>;
export type ParcelDef = z.infer<typeof Parcel>;
export type DecorDef = z.infer<typeof Decor>;
export type CosmeticDef = z.infer<typeof Cosmetic>;
export type QuestDef = z.infer<typeof Quest>;
export type DialogueLineDef = z.infer<typeof DialogueLine>;
export type SeasonDef = z.infer<typeof Season>;
export type SeasonEventDef = z.infer<typeof SeasonEvent>;
export type LuckyEventDef = z.infer<typeof LuckyEvent>;
export type AchievementDef = z.infer<typeof Achievement>;
export type HeirloomDef = z.infer<typeof HeirloomUpgrade>;
export type MiniGameContent = z.infer<typeof MiniGameDef>;
