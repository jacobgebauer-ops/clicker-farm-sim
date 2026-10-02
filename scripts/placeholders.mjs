// Generates placeholder PNGs for every art slot in assets/manifest.json.
// They are simple, labeled, and colored by category so the game is fully playable before
// final art exists. Real art in /public/assets/<path> always wins over these.
// Run: npm run placeholders   (writes public/placeholders/<id>.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, hex, shade, PLUM, noise, hashStr } from './pixel.mjs';
import { buildManifest } from './manifest.mjs';
import { formatContent } from './fmt-json.mjs';

// fileURLToPath (not URL.pathname) so Windows drive letters resolve correctly
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/placeholders');
const CAT = {
  tiles: '#7FC46A', crops: '#5DBB63', items: '#E3B04B', buildings: '#B33A3A', animals: '#B5651D', characters: '#2F5BD3',
  portraits: '#7B4FB5', avatar: '#9AA3AD', cosmetics: '#FF6FA5', decor: '#37D4D0', props: '#6FAF5A', fx: '#FFF1A8', minigames: '#B48AE0', ui: '#7B4FB5',
};
const WHITE = [255, 255, 255, 255];
const CREAM = hex('#FFF6DD');

function drawTile(c, id) {
  const r = noise(hashStr(id));
  const base = {
    tile_grass: '#8EDB7E', tile_grass_dark: '#6BC266', tile_meadow: '#A5D96E', tile_soil: '#9A6B47', tile_soil_wet: '#6E4A32', tile_path: '#D8C3A0',
    tile_gravel: '#BDB6AA', tile_water: '#5BBCE6', tile_woods_floor: '#4F7A4A', tile_bramble: '#4B6B3A', tile_bramble_dense: '#3A5530', tile_sand: '#F5DFA6',
    tile_snow_patch: '#F4FBFF', tile_creek_bank: '#9C8B63', tile_fence_h: '#00000000', tile_fence_v: '#00000000',
  }[id] ?? '#8EDB7E';
  if (id === 'tile_fence_h' || id === 'tile_fence_v') {
    const wood = hex('#C9A27A');
    if (id === 'tile_fence_h') {
      c.rect(0, 12, 32, 3, wood);
      c.rect(0, 20, 32, 3, wood);
      c.rect(3, 8, 4, 20, shade(wood, -0.1));
      c.rect(25, 8, 4, 20, shade(wood, -0.1));
    } else {
      c.rect(12, 0, 3, 32, wood);
      c.rect(18, 0, 3, 32, wood);
    }
    return;
  }
  const col = hex(base);
  c.rect(0, 0, 32, 32, col);
  for (let i = 0; i < 40; i++) c.set(Math.floor(r() * 32), Math.floor(r() * 32), shade(col, r() < 0.5 ? -0.12 : 0.12));
  if (id === 'tile_soil' || id === 'tile_soil_wet') for (let y = 4; y < 32; y += 8) c.rect(2, y, 28, 2, shade(col, -0.2));
  if (id === 'tile_water') for (let i = 0; i < 6; i++) c.rect(Math.floor(r() * 26), Math.floor(r() * 30), 5, 1, shade(col, 0.4));
  if (id.startsWith('tile_bramble')) {
    const n = id.endsWith('dense') ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const x = 4 + r() * 24;
      const y = 4 + r() * 24;
      c.circle(x, y, 3 + r() * 3, shade(hex('#2E5A2A'), r() * 0.2));
      c.set(x + 2, y - 1, hex('#3B1F4F'));
      c.set(x - 2, y + 1, hex('#5E2E8C'));
    }
    for (let i = 0; i < 6; i++) c.line(r() * 32, r() * 32, r() * 32, r() * 32, hex('#5A3A2A'));
  }
  if (id === 'tile_grass' || id === 'tile_meadow') for (let i = 0; i < 3; i++) {
    const x = Math.floor(r() * 28) + 2;
    const y = Math.floor(r() * 28) + 2;
    c.set(x, y, shade(col, -0.25));
    c.set(x + 1, y - 1, shade(col, -0.25));
  }
}

function drawCrop(c, color, frame, id) {
  const ox = 0;
  const leaf = hex('#3F9F4A');
  const col = hex(color);
  const flower = /tulip|sunflower|lavender/.test(id);
  const tree = /apple|pear|plum|cherry|quince/.test(id);
  if (frame === 0) {
    c.rect(ox + 15, 24, 2, 5, leaf);
    c.rect(ox + 12, 23, 3, 2, leaf);
    c.rect(ox + 17, 22, 3, 2, leaf);
    return;
  }
  const h = [0, 10, 16, 20][frame];
  if (tree) {
    c.rect(ox + 14, 30 - h, 4, h, hex('#8A5A34'));
    c.circle(ox + 16, 30 - h, 4 + frame * 2.5, shade(leaf, -0.05));
    if (frame === 3) for (const [dx, dy] of [[-5, -2], [4, -4], [0, 3], [6, 2], [-3, -7]]) c.circle(ox + 16 + dx, 30 - h + dy, 2, col);
    return;
  }
  c.rect(ox + 15, 30 - h, 2, h, leaf);
  for (let i = 0; i < frame + 1; i++) {
    c.ellipse(ox + 12, 29 - i * 5, 3, 1.6, leaf);
    c.ellipse(ox + 20, 27 - i * 5, 3, 1.6, leaf);
  }
  if (frame === 2) c.circle(ox + 16, 30 - h, 2, shade(col, 0.3));
  if (frame === 3) {
    if (flower) {
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) c.circle(ox + 16 + dx, 10 + dy, 2.5, col);
      c.circle(ox + 16, 10, 1.5, hex('#FFD93B'));
    } else {
      c.circle(ox + 16, 11, 5, col);
      c.circle(ox + 14, 9, 1.5, shade(col, 0.45));
    }
  }
}

