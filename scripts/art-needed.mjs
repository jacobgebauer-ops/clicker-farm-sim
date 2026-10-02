// Writes ART_NEEDED.md and assets/art-needed.csv: every art slot that still uses a placeholder,
// with the file name to save it as and a ready-to-run image prompt.
// Run: npm run art:needed   (re-run after each batch of art)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(fs.readFileSync(`${root}/assets/manifest.json`, 'utf8'));
const read = (f) => JSON.parse(fs.readFileSync(`${root}/content/${f}.json`, 'utf8'));
const names = {};
for (const f of ['crops', 'items', 'recipes', 'wines', 'decor', 'cosmetics', 'buildings', 'animals']) for (const x of read(f)) names[x.id] = x.name;
const has = (p) => fs.existsSync(`${root}/public/${p}`);
const frameHas = (p, f) => fs.existsSync(`${root}/public/${p.replace(/\.png$/, `_f${f}.png`)}`);
const shape = (w, h) => (w === h ? 'square' : w > h ? `wide ${+(w / h).toFixed(2)}:1` : `tall 1:${+(h / w).toFixed(2)}`);

const extra = {
  tile_grass: 'grass ground tile, seamless', tile_grass_dark: 'darker grass tile, seamless', tile_meadow: 'meadow grass with tiny flowers, seamless',
  tile_soil: 'tilled garden soil with furrows, seamless', tile_soil_wet: 'watered (darker) tilled soil, seamless', tile_path: 'dirt path, seamless',
  tile_gravel: 'gravel, seamless', tile_water: 'creek water, seamless', tile_woods_floor: 'forest floor with needles and moss, seamless',
  tile_bramble: 'overgrown blackberry bramble ground, seamless', tile_bramble_dense: 'very dense bramble ground, seamless',
  tile_fence_h: 'horizontal fence segment (transparent background)', tile_fence_v: 'fence running up and down the screen, seen from the 3/4 top-down view: one wooden post at the bottom center with the rails running straight up from it toward the top edge, so stacked pieces form a continuous vertical fence line (not a side-on fence)',
  tile_sand: 'beach sand, seamless', tile_snow_patch: 'patch of snow (transparent edges)', tile_creek_bank: 'muddy, grassy creek bank, seamless',
  luna_sleep: 'Luna curled up asleep (old black cat)', luna_walk: 'Luna walking, side view (up to 4 frames)', anim_rooster: 'rooster, colorful tail',
  char_claire: 'Claire, warm slightly bossy cafe owner, blonde bob, pink blouse, white apron', char_andrew: 'Andrew, gruff friendly store owner, gray beard, red flannel, suspenders',
  char_tourist: 'city tourist, sun hat, camera, turquoise shirt', portrait_claire: 'Claire head and shoulders', portrait_andrew: 'Andrew head and shoulders',
  portrait_rachel: 'Rachel head and shoulders (long brown hair, purple overalls, straw sun hat)',
  avatar_body: 'player body, GRAYSCALE (tinted in game)', prop_bush: 'round green bush', prop_rock: 'mossy rock', prop_mailbox: 'purple farm mailbox on a post',
  prop_van: "Claire's pink cafe delivery van", prop_sign: 'wooden signpost', prop_stump: 'tree stump', prop_haystack: 'haystack', prop_lamp: 'old lamp post',
  lucky_butterfly: 'golden butterfly (2 frames: wings open, wings closed)', lucky_blue_butterfly: 'blue morpho butterfly (2 frames)', lucky_ladybug: 'ladybug (2 frames)',
  fx_petal: 'pink blossom petal (tiny)', fx_leaf: 'orange autumn leaf (tiny)', fx_snow: 'snowflake (tiny)', fx_sparkle: 'yellow sparkle (tiny)', fx_dust: 'dust puff (tiny)',
  fx_heart: 'small heart (tiny)', fx_water_drop: 'water drop (tiny)',
  mg_pail: 'metal milk pail', mg_note: 'round purple rhythm note', mg_note_gold: 'golden rhythm note', mg_basket: 'woven egg basket',
  mg_egg: 'white egg', mg_egg_gold: 'golden egg', mg_boot: 'old muddy boot', mg_feather: 'white feather', mg_weed: 'small weed', mg_weed_big: 'big overgrown weed',
  mg_sprout: 'garden sprout with a small orange bud', mg_bg_barn: 'mini game background: inside a cozy barn (portrait, middle kept clear)',
  mg_bg_coop: 'mini game background: outside the coop, sunny sky (portrait)', mg_bg_field: 'mini game background: garden bed from above (portrait)',
};
const ui = { coin: 'gold coin', ribbon: 'blue prize ribbon rosette', heirloom_seed: 'golden heirloom seed', star: 'yellow star', star_empty: 'empty (gray) star', heart: 'red heart',
  xp: 'XP badge', clock: 'clock', lock: 'padlock', check: 'green check mark', luke_button: 'round blue "?" button', collect_all: 'harvest basket full of produce',
  tab_farm: 'tab icon: little garden bed', tab_craft: 'tab icon: cooking pot', tab_shops: 'tab icon: shop stall', tab_style: 'tab icon: hat', tab_menu: 'tab icon: book',
  basket: 'gift basket', almanac: 'farmers almanac book', journal: 'season journal book', chalkboard: 'cafe chalkboard' };

