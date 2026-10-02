// Coop: Egg Catch. Drag the basket to catch eggs; dodge boots and feathers; golden eggs are worth more.
import Phaser from 'phaser';
import { MiniGameScene } from '../base';
import type { MiniGame, MiniGameContext } from '../types';
import { sfx } from '../../../audio/audio';
import { displayScale } from '../../assets';

const KEY = 'mg_egg_catch';

interface Drop {
  kind: 'egg' | 'gold' | 'boot' | 'feather';
  sprite: Phaser.GameObjects.Image;
  vy: number;
  sway: number;
}

class EggCatchScene extends MiniGameScene {
  protected title = 'Egg Catch';
  protected bgKey = 'mg_bg_coop';
  private basket!: Phaser.GameObjects.Image;
  private drops: Drop[] = [];
  private spawnIn = 0;
  private targetX = 180;
  private streak = 0;

  constructor() {
    super(KEY);
  }

  protected setup() {
    this.drops = [];
    this.streak = 0;
    this.basket = this.add.image(this.W / 2, this.H - 90, 'mg_basket').setScale(1.6).setDepth(10);
    this.targetX = this.W / 2;
    for (let i = 0; i < 5; i++) this.add.image(30 + i * ((this.W - 60) / 4), 76, 'anim_hen').setScale(1.5 * displayScale('anim_hen')).setFlipX(i % 2 === 1);
    const move = (p: Phaser.Input.Pointer) => {
      if (this.running) this.targetX = Phaser.Math.Clamp(p.x / this.Z, 30, this.W - 30);
    };
    this.input.on('pointerdown', move);
    this.input.on('pointermove', move);
  }

  protected begin() {
    this.spawnIn = 0.3;
  }

  private spawn() {
    const r = Math.random();
    const kind: Drop['kind'] = r < 0.06 ? 'gold' : r < 0.18 ? 'boot' : r < 0.26 ? 'feather' : 'egg';
    const key = { egg: 'mg_egg', gold: 'mg_egg_gold', boot: 'mg_boot', feather: 'mg_feather' }[kind];
    const sprite = this.add.image(Phaser.Math.Between(30, this.W - 30), 70, key).setScale(1.5);
    const speed = (150 + this.elapsed * 4) * this.ctx.difficulty;
    this.drops.push({ kind, sprite, vy: kind === 'feather' ? speed * 0.5 : speed, sway: Math.random() * 6 });
  }

  protected step(dt: number) {
    this.basket.x += (this.targetX - this.basket.x) * Math.min(1, dt * 14);
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = Math.max(0.35, 0.75 - this.elapsed * 0.008) / this.ctx.difficulty;
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.sprite.y += d.vy * dt;
      if (d.kind === 'feather') d.sprite.x += Math.sin(this.elapsed * 3 + d.sway) * 40 * dt;
      const caught = Math.abs(d.sprite.y - (this.basket.y - 14)) < 16 && Math.abs(d.sprite.x - this.basket.x) < 38;
      if (caught) {
        if (d.kind === 'egg' || d.kind === 'gold') {
          this.streak++;
          this.score += (d.kind === 'gold' ? 5 : 1) + (this.streak >= 10 ? 1 : 0);
          sfx(d.kind === 'gold' ? 'golden' : 'pop');
        } else {
          this.streak = 0;
          this.score = Math.max(0, this.score - 2);
          sfx('miss');
          if (!this.ctx.reduceMotion) this.cameras.main.shake(120, 0.004);
        }
        d.sprite.destroy();
        this.drops.splice(i, 1);
        continue;
      }
      if (d.sprite.y > this.H + 20) {
        if (d.kind === 'egg' || d.kind === 'gold') this.streak = 0;
        d.sprite.destroy();
        this.drops.splice(i, 1);
      }
    }
  }

  protected stars(score: number) {
    return eggCatch.onResult(score);
  }
}

const eggCatch: MiniGame = {
  id: 'egg_catch',
  title: 'Egg Catch',
  sceneKey: KEY,
  scene: EggCatchScene,
  start(ctx: MiniGameContext) {
    ctx.game.scene.start(KEY, { ctx });
  },
  onResult(score: number) {
    return score >= 45 ? 3 : score >= 30 ? 2 : score >= 15 ? 1 : 0;
  },
};

export default eggCatch;