function drawItem(c, id, color) {
  const col = hex(color ?? '#E3B04B');
  if (id.startsWith('item_wine')) {
    c.rect(14, 4, 4, 6, hex('#2E1A47'));
    c.ellipse(16, 20, 7, 10, hex('#3A2160'));
    c.rect(10, 16, 12, 9, col);
    c.rect(12, 18, 8, 1, WHITE);
    c.rect(12, 21, 6, 1, WHITE);
    c.rect(11, 12, 2, 6, [255, 255, 255, 120]);
  } else if (/lumber|fencing/.test(id)) {
    for (let i = 0; i < 3; i++) c.rect(5, 9 + i * 6, 22, 5, shade(col, -i * 0.08));
  } else if (/barrel/.test(id)) {
    c.ellipse(16, 17, 10, 12, col);
    c.rect(6, 10, 20, 2, hex('#5A5F73'));
    c.rect(6, 22, 20, 2, hex('#5A5F73'));
  } else if (/bottle|glass|nails|paint|sugar|flour/.test(id)) {
    c.rect(8, 8, 16, 18, col);
    c.rect(8, 8, 16, 4, shade(col, -0.2));
  } else if (/milk/.test(id)) {
    c.rect(10, 8, 12, 18, CREAM);
    c.rect(12, 5, 8, 4, hex('#9AA3AD'));
  } else if (/egg/.test(id)) {
    c.ellipse(16, 17, 8, 10, col);
    c.circle(13, 13, 2, shade(col, 0.5));
  } else {
    c.circle(16, 16, 10, col);
    c.circle(12, 12, 3, shade(col, 0.4));
    c.rect(15, 3, 2, 4, hex('#3F9F4A'));
  }
  c.outline();
  c.label(id.replace(/^item_/, '').replace(/_/g, ' '));
}

const BUILDING_STYLE = {
  farmhouse: ['#FFF1DE', '#5A5F73'], kitchen: ['#FFE9C9', '#B33A3A'], coop: ['#FFF6DD', '#C2552B'], barn: ['#B33A3A', '#5A5F73'],
  market_stall: ['#FFFFFF', '#7B4FB5'], honor_box: ['#C9A27A', '#7B4FB5'], winery: ['#C8B9D9', '#4A2B7A'], greenhouse: ['#BFE8FF', '#E6F6FF'],
  hive: ['#F2B33D', '#C9A13B'], county_fair: ['#FFFFFF', '#E5384F'],
};

