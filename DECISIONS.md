# Decisions

Judgment calls made while building, one line each.

## Build and tooling
- The sprite zip could not be fetched from Google Drive at first (the connector caps downloads at 10 MB and the network policy blocks drive.google.com); it arrived later as an upload and its 32 sprites are now in the game.
- Final art is kept at its own resolution (`art:process --native`) and fitted to each slot when drawn: buildings, decor, and props fill their footprint width and may grow taller; everything else fits inside its box. Downscaling the supplied sprites to the 32 px grid would have thrown away most of their detail.
- Final art may cover only some frames (`<id>_f<n>.png`): the three crops came as ready-stage art only, so earlier stages keep their placeholder sprouts.
- Buildings with only restored final art show their ruined stage as that art grayed with bramble thickets, and the repair stage lightly tinted under scaffolding, until dedicated art exists.
- Head anchors, horn spans, and facing for final animal art live in `assets/art-meta.json`; animals flip to face where they walk whichever way their art was drawn.
- `art:process` recolors dark magenta edge pixels (left by anti-aliasing against the key) to the plum outline, so sprites have no pink halo in game. Real purples survive because the check needs red and blue nearly equal.
- The generator's own background removal erased pink, red, and purple areas inside some sprites (van panels, Claire's blouse, the flower crown, ornaments, apples). `assets/art-fixes.json` lists the damaged sprites and how to refill them; real gaps (a lock shackle, easel legs, the well opening) are left alone because no automatic rule tells them apart. The art prompts now ask for the magenta background to be left in place.
- The supplied vertical fence was drawn side on, so the game builds the vertical piece from the horizontal one (a post with the rail turned on end) until a proper one exists; `art-fixes.json` skips the supplied file.
- Ground variants are blended over a base tile at 30 percent instead of swapped in, because the detailed final tiles differ too much in color and read as a checkerboard; the woods use the woods floor alone.
- Single-frame final art gets a gentle code "breathing" animation instead of a frame strip.
- Supplied art with no matching slot was put to use: the calf became a buyable Highland calf that grows into a cow in two days, the blackberry jam became a new recipe, Claire's cafe is the header of her shop tab, and the trees and brambles became farm scenery (border, Selleck Woods, the orchard, overgrown acres).
- Final art stays visible in Luna's sitting pose until a sleeping sprite exists.
- Stack versions: Phaser 3.90, Preact 10, Vite 7, TypeScript 5.9, Zod 4, Vitest 3, Playwright 1.56 (matches the preinstalled Chromium), vite-plugin-pwa 1.3.
- Hashed JS and CSS bundles go to `/static` so they never mix with final art under `/assets`.
- Placeholders are generated (`npm run placeholders`, also run by `dev` and `build`) and not committed; real art in `public/assets` always wins.
- A Vite virtual module lists which manifest slots have real art, so the game never requests files that do not exist.
- The debug panel ships in production builds but only appears with `?debug=1`, so the deployed build can be tested on the phone.
- Extra Playwright specs cover mini games with touch, season change, prestige, save code round trip, and offline boot, beyond the one required smoke test.

## Calendar and seasons
- Days before the anchor Monday (2026-10-05) count as Fall (week -1), so the first season Rachel sees is Fall even if she starts early; the first rollover keeps Fall and resets the journal.
- Daily systems (basket, wishes, market day) roll over at local midnight.
- A crop "ready" at rollover means its ready time is at or before Monday 00:00; anything still growing and out of season is composted for a 50% seed refund.
- Season visuals use a tinted overlay on the ground, falling particles, one seasonal prop by the farmhouse, and snow patches in winter; no separate tilesets.
- Dated season events (Spooky Week, Holiday Lights) give their gift once per calendar year.

## Land and buildings
- Parcels have three states: overgrown, cleared (usable, buildings repairable, first plots), and restored (fences, paint, more plots, +5% reputation). "Restored" is what counts for "5 of 9" and 100%.
- Restoration percent counts both parcel steps plus the repair stages of every core building (hive and County Fair are not core).
- Plots inside a parcel each need a one-time clearing fee; the first three Homestead plots are free.
- Repairs take real time (1 minute to 4 hours) and show an Under Repair stage; ribbons can finish them (1 ribbon per 2 hours left).
- Missing buyable materials are bought from Andrew automatically when repairing, upgrading, or cooking, with the total shown on the button.
- Upgrade cost is `base * growth^(level - 1)` with growth 1.5 to 1.7 per building; material needs grow every two levels.
- Farmhouse level is "reputation": +8% sell prices per level, compounding, max level 15.
- The Honor Box on the Roadside earns coins per hour (stores up to 10 hours) so there is always something earned while away.
- The greenhouse provides separate beds (1 per level) that accept any crop; Weed Pull is its mini game and speeds up every growing crop.
- Visible upgrade milestones are shown as gold stars on the building until real per-level art exists.

