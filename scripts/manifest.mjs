// Builds assets/manifest.json: one entry per art slot. Content ids get slots automatically,
// so adding a crop or decor item to /content gives it an art slot with no extra work.
// Run: npm run manifest (also runs before placeholders and content:check)
import fs from 'node:fs';
import path from 'node:path';
import { formatContent } from './fmt-json.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));

export function buildManifest() {
  const crops = read('crops.json');
  const items = read('items.json');
  const recipes = read('recipes.json');
  const wines = read('wines.json');
  const buildings = read('buildings.json');
  const decor = read('decor.json');
  const cosmetics = read('cosmetics.json');
  const animals = read('animals.json');
  const out = [];
  const add = (category, id, w, h, extra = {}) => out.push({ id, category, path: `assets/${category}/${id}.png`, w, h, frames: 1, anchor: [0.5, 1], ...extra });

  // ground tiles
  for (const t of ['grass', 'grass_dark', 'meadow', 'soil', 'soil_wet', 'path', 'gravel', 'water', 'woods_floor', 'bramble', 'bramble_dense', 'fence_h', 'fence_v', 'sand', 'snow_patch', 'creek_bank'])
    add('tiles', `tile_${t}`, 32, 32, { anchor: [0, 0] });

  // crops: 4-frame growth strip (sprout, growing, budding, ready)
  for (const c of crops) add('crops', `crop_${c.id}`, 32, 32, { frames: 4, color: c.color });

  // inventory icons for everything that can be held
  for (const c of crops) add('items', `item_${c.id}`, 32, 32, { anchor: [0.5, 0.5], color: c.color });
  for (const i of items) add('items', `item_${i.id}`, 32, 32, { anchor: [0.5, 0.5], color: i.color });
  for (const r of recipes) add('items', `item_${r.id}`, 32, 32, { anchor: [0.5, 0.5], color: r.color });
  for (const w of wines) add('items', `item_${w.id}`, 32, 32, { anchor: [0.5, 0.5], color: w.labelColor });
  add('items', 'item_wine_family', 32, 32, { anchor: [0.5, 0.5], color: '#4A2B7A' });

  // buildings: three restoration stages; art is w*32 wide and h*32+16 tall (roof overhang)
  for (const b of buildings) {
    for (const stage of ['ruined', 'repair', 'restored']) {
      add('buildings', `bld_${b.id}_${stage}`, b.w * 32, b.h * 32 + 16, { anchor: [0, 1], footprint: [b.w, b.h] });
    }
  }

  // animals (2-frame idle strips)
  for (const a of animals) {
    const size = a.id === 'highland_calf' ? [36, 30] : a.kind === 'cow' ? [48, 40] : a.id === 'chick' ? [16, 16] : [24, 24];
    add('animals', `anim_${a.id}`, size[0], size[1], { frames: 2, headAnchor: a.headAnchor, hornSpan: a.hornSpan });
  }
  add('animals', 'luna_sleep', 32, 24, { frames: 2 });
  add('animals', 'luna_sit', 24, 32, { frames: 2 });
  add('animals', 'luna_walk', 32, 24, { frames: 4 });

  // people
  for (const p of ['luke', 'claire', 'andrew', 'tourist']) add('characters', `char_${p}`, 32, 48, { frames: 2 });
  for (const p of ['luke', 'claire', 'andrew', 'luna', 'rachel']) add('portraits', `portrait_${p}`, 64, 64, { anchor: [0.5, 0.5] });
  // avatar: grayscale layers tinted in code
  add('avatar', 'avatar_body', 32, 48, { frames: 2, tint: 'skin' });
  for (const c of cosmetics) {
    if (c.slot === 'avatar_hair') add('avatar', `avatar_${c.id}`, 32, 48, { frames: 2, tint: 'hair' });
    if (c.slot === 'avatar_outfit') add('avatar', `avatar_${c.id}`, 32, 48, { frames: 2, tint: 'outfit' });
    if (c.slot === 'avatar_hat' || c.slot === 'avatar_accessory') add('avatar', `avatar_${c.id}`, 32, 48, { frames: 2 });
  }

  // cosmetics: animal hats sit on headAnchor; labels are shown in the cellar
  for (const c of cosmetics) {
    if (c.slot === 'cow_hat') add('cosmetics', `cos_${c.id}`, 24, 16, { anchor: [0.5, 1], color: c.color });
    if (c.slot === 'chicken_hat') add('cosmetics', `cos_${c.id}`, 12, 10, { anchor: [0.5, 1], color: c.color });
    if (c.slot === 'animal_neck') add('cosmetics', `cos_${c.id}`, 16, 8, { anchor: [0.5, 0.5], color: c.color });
    if (c.slot === 'wine_label') add('cosmetics', `cos_${c.id}`, 48, 64, { anchor: [0.5, 0.5], color: c.color });
    if (c.slot.startsWith('building_')) add('cosmetics', `cos_${c.id}`, 32, 32, { anchor: [0.5, 0.5], color: c.color });
  }

  // decor
  for (const d of decor) add('decor', `decor_${d.id}`, d.w * 32, d.h * 32, { anchor: [0, 1], footprint: [d.w, d.h], frames: d.animated ? 2 : 1, color: d.color });

  // farm props and lucky critters
  for (const [id, w, h] of [['prop_well', 32, 40], ['prop_tree', 56, 72], ['prop_tree_apple', 52, 64], ['prop_fir', 44, 80], ['prop_brambles', 40, 38], ['prop_bush', 32, 32], ['prop_rock', 32, 24], ['prop_mailbox', 16, 32], ['prop_van', 64, 40], ['prop_sign', 32, 32], ['prop_stump', 32, 24], ['prop_haystack', 32, 32], ['prop_lamp', 16, 48]]) add('props', id, w, h);
  add('fx', 'lucky_butterfly', 16, 16, { frames: 2, anchor: [0.5, 0.5] });
  add('fx', 'lucky_blue_butterfly', 16, 16, { frames: 2, anchor: [0.5, 0.5] });
  add('fx', 'lucky_ladybug', 12, 12, { frames: 2, anchor: [0.5, 0.5] });
  for (const p of ['petal', 'leaf', 'snow', 'sparkle', 'dust', 'heart', 'water_drop']) add('fx', `fx_${p}`, 8, 8, { anchor: [0.5, 0.5] });

  // mini games
  for (const [id, w, h] of [['mg_pail', 40, 32], ['mg_note', 24, 24], ['mg_note_gold', 24, 24], ['mg_basket', 48, 32], ['mg_egg', 16, 20], ['mg_egg_gold', 16, 20], ['mg_boot', 24, 24], ['mg_feather', 16, 16], ['mg_weed', 24, 24], ['mg_weed_big', 32, 32], ['mg_sprout', 24, 24], ['mg_bg_barn', 360, 640], ['mg_bg_coop', 360, 640], ['mg_bg_field', 360, 640]]) add('minigames', id, w, h, { anchor: [0.5, 0.5] });

  // ui
  add('ui', 'ui_claires_cafe', 112, 112, { anchor: [0.5, 1] });
  for (const id of ['coin', 'ribbon', 'heirloom_seed', 'star', 'star_empty', 'heart', 'xp', 'clock', 'lock', 'check', 'luke_button', 'collect_all', 'tab_farm', 'tab_craft', 'tab_shops', 'tab_style', 'tab_menu', 'basket', 'almanac', 'journal', 'chalkboard'])
    add('ui', `ui_${id}`, 32, 32, { anchor: [0.5, 0.5] });

  // placement data for final art (head anchors, facing), kept beside the manifest
  const metaFile = path.join(root, 'assets/art-meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  for (const e of out) if (meta[e.id]) e.art = meta[e.id];
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('manifest.mjs')) {
  const m = buildManifest();
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/manifest.json'), formatContent(m) + '\n');
  console.log(`assets/manifest.json: ${m.length} art slots`);
}