function drawBuilding(c, id) {
  const m = /^bld_(.+)_(ruined|repair|restored)$/.exec(id);
  const [bid, stage] = [m[1], m[2]];
  const [wallHex, roofHex] = BUILDING_STYLE[bid] ?? ['#E0D0B0', '#7B4FB5'];
  let wall = hex(wallHex);
  let roof = hex(roofHex);
  if (stage === 'ruined') {
    wall = shade([150, 140, 130, 255], -0.1);
    roof = [110, 100, 105, 255];
  }
  const W = c.w;
  const H = c.h;
  const wallTop = Math.floor(H * 0.45);
  if (bid === 'market_stall' || bid === 'county_fair') {
    // striped canopy tent
    c.rect(4, wallTop, W - 8, H - wallTop - 2, shade(wall, -0.05));
    for (let x = 0; x < W; x += 8) c.rect(x, wallTop - 14, 4, 16, stage === 'ruined' ? roof : hex(roofHex));
    for (let x = 4; x < W; x += 8) c.rect(x, wallTop - 14, 4, 16, stage === 'ruined' ? shade(roof, 0.2) : WHITE);
    c.rect(4, H - 14, W - 8, 4, hex('#8A5A34'));
  } else if (bid === 'greenhouse') {
    c.rect(2, wallTop - 6, W - 4, H - wallTop + 4, [191, 232, 255, stage === 'ruined' ? 120 : 210]);
    for (let x = 2; x < W; x += 10) c.rect(x, wallTop - 6, 2, H - wallTop + 4, hex('#E6F6FF'));
    c.tri(2, wallTop - 6, W / 2, 6, W - 2, wallTop - 6, [230, 246, 255, 200]);
  } else if (bid === 'hive') {
    for (let i = 0; i < 4; i++) c.rect(6, H - 10 - i * 8, W - 12, 7, shade(wall, i % 2 ? -0.1 : 0));
    c.rect(4, H - 42, W - 8, 4, roof);
  } else {
    c.rect(2, wallTop, W - 4, H - wallTop, wall);
    for (let y = wallTop + 4; y < H; y += 6) c.rect(2, y, W - 4, 1, shade(wall, -0.08));
    c.tri(-2, wallTop + 1, W / 2, 4, W + 2, wallTop + 1, roof);
    c.rect(0, wallTop - 2, W, 3, shade(roof, -0.2));
    const dw = Math.max(8, Math.floor(W / 6));
    c.rect(Math.floor(W / 2 - dw / 2), H - 18, dw, 18, bid === 'barn' ? WHITE : hex('#7B4FB5'));
    if (bid === 'barn') {
      c.line(W / 2 - dw / 2, H - 18, W / 2 + dw / 2, H - 1, hex('#B33A3A'));
      c.line(W / 2 + dw / 2, H - 18, W / 2 - dw / 2, H - 1, hex('#B33A3A'));
    }
    if (W >= 64) for (const x of [8, W - 20]) {
      c.rect(x, wallTop + 8, 12, 10, hex('#BFE8FF'));
      c.rect(x + 5, wallTop + 8, 2, 10, WHITE);
    }
  }
  if (stage === 'ruined') {
    const r = noise(hashStr(id));
    for (let i = 0; i < 6; i++) c.circle(r() * W, wallTop + r() * 10, 3 + r() * 4, [60, 50, 60, 255]);
    for (let i = 0; i < Math.floor(W / 6); i++) {
      const x = r() * W;
      c.circle(x, H - 4 - r() * 6, 4 + r() * 3, hex('#2E5A2A'));
      c.set(x + 1, H - 6, hex('#5E2E8C'));
    }
  }
  if (stage === 'repair') {
    const wood = hex('#8A5A34');
    for (let x = 4; x < W; x += 14) c.rect(x, wallTop - 10, 2, H - wallTop + 10, wood);
    for (let y = wallTop; y < H; y += 12) c.rect(0, y, W, 2, wood);
  }
  c.outline();
  c.label(`${bid} ${stage}`);
}

function drawAnimal(c, id, frame) {
  const ox = 0;
  const bob = frame % 2;
  if (id === 'anim_highland_cow') {
    const fur = hex('#B5651D');
    c.ellipse(ox + 22, 22 + bob, 16, 10, fur);
    for (let i = 0; i < 10; i++) c.rect(ox + 8 + i * 3, 28 + bob, 2, 4, shade(fur, -0.15));
    for (const lx of [10, 16, 28, 34]) c.rect(ox + lx, 30, 3, 9, shade(fur, -0.3));
    c.ellipse(ox + 39, 15 + bob, 7, 7, fur);
    c.rect(ox + 34, 10 + bob, 11, 5, shade(fur, 0.15));
    c.line(ox + 33, 9 + bob, ox + 28, 4 + bob, CREAM);
    c.line(ox + 45, 9 + bob, ox + 47, 3 + bob, CREAM);
    c.rect(ox + 38, 19 + bob, 5, 3, hex('#E8A08A'));
  } else if (id === 'anim_hen' || id === 'anim_rooster') {
    const body = id === 'anim_hen' ? hex('#FFFFFF') : hex('#C2552B');
    c.ellipse(ox + 12, 15 + bob, 8, 6, body);
    c.circle(ox + 17, 8 + bob, 4, body);
    c.rect(ox + 16, 3 + bob, 3, 2, hex('#E5384F'));
    c.rect(ox + 21, 8 + bob, 2, 2, hex('#FFB000'));
    if (id === 'anim_rooster') for (let i = 0; i < 3; i++) c.rect(ox + 2 + i, 6 + i * 2 + bob, 3, 2, hex(['#2E8B57', '#2F5BD3', '#7B4FB5'][i]));
    c.rect(ox + 10, 21, 1, 3, hex('#FFB000'));
    c.rect(ox + 14, 21, 1, 3, hex('#FFB000'));
  } else if (id === 'anim_chick') {
    c.circle(ox + 8, 9 + bob, 5, hex('#FFE066'));
    c.rect(ox + 12, 8 + bob, 2, 1, hex('#FFB000'));
  } else {
    // Luna: black cat
    const black = hex('#1E1626');
    if (id === 'luna_sit') {
      c.ellipse(ox + 12, 22, 7, 9, black);
      c.circle(ox + 12, 11, 6, black);
      c.tri(ox + 6, 8, ox + 8, 2, ox + 10, 7, black);
      c.tri(ox + 14, 7, ox + 16, 2, ox + 18, 8, black);
      c.rect(ox + 9, 10, 2, 2, hex('#C8E86A'));
      c.rect(ox + 13, 10, 2, 2, hex('#C8E86A'));
    } else {
      c.ellipse(ox + 15, 17, 12, 6 + bob * 0.5, black);
      c.circle(ox + 25, 14, 5, black);
      c.tri(ox + 21, 11, ox + 22, 6, ox + 24, 10, black);
      c.tri(ox + 26, 10, ox + 28, 6, ox + 29, 11, black);
      c.line(ox + 3, 18, ox + 1, 12, black);
      if (id === 'luna_sleep') c.text('z', ox + 27 + bob, 1, hex('#B48AE0'));
      else c.rect(ox + 24, 13, 2, 1, hex('#C8E86A'));
    }
    c.outline(hex('#4A2B7A'));
    return;
  }
  c.outline();
}

