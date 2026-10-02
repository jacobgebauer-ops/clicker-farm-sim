import Phaser from 'phaser';
import { MANIFEST, assetUrl } from './assets';

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
      if (e.frames > 1) this.load.spritesheet(e.id, url, { frameWidth: e.w, frameHeight: e.h });
      else this.load.image(e.id, url);
    }
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
    // two-frame idle animations for anything with frames
    for (const e of MANIFEST) {
      if (e.frames > 1 && !e.id.startsWith('crop_')) {
        this.anims.create({ key: `${e.id}_idle`, frames: this.anims.generateFrameNumbers(e.id, { start: 0, end: e.frames - 1 }), frameRate: e.frames > 2 ? 6 : 2, repeat: -1 });
      }
    }
    this.scene.start('Farm');
  }
}