function describe(e) {
  const id = e.id;
  if (extra[id]) return extra[id];
  if (id.startsWith('ui_')) return ui[id.slice(3)] ?? id;
  if (id.startsWith('bld_')) { const [, b, st] = /^bld_(.+)_(ruined|repair|restored)$/.exec(id); return `${names[b]}: ${st === 'repair' ? 'under repair (scaffolding)' : st}`; }
  if (id.startsWith('item_')) return names[id.slice(5)] ?? id.slice(5);
  if (id.startsWith('decor_')) return names[id.slice(6)] ?? id;
  if (id.startsWith('cos_')) return names[id.slice(4)] ?? id;
  if (id.startsWith('avatar_')) return `${names[id.slice(7)] ?? id.slice(7)} (avatar layer${/hair|outfit/.test(id) ? ', GRAYSCALE, tinted in game' : ''})`;
  if (id.startsWith('anim_')) return names[id.slice(5)] ?? id;
  return id;
}

const BLD = {
  kitchen: 'a small summer kitchen cottage with a brick chimney and a window box',
  market_stall: 'a farmers market stall with a purple and white striped canopy and a wooden counter',
  honor_box: 'a tiny roadside farm stand with a little wooden coin box and a hand-painted sign',
  winery: 'an old stone and timber winery with purple trim, a round door, and oak barrels by the entrance',
  hive: 'three white wooden beehives on a small stand with a few flowers',
  county_fair: 'a red and white striped county fair tent with pennant flags',
  farmhouse: 'a two-story cream farmhouse with a wraparound porch', barn: 'a big red gambrel barn', coop: 'a small red and white chicken coop with a ramp', greenhouse: 'a wood and glass greenhouse',
};
const ROOF = { cow_hat: 'a hat for a Highland cow, front view, no animal, sized to sit between two horns', chicken_hat: 'a tiny hat for a chicken, front view, no animal', animal_neck: 'neckwear for a farm animal (scarf, bell, or lei), front view, no animal' };
function promptFor(e, desc, file) {
  const id = e.id;
  const cos = id.startsWith('cos_') ? read('cosmetics').find((c) => `cos_${c.id}` === id) : null;
  let subject;
  const TILE = { tile_grass: 'short bright green grass', tile_grass_dark: 'slightly darker green grass', tile_meadow: 'meadow grass with tiny white and yellow flowers', tile_soil: 'tilled garden soil with neat furrows', tile_soil_wet: 'freshly watered tilled soil (darker and a little shiny)', tile_path: 'a packed dirt path', tile_gravel: 'gravel', tile_water: 'clear creek water with small ripples', tile_woods_floor: 'forest floor with fir needles and moss', tile_bramble: 'overgrown Himalayan blackberry brambles with thorny canes and dark berries', tile_bramble_dense: 'very dense blackberry brambles with almost no ground showing', tile_sand: 'warm beach sand', tile_creek_bank: 'a muddy, grassy creek bank' };
  if (e.category === 'tiles') subject = TILE[id] ? `a seamless, tileable ground texture of ${TILE[id]}, viewed straight down, filling the whole square edge to edge with no border` : id === 'tile_snow_patch' ? 'a soft irregular patch of snow on the ground, viewed from above' : `a short ${id.endsWith('_h') ? 'horizontal' : 'vertical'} section of rustic wooden fence, matching the wooden fence sprite`;
  else if (e.category === 'crops') {
    const f = Number(/_f(\d)\.png$/.exec(file)[1]);
    const name = names[id.slice(5)];
    subject = f === 3 ? `a ${name.toLowerCase()} plant fully grown and ready to harvest, growing from a small diamond-shaped patch of tilled soil (same framing as the pumpkin and strawberry sprites)` : `a ${name.toLowerCase()} plant at growth stage ${f + 1} of 4 (${['a tiny sprout with two leaves', 'a young leafy plant', 'a bigger plant with buds, nearly ready'][f]}), on the same small diamond-shaped soil patch`;
  } else if (e.category === 'buildings') {
    const [, b, st] = /^bld_(.+)_(ruined|repair|restored)$/.exec(id);
    const base = BLD[b] ?? names[b];
    subject = st === 'restored' ? `${base}, freshly restored, bright and welcoming, same 3/4 angle as the barn and farmhouse` : st === 'ruined' ? `${base}, abandoned and weathered, gray wood, holes in the roof, blackberry brambles growing up the walls, cozy not spooky` : `${base}, under repair with wooden scaffolding, fresh planks mixed with old ones`;
  } else if (e.category === 'items') subject = `an inventory icon of ${desc.toLowerCase().startsWith('wine') || /wine|blush|perry|velvet|reserve/i.test(desc) ? `a bottle of ${desc} (wine bottle with a purple-themed label)` : desc.toLowerCase()}, one object, chunky and readable at small size`;
  else if (e.category === 'decor') subject = `${desc.toLowerCase()}, a garden decoration for a cozy farm`;
  else if (cos && ROOF[cos.slot]) subject = `${desc.toLowerCase()}: ${ROOF[cos.slot]}`;
  else if (cos?.slot === 'wine_label') subject = `a vintage wine bottle label design, "${desc}" style, purple accents, blank space in the middle for a name, flat front view`;
  else if (cos) subject = `a small square swatch showing ${desc.toLowerCase()} (${cos.slot.replace('building_', 'building ')} sample)`;
  else if (e.category === 'avatar') {
    const n = desc.replace(/ \(.*\)$/, '').toLowerCase();
    const what = id === 'avatar_body' ? 'the base body of a woman farmer character (head, arms, legs, simple underclothes), no hair' : id.includes('hair') ? `a "${n}" hairstyle on its own (no head)` : id.includes('outfit') ? `a "${n}" outfit on its own (no body)` : `a "${n}" on its own`;
    subject = `${what}, drawn as a separate paper-doll layer that lines up exactly over the same 32x48-shaped body, front view${/GRAYSCALE/.test(desc) ? ', in GRAYSCALE ONLY because the game recolors it' : ''}`;
  }
  else if (e.category === 'characters') subject = `${desc}, full body, standing, front 3/4 view, same style and scale as the Luke sprite`;
  else if (e.category === 'portraits') subject = `${desc}, friendly expression, framed like the Luke portrait`;
  else if (e.category === 'minigames' && id.startsWith('mg_bg')) subject = `${desc}, tall portrait scene, soft and simple so game pieces stand out`;
  else subject = desc;
  return `16-bit SNES-era pixel art, cozy farm game, matching the existing sprites (dark plum #2B1B3D outlines, bright cheerful colors, crisp pixels, no anti-aliasing, no text): ${subject}. ${e.category === 'tiles' && !/fence|snow/.test(id) ? 'Square image.' : `Single sprite centered on a solid magenta #FF00FF background, ${shape(e.w, e.h)} framing.`}`;
}

