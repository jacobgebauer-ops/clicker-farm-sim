# Content guide

All game content lives in `/content` as JSON. Adding content never requires engine code. Every file has a Zod schema in `content/schema.ts`; `npm run content:check` (and `npm run build`) fails with a clear message if anything is invalid or refers to an id that does not exist.

After editing content:

```bash
npm run content:check     # validate, cross-check ids, and list art that still uses placeholders
npm run placeholders      # give any new ids a placeholder sprite
npm run format:content    # optional: tidy the JSON (one object per line)
npm test
```

## Rules that keep saves safe

1. **Never rename or delete an id.** Players' saves refer to them.
2. To retire something, add `"deprecated": true`. It disappears from shops and pickers but old saves still understand it.
3. If an item must be replaced, keep the old entry deprecated and add an alias in `content/aliases.json`:
   ```json
   { "old_berry_id": "new_berry_id" }
   ```
4. Ids are lowercase `snake_case`.
5. Unknown ids in a save are preserved and ignored, never deleted, so rolling back a build is safe.

## Changing the save shape (developers)

Whenever the shape of the save changes:

1. Bump `SCHEMA_VERSION` in `src/core/config.ts`.
2. Add `migrations[<old version>]` in `src/core/migrations.ts` that converts an old save into the new shape.
3. Save a real save from the previous version as `tests/fixtures/save_v<old version>.json` (Menu, Settings, Download save file gives you one).
4. `npm test` loads every fixture and fails if any of them does not migrate cleanly.

New optional fields with sensible defaults do not need a migration: `normalize()` in `src/core/save.ts` fills missing fields from a fresh game.

## Copy-paste examples

### A crop (`content/crops.json`)

```json
{"id": "rainbow_chard", "name": "Rainbow Chard", "seasons": ["spring", "fall"], "growMin": 50, "seedCost": 6, "sellPrice": 15, "xp": 10, "tags": ["green", "leafy", "vegetable", "pretty"], "color": "#D94A6B"}
```

- `growMin` is real minutes. `tags` drive market hints (a color, a flavor such as sweet or savory, and a category such as fruit or vegetable work best).
- Optional: `"effort"` (otherwise computed), `"minLevel"`, `"requires": "heirloom:creek_crops"`, `"deprecated": true`.
- It gets an art slot automatically: `crop_rainbow_chard` (4-frame growth strip) and `item_rainbow_chard`.

### A recipe (`content/recipes.json`)

```json
{"id": "chard_gratin", "name": "Chard Gratin", "inputs": [{"id": "rainbow_chard", "qty": 3}, {"id": "milk", "qty": 1}], "craftMin": 35, "xp": 12, "tags": ["green", "savory", "baked"], "unlock": {"building": "kitchen", "level": 3}, "color": "#C9D98A"}
```

- `unlock.level` is the number of kitchen upgrades needed (0 means as soon as the kitchen is restored). Use `{"quest": "q_some_quest"}` to unlock from a quest reward instead.
- Optional: `"seasons": ["winter"]` to cook it only in a season, `"sellPrice"` to override the computed price.

### A wine (`content/wines.json`)

```json
{"id": "wine_cherry", "name": "Cherry Cordial", "fruit": "cherry", "fruitQty": 5, "extras": [{"id": "sugar", "qty": 2}, {"id": "bottle", "qty": 3}], "fermentMin": 600, "labelColor": "#B33A5A", "tags": ["wine", "red", "sweet"], "blurb": "Bright, a little tart, very pretty in the glass."}
```

Quality tiers (Young, Cellared, Reserve) come from aging and apply to every wine automatically.

### A decor item (`content/decor.json`)

```json
{"id": "pumpkin_lantern_row", "name": "Pumpkin Lantern Row", "w": 2, "h": 1, "season": "fall", "price": {"coins": 650}, "source": "shop", "animated": true, "tags": ["fall", "pumpkin"], "color": "#FF8A1F"}
```

- `w` and `h` are tiles. `source` is one of `shop`, `journal`, `quest`, `achievement`, `andrew_weekly`, `start`, `heirloom`, `event`.
- `"walkable": true` lets other things sit on top (paths, rugs).
- To add it to a Season Journal pool, also add `{"type": "decor", "id": "pumpkin_lantern_row"}` to `journal.json` under `pools.fall`.

