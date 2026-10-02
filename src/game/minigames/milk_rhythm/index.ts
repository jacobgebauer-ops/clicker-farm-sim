// Barn: Milk Rhythm. Notes fall into three pails on the beat; tap the lane as they land.
import Phaser from 'phaser';
import { MiniGameScene, ROUND_SECONDS } from '../base';
import type { MiniGame, MiniGameContext } from '../types';
import { sfx, bell, audioTime } from '../../../audio/audio';
import { displayScale } from '../../assets';

const KEY = 'mg_milk_rhythm';
const LANE_PITCH = [523.25, 659.25, 783.99];

interface Note {
  lane: number;
  time: number;
  gold: boolean;
  sprite: Phaser.GameObjects.Image;
  done: boolean;
}

class MilkRhythmScene extends MiniGameScene {
  protected title = 'Milk Rhythm';
  protected bgKey = 'mg_bg_barn';
  private notes: Note[] = [];
  private hitY = 0;
  private fallTime = 1.6;
  private hits = 0;
  private total = 0;
  private combo = 0;
  private best = 0;
  private comboText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private laneX: number[] = [];
  private nextBeat = 0;
  private beat = 0.6;

  constructor() {
    super(KEY);
  }

  protected setup() {
    this.notes = [];
    this.hits = this.total = this.combo = this.best = 0;
    this.hitY = this.H - 120;
    this.laneX = [this.W * 0.22, this.W * 0.5, this.W * 0.78];
    const d = this.ctx.difficulty;
    this.beat = 60 / (96 * Math.min(1.5, d)) ;
    this.fallTime = 1.7 / Math.min(1.4, d);
    const g = this.add.graphics();
    for (const x of this.laneX) {
      g.fillStyle(0x2b1b3d, 0.25).fillRect(x - 30, 70, 60, this.hitY - 40);
      this.add.image(x, this.hitY + 10, 'mg_pail').setScale(1.5 * displayScale('mg_pail'));
    }
    g.lineStyle(3, 0xffffff, 0.8).lineBetween(10, this.hitY, this.W - 10, this.hitY);
    this.comboText = this.text(this.W / 2, 80, '', 14).setDepth(1000);
    this.feedback = this.text(this.W / 2, this.hitY - 60, '', 18).setDepth(1000);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.running) return;
      const x = p.x / this.Z;
      const lane = x < this.W / 3 ? 0 : x < (this.W * 2) / 3 ? 1 : 2;
      this.tap(lane);
    });
    // build a seeded beat pattern for the whole round
    const rnd = new Phaser.Math.RandomDataGenerator([String(Date.UTC(2026, 9, 5))]);
    let t = 1.2;
    let lane = 1;
    while (t < ROUND_SECONDS - 1) {
      const r = rnd.frac();
      lane = Phaser.Math.Clamp(lane + (r < 0.33 ? -1 : r < 0.66 ? 1 : 0), 0, 2);
      if (rnd.frac() < 0.82) this.spawn(lane, t, rnd.frac() < 0.06);
      if (d > 1.2 && rnd.frac() < 0.12) this.spawn((lane + 1) % 3, t, false);
      t += this.beat * (rnd.frac() < 0.25 ? 0.5 : 1);
    }
  }

  private spawn(lane: number, time: number, gold: boolean) {
    const noteKey = gold ? 'mg_note_gold' : 'mg_note';
    const sprite = this.add.image(this.laneX[lane], -40, noteKey).setScale(1.4 * displayScale(noteKey)).setVisible(false);
    this.notes.push({ lane, time, gold, sprite, done: false });
    this.total++;
  }

  protected begin() {
    this.nextBeat = 0;
  }

  private tap(lane: number) {
    const t = this.elapsed;
    let best: Note | null = null;
    for (const n of this.notes) {
      if (n.done || n.lane !== lane) continue;
      if (Math.abs(n.time - t) < 0.22 && (!best || Math.abs(n.time - t) < Math.abs(best.time - t))) best = n;
    }
    if (!best) {
      this.combo = 0;
      sfx('miss');
      return;
    }
    const dt = Math.abs(best.time - t);
    best.done = true;
    best.sprite.destroy();
    this.hits++;
    this.combo++;
    this.best = Math.max(this.best, this.combo);
    const perfect = dt < 0.09;
    this.score += (perfect ? 100 : 60) * (best.gold ? 3 : 1) + Math.min(50, this.combo * 2);
    this.feedback.setText(perfect ? 'Perfect!' : 'Good');
    this.feedback.setColor(perfect ? '#FFD93B' : '#9FE3C0');
    bell(audioTime(), LANE_PITCH[lane] * (best.gold ? 2 : 1), 0.4, 0.3, 'sfx');
    if (!this.ctx.reduceMotion) {
      const ring = this.add.circle(this.laneX[lane], this.hitY, 18, 0xffffff, 0.5);
      this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    }
  }

  protected step() {
    const t = this.elapsed;
    // soft beat ticks
    if (t >= this.nextBeat) {
      bell(audioTime(), 196, 0.25, 0.08, 'music');
      this.nextBeat += this.beat * 2;
    }
    for (const n of this.notes) {
      if (n.done) continue;
      const k = 1 - (n.time - t) / this.fallTime;
      if (k < 0) continue;
      n.sprite.setVisible(true);
      n.sprite.y = 70 + (this.hitY - 70) * k;
      if (t - n.time > 0.22) {
        n.done = true;
        this.combo = 0;
        this.tweens.add({ targets: n.sprite, alpha: 0, duration: 200, onComplete: () => n.sprite.destroy() });
      }
    }
    this.comboText.setText(this.combo > 2 ? `${this.combo} combo` : '');
  }

  protected finalScore() {
    return Math.round((this.hits / Math.max(1, this.total)) * 100);
  }

  protected stars(score: number) {
    return milkRhythm.onResult(score);
  }
}

const milkRhythm: MiniGame = {
  id: 'milk_rhythm',
  title: 'Milk Rhythm',
  sceneKey: KEY,
  scene: MilkRhythmScene,
  start(ctx: MiniGameContext) {
    ctx.game.scene.start(KEY, { ctx });
  },
  // score is accuracy percent
  onResult(score: number) {
    return score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
  },
};

export default milkRhythm;