## Farming and animals
- Seeds are paid for at planting (the seed cost goes to Andrew implicitly) so planting stays at two taps.
- Tending removes 5% of the grow time per tap with a 20 second per-plot cooldown, capped at 25% per crop.
- Crop prices follow `profit = 0.12 * minutes^1.06` (seed is about 40% of sell price), so profit per minute rises slightly for longer crops; the shortest crops have hand-set prices.
- Hens store up to 4 eggs, cows up to 3 milk; production pauses when full.
- Brushing has a 30 minute cooldown; bond levels 0 to 5, each 5% faster, and level 3+ gives double milk.
- Chicks grow into hens after 24 hours.
- Cow hats are scaled down to fit inside the horn span; hats and neckwear follow the head anchor when the animal turns.

## Crafting, wine, and selling
- Kitchen slots run in parallel (2 plus one per 3 levels); finished dishes wait to be collected.
- Recipe unlocks are by kitchen level (or quest); seasonal recipes such as Peppermint Bark only cook in their season.
- Each wine batch yields 3 bottles. Quality depends on extra aging past the ferment time: +50% is Cellared, +150% is Reserve. Collect All only auto-bottles batches that reached Reserve.
- Wine names and label styles are remembered per wine type; every bottling is kept in a cellar log.
- Claire's wine orders accept any quality tier.
- The farm stand buys anything, any day, at 75% of base price, so weekdays always have an outlet.
- Claire's cafe level comes from friendship; order slots grow from 3 to 6; wine orders begin at cafe level 3. Orders expire after 6 hours with no penalty, and "Not today" brings a new one in 3 minutes.
- The very first order is always two of the quickest crop in season.
- Market stall slots limit how many different items can be sold per day (3 at level 1, +1 per level); a daily market goal pays 2 ribbons.
- Market hot items come from things in season or from last season (stockpiled), plus season-free goods; heirloom-only items are excluded.
- Hint sources: Luke gives one vague, 60% accurate hint; Claire's chalkboard covers food only at 80%; the Almanac goes from 55% to 100% accuracy and from vague to exact names over 5 levels. Hints appear from Wednesday.
- The market recap compares each item's coins per hour of effort with the weekend average.
- Andrew's weekly shelf shows the in-season weekly items, one out-of-season weekly item, and one regular catalog item at 20% off.

## Progression and retention
- XP needed for level L is `50 * (L - 1)^2.1`; each farm level adds 0.5% to sell prices.
- Quests complete automatically and use lifetime stats, so earlier progress counts; Journal tiers are claimed with a button for a satisfying moment.
- The tutorial is the first eight quests narrated by Luke in a small bubble that never blocks and can be skipped at any time.
- Daily basket and journal coin rewards grow by 50% every five farm levels.
- Daily wishes only use activities that are already unlocked (no egg wishes before the coop exists).
- Codex sets (crops per season, wines, recipes, hats, Luna spots, Luna gifts, decor) each pay a one-time ribbon bonus.
- Luna changes napping spots twice a day (morning and after 1 pm), only in parcels that are not overgrown, so "50 places" takes about a month; gifts have a 4% chance per tap after 5 moments, at most once a day.
- A lucky critter appears every 1 to 3 minutes while the farm is on screen; the tourist offers twice the base price for 1 to 3 of a random held item.

## Prestige
- Condition B uses lifetime coins across all years, as written; seeds use only this year's coins plus first-time achievements earned this year.
- Materials, animals (and their bond), wine names, and greenhouse placement are kept; greenhouse beds drop back to one because building levels reset.
- The County Fair tent appears on the Roadside once prestige is available; "Not yet" is always offered first.
- Heirloom expansions are flags in data; Beekeeping adds the Bee Garden building and honey, the Hillside Orchard and Creek Bottom unlocks add crops and a recipe each.

## Saves
- Save codes are `SH1.<checksum>.<base64 gzip JSON>` with an FNV-1a checksum.
- Fixtures v1 and v2 are reconstructed earlier shapes (a prototype schema) so the migration path is exercised from day one; v3 is the current schema.
- Unknown inventory ids and unknown crops on plots are kept (and ignored by the UI); saves from a newer schema load without migration and keep their extra fields.
- If a save cannot be parsed, a copy is kept under a separate key and a new farm starts, rather than overwriting it.

## Presentation
- Default camera zoom makes each tile at least 48 CSS pixels so every plot is a comfortable touch target; pinch zoom steps through whole-number zoom levels to keep pixels crisp.
- Parcel names, timers, and prices are DOM text positioned over the canvas so text stays sharp.
- The avatar uses grayscale layers tinted with multiply, in both Phaser and the DOM preview.
- When no music files exist, a procedural music box plays a seeded pentatonic loop per season; mini games use the menu theme.
- Mini game rounds are 40 seconds; quitting early gives no reward and no result screen.
- Photo mode hides the UI and saves a PNG through the Web Share sheet on Android, or as a download.
- The public build uses the farm name "Willow Creek Homestead" and has no dedication, easter eggs, or family wine.
