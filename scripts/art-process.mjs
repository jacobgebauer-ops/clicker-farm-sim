// Turns raw AI-generated images into game-ready sprites.
//
//   npm run art:process -- <inboxDir> [--native] [--map map.json] [--palette] [--dry] [--tolerance 60]
//
// File names must match a manifest id: `crop_pumpkin.png`, or one file per frame
// (`anim_hen_f0.png`, `anim_hen_f1.png`). PNG and JPG are supported.
//
// --native keeps the source resolution (trim only, no downscale). The game fits final art to
// each slot's footprint at draw time, so detailed art keeps its detail. Single-frame files
// named `<id>_f<n>` become per-frame overrides (for example only the ready stage of a crop).
// --map points at a JSON list that renames sources and can crop them:
//   [{ "src": "pumpkin_s3", "id": "crop_pumpkin", "frame": 3 },
//    { "src": "luke", "id": "portrait_luke", "crop": [0, 0, 45, 45] }]
// Steps per image: key out the solid magenta (#FF00FF) background, trim, downscale with
// nearest-neighbor (majority color per block) to the manifest size, optionally snap to the
// global palette, then write public/assets/<path>. Warnings flag non-integer scale ratios
// and stray anti-aliased edge pixels, which usually need a quick cleanup in Aseprite or Pixelorama.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { Canvas } from './pixel.mjs';
import { buildManifest } from './manifest.mjs';

// fileURLToPath (not URL.pathname) so Windows drive letters resolve correctly
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const inbox = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--map' && args[i - 1] !== '--tolerance');
const usePalette = args.includes('--palette');
const dry = args.includes('--dry');
const tol = Number(args[args.indexOf('--tolerance') + 1]) || 60;
const native = args.includes('--native');
const mapFile = args.includes('--map') ? args[args.indexOf('--map') + 1] : null;

const PALETTE = [
  '#2B1B3D', '#7B4FB5', '#B48AE0', '#4A2B7A', '#9FE3C0', '#FFB7D5', '#FFF1A8', '#9AD7FF', '#37D4D0', '#FFD93B', '#FF7F6B', '#F5DFA6',
  '#FF8A1F', '#FFD43B', '#FFF6DD', '#6E3A8C', '#BFE8FF', '#E5384F', '#FFFFFF', '#2E8B57', '#8EDB7E', '#6BC266', '#4FA36A', '#3F9F4A',
  '#B5651D', '#8A5A34', '#C9925A', '#6E4A32', '#9AA3AD', '#5A5F73', '#1E1626', '#F1C7A5', '#C68A5A', '#B33A3A', '#2F5BD3', '#5BBCE6',
].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

function decode(file) {
  const buf = fs.readFileSync(file);
  if (/\.jpe?g$/i.test(file)) {
    const img = jpeg.decode(buf, { useTArray: true });
    const c = new Canvas(img.width, img.height);
    c.data = new Uint8ClampedArray(img.data);
    return c;
  }
  return Canvas.fromPNG(buf);
}

function isKey([r, g, b, a]) {
  if (a < 16) return true;
  // close to magenta: high red and blue, low green
  return Math.abs(r - 255) + g + Math.abs(b - 255) < tol;
}

function keyOut(c) {
  let fringe = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const px = c.get(x, y);
    const i = (y * c.w + x) * 4;
    if (isKey(px)) c.data[i + 3] = 0;
    else if (px[0] > 180 && px[2] > 180 && px[1] < 120) fringe++; // pinkish halo from anti-aliasing
  }
  return fringe;
}

/**
 * Edge pixels that were anti-aliased against the magenta key come out dark magenta and read
 * as a pink halo in game. Recolor them to the outline plum. Only pixels touching transparency
 * with a red/blue balance close to magenta are touched, so real purples (blue heavy) survive.
 */
