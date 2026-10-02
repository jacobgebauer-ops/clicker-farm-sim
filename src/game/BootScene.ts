import Phaser from 'phaser';
import { MANIFEST, assetUrl, hasRealArt, realFrameCount, realSize, frameOverrides, frameKey } from './assets';

/** Loads every art slot. Missing files never crash: they become generated blocks. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const failed = new Set<string>();
    this.load.on('loaderror', (file: Phaser.Loader.File) => failed.add(file.key));
    for (const e of MANIFEST) {
      const url = assetUrl(e.id);
      if (hasRealArt(e.id)) {
        // final art keeps its own resolution; it is a strip only if its shape says so
        const frames = realFrameCount(e.id);
        const [w, h] = realSize(e.id)!;
        if (frames > 1) this.load.spritesheet(e.id, url, { frameWidth: Math.floor(w / frames), frameHeight: h });
        else this.load.image(e.id, url);
      } else if (e.frames > 1) this.load.spritesheet(e.id, url, { frameWidth: e.w, frameHeight: e.h });
      else this.load.image(e.id, url);
    }
    // per-frame final art (for example a crop's ready stage)
    for (const o of frameOverrides()) this.load.image(frameKey(o.id, o.frame), assetUrl(o.id, o.frame));
    this.load.once('complete', () => {
      for (const e of MANIFEST) if (failed.has(e.id) || !this.textures.exists(e.id)) this.makeFallback(e.id, e.w * e.frames, e.h, e.frames, e.w, e.color);
    });
    const bar = document.getElementById('boot-progress');
    this.load.on('progress', (p: number) => {
      if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    });
  }

  private makeFallback(key: string, w: number, h: number, frames: number, fw: number, color?: string) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const col = Phaser.Display.Color.HexStringToColor(color ?? '#B48AE0').color;
    for (let f = 0; f < frames; f++) {
      g.fillStyle(col, 1).fillRect(f * fw + 1, 1, fw - 2, h - 2);
      g.lineStyle(1, 0x2b1b3d, 1).strokeRect(f * fw + 0.5, 0.5, fw - 1, h - 1);
    }
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, w, h);
    g.destroy();
    if (frames > 1) {
      const tex = this.textures.get(key);
      for (let f = 0; f < frames; f++) tex.add(f, 0, f * fw, 0, fw, h);
    }
  }

  create() {
    if (hasRealArt('tile_fence_h') && !hasRealArt('tile_fence_v')) this.deriveVerticalFence();
    // two-frame idle animations for anything with frames
    for (const e of MANIFEST) {
      if (e.frames > 1 && !e.id.startsWith('crop_') && this.textures.get(e.id).frameTotal > 2) {
        this.anims.create({ key: `${e.id}_idle`, frames: this.anims.generateFrameNumbers(e.id, { start: 0, end: e.frames - 1 }), frameRate: e.frames > 2 ? 6 : 2, repeat: -1 });
      }
    }
    this.scene.start('Farm');
  }

  /**
   * Builds the vertical fence piece from the horizontal one, so the sides of a field match
   * its top and bottom: one post, with the top rail turned on end running through it.
   */
  private deriveVerticalFence() {
    const img = this.textures.get('tile_fence_h').getSourceImage() as HTMLImageElement;
    const { width: W, height: H } = img;
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const sctx = src.getContext('2d')!;
    sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, W, H).data;
    const solid = (x: number, y: number) => data[(y * W + x) * 4 + 3] > 0;
    const colCount = (x: number) => { let n = 0; for (let y = 0; y < H; y++) if (solid(x, y)) n++; return n; };
    // the left post: the first run of tall columns
    const tallest = Math.max(...Array.from({ length: W }, (_, x) => colCount(x)));
    let p0 = 0;
    while (p0 < W && colCount(p0) < tallest * 0.6) p0++;
    let p1 = p0;
    while (p1 + 1 < W && colCount(p1 + 1) >= tallest * 0.6) p1++;
    // the top rail: the first run of solid rows through the middle column
    const mid = Math.floor(W / 2);
    let r0 = 0;
    while (r0 < H && !solid(mid, r0)) r0++;
    let r1 = r0;
    while (r1 + 1 < H && solid(mid, r1 + 1)) r1++;
    if (p0 >= W || r0 >= H) return;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const octx = out.getContext('2d')!;
    const railW = r1 - r0 + 1;
    const railX = mid - Math.floor(railW / 2);
    const runFrom = p1 + 1;
    const runLen = Math.max(1, W - 2 * runFrom);
    for (let y = 0; y < H; y++) for (let i = 0; i < railW; i++) {
      const sx = runFrom + (y % runLen);
      octx.drawImage(src, sx, r0 + i, 1, 1, railX + i, y, 1, 1);
    }
    const postW = p1 - p0 + 1;
    octx.drawImage(src, p0, 0, postW, H, mid - Math.floor(postW / 2), 0, postW, H);
    if (this.textures.exists('tile_fence_v')) this.textures.remove('tile_fence_v');
    this.textures.addCanvas('tile_fence_v', out);
  }
}
