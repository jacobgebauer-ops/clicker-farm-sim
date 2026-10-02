# Asset provenance and licenses

Every asset in the game, where it came from, the tool used, its license, and the date it was added. Add a row for each new asset (one row per batch is fine when a batch shares a source).

| Asset | Path | Source | Tool | License | Date |
|---|---|---|---|---|---|
| Placeholder sprites (all manifest slots) | `public/placeholders/*.png` (generated) | Drawn procedurally by `scripts/placeholders.mjs` | Code | Project's own | 2026-10-02 |
| App icons | `public/icons/*.png` (generated) | Drawn procedurally by `scripts/placeholders.mjs` | Code | Project's own | 2026-10-02 |
| Pixelify Sans font | bundled from `@fontsource/pixelify-sans` | Stefie Justprince, via Google Fonts / Fontsource | n/a | SIL Open Font License 1.1 | 2026-10-02 |
| Sound effects | generated at runtime | ZzFX by Frank Force (`zzfx` npm package) | Code | MIT | 2026-10-02 |
| Procedural music box | generated at runtime | `src/audio/audio.ts` | Code | Project's own | 2026-10-02 |
| Game engine | npm | Phaser 3 | n/a | MIT | 2026-10-02 |
| UI library | npm | Preact | n/a | MIT | 2026-10-02 |
| Final sprites, first batch (32 images: barn, coop, farmhouse, greenhouse, Claire's cafe, Highland cow and calf, hen, chick, Luke, Luna, pumpkin, strawberry, lavender, apple, maple and fir trees, brambles, well, wooden fence, beach umbrella, giant candy corn, Luna's bed, Christmas tree, candy egg tree, four hats, blackberry jam, milk, blackberry wine) | `public/assets/**` (mapping in `assets/grok-map.json`) | AI generated in a Grok workspace, supplied by the project owner | Grok image generation, then `npm run art:process -- --native --map assets/grok-map.json` | Owner-generated; check xAI's terms for generated images before any public release | 2026-10-02 |
| Final sprites, second batch (93 images, the priority 1 list: 16 ground tiles, the ready stage of 33 crops, 6 restored buildings, the rooster, Luna sleeping and walking, Andrew, Claire, and the tourist with portraits of Andrew, Claire, and Rachel, 8 farm props, and 21 interface icons; the vertical fence tile is not used) | `public/assets/**` (names match the manifest; cleanup in `assets/art-fixes.json`) | AI generated in a Grok workspace, supplied by the project owner; holes left by the generator's background removal were refilled by `art:process` (Claire's blouse repainted pink to match her portrait) | Grok image generation, then `npm run art:process -- --native` | Owner-generated; check xAI's terms for generated images before any public release | 2026-10-02 |
| Luke and Luna portraits | `public/assets/portraits/*.png` | Cropped from the Luke and Luna sprites above | `art:process` crop | Same as above | 2026-10-02 |

## Template

| Asset | Path | Source | Tool | License | Date |
|---|---|---|---|---|---|
| e.g. Highland cow sprite | `public/assets/animals/anim_highland_cow.png` | AI generated, cleaned up by hand | Grok image + Aseprite | Check the generator's terms; note any restrictions | YYYY-MM-DD |

Before any public release, review the IP status of AI-generated assets and the terms of each generator used.