function defringe(c) {
  const src = c.data.slice();
  const clear = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || src[(y * c.w + x) * 4 + 3] === 0;
  let n = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const i = (y * c.w + x) * 4;
    if (src[i + 3] === 0) continue;
    if (!clear(x - 1, y) && !clear(x + 1, y) && !clear(x, y - 1) && !clear(x, y + 1)) continue;
    const [r, g, b] = [src[i], src[i + 1], src[i + 2]];
    const lo = Math.min(r, b);
    if (lo < 40 || g > lo * 0.3 || Math.abs(r - b) > Math.max(r, b) * 0.25) continue;
    c.data[i] = 0x2b; c.data[i + 1] = 0x1b; c.data[i + 2] = 0x3d;
    n++;
  }
  return n;
}

/**
 * Some generators key out pink and red shades inside a sprite along with the magenta
 * background, leaving see-through seams (van panels, pea flowers, a rooster's belly).
 * Enclosed transparent regions up to `max` pixels are filled from their edges inward
 * with a slightly darkened blend of the surrounding colors. Real gaps (a lock shackle,
 * easel legs) are kept by listing only damaged sprites in assets/art-fixes.json.
 * `color` (with `shade` next to the outline) repaints holes in a known color instead, for
 * areas whose color was lost entirely (pink flowers, red ornaments). When a whole area was
 * keyed out and its outline is broken, `rows: [y0, y1]` also repaints every transparent
 * pixel between the leftmost and rightmost opaque pixel of those rows.
 */
function fillHoles(c, fix) {
  const { max = 0, rows, color, shade } = typeof fix === 'number' ? { max: fix } : fix;
  const W = c.w, H = c.h, N = W * H;
  const clear = (i) => c.data[i * 4 + 3] === 0;
  const nb4 = (i) => { const x = i % W, y = (i / W) | 0; return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1].filter((k) => k >= 0); };
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const paint = (writes) => {
    for (const [j, [r, g, b]] of writes) {
      c.data[j * 4] = r; c.data[j * 4 + 1] = g; c.data[j * 4 + 2] = b; c.data[j * 4 + 3] = 255;
    }
    return writes.length;
  };
  let filled = 0;
  if (rows && color) {
    const base = rgb(color);
    const edge = shade ? rgb(shade) : base;
    const writes = [];
    const span = (y) => {
      let a = W, b = -1;
      for (let x = 0; x < W; x++) if (!clear(y * W + x)) { a = Math.min(a, x); b = x; }
      return [a, b];
    };
    // the neighbor rows bridge short breaks in the outline (a shoulder line with a gap)
    const ys = [];
    for (let y = Math.max(0, rows[0]); y <= Math.min(H - 1, rows[1]); y++) ys.push(y);
    const spans = new Map(ys.map((y) => [y, span(y)]));
    for (const y of ys) {
      const near = [y - 1, y, y + 1].filter((v) => spans.has(v)).map((v) => spans.get(v));
      const x0 = Math.min(...near.map((n) => n[0]));
      const x1 = Math.max(...near.map((n) => n[1]));
      for (let x = x0 + 1; x1 >= 0 && x < x1; x++) {
        const j = y * W + x;
        if (clear(j)) writes.push([j, nb4(j).some((k) => !clear(k)) ? edge : base]);
      }
    }
    filled += paint(writes);
  }
  const outside = new Uint8Array(N);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || !clear(i)) continue;
    outside[i] = 1;
    stack.push(...nb4(i));
  }
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!clear(i) || outside[i] || seen[i]) continue;
    const comp = [];
    const q = [i];
    seen[i] = 1;
    while (q.length) {
      const j = q.pop();
      comp.push(j);
      for (const k of nb4(j)) if (clear(k) && !outside[k] && !seen[k]) { seen[k] = 1; q.push(k); }
    }
    if (comp.length > max) continue;
    if (color) {
      const base = rgb(color);
      const edge = shade ? rgb(shade) : base;
      filled += paint(comp.map((j) => [j, nb4(j).some((k) => !clear(k)) ? edge : base]));
      continue;
    }
    let todo = comp;
    while (todo.length) {
      const next = [];
      const writes = [];
      for (const j of todo) {
        const x = j % W, y = (j / W) | 0;
        const acc = [0, 0, 0];
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if ((dx || dy) && xx >= 0 && yy >= 0 && xx < W && yy < H && !clear(yy * W + xx)) {
            const k = (yy * W + xx) * 4;
            acc[0] += c.data[k]; acc[1] += c.data[k + 1]; acc[2] += c.data[k + 2];
            n++;
          }
        }
        if (n) writes.push([j, acc.map((v) => Math.round((v / n) * 0.85))]);
        else next.push(j);
      }
      if (!writes.length) break;
      filled += paint(writes);
      todo = next;
    }
  }
  return filled;
}