function drawPerson(c, id, frame) {
  const ox = 0;
  const bob = frame % 2;
  const style = {
    char_luke: { skin: '#C68A5A', hair: '#5A3A22', shirt: '#F5DFA6', pants: '#3E64D8', hat: '#2F5BD3' },
    char_claire: { skin: '#F1C7A5', hair: '#C9A13B', shirt: '#FFB7D5', pants: '#7B4FB5', apron: '#FFFFFF' },
    char_andrew: { skin: '#E0A982', hair: '#8A8A8A', shirt: '#B33A3A', pants: '#5A4A3A', beard: '#8A8A8A' },
    char_tourist: { skin: '#F1C7A5', hair: '#2B1B3D', shirt: '#37D4D0', pants: '#F5DFA6', hat: '#FFD93B' },
    avatar_body: { skin: '#D0D0D0' },
  }[id] ?? { skin: '#F1C7A5', hair: '#7A4A2A', shirt: '#7B4FB5', pants: '#4A2B7A' };
  if (id.startsWith('avatar_') && id !== 'avatar_body') {
    // grayscale overlay layers (tinted in game)
    const g = hex('#C8C8C8');
    if (id.includes('hair')) {
      c.rect(ox + 9, 6 + bob, 14, 6, g);
      if (/long|braid|curls/.test(id)) c.rect(ox + 8, 10 + bob, 4, 14, g);
      if (/long|curls/.test(id)) c.rect(ox + 20, 10 + bob, 4, 14, g);
      if (/bun|ponytail/.test(id)) c.circle(ox + 16, 4 + bob, 3, g);
    } else if (id.includes('outfit')) {
      c.rect(ox + 9, 22 + bob, 14, 13, g);
      c.rect(ox + 10, 35, 12, 9, shade(g, -0.2));
    } else if (id.includes('hat') && !id.endsWith('none')) {
      const m = /visor|sun/.test(id) ? hex('#E3C065') : /santa|witch/.test(id) ? hex('#E5384F') : hex('#B48AE0');
      c.rect(ox + 7, 5 + bob, 18, 3, m);
      c.rect(ox + 10, 1 + bob, 12, 5, m);
    } else if (id.includes('acc') && !id.endsWith('none')) {
      c.rect(ox + 22, 26 + bob, 6, 6, hex('#B48AE0'));
    }
    return;
  }
  const skin = hex(style.skin);
  c.rect(ox + 10, 22 + bob, 12, 14, hex(style.shirt ?? '#D0D0D0'));
  if (style.apron) c.rect(ox + 12, 26 + bob, 8, 10, hex(style.apron));
  c.rect(ox + 11, 36, 4, 10, hex(style.pants ?? '#A0A0A0'));
  c.rect(ox + 17, 36, 4, 10, hex(style.pants ?? '#A0A0A0'));
  c.circle(ox + 16, 13 + bob, 7, skin);
  if (style.hair) {
    c.rect(ox + 9, 6 + bob, 14, 5, hex(style.hair));
    if (id === 'char_luke') for (let i = 0; i < 5; i++) c.circle(ox + 10 + i * 3, 8 + bob, 2, hex(style.hair));
  }
  if (style.beard) c.rect(ox + 11, 16 + bob, 10, 5, hex(style.beard));
  if (style.hat) {
    c.rect(ox + 8, 6 + bob, 16, 3, hex(style.hat));
    c.rect(ox + 10, 2 + bob, 12, 5, hex(style.hat));
  }
  c.rect(ox + 13, 12 + bob, 2, 2, PLUM);
  c.rect(ox + 18, 12 + bob, 2, 2, PLUM);
  c.outline();
}

function drawPortrait(c, id) {
  const bg = { portrait_luke: '#2F5BD3', portrait_claire: '#C2477A', portrait_andrew: '#8A5A34', portrait_luna: '#4A2B7A', portrait_rachel: '#7B4FB5' }[id];
  c.rect(0, 0, 64, 64, hex(bg));
  c.rect(2, 2, 60, 60, shade(hex(bg), 0.25));
  const person = new Canvas(64, 48);
  if (id === 'portrait_luna') drawAnimal(person, 'luna_sit', 0);
  else drawPerson(person, `char_${id.split('_')[1]}`, 0);
  // scale 2x the head area
  for (let y = 0; y < 30; y++) for (let x = 0; x < 32; x++) {
    const px = person.get(x, y);
    if (px[3]) c.rect(x * 2, 6 + y * 2, 2, 2, px);
  }
}

