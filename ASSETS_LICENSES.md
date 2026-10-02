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

## Template

| Asset | Path | Source | Tool | License | Date |
|---|---|---|---|---|---|
| e.g. Highland cow sprite | `public/assets/animals/anim_highland_cow.png` | AI generated, cleaned up by hand | Grok image + Aseprite | Check the generator's terms; note any restrictions | YYYY-MM-DD |

Before any public release, review the IP status of AI-generated assets and the terms of each generator used.