const rows = [];
const add = (prio, group, file, desc, e) => rows.push({ prio, group, file, desc, shape: shape(e.w, e.h), prompt: promptFor(e, desc, file) });
for (const e of m) {
  const file = e.path.split('/').pop();
  if (e.category === 'crops') {
    const name = names[e.id.slice(5)];
    if (!frameHas(e.path, 3) && !has(e.path)) add(1, 'Crops: ready to harvest', file.replace('.png', '_f3.png'), `${name}, fully grown and ready to harvest (on a small soil patch)`, e);
    for (const f of [0, 1, 2]) if (!frameHas(e.path, f) && !has(e.path)) add(3, 'Crops: growth stages', file.replace('.png', `_f${f}.png`), `${name}, ${['tiny sprout', 'young plant', 'budding, almost ready'][f]}`, e);
    continue;
  }
  if (has(e.path)) continue;
  const id = e.id;
  let prio = 2, group = 'Other';
  if (e.category === 'tiles') { prio = 1; group = 'Ground tiles'; }
  else if (e.category === 'buildings') { if (id.endsWith('_restored')) { prio = 1; group = 'Buildings: restored'; } else { prio = 3; group = 'Buildings: ruined and under repair (optional; currently drawn from the restored art)'; } }
  else if (['animals', 'characters', 'portraits'].includes(e.category)) { prio = 1; group = 'Characters and animals'; }
  else if (e.category === 'props') { prio = 1; group = 'Farm props'; }
  else if (e.category === 'ui') { prio = 1; group = 'UI icons'; }
  else if (e.category === 'items') { prio = 2; group = 'Items (inventory icons)'; }
  else if (e.category === 'decor') { prio = 2; group = 'Decor'; }
  else if (e.category === 'cosmetics') { prio = 2; group = id.includes('label') ? 'Wine labels' : id.includes('paint') || id.includes('roof') || id.includes('skin') ? 'Building paint, roof and trim swatches' : 'Hats and neckwear'; }
  else if (e.category === 'avatar') { prio = 3; group = 'Avatar layers'; }
  else if (e.category === 'minigames') { prio = 3; group = 'Mini games'; }
  else if (e.category === 'fx') { prio = 3; group = 'Effects and lucky critters'; }
  add(prio, group, file, describe(e), e);
}