function drawGeneric(c, id, color, catColor) {
  const col = hex(color ?? catColor);
  const W = c.w;
  const H = c.h;
  if (id.startsWith('decor_') && /tree|topiary|fir/.test(id)) {
    c.tri(W / 2, 2, 2, H - 8, W - 2, H - 8, col);
    c.rect(W / 2 - 2, H - 8, 4, 8, hex('#8A5A34'));
  } else if (/fence|path|arch|bunting|lights/.test(id)) {
    c.rect(1, Math.floor(H / 2) - 3, W - 2, 6, col);
    for (let x = 2; x < W; x += 8) c.rect(x, Math.floor(H / 2) - 7, 3, 14, shade(col, -0.15));
  } else {
    c.rect(2, 2, W - 4, H - 4, col);
    c.rect(2, 2, W - 4, 3, shade(col, 0.3));
    c.rect(2, H - 5, W - 4, 3, shade(col, -0.25));
  }
  c.outline();
  if (W >= 16 && H >= 12) c.label(id.replace(/^(decor|cos|prop|mg|ui|fx|lucky)_/, '').replace(/_/g, ' '));
}

function drawUi(c, id) {
  const name = id.replace('ui_', '');
  const draw = {
    coin: () => { c.circle(16, 16, 12, hex('#FFC21F')); c.circle(16, 16, 9, hex('#FFD93B')); c.rect(15, 10, 3, 12, hex('#E3A21F')); },
    ribbon: () => { c.tri(10, 18, 6, 31, 15, 26, hex('#2F5BD3')); c.tri(22, 18, 26, 31, 17, 26, hex('#2F5BD3')); c.circle(16, 13, 10, hex('#3E64D8')); c.circle(16, 13, 6, hex('#9AD7FF')); },
    heirloom_seed: () => { c.ellipse(16, 18, 7, 10, hex('#C9A13B')); c.rect(15, 4, 2, 6, hex('#3F9F4A')); c.ellipse(20, 6, 4, 2, hex('#3F9F4A')); },
    star: () => { c.tri(16, 3, 9, 28, 23, 28, hex('#FFD93B')); c.tri(3, 12, 29, 12, 16, 22, hex('#FFD93B')); },
    star_empty: () => { c.tri(16, 3, 9, 28, 23, 28, hex('#5A4A6A')); c.tri(3, 12, 29, 12, 16, 22, hex('#5A4A6A')); },
    heart: () => { c.circle(11, 12, 6, hex('#E5384F')); c.circle(21, 12, 6, hex('#E5384F')); c.tri(5, 14, 27, 14, 16, 27, hex('#E5384F')); },
    xp: () => { c.circle(16, 16, 12, hex('#7B4FB5')); c.text('xp', 12, 14, WHITE); },
    clock: () => { c.circle(16, 16, 12, WHITE); c.line(16, 16, 16, 8, PLUM); c.line(16, 16, 21, 18, PLUM); },
    lock: () => { c.rect(8, 14, 16, 14, hex('#C9A13B')); c.rect(11, 6, 3, 9, hex('#9AA3AD')); c.rect(18, 6, 3, 9, hex('#9AA3AD')); c.rect(11, 5, 10, 3, hex('#9AA3AD')); },
    tab_farm: () => { c.rect(4, 18, 24, 10, hex('#9A6B47')); c.rect(4, 18, 24, 2, hex('#6E4A32')); c.rect(9, 10, 2, 9, hex('#3F9F4A')); c.circle(10, 9, 4, hex('#FF8A1F')); c.rect(20, 12, 2, 7, hex('#3F9F4A')); c.ellipse(21, 11, 4, 2, hex('#5DBB63')); },
    tab_craft: () => { c.ellipse(16, 20, 12, 8, hex('#5A5F73')); c.rect(4, 14, 24, 6, hex('#7A8090')); c.rect(13, 4, 2, 8, hex('#C9C9C9')); c.rect(18, 6, 2, 6, hex('#C9C9C9')); c.rect(26, 14, 5, 3, hex('#5A5F73')); },
    tab_shops: () => { c.rect(5, 12, 22, 16, hex('#FFF6DD')); for (let x = 3; x < 29; x += 6) { c.rect(x, 6, 3, 8, hex('#7B4FB5')); c.rect(x + 3, 6, 3, 8, WHITE); } c.rect(12, 18, 8, 10, hex('#8A5A34')); },
    tab_style: () => { c.rect(6, 18, 20, 4, hex('#7B4FB5')); c.rect(10, 8, 12, 11, hex('#7B4FB5')); c.rect(10, 15, 12, 2, hex('#FFD93B')); c.circle(22, 9, 3, hex('#FFB7D5')); },
    tab_menu: () => { c.rect(7, 5, 18, 23, hex('#4F7A4A')); c.rect(9, 5, 2, 23, hex('#2E5A2A')); for (let y = 10; y < 24; y += 5) c.rect(13, y, 9, 2, hex('#FFF6DD')); },
    basket: () => { c.ellipse(16, 21, 12, 8, hex('#C9925A')); c.rect(4, 16, 24, 4, hex('#A0703F')); c.line(6, 16, 16, 5, hex('#A0703F')); c.line(26, 16, 16, 5, hex('#A0703F')); c.circle(12, 15, 3, hex('#E5384F')); c.circle(19, 14, 3, hex('#FFD93B')); },
    journal: () => { c.rect(6, 4, 20, 25, hex('#7B4FB5')); c.rect(8, 6, 16, 21, hex('#FFF6DD')); for (let y = 10; y < 25; y += 4) c.rect(10, y, 12, 1, hex('#B48AE0')); c.rect(20, 4, 3, 10, hex('#E5384F')); },
    almanac: () => { c.rect(5, 6, 22, 22, hex('#4F7A4A')); c.rect(7, 8, 18, 18, hex('#6FAF5A')); c.circle(16, 15, 5, hex('#FFD93B')); c.rect(5, 26, 22, 2, hex('#FFF6DD')); },
    chalkboard: () => { c.rect(4, 4, 24, 20, hex('#8A5A34')); c.rect(6, 6, 20, 16, hex('#2F3B33')); c.rect(9, 10, 12, 1, WHITE); c.rect(9, 14, 9, 1, WHITE); c.rect(8, 24, 2, 6, hex('#8A5A34')); c.rect(22, 24, 2, 6, hex('#8A5A34')); },
    collect_all: () => { c.ellipse(16, 21, 12, 8, hex('#C9925A')); c.circle(11, 14, 4, hex('#FF8A1F')); c.circle(18, 13, 4, hex('#E5384F')); c.circle(15, 9, 3, hex('#F5E6C8')); },
    luke_button: () => { c.circle(16, 16, 13, hex('#2F5BD3')); c.text('?', 15, 13, WHITE); },
    check: () => { c.line(7, 16, 13, 23, hex('#2E8B57')); c.line(13, 23, 25, 8, hex('#2E8B57')); c.line(7, 17, 13, 24, hex('#2E8B57')); c.line(13, 24, 25, 9, hex('#2E8B57')); },
  }[name];
  if (draw) {
    draw();
    c.outline();
  } else drawGeneric(c, id, null, CAT.ui);
}

