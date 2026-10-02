// Save migrations. migrations[n] upgrades a save from schema n to n+1.
// RULE: whenever the save shape changes, bump CONFIG.SCHEMA_VERSION, add a migration here,
// and add tests/fixtures/save_v<old>.json (see CONTENT_GUIDE.md).
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AnySave = Record<string, any>;

export const migrations: Record<number, (save: AnySave) => AnySave> = {
  // v1 (prototype) -> v2: money became coins, quests became an object, animal timers renamed
  1: (s) => {
    const out: AnySave = { ...s, schemaVersion: 2 };
    out.coins = s.money ?? 0;
    delete out.money;
    out.quests = { done: Array.isArray(s.quests) ? s.quests : [] };
    out.animals = (s.animals ?? []).map((a: AnySave) => {
      const { lastProduced, ...rest } = a;
      return { ...rest, prodAt: lastProduced ?? s.lastSeen ?? 0, brushUntil: 0, bornAt: s.createdAt ?? 0 };
    });
    out.ribbons = s.ribbons ?? 0;
    return out;
  },
  // v2 -> v3: Heirloom Years (prestige), Luna moments, decor layouts, more settings
  2: (s) => {
    const out: AnySave = { ...s, schemaVersion: 3 };
    out.heirloomSeeds = s.heirloomSeeds ?? 0;
    out.heirloom = s.heirloom ?? {};
    out.farmYear = s.farmYear ?? 1;
    out.yearCoins = s.yearCoins ?? s.lifetimeCoins ?? 0;
    out.yearAchievements = s.yearAchievements ?? 0;
    out.flags = s.flags ?? [];
    out.luna = s.luna ?? { moments: s.stats?.lunaTap ?? 0 };
    out.layouts = s.layouts ?? {};
    out.settings = { reduceMotion: false, haptics: true, numberFormat: 'short', ...(s.settings ?? {}) };
    return out;
  },
};

export function migrate(save: AnySave, target: number): { save: AnySave; from: number; steps: number } {
  const from = Number(save.schemaVersion ?? 1);
  let cur = save;
  let v = from;
  let steps = 0;
  while (v < target) {
    const m = migrations[v];
    if (!m) throw new Error(`No migration from schema ${v}`);
    cur = m(cur);
    v = Number(cur.schemaVersion);
    steps++;
  }
  return { save: cur, from, steps };
}
