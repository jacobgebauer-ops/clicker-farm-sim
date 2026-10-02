// Turns raw AI-generated images into game-ready sprites.
//
//   npm run art:process -- <inboxDir> [--palette] [--dry] [--tolerance 60]
//
// File names must match a manifest id: `crop_pumpkin.png`, or one file per frame
// (`anim_hen_f0.png`, `anim_hen_f1.png`). PNG and JPG are supported.
// Steps per image: key out the solid magenta (#FF00FF) background, trim, downscale with
// nearest-neighbor (majority color per block) to the manifest size, optionally snap to the
// global palette, then write public/assets/<path>. Warnings flag non-integer scale ratios
// and stray anti-aliased edge pixels, which usually need a quick cleanup in Aseprite or Pixelorama.
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { Canvas } from './pixel.mjs';
import { buildManifest } from './manifest.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const inbox = args.find((a) => !a.startsWith('--'));
const usePalette = args.includes('--palette');
const dry = args.includes('--dry');
const tol = Number(args[args.indexOf('--tolerance') + 1]) || 60;

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

function main() {
  if (!inbox || !fs.existsSync(inbox)) {
    console.error('Usage: npm run art:process -- <inboxDir> [--palette] [--dry] [--tolerance 60]');
    process.exit(1);
  }
  const manifest = new Map(buildManifest().map((e) => [e.id, e]));
  const files = fs.readdirSync(inbox).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  const groups = new Map();
  const unknown = [];
  for (const f of files) {
    const base = f.replace(/\.(png|jpe?g)$/i, '');
    const m = /^(.*)_f(\d)$/.exec(base);
    const id = m && manifest.has(m[1]) ? m[1] : base;
    if (!manifest.has(id)) { unknown.push(f); continue; }
    const g = groups.get(id) ?? [];
    g[m && manifest.has(m[1]) ? Number(m[2]) : 0] = path.join(inbox, f);
    groups.set(id, g);
  }
  const warnings = [];
  let written = 0;
  for (const [id, frames] of groups) {
    const e = manifest.get(id);
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