function drawFx(c, id, frame) {
  const ox = 0;
  const map = {
    fx_petal: () => c.ellipse(4, 4, 3, 2, hex('#FFB7D5')),
    fx_leaf: () => c.ellipse(4, 4, 3, 2, hex('#FF8A1F')),
    fx_snow: () => c.circle(4, 4, 2.5, WHITE),
    fx_sparkle: () => { c.rect(3, 0, 2, 8, hex('#FFF1A8')); c.rect(0, 3, 8, 2, hex('#FFF1A8')); },
    fx_dust: () => c.circle(4, 4, 2, [220, 200, 170, 200]),
    fx_heart: () => { c.circle(2.5, 3, 2, hex('#E5384F')); c.circle(5.5, 3, 2, hex('#E5384F')); c.tri(0.5, 4, 7.5, 4, 4, 8, hex('#E5384F')); },
    fx_water_drop: () => c.ellipse(4, 5, 2, 3, hex('#5BBCE6')),
  };
  if (map[id]) return map[id]();
  if (id.includes('butterfly')) {
    const col = id.includes('blue') ? hex('#3E64D8') : hex('#FFC21F');
    const spread = frame ? 3 : 6;
    c.ellipse(ox + 8 - spread / 2, 7, spread / 2 + 1, 5, col);
    c.ellipse(ox + 8 + spread / 2, 7, spread / 2 + 1, 5, col);
    c.rect(ox + 7, 4, 2, 9, PLUM);
  } else {
    c.circle(ox + 6, 6, 5, hex('#E5384F'));
    c.rect(ox + 6, 1, 1, 10, PLUM);
    c.set(ox + 4, 5, PLUM);
    c.set(ox + 8, 7, PLUM);
    c.circle(ox + 6, 2, 2, PLUM);
  }
}

function drawCosmetic(c, id, color) {
  const col = hex(color);
  if (c.w === 48) {
    c.rect(0, 0, 48, 64, CREAM);
    c.rect(3, 3, 42, 58, col);
    c.rect(7, 20, 34, 24, CREAM);
    c.outline();
    c.label(id.replace('cos_label_', ''));
    return;
  }
  if (c.h <= 10) {
    c.rect(1, 3, c.w - 2, c.h - 3, col);
    c.rect(Math.floor(c.w / 2) - 2, 0, 4, 4, shade(col, 0.2));
  } else if (c.w === 16) {
    c.rect(0, 2, 16, 4, col);
    c.circle(8, 6, 2, shade(col, 0.3));
  } else if (c.w === 24) {
    c.rect(1, 12, 22, 3, col);
    c.rect(5, 4, 14, 9, col);
    c.rect(5, 10, 14, 2, shade(col, -0.3));
  } else {
    c.rect(2, 2, c.w - 4, c.h - 4, col);
  }
  c.outline();
}

