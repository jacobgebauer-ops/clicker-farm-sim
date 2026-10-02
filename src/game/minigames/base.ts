import Phaser from 'phaser';
import type { MiniGameContext } from './types';
import { sfx } from '../../audio/audio';

export const ROUND_SECONDS = 40;

/**
 * Common shell for mini games: integer pixel scaling, a countdown, a round timer,
 * HUD text, a quit button, and the finish hand-off.
 */
export abstract class MiniGameScene extends Phaser.Scene {
  protected ctx!: MiniGameContext;
  protected W = 360;
  protected H = 640;
  protected Z = 1;
  protected score = 0;
  protected running = false;
  protected ended = false;
  protected elapsed = 0;
  protected scoreText!: Phaser.GameObjects.Text;
  protected timeText!: Phaser.GameObjects.Text;
  protected abstract title: string;
  protected abstract bgKey: string;

  init(data: { ctx: MiniGameContext }) {
    this.ctx = data.ctx;
    this.score = 0;
    this.running = false;
    this.ended = false;
    this.elapsed = 0;
  }

  protected text(x: number, y: number, s: string, size = 16, color = '#FFF6DD') {
    return this.add
      .text(x, y, s, { fontFamily: '"Pixelify Sans", monospace', fontSize: `${size}px`, color, stroke: '#2B1B3D', strokeThickness: Math.max(2, size / 5), align: 'center' })
      .setResolution(this.Z * 2)
      .setOrigin(0.5);
  }

  create() {
    const cw = this.scale.width;
    const ch = this.scale.height;
    this.Z = Math.max(1, Math.floor(cw / 360));
    this.W = Math.floor(cw / this.Z);
    this.H = Math.floor(ch / this.Z);
    const cam = this.cameras.main;
    cam.setZoom(this.Z);
    cam.setOrigin(0, 0);
    cam.setScroll(0, 0);
    cam.setBackgroundColor('#2B1B3D');
    const bg = this.add.image(this.W / 2, this.H / 2, this.bgKey);
    bg.setScale(Math.max(this.W / bg.width, this.H / bg.height));
    this.scoreText = this.text(this.W / 2, 40, '0', 22).setDepth(1000);
    this.timeText = this.text(this.W - 40, 40, `${ROUND_SECONDS}`, 16).setDepth(1000);
    const quit = this.text(36, 40, 'Quit', 14).setDepth(1000).setInteractive({ useHandCursor: true });
    quit.on('pointerup', () => this.end(true));
    this.setup();
    const title = this.text(this.W / 2, this.H * 0.35, this.title, 26).setDepth(1001);
    const count = this.text(this.W / 2, this.H * 0.45, '3', 40).setDepth(1001);
    let n = 3;
    sfx('tap');
    this.time.addEvent({
      delay: 700,
      repeat: 3,
      callback: () => {
        n--;
        if (n > 0) {
          count.setText(String(n));
          sfx('tap');
        } else if (n === 0) {
          count.setText('Go!');
          sfx('ding');
        } else {
          title.destroy();
          count.destroy();
          this.running = true;
          this.begin();
        }
      },
    });
  }

  update(_t: number, dt: number) {
    if (!this.running || this.ended) return;
    this.elapsed += dt / 1000;
    const left = Math.max(0, ROUND_SECONDS - this.elapsed);
    this.timeText.setText(String(Math.ceil(left)));
    this.scoreText.setText(String(this.score));
    this.step(dt / 1000);
    if (left <= 0) this.end(false);
  }

  protected end(quit: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const final = quit ? 0 : this.finalScore();
    const stars = quit ? 0 : this.stars(final);
    this.time.delayedCall(quit ? 0 : 500, () => this.ctx.finish(final, stars, quit));
  }

  protected finalScore() {
    return this.score;
  }

  protected abstract stars(score: number): number;
  protected abstract setup(): void;
  protected abstract begin(): void;
  protected abstract step(dt: number): void;
}