### A cosmetic (`content/cosmetics.json`)

```json
{"id": "hat_viking", "name": "Viking Helmet", "slot": "cow_hat", "price": {"ribbons": 8}, "source": "shop", "color": "#AEB7C0"}
```

Slots: `cow_hat`, `chicken_hat`, `animal_neck`, `avatar_hat`, `avatar_hair`, `avatar_outfit`, `avatar_accessory`, `wine_label`, `building_paint`, `building_roof`, `building_skin`.

### A quest (`content/quests.json`)

```json
{"id": "q_chard_party", "chapter": 3, "title": "Chard Party", "giver": "claire", "text": "Claire wants a mountain of chard for the lunch rush.", "prereq": ["q_claire_flowers"], "objective": {"type": "stat", "stat": "harvest", "id": "rainbow_chard", "count": 20}, "reward": {"coins": 600, "xp": 60, "recipes": ["chard_gratin"]}}
```

Objective types:
- `{"type": "stat", "stat": "<stat>", "id": "<optional id>", "count": N}` with stats such as `harvest`, `plant`, `tend`, `collect`, `craft`, `orderFill`, `marketSell`, `marketHot`, `sell`, `buy`, `brush`, `lunaTap`, `minigame`, `minigameStars3`, `wineBottle`, `wineReserve`, `lucky`, `decorPlace`, `photo`, `repair`, `upgrade`
- `{"type": "building", "id": "barn", "stage": 2}` or `{"type": "building", "id": "kitchen", "level": 5}`
- `{"type": "parcel", "id": "north_field", "state": "cleared"}`
- `{"type": "parcelsRestored", "count": 5}`, `{"type": "own", "id": "pumpkin", "count": 10}`, `{"type": "animals", "kind": "hen", "count": 6}`
- `{"type": "collection", "set": "lunaSpots", "count": 10}`, `{"type": "coinsLifetime", "count": 100000}`, `{"type": "level", "count": 10}`

Rewards can include `coins`, `ribbons`, `xp`, `items`, `cosmetics`, `decor`, `recipes`, and `animals`.

### A Luke dialogue line (`content/dialogue.json`)

```json
{"id": "tip_41", "trigger": "tip", "mood": "sly", "text": "If you tap the scarecrow five times, nothing happens. I checked. Twice."}
```

- Ids must be unique. Triggers in use: `greeting`, `tip`, `chatter`, `market_hint` (must contain `{hint}`), `rollover` (can use `{season}`), `compost`, `away`, `whats_new`, `tutorial_start`, `tutorial_skip`, `tutorial_done`, `prestige_ready`, `prestige_done` (`{year}`), `luna`, `minigame_cooldown`, `claire_order`, `claire_chalkboard` (`{hint}`), `andrew`, `almanac` (`{hint}`), and `screen:<name>` for the Ask Luke button on each screen (`screen:farm`, `screen:kitchen`, `screen:winery`, `screen:claire`, `screen:andrew`, `screen:market`, `screen:style`, `screen:journal`, `screen:quests`, `screen:codex`, `screen:settings`, `screen:heirloom`).
- Every line can use `{name}`, `{farm}`, and `{town}`. Add `"season": "winter"` to limit a line to one season, and `"weight": 2` to make it more likely.
- Moods: `happy`, `sassy`, `sly`, `proud`, `sleepy`, `excited`, `gentle`. No em dashes, please; use commas, semicolons, or parentheses.

### A season event (`content/events.json`, under `season`)

```json
{"id": "berry_festival", "name": "Berry Festival", "text": "Everything berry sells for more this week.", "when": {"dates": {"from": "07-14", "to": "07-20"}}, "effects": {"priceMult": [{"tag": "berry", "mult": 1.2}], "luckyRate": 1.5}, "gift": {"ribbons": 2}}
```

Use `"when": {"seasons": ["summer"]}` for an every-summer-week event, or `dates` (`MM-DD`, ranges may wrap past New Year) for a calendar event. `gift` is given once per year while the event is active. Effects: `priceMult` by tag, `luckyRate`, `xpMult`.

### A mini game

