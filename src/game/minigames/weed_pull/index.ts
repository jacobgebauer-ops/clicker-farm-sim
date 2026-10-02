// Farmland: Weed Pull. Tap or swipe weeds before they spread. Leave the crops alone,
// and absolutely do not tap Luna when she wanders through.
import Phaser from 'phaser';
import { MiniGameScene } from '../base';
import type { MiniGame, MiniGameContext } from '../types';
import { sfx } from '../../../audio/audio';
import { displayScale } from '../../assets';

const KEY = 'mg_weed_pull';
const COLS = 5;
const ROWS = 7;

type Cell = { kind: 'empty' | 'crop' | 'weed' | 'big'; sprite?: Phaser.GameObjects.Image; age: number };

class WeedPullScene extends MiniGameScene {
  protected title = 'Weed Pull';
  protected bgKey = 'mg_bg_field';
  private cells: Cell[] = [];
  private cell = 56;
  private ox = 0;
  private oy = 0;
  private spawnIn = 0;
  private luna?: Phaser.GameObjects.Sprite;
  private lunaIn = 8;
  private lunaDir = 1;
  private lunaPenalty = 0;

  constructor() {
    super(KEY);
  }

  protected setup() {
    this.cells = [];
    this.cell = Math.min(Math.floor((this.W - 20) / COLS), Math.floor((this.H - 200) / ROWS));
    this.ox = (this.W - this.cell * COLS) / 2;
    this.oy = 110;
    const g = this.add.graphics();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      g.fillStyle((r + c) % 2 ? 0x9a6b47 : 0x8a5d3c, 1).fillRect(this.ox + c * this.cell + 1, this.oy + r * this.cell + 1, this.cell - 2, this.cell - 2);
      const crop = Math.random() < 0.3;
      const cell: Cell = { kind: crop ? 'crop' : 'empty', age: 0 };
      if (crop) cell.sprite = this.add.image(this.cx(c), this.cy(r), 'mg_sprout').setScale(1.4 * displayScale('mg_sprout'));
      this.cells.push(cell);
    }
    this.lunaPenalty = 0;
    const handle = (p: Phaser.Input.Pointer) => {
      if (!this.running || !p.isDown) return;
      const x = p.x / this.Z;
      const y = p.y / this.Z;
      if (this.luna && Phaser.Math.Distance.Between(x, y, this.luna.x, this.luna.y - 10) < 22) {
        this.tapLuna();
        return;
      }
      const c = Math.floor((x - this.ox) / this.cell);
      const r = Math.floor((y - this.oy) / this.cell);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
      this.pull(r * COLS + c, p.getDistance() < 6);
    };
    this.input.on('pointerdown', handle);
    this.input.on('pointermove', handle);
  }

  private cx(c: number) {
    return this.ox + c * this.cell + this.cell / 2;
  }
  private cy(r: number) {
    return this.oy + r * this.cell + this.cell / 2;
  }

  protected begin() {
    this.spawnIn = 0.4;
    for (let i = 0; i < 3; i++) this.grow();
  }

  private grow() {
    const empty = this.cells.map((c, i) => [c, i] as const).filter(([c]) => c.kind === 'empty');
    if (!empty.length) return;
    const [cell, i] = empty[Math.floor(Math.random() * empty.length)];
    this.setWeed(cell, i, 'weed');
  }

  private setWeed(cell: Cell, i: number, kind: 'weed' | 'big') {
    cell.sprite?.destroy();
    cell.kind = kind;
    cell.age = 0;
    cell.sprite = this.add.image(this.cx(i % COLS), this.cy(Math.floor(i / COLS)), kind === 'big' ? 'mg_weed_big' : 'mg_weed').setScale((kind === 'big' ? 1.3 : 1.5) * displayScale(kind === 'big' ? 'mg_weed_big' : 'mg_weed'));
    if (!this.ctx.reduceMotion) this.tweens.add({ targets: cell.sprite, scaleY: cell.sprite.scaleY * 1.1, yoyo: true, repeat: -1, duration: 400 });
  }

  private pull(i: number, wasTap: boolean) {
    const cell = this.cells[i];
    if (cell.kind === 'weed' || cell.kind === 'big') {
      this.score += cell.kind === 'big' ? 2 : 1;
      sfx('pop');
      const s = cell.sprite!;
      this.tweens.killTweensOf(s);
      this.tweens.add({ targets: s, y: s.y - 30, alpha: 0, duration: 250, onComplete: () => s.destroy() });
      cell.sprite = undefined;
      cell.kind = 'empty';
    } else if (cell.kind === 'crop' && wasTap) {
      this.score = Math.max(0, this.score - 2);
      sfx('miss');
      const s = cell.sprite!;
      this.tweens.add({ targets: s, angle: { from: -15, to: 15 }, yoyo: true, duration: 80, repeat: 2, onComplete: () => s.setAngle(0) });
    }
  }

  private tapLuna() {
    if (!this.luna || this.luna.getData('tapped')) return;
    this.luna.setData('tapped', true);
    this.score = Math.max(0, this.score - 3);
    this.lunaPenalty++;
    this.ctx.lunaMoment();
    sfx('meow');
    const t = this.text(this.luna.x, this.luna.y - 40, 'Mrrrp?!', 14);
    this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  protected step(dt: number) {
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.grow();
      this.spawnIn = Math.max(0.45, 1.0 - this.elapsed * 0.012) / this.ctx.difficulty;
    }
    // weeds age, grow big, and spread to a neighbor
    this.cells.forEach((cell, i) => {
      if (cell.kind !== 'weed' && cell.kind !== 'big') return;
      cell.age += dt;
      if (cell.kind === 'weed' && cell.age > 4) this.setWeed(cell, i, 'big');
      else if (cell.kind === 'big' && cell.age > 3) {
        cell.age = 0;
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS).map(([rr, cc]) => rr * COLS + cc).filter((j) => this.cells[j].kind === 'empty');
        if (nb.length) this.setWeed(this.cells[nb[0]], nb[0], 'weed');
      }
    });
    // Luna strolls through now and then
    this.lunaIn -= dt;
    if (!this.luna && this.lunaIn <= 0) {
      this.lunaDir = Math.random() < 0.5 ? 1 : -1;
      const row = Math.floor(Math.random() * ROWS);
      this.luna = this.add.sprite(this.lunaDir > 0 ? -20 : this.W + 20, this.cy(row) + 12, 'luna_walk').setOrigin(0.5, 1).setScale(1.5 * displayScale('luna_walk')).setDepth(50).setFlipX(this.lunaDir < 0);
      if (this.anims.exists('luna_walk_idle')) this.luna.play('luna_walk_idle');
    }
    if (this.luna) {
      this.luna.x += this.lunaDir * 45 * dt;
      if (this.luna.x < -40 || this.luna.x > this.W + 40) {
        this.luna.destroy();
        this.luna = undefined;
        this.lunaIn = 7 + Math.random() * 6;
      }
    }
  }

  protected stars(score: number) {
    return weedPull.onResult(score);
  }
}

const weedPull: MiniGame = {
  id: 'weed_pull',
  title: 'Weed Pull',
  sceneKey: KEY,
  scene: WeedPullScene,
  start(ctx: MiniGameContext) {
    ctx.game.scene.start(KEY, { ctx });
  },
  onResult(score: number) {
    return score >= 40 ? 3 : score >= 26 ? 2 : score >= 12 ? 1 : 0;
  },
};

export default weedPull;