function drawMinigame(c, id) {
  const W = c.w;
  const H = c.h;
  if (id.startsWith('mg_bg')) {
    const top = { mg_bg_barn: '#F2D6A2', mg_bg_coop: '#BDE6FF', mg_bg_field: '#BDE6FF' }[id];
    c.rect(0, 0, W, H, hex(top));
    c.rect(0, Math.floor(H * 0.75), W, H, hex(id === 'mg_bg_barn' ? '#C9925A' : '#8EDB7E'));
    if (id === 'mg_bg_barn') for (let x = 0; x < W; x += 24) c.rect(x, 0, 2, H * 0.75, hex('#D9B783'));
    return;
  }
  const draw = {
    mg_pail: () => { c.rect(6, 8, 28, 22, hex('#AEB7C0')); c.rect(6, 8, 28, 4, hex('#FFFFFF')); c.line(6, 8, 20, 1, PLUM); c.line(34, 8, 20, 1, PLUM); },
    mg_note: () => { c.circle(12, 12, 9, hex('#B48AE0')); c.circle(12, 12, 5, hex('#FFFFFF')); },
    mg_note_gold: () => { c.circle(12, 12, 9, hex('#FFD93B')); c.circle(12, 12, 5, hex('#FFFFFF')); },
    mg_basket: () => { c.rect(4, 12, 40, 18, hex('#C9925A')); for (let x = 6; x < 44; x += 6) c.rect(x, 12, 2, 18, hex('#A0703F')); c.rect(2, 10, 44, 4, hex('#A0703F')); },
    mg_egg: () => c.ellipse(8, 10, 6, 8, hex('#F5E6C8')),
    mg_egg_gold: () => { c.ellipse(8, 10, 6, 8, hex('#FFD93B')); c.set(6, 6, WHITE); },
    mg_boot: () => { c.rect(6, 2, 10, 16, hex('#6E4A32')); c.rect(6, 16, 16, 6, hex('#6E4A32')); },
    mg_feather: () => { c.line(2, 14, 14, 2, hex('#FFFFFF')); c.ellipse(9, 7, 3, 6, hex('#F0F0F0')); },
    mg_weed: () => { c.tri(12, 2, 6, 22, 18, 22, hex('#6B8E23')); c.tri(4, 8, 2, 22, 10, 22, hex('#556B2F')); c.tri(20, 8, 14, 22, 22, 22, hex('#556B2F')); },
    mg_weed_big: () => { c.tri(16, 2, 6, 30, 26, 30, hex('#556B2F')); c.tri(4, 10, 2, 30, 12, 30, hex('#6B8E23')); c.tri(28, 10, 20, 30, 30, 30, hex('#6B8E23')); },
    mg_sprout: () => { c.rect(11, 10, 2, 12, hex('#3F9F4A')); c.ellipse(8, 10, 4, 2, hex('#5DBB63')); c.ellipse(16, 8, 4, 2, hex('#5DBB63')); c.circle(12, 6, 3, hex('#FF8A1F')); },
  }[id];
  if (draw) {
    draw();
    c.outline();
  } else drawGeneric(c, id, null, CAT.minigames);
}

function drawProp(c, id) {
  const W = c.w;
  const H = c.h;
  const draw = {
    prop_well: () => { c.rect(4, 22, 24, 16, hex('#9AA3AD')); c.rect(4, 22, 24, 3, hex('#BDB6AA')); c.rect(6, 4, 3, 20, hex('#8A5A34')); c.rect(23, 4, 3, 20, hex('#8A5A34')); c.tri(2, 6, 16, -2, 30, 6, hex('#7B4FB5')); },
    prop_tree: () => { c.rect(W / 2 - 3, H * 0.55, 6, H * 0.45, hex('#8A5A34')); c.circle(W / 2, H * 0.4, W * 0.42, hex('#E3842B')); c.circle(W * 0.38, H * 0.32, W * 0.15, hex('#F2A33D')); },
    prop_tree_apple: () => { c.rect(W / 2 - 3, H * 0.55, 6, H * 0.45, hex('#8A5A34')); c.circle(W / 2, H * 0.4, W * 0.42, hex('#4FA36A')); for (const [dx, dy] of [[-8, -6], [6, -10], [0, 4], [10, 2], [-10, 6]]) c.circle(W / 2 + dx, H * 0.4 + dy, 2.5, hex('#E5384F')); },
    prop_fir: () => { c.rect(W / 2 - 2, H - 12, 4, 12, hex('#6E4A32')); c.tri(W / 2, 0, 2, H - 10, W - 2, H - 10, hex('#1F6B45')); c.tri(W / 2, 0, W * 0.25, H * 0.45, W * 0.75, H * 0.45, hex('#2E8B57')); },
    prop_brambles: () => { const r = noise(7); for (let i = 0; i < 9; i++) { const x = 6 + r() * (W - 12); const y = 8 + r() * (H - 14); c.circle(x, y, 5 + r() * 3, hex('#2E5A2A')); c.set(x + 2, y - 1, hex('#3B1F4F')); } },
    prop_bush: () => { c.circle(16, 20, 11, hex('#4FA36A')); c.circle(11, 16, 4, hex('#6BC266')); },
    prop_rock: () => { c.ellipse(16, 15, 13, 8, hex('#9AA3AD')); c.ellipse(12, 12, 5, 2, hex('#C7D0D8')); },
    prop_mailbox: () => { c.rect(7, 14, 2, 18, hex('#8A5A34')); c.rect(2, 6, 12, 9, hex('#7B4FB5')); c.rect(13, 4, 2, 5, hex('#E5384F')); },
    prop_van: () => { c.rect(2, 10, 58, 22, hex('#FFB7D5')); c.rect(40, 4, 20, 10, hex('#FFB7D5')); c.rect(44, 6, 12, 7, hex('#BFE8FF')); c.circle(14, 34, 5, PLUM); c.circle(48, 34, 5, PLUM); c.text('cafe', 10, 17, hex('#7B4FB5')); },
    prop_sign: () => { c.rect(14, 14, 4, 18, hex('#8A5A34')); c.rect(2, 4, 28, 12, hex('#C9A27A')); },
    prop_stump: () => { c.ellipse(16, 14, 12, 8, hex('#8A5A34')); c.ellipse(16, 11, 10, 5, hex('#C9A27A')); },
    prop_haystack: () => { c.ellipse(16, 20, 14, 11, hex('#E3C065')); c.ellipse(13, 15, 5, 3, hex('#F5DFA6')); },
    prop_lamp: () => { c.rect(7, 10, 2, 38, hex('#5A5F73')); c.rect(3, 2, 10, 9, hex('#FFF1A8')); },
  }[id];
  if (draw) {
    draw();
    c.outline();
  } else drawGeneric(c, id, null, CAT.props);
}