const P = { 1: 'Priority 1: seen on every visit', 2: 'Priority 2: shops, inventory, and collections', 3: 'Priority 3: polish' };
let md = `# Sprites still needed\n\nGenerated from \`assets/manifest.json\` by \`npm run art:needed\`. ${rows.length} images to go; ${m.filter((e) => has(e.path)).length} slots already have final art. The same list, with prompts, is in \`assets/art-needed.csv\` for uploading.\n\n`;
md += `## Master prompt for Grok Build\n\nUpload \`assets/art-needed.csv\` and a few of the finished sprites (the barn, the Highland cow, Luke, the pumpkin) as style references, then paste this. Run it once per priority (change "priority 1" to 2, then 3) so each batch stays a manageable size.\n\n\`\`\`text\nYou are making pixel art sprites for "Selleck Homestead", a cozy farm game. The attached sprites are finished art from this game: match their style exactly (16-bit SNES-era pixel art, 3/4 top-down view, dark plum #2B1B3D outlines, bright cheerful colors, crisp pixels, no anti-aliasing, no text or watermarks).\n\nThe attached CSV lists every sprite still needed. For each row where priority is 1:\n1. Generate one image from the "prompt" column. One sprite per image, centered, on a solid magenta #FF00FF background (tiles fill the whole square instead).\n2. Keep the framing close to the "shape" column (square, wide, or tall).\n3. Leave the solid magenta background in place; do not cut it out or make it transparent (background removal tends to erase pink, red, and purple parts of the sprite, and the game's own tools remove the exact magenta cleanly). Save each image as a PNG named exactly as in the "file" column. Do not rename files.\n4. Keep every sprite at the same pixel scale as the reference sprites, so a cow, a hen, and a barn look right next to each other.\n\nPut all the PNGs in one folder called sprites, add a contact sheet image showing them together, and give me the folder as a zip. If a row is unclear, make your best guess rather than skipping it.\n\`\`\`\n\nAfter it finishes, unzip into \`art-inbox/<batch>\` and run \`npm run art:process -- art-inbox/<batch> --native\`, or send the zip and I will drop it in.\n\nTips:\n- Crops: the ready stage (\`_f3\`) matters most; the sprout stages (\`_f0\` to \`_f2\`) can wait.\n- Avatar layers have to line up perfectly as paper-doll layers, which image generators struggle with. Leave them for last, or skip them; the placeholders work fine.\n- Buildings only need the restored stage; ruined and under-repair versions are already drawn from it.\n\n`;
md += `## How to deliver them\n\n- Save each image with the exact **file name** below (PNG). Then they drop in with no renaming:\n  \`npm run art:process -- <folder> --native\`\n- Solid magenta \`#FF00FF\` background, left in place (no background removal: it erases pinks and reds inside the sprite). One sprite per image, centered, nothing else in frame.\n- Any resolution is fine (the game fits art to its spot), but keep the **shape** close to what is listed. Match the style of the first batch: 16-bit pixel art, 3/4 top-down, dark plum outlines.\n- Tiles marked "seamless" must tile edge to edge.\n- Items marked GRAYSCALE are recolored by the game; draw them in grays only.\n\n`;
for (const p of [1, 2, 3]) {
  const pr = rows.filter((r) => r.prio === p);
  md += `## ${P[p]} (${pr.length})\n\n`;
  const groups = [...new Set(pr.map((r) => r.group))];
  for (const g of groups) {
    const gr = pr.filter((r) => r.group === g);
    md += `### ${g} (${gr.length})\n\n`;
    for (const r of gr) md += `- **\`${r.file}\`** (${r.shape}): ${r.desc}\n  > ${r.prompt.replace(/\|/g, '/')}\n`;
    md += '\n';
  }
}
fs.writeFileSync(`${root}/ART_NEEDED.md`, md);
// machine-readable copy to upload to Grok Build
const csv = ['priority,file,shape,description,prompt', ...rows.map((r) => [r.prio, r.file, r.shape, r.desc, r.prompt].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
fs.writeFileSync(`${root}/assets/art-needed.csv`, csv);
console.log(`ART_NEEDED.md: ${rows.length} sprites still needed (priority 1: ${rows.filter((r) => r.prio === 1).length}, 2: ${rows.filter((r) => r.prio === 2).length}, 3: ${rows.filter((r) => r.prio === 3).length})`);
