// Minimal pixel canvas used by the placeholder generator and art processing (no native deps).
import { PNG } from 'pngjs';

export const PLUM = [0x2b, 0x1b, 0x3d, 255];

export function hex(h, a = 255) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function shade([r, g, b, a], f) {
  const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return [k(r), k(g), k(b), a];
}

// 3x5 pixel font for labels
const FONT = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111',
  f: '111100110100100', g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010',
  k: '101101110101101', l: '100100100100111', m: '101111111101101', n: '110101101101101', o: '010101101101010',
  p: '110101110100100', q: '010101101110011', r: '110101110101101', s: '011100010001110', t: '111010010010010',
  u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101', y: '101101010010010',
  z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', _: '000000000000111', '-': '000000111000000', ' ': '000000000000000', '.': '000000000000010',
};

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] / 255;
    if (a >= 1 || this.data[i + 3] === 0) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = c[3];
    } else {
      for (let k = 0; k < 3; k++) this.data[i + k] = Math.round(this.data[i + k] * (1 - a) + c[k] * a);
      this.data[i + 3] = Math.max(this.data[i + 3], c[3]);
    }
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  circle(cx, cy, r, c) {
    this.ellipse(cx, cy, r, r, c);
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  tri(x0, y0, x1, y1, x2, y2, c) {
    const minX = Math.floor(Math.min(x0, x1, x2));
    const maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) this.set(x, y, c);
      }
  }
  /** Draw a 1px outline around every opaque pixel. */
  outline(c = PLUM) {
    const src = this.data.slice();
    const op = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3] > 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (op(x, y)) continue;
        if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) this.set(x, y, c);
      }
  }
  text(str, x, y, c) {
    let cx = x;
    for (const ch of str.toLowerCase()) {
      const g = FONT[ch] ?? FONT[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') this.set(cx + i, y + j, c);
      cx += 4;
    }
  }
  /** Label strip centered at the bottom; truncates to fit. */
  label(str, color = [255, 255, 255, 255]) {
    const maxChars = Math.max(1, Math.floor((this.w - 2) / 4));
    const s = str.length > maxChars ? str.slice(0, maxChars) : str;
    const tw = s.length * 4 - 1;
    const x = Math.floor((this.w - tw) / 2);
    const y = this.h - 7;
    this.rect(x - 1, y - 1, tw + 2, 7, [43, 27, 61, 200]);
    this.text(s, x, y, color);
  }
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c[3]) this.set(ox + x, oy + y, c);
    }
  }
  toPNG() {
    const png = new PNG({ width: this.w, height: this.h });
    png.data = Buffer.from(this.data);
    return PNG.sync.write(png);
  }
  static fromPNG(buf) {
    const png = PNG.sync.read(buf);
    const c = new Canvas(png.width, png.height);
    c.data = new Uint8ClampedArray(png.data);
    return c;
  }
}

/** Seeded noise so placeholders are stable between runs. */
export function noise(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