/** Per-sprite cleanup settings: { "fillHoles": { "prop_van": 400, "crop_*": 40, "char_claire": { "max": 40, "rows": [31, 65], "color": "#E77287" } } }. */
const fixesFile = path.join(root, 'assets/art-fixes.json');
const FIXES = fs.existsSync(fixesFile) ? JSON.parse(fs.readFileSync(fixesFile, 'utf8')) : {};
function fixFor(kind, id) {
  const table = FIXES[kind] ?? {};
  if (id in table) return table[id];
  const glob = Object.keys(table).find((k) => k.endsWith('*') && id.startsWith(k.slice(0, -1)));
  return glob ? table[glob] : undefined;
}

function bbox(c) {
  let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.data[(y * c.w + x) * 4 + 3] > 0) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function nearestPalette([r, g, b, a]) {
  let best = PALETTE[0];
  let bd = Infinity;
  for (const p of PALETTE) {
    const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = p; }
  }
  return [best[0], best[1], best[2], a];
}

/** Downscale a trimmed region into tw x th using the majority color of each source block. */
function downscale(src, box, tw, th, warnings, label) {
  const scale = Math.min(tw / box.w, th / box.h);
  const ratio = 1 / scale;
  if (Math.abs(ratio - Math.round(ratio)) > 0.05) warnings.push(`${label}: non-integer scale ratio ${ratio.toFixed(2)} (source ${box.w}x${box.h} -> ${tw}x${th}); edges may look uneven`);
  const ow = Math.max(1, Math.round(box.w * scale));
  const oh = Math.max(1, Math.round(box.h * scale));
  const out = new Canvas(tw, th);
  const offX = Math.floor((tw - ow) / 2);
  const offY = th - oh; // anchor bottom so sprites stand on the ground
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx0 = box.x + Math.floor(x * ratio);
    const sy0 = box.y + Math.floor(y * ratio);
    const sx1 = Math.max(sx0 + 1, box.x + Math.floor((x + 1) * ratio));
    const sy1 = Math.max(sy0 + 1, box.y + Math.floor((y + 1) * ratio));
    const counts = new Map();
    let transparent = 0;
    let total = 0;
    for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++) {
      const px = src.get(xx, yy);
      total++;
      if (px[3] < 128) { transparent++; continue; }
      const k = ((px[0] >> 3) << 10) | ((px[1] >> 3) << 5) | (px[2] >> 3);
      const e = counts.get(k) ?? { n: 0, px };
      e.n++;
      counts.set(k, e);
    }
    if (transparent * 2 > total || !counts.size) continue;
    let best = null;
    for (const e of counts.values()) if (!best || e.n > best.n) best = e;
    let px = [best.px[0], best.px[1], best.px[2], 255];
    if (usePalette) px = nearestPalette(px);
    out.set(offX + x, offY + y, px);
  }
  return out;
}

function strayPixels(c) {
  // opaque pixels with no opaque 4-neighbors usually come from anti-aliasing noise
  let n = 0;
  const op = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && c.data[(y * c.w + x) * 4 + 3] > 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (op(x, y) && !op(x - 1, y) && !op(x + 1, y) && !op(x, y - 1) && !op(x, y + 1)) n++;
  return n;
}