1. Create `src/game/minigames/<id>/index.ts` that default-exports a `MiniGame` (see `src/game/minigames/types.ts`). The easiest start is to copy `egg_catch` and extend `MiniGameScene` from `../base`, which handles scaling, the countdown, the 40 second timer, the HUD, and quitting.
   ```ts
   const myGame: MiniGame = {
     id: 'grape_stomp',
     title: 'Grape Stomp',
     sceneKey: 'mg_grape_stomp',
     scene: GrapeStompScene,
     start(ctx) { ctx.game.scene.start('mg_grape_stomp', { ctx }); },
     onResult(score) { return score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0; },
   };
   export default myGame;
   ```
2. Register it with a building in `content/minigames.json`:
   ```json
   {"id": "grape_stomp", "name": "Grape Stomp", "building": "winery", "blurb": "Stomp in rhythm to press the grapes.", "howTo": "Tap the left and right feet with the beat."}
   ```
3. Add `"minigame": "grape_stomp"` to the building in `buildings.json`. The registry picks the folder up automatically, the building sheet shows a Play button, and the reward rules (timer skip 15/30/50% by stars, 20 minute cooldown) apply. Timer skipping for a new building is defined in `skipTimers` in `src/core/minigames.ts`.

### An Heirloom Tree upgrade (`content/heirloom.json`)

```json
{"id": "h_market_charm", "name": "Market Charm", "desc": "The market goal pays one extra ribbon per level.", "maxLevel": 3, "costs": [2, 4, 6], "effect": {"type": "unlock", "value": 1, "flag": "heirloom:market_charm"}, "prereq": ["h_yield"]}
```

Effect types: `sellMult`, `growSpeed`, `offlineHours`, `kitchenSlots`, `cellarSlots`, `almanacStart`, `startCoins`, and `unlock` (sets a flag). Any content entry with `"requires": "heirloom:<flag>"` stays hidden until the flag is unlocked, which is how expansions such as new crops, decor sets, and buildings are added without code. A brand new effect type (like the market charm above doing something new) needs a line of engine code where the effect applies.

## Personal content (`content/personal/personal.json`)

```json
{
  "playerName": "Rachel",
  "farmName": "Selleck Homestead",
  "townName": "Selleck",
  "cows": ["Fergus", "Moira", "Bonnie", "Angus", "Heather", "Wallace"],
  "chickens": ["Henrietta", "Clucky", "Pepper", "Biscuit", "Nugget", "Mabel"],
  "dedication": "Shown once on first launch, and any time from Settings.",
  "easterEggs": [
    {"trigger": "decorTap:highland_statue:5", "text": "Tap a decoration a number of times."},
    {"trigger": "lunaTap:100", "text": "Pet Luna a total number of times."},
    {"trigger": "date:06-14", "text": "Shown once on this day each year (birthday, anniversary)."}
  ],
  "familyWine": {"name": "Selleck Family Blackberry", "description": "The family recipe.", "label": "#4A2B7A", "fruit": "blackberry"}
}
```

Set `familyWine` to `null` to leave it out. `public.json` is the stand-in used for `VITE_BUILD=public`.

## Art

Every slot is in `assets/manifest.json` (regenerate with `npm run manifest`). Final art goes in `public/<path>` from the manifest. Process AI output with:

```bash
npm run art:process -- ./art-inbox --palette
```

Name inbox files after the manifest id (`anim_highland_cow.png`), or one file per frame (`anim_highland_cow_f0.png`, `anim_highland_cow_f1.png`). Backgrounds must be solid magenta `#FF00FF`.

**AI output usually needs a manual cleanup pass.** Image generators produce soft, anti-aliased edges, uneven pixel sizes, and stray colors. Open the processed PNG in a pixel editor (Aseprite or the free Pixelorama) and:
- remove pink fringe pixels left by the magenta key,
- fix lines so they are one pixel wide with the plum outline `#2B1B3D`,
- check animals and characters most carefully: faces, horns, legs, and the Highland cow's bangs tend to come out muddy,
- keep frames the same size and baseline so animations do not wobble.

The script warns about non-integer scale ratios (generate at an exact multiple of the target size, such as 8x or 16x) and stray single pixels. Record every new asset in `ASSETS_LICENSES.md`.

## Music

Drop `spring.ogg`, `summer.ogg`, `fall.ogg`, `winter.ogg`, and `menu.ogg` into `public/audio/music/`. Missing files fall back to the procedural music box.
