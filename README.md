# Selleck Homestead

A cozy idle farm game for one very special player, built as an installable web app (PWA) for an Android phone. Clear the Himalayan blackberry brambles, rebuild nine acres in Selleck, WA, raise Highland cows (in hats), make fruit wine, sell at the weekend Farmers Market, and put up with Luna, an old black cat who does absolutely nothing useful.

The game is fully playable today with generated placeholder art and generated sound. Final art drops in later by file name.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (add ?debug=1 for the dev tools)
```

Requires Node 20 or newer.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Generate placeholders, then start the Vite dev server |
| `npm run build` | Placeholders, content validation, typecheck, production build into `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm test` | Unit tests (Vitest): seasons and DST, market determinism, offline math, prestige, save migrations, content schemas, cooldowns |
| `npm run test:e2e` | Playwright smoke test at 412x915 plus the "definition of done" flows |
| `npm run sim` | Pacing report: simulates a light daily player and compares milestones with the targets |
| `npm run placeholders` | Writes a labeled placeholder PNG for every art slot in `assets/manifest.json` |
| `npm run art:process -- <inbox>` | Turns raw AI art into game-ready sprites (see below) |
| `npm run content:check` | Validates all `/content` data and reports which art slots still use placeholders |
| `npm run manifest` | Regenerates `assets/manifest.json` from the content files |

## Project layout

```
src/core        pure game logic (no Phaser, no DOM): clock, rng, calendar, state, economy,
                farm, crafting, shops, market, progress, luna, minigames, prestige, tick, save
src/game        Phaser: Boot and Farm scenes, mini games (one folder each)
src/ui          Preact: HUD, tabs, sheets, dialogs, tutorial, debug panel
src/platform    Platform interface and its web implementation
src/audio       ZzFX sound effects and music (files or procedural music box)
content         JSON game data, Zod schemas (schema.ts), personal overlay
assets          manifest.json (every art slot)
public/assets   final art, by manifest path (placeholders live in public/placeholders)
public/audio    optional music loops: public/audio/music/{spring,summer,fall,winter,menu}.ogg
scripts         placeholders, art-process, sim, manifest, content-check
tests           unit tests, save fixtures per schema version, e2e specs
```

## Deploying

### Recommended: Cloudflare Pages (free, works with private repos)

1. In the Cloudflare dashboard, go to Workers and Pages, then Create, then Pages, then "Connect to Git", and pick this repository.
2. Build settings:
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
   - Leave `BASE_PATH` unset (the app is served from `/`).
3. Production branch: `main`. Every push to `main` deploys. Pushes to any other branch (for example `dev`) get their own preview URL automatically, which is a safe place to try changes before Rachel sees them.
4. Optional: add a custom domain under the project's Custom domains tab. Not needed for v1.

`public/_headers` tells Cloudflare never to cache the service worker, so updates arrive promptly.

### Fallback: GitHub Pages

`.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`. In the repository settings, set Pages to "GitHub Actions". The site lives at `https://<user>.github.io/<repo>/`, so the workflow sets `BASE_PATH=/<repo>/` automatically. Note: GitHub Pages on a private repository needs a paid GitHub plan.

To build for a sub-path yourself: `BASE_PATH=/my-farm/ npm run build`.

### Gift build vs public build

`VITE_BUILD=gift` (the default) uses `content/personal/personal.json`: Rachel's name, the cow and chicken names, the dedication letter, easter eggs, and the family wine. `VITE_BUILD=public npm run build` swaps in `content/personal/public.json`, which has none of that. Personal data never ships in a public build.

## How Rachel installs it

1. Open the link in **Chrome** on her phone.
2. Tap the three-dot menu (top right).
3. Tap **Add to Home screen** (or **Install app**), then **Install**.
4. Open the farm from the home screen icon. It runs full screen, in portrait, and works offline after the first visit.

There is also an "Add to Home Screen" button and the same steps in Menu, Settings, Install.

## How updates work

- Push to `main`; Cloudflare rebuilds and deploys in a minute or two.
- The next time Rachel opens the game, the service worker downloads the new version in the background and shows "A new update is ready" with a Reload button. It never interrupts a mini game; it waits until the round is over.
- After reloading, Luke presents "What's new on the farm" from `content/changelog.json`. Add an entry there with each release and bump `version` in `package.json`.
- Progress is never lost: the save is versioned and migrated (see CONTENT_GUIDE.md, "Changing the save shape"). Before any migration the old save is copied to a `backup_prev` slot.

## Saves and backups

- Saved automatically to localStorage and mirrored to IndexedDB; on load the newest valid copy wins. The app asks the browser to keep storage persistent.
- Menu, Settings: **Copy save code** (compressed, checksummed text), **Import save code**, and **Download save file**. A gentle reminder to back up appears about once a month.

## Art: dropping in the final sprites

Every art slot is listed in `assets/manifest.json` with its id, path, size, frame count, and anchors. The game loads `public/<path>` when it exists and falls back to the generated placeholder otherwise; a missing file never crashes anything.

The first batch of final art (32 sprites from the Grok workspace) is already in. It was ingested at its own resolution with a rename map:

```bash
npm run art:process -- art-inbox/grok --native --map assets/grok-map.json
```

`--native` keeps the source resolution (the game fits art to each slot when drawing it), and the map renames sources to manifest ids, targets single frames (`"frame": 3` for a crop's ready stage), and can crop (the Luke and Luna portraits). Placement data for animal art (head anchor for hats, horn span, facing) is in `assets/art-meta.json`.

**What's still needed:** `ART_NEEDED.md` lists every sprite that still uses a placeholder, by priority, with the exact file name to save it as and a ready-to-run image prompt (also in `assets/art-needed.csv` for uploading to an image tool). It opens with a master prompt for Grok Build. Refresh it after each batch with `npm run art:needed`.

To ingest AI-generated art (solid magenta `#FF00FF` background, or already transparent), name each file after its manifest id and run:

```bash
npm run art:process -- path/to/inbox            # writes into public/assets/...
npm run art:process -- path/to/inbox --palette  # also snap colors to the global palette
npm run art:process -- path/to/inbox --dry      # check only
npm run content:check                           # see which slots still use placeholders
```

Multi-frame sprites can be one image with frames side by side, or separate files named `<id>_f0.png`, `<id>_f1.png`, and so on. See CONTENT_GUIDE.md for cleanup tips.

## Dev tools

Add `?debug=1` to the URL for the debug panel: time travel (minutes to a week, next Monday, next Saturday, clock going backward), force a season, grant coins and items, restore everything, force market hot items, spawn lucky critters or the tourist, simulate a 12 hour absence, reopen dialogs, and reset the save. The panel is hidden unless the parameter is present.

## Documents

- `DECISIONS.md`: every judgment call made while building, one line each
- `CONTENT_GUIDE.md`: copy-paste examples for adding crops, recipes, wines, decor, cosmetics, quests, Luke lines, season events, mini games, and Heirloom upgrades
- `ART_PROMPTS.md`: art direction and prompts for every slot, plus audio prompts
- `ASSETS_LICENSES.md`: provenance for every asset