function cropCanvas(src, [x, y, w, h]) {
  const out = new Canvas(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.set(xx, yy, src.get(x + xx, y + yy));
  return out;
}

/** Key, trim, and write at source resolution. `frame` writes a per-frame override file. */
function writeNative(e, src, frame, warnings, label) {
  const fringe = keyOut(src);
  if (fringe > 20) warnings.push(`${label}: ${fringe} pinkish anti-aliased pixels survived the magenta key`);
  defringe(src);
  const holeFix = fixFor('fillHoles', e.id);
  if (holeFix) {
    const n = fillHoles(src, holeFix);
    if (n) console.log(`  ${label}: filled ${n} see-through pixel(s) inside the sprite`);
  }
  const box = bbox(src);
  if (!box) {
    warnings.push(`${label}: image is empty after keying`);
    return null;
  }
  // ground tiles sit on a fixed 32 px grid, so they are downscaled properly instead of kept native;
  // paper-doll avatar layers keep their full canvas so every layer still lines up
  let out = e.category === 'tiles' ? downscale(src, box, e.w, e.h, warnings, label) : e.category === 'avatar' ? src : cropCanvas(src, [box.x, box.y, box.w, box.h]);
  if (usePalette) for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3]) {
    const p = nearestPalette([out.data[i], out.data[i + 1], out.data[i + 2], 255]);
    out.data[i] = p[0]; out.data[i + 1] = p[1]; out.data[i + 2] = p[2];
  }
  const stray = strayPixels(out);
  if (stray > 3) warnings.push(`${label}: ${stray} stray single pixels (anti-aliasing noise); clean up in a pixel editor`);
  const rel = frame === null || frame === undefined ? e.path : e.path.replace(/\.png$/, `_f${frame}.png`);
  const dest = path.join(root, 'public', rel);
  if (!dry) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, out.toPNG());
  }
  console.log(`${dry ? '[dry] ' : ''}${label} -> public/${rel} (${out.w}x${out.h}, native)`);
  return out;
}