export function drawEntry(e) {
  const c = new Canvas(e.w * e.frames, e.h);
  for (let f = 0; f < e.frames; f++) {
    const frame = new Canvas(e.w, e.h);
    switch (e.category) {
      case 'tiles': drawTile(frame, e.id); break;
      case 'crops': drawCrop(frame, e.color, f, e.id); frame.outline(); break;
      case 'items': drawItem(frame, e.id, e.color); break;
      case 'buildings': drawBuilding(frame, e.id); break;
      case 'animals': drawAnimal(frame, e.id, f); break;
      case 'characters': case 'avatar': drawPerson(frame, e.id, f); break;
      case 'portraits': drawPortrait(frame, e.id); break;
      case 'cosmetics': drawCosmetic(frame, e.id, e.color); break;
      case 'fx': drawFx(frame, e.id, f); break;
      case 'minigames': drawMinigame(frame, e.id); break;
      case 'props': drawProp(frame, e.id); break;
      case 'ui': drawUi(frame, e.id); break;
      default: drawGeneric(frame, e.id, e.color, CAT[e.category] ?? '#B48AE0');
    }
    // animated decor: second frame bobs one pixel
    const dy = e.category === 'decor' && f === 1 ? -1 : 0;
    c.blit(frame, f * e.w, dy);
  }
  return c;
}

if (process.argv[1] && process.argv[1].endsWith('placeholders.mjs')) {
  const manifest = buildManifest();
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/manifest.json'), formatContent(manifest) + '\n');
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const e of manifest) {
    const canvas = drawEntry(e);
    fs.writeFileSync(path.join(outDir, `${e.id}.png`), canvas.toPNG());
    n++;
  }
  writeIcons();
  console.log(`placeholders: wrote ${n} PNGs to public/placeholders`);
}

/** App icons for the PWA manifest: a purple tile with a Highland cow face. */
function writeIcons() {
  const dir = path.join(root, 'public/icons');
  fs.mkdirSync(dir, { recursive: true });
  for (const size of [192, 512]) {
    const base = new Canvas(64, 64);
    base.rect(0, 0, 64, 64, hex('#7B4FB5'));
    base.circle(32, 34, 26, hex('#B48AE0'));
    const fur = hex('#B5651D');
    base.ellipse(32, 36, 15, 14, fur);
    base.line(18, 26, 8, 14, hex('#FFF6DD'));
    base.line(19, 27, 9, 15, hex('#FFF6DD'));
    base.line(46, 26, 56, 14, hex('#FFF6DD'));
    base.line(45, 27, 55, 15, hex('#FFF6DD'));
    base.rect(20, 22, 24, 9, shade(fur, 0.15));
    for (let x = 20; x < 44; x += 3) base.rect(x, 28, 2, 4, shade(fur, 0.25));
    base.ellipse(32, 44, 8, 5, hex('#E8A08A'));
    base.rect(28, 43, 2, 2, PLUM);
    base.rect(34, 43, 2, 2, PLUM);
    const out = new Canvas(size, size);
    const k = size / 64;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) out.rect(Math.floor(x * k), Math.floor(y * k), Math.ceil(k), Math.ceil(k), base.get(x, y));
    // only fill in missing icons, so hand-made icons dropped in later are never overwritten
    for (const name of [`icon-${size}.png`, `maskable-${size}.png`]) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) fs.writeFileSync(file, out.toPNG());
    }
  }
}