function findSource(name) {
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const f = path.join(inbox, name + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function runMap(manifest) {
  const entries = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const warnings = [];
  let written = 0;
  for (const m of entries) {
    const e = manifest.get(m.id);
    const file = findSource(m.src);
    if (!e) { warnings.push(`${m.src}: no manifest id "${m.id}"`); continue; }
    if (!file) { warnings.push(`${m.src}: source not found in ${inbox}`); continue; }
    if (FIXES.skip?.[m.id]) { console.log(`skip ${m.src}: ${FIXES.skip[m.id]}`); continue; }
    let src = decode(file);
    if (m.crop) src = cropCanvas(src, m.crop);
    const label = `${m.src} as ${m.id}${m.frame !== undefined ? ` frame ${m.frame}` : ''}`;
    if (native) {
      if (writeNative(e, src, m.frame ?? null, warnings, label)) written++;
      continue;
    }
    keyOut(src);
    const box = bbox(src);
    if (!box) continue;
    const out = downscale(src, box, e.w, e.h, warnings, label);
    const rel = m.frame !== undefined ? e.path.replace(/\.png$/, `_f${m.frame}.png`) : e.path;
    if (!dry) {
      fs.mkdirSync(path.dirname(path.join(root, 'public', rel)), { recursive: true });
      fs.writeFileSync(path.join(root, 'public', rel), out.toPNG());
    }
    console.log(`${dry ? '[dry] ' : ''}${label} -> public/${rel} (${e.w}x${e.h})`);
    written++;
  }
  for (const w of warnings) console.warn(`warn ${w}`);
  console.log(`\nart:process: ${written} sprite(s) ${dry ? 'checked' : 'written'}, ${warnings.length} warning(s).`);
  if (written) console.log('Remember to add a line to ASSETS_LICENSES.md for each new asset (source, tool, license, date).');
}

function main() {
  if (!inbox || !fs.existsSync(inbox)) {
    console.error('Usage: npm run art:process -- <inboxDir> [--palette] [--dry] [--tolerance 60]');
    process.exit(1);
  }
  const manifest = new Map(buildManifest().map((e) => [e.id, e]));
  if (mapFile) return runMap(manifest);
  const files = fs.readdirSync(inbox).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  const groups = new Map();
  const unknown = [];
  for (const f of files) {
    const base = f.replace(/\.(png|jpe?g)$/i, '');
    const m = /^(.*)_f(\d)$/.exec(base);
    const id = m && manifest.has(m[1]) ? m[1] : base;
    if (!manifest.has(id)) { unknown.push(f); continue; }
    if (FIXES.skip?.[id]) { console.log(`skip ${f}: ${FIXES.skip[id]}`); continue; }
    const g = groups.get(id) ?? [];
    g[m && manifest.has(m[1]) ? Number(m[2]) : 0] = path.join(inbox, f);
    groups.set(id, g);
  }
  const warnings = [];
  let written = 0;
  for (const [id, frames] of groups) {
    const e = manifest.get(id);
    if (native) {
      // whole image as the base art, or individual `_f<n>` files as per-frame overrides
      frames.forEach((file, f) => {
        if (!file) return;
        const isFrameFile = /_f\d\.(png|jpe?g)$/i.test(file);
        if (writeNative(e, decode(file), isFrameFile ? f : null, warnings, `${id}${isFrameFile ? `[${f}]` : ''}`)) written++;
      });
      continue;
    }
    const out = new Canvas(e.w * e.frames, e.h);
    // one source image with several frames side by side is also accepted
    if (frames.length === 1 && e.frames > 1) {
      const src = decode(frames[0]);
      const fringe = keyOut(src);
      if (fringe > 20) warnings.push(`${id}: ${fringe} pinkish anti-aliased pixels survived the magenta key`);
      const fw = Math.floor(src.w / e.frames);
      for (let f = 0; f < e.frames; f++) {
        const slice = new Canvas(fw, src.h);
        for (let y = 0; y < src.h; y++) for (let x = 0; x < fw; x++) slice.set(x, y, src.get(f * fw + x, y));
        const box = bbox(slice);
        if (box) out.blit(downscale(slice, box, e.w, e.h, warnings, `${id}[${f}]`), f * e.w, 0);
      }
    } else {
      for (let f = 0; f < e.frames; f++) {
        const file = frames[f] ?? frames[0];
        if (!file) continue;
        const src = decode(file);
        const fringe = keyOut(src);
        if (fringe > 20) warnings.push(`${id}: ${fringe} pinkish anti-aliased pixels survived the magenta key`);
        const box = bbox(src);
        if (!box) { warnings.push(`${id}: image is empty after keying`); continue; }
        out.blit(downscale(src, box, e.w, e.h, warnings, `${id}[${f}]`), f * e.w, 0);
      }
    }
    const stray = strayPixels(out);
    if (stray > 3) warnings.push(`${id}: ${stray} stray single pixels (anti-aliasing noise); clean up in a pixel editor`);
    const dest = path.join(root, 'public', e.path);
    if (!dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out.toPNG());
    }
    written++;
    console.log(`${dry ? '[dry] ' : ''}${id} -> public/${e.path} (${e.w * e.frames}x${e.h})`);
  }
  for (const f of unknown) console.warn(`skip ${f}: no manifest id matches (see assets/manifest.json)`);
  for (const w of warnings) console.warn(`warn ${w}`);
  console.log(`\nart:process: ${written} sprite(s) ${dry ? 'checked' : 'written'}, ${warnings.length} warning(s), ${unknown.length} skipped.`);
  if (written) console.log('Remember to add a line to ASSETS_LICENSES.md for each new asset (source, tool, license, date).');
}

main();
