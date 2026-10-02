import Phaser from 'phaser';
import * as G from '../core';
import type { GameState, Plot, AnimalState } from '../core';
import { store } from '../ui/store';
import { nav } from '../ui/nav';
import { displayScale, hasRealArt, hasFrameArt, frameKey, artMeta } from './assets';
import { sfx } from '../audio/audio';
import { webPlatform } from '../platform/web';

const T = 32;
const WORLD = 24 * T;
const MARGIN = 4 * T;

type Hit =
  | { kind: 'critter'; idx: number }
  | { kind: 'luna' }
  | { kind: 'animal'; id: string }
  | { kind: 'decor'; uid: string }
  | { kind: 'plot'; id: string }
  | { kind: 'building'; id: string }
  | { kind: 'luke' }
  | { kind: 'avatar' }
  | { kind: 'van' }
  | { kind: 'andrew' }
  | { kind: 'parcel'; id: string };

interface AnimalView {
  c: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  hat?: Phaser.GameObjects.Image;
  neck?: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image;
  kind: string;
  hatId?: string;
  neckId?: string;
  nextMove: number;
}

interface Critter {
  sprite: Phaser.GameObjects.Sprite;
  eventId: string;
  kind: 'butterfly' | 'ladybug' | 'tourist';
  start: number;
  dur: number;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  phase: number;
}

const SEASON_OVERLAY: Record<string, [number, number]> = {
  spring: [0xffb7d5, 0.07],
  summer: [0xffd93b, 0.07],
  fall: [0xff8a1f, 0.12],
  winter: [0xffffff, 0.38],
};

export class FarmScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.RenderTexture;
  private groundKey = '';
  private plots = new Map<string, { soil: Phaser.GameObjects.Image; crop?: Phaser.GameObjects.Sprite; cropId?: string; stage: number; ready: boolean }>();
  private buildings = new Map<string, { sprite: Phaser.GameObjects.Sprite; key: string; roof: Phaser.GameObjects.Graphics; bar: Phaser.GameObjects.Graphics; bubble: Phaser.GameObjects.Image; extras: Phaser.GameObjects.Image[] }>();
  private animals = new Map<string, AnimalView>();
  private decor = new Map<string, Phaser.GameObjects.Sprite>();
  private props: Phaser.GameObjects.GameObject[] = [];
  private seasonProps: Phaser.GameObjects.Image[] = [];
  private scenery: Phaser.GameObjects.Image[] = [];
  private sceneryKey = '';
  private luna!: Phaser.GameObjects.Sprite;
  private luke!: Phaser.GameObjects.Sprite;
  private avatar!: Phaser.GameObjects.Container;
  private van!: Phaser.GameObjects.Image;
  private andrewSign!: Phaser.GameObjects.Image;
  private critters: Critter[] = [];
  private nextCritter = 0;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private particleTex = '';
  private emitRect = new Phaser.Geom.Rectangle(0, 0, 400, 2);
  private grid!: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Sprite;
  private lastVersion = -1;
  private lastSlowSync = 0;
  private labels!: HTMLDivElement;
  private labelEls = new Map<string, HTMLDivElement>();
  private zoomLevels: number[] = [1, 2, 3];
  // input
  private down?: { x: number; y: number; wx: number; wy: number; t: number; camX: number; camY: number };
  private panning = false;
  private sweeping = false;
  private dragDecor: string | null = null;
  private pinch?: { dist: number; zoom: number };
  private longPressTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Farm');
  }

  /** Scale a sprite so final art of any resolution fills its slot; remembers the base scale. */
  private fit<O extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(obj: O, id: string, frame?: number, mult = 1): O {
    const sc = displayScale(id, frame) * mult;
    obj.setScale(sc);
    obj.setData('base', sc);
    return obj;
  }

  private base(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): number {
    return (obj.getData('base') as number) ?? 1;
  }

  /** Play the idle strip if the art has one; otherwise a gentle code animation keeps it alive. */
  private idle(obj: Phaser.GameObjects.Sprite, key: string, reduceMotion: boolean) {
    if (this.anims.exists(`${key}_idle`)) obj.play(`${key}_idle`);
    else if (!reduceMotion) {
      const b = this.base(obj);
      this.tweens.add({ targets: obj, scaleY: b * 1.035, yoyo: true, repeat: -1, duration: 900 + Math.random() * 500, ease: 'Sine.easeInOut', delay: Math.random() * 600 });
    }
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#4F7A4A');
    cam.setBounds(-MARGIN, -MARGIN, WORLD + MARGIN * 2, WORLD + MARGIN * 2);
    this.ground = this.add.renderTexture(0, 0, WORLD, WORLD).setOrigin(0, 0).setDepth(-10);
    this.drawBorder();
    this.grid = this.add.graphics().setDepth(5000);
    this.input.addPointer(1);
    this.setupZoom();
    const hs = G.C().parcels.get('homestead')!;
    cam.centerOn((hs.gx * 8 + 4) * T, (hs.gy * 8 + 3) * T);

    // characters and fixed props
    const rm = store.state?.settings.reduceMotion ?? false;
    this.luke = this.fit(this.add.sprite(13.4 * T, 12.95 * T, 'char_luke').setOrigin(0.5, 1), 'char_luke');
    this.idle(this.luke, 'char_luke', rm);
    this.avatar = this.add.container(8.7 * T, 11.9 * T);
    this.van = this.fit(this.add.image(21.2 * T, 20.8 * T, 'prop_van').setOrigin(0.5, 1), 'prop_van');
    this.andrewSign = this.fit(this.add.image(23.2 * T, 23.6 * T, 'prop_sign').setOrigin(0.5, 1), 'prop_sign');
    this.props.push(this.fit(this.add.image(14.5 * T, 13 * T, 'prop_well').setOrigin(0.5, 1).setDepth(13 * T), 'prop_well'));
    this.props.push(this.fit(this.add.image(23.4 * T, 17 * T, 'prop_mailbox').setOrigin(0.5, 1).setDepth(17 * T), 'prop_mailbox'));
    // final art for a sitting Luna stands in for the sleeping one until a sleeping sprite exists
    const lunaKey = hasRealArt('luna_sit') && !hasRealArt('luna_sleep') ? 'luna_sit' : 'luna_sleep';
    this.luna = this.fit(this.add.sprite(0, 0, lunaKey).setOrigin(0.5, 1), lunaKey, undefined, lunaKey === 'luna_sit' ? 0.85 : 1);
    this.idle(this.luna, lunaKey, rm);

    this.labels = document.getElementById('world-labels') as HTMLDivElement;
    this.setupInput();
    this.scale.on('resize', () => this.setupZoom());
    store.onCoreEvent((e) => this.onCoreEvent(e));
    nav.subscribe(() => this.onNav());
    this.events.on('shutdown', () => this.clearLabels());
    this.nextCritter = this.time.now + 20_000;
    this.sync(true);
    document.getElementById('boot')?.remove();
  }

  // ---------- camera ----------
  private setupZoom() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const dpr = window.devicePixelRatio || 1;
    const min = Math.max(1, Math.floor(dpr * 0.75));
    const max = Math.max(min + 2, Math.ceil(dpr * 2.5));
    this.zoomLevels = [];
    for (let z = min; z <= max; z++) this.zoomLevels.push(z);
    // default: each 32px tile is at least 48 CSS px, so every plot is a comfortable touch target
    const want = Math.ceil(1.5 * dpr);
    const z = Phaser.Math.Clamp(want, min, max);
    void w;
    cam.setZoom(z);
  }

  private zoomBy(step: number, sx?: number, sy?: number) {
    const cam = this.cameras.main;
    const idx = this.zoomLevels.indexOf(cam.zoom);
    const next = this.zoomLevels[Phaser.Math.Clamp((idx < 0 ? 0 : idx) + step, 0, this.zoomLevels.length - 1)];
    this.setZoomAt(next, sx, sy);
  }

  private setZoomAt(z: number, sx = this.scale.width / 2, sy = this.scale.height / 2) {
    const cam = this.cameras.main;
    if (z === cam.zoom) return;
    const before = cam.getWorldPoint(sx, sy);
    cam.setZoom(z);
    cam.preRender();
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  focusTile(tx: number, ty: number) {
    this.cameras.main.pan(tx * T, ty * T, 400, 'Sine.easeInOut');
  }

  // ---------- drawing ----------
  private drawBorder() {
    // fir trees around the edge of the property
    const rnd = new G.Rng('border');
    for (let i = -3; i < 27; i++) {
      for (const [x, y] of [[i, -2.2], [i, 25.6], [-1.6, i], [25.4, i]] as [number, number][]) {
        if (!rnd.chance(0.75)) continue;
        const key = hasRealArt('prop_tree') && rnd.chance(0.25) ? 'prop_tree' : 'prop_fir';
        this.fit(this.add.image(x * T + rnd.int(-6, 6), y * T, key).setOrigin(0.5, 1).setDepth(y * T), key, undefined, rnd.range(0.85, 1.1));
      }
    }
  }

  private parcelAt(tx: number, ty: number) {
    return G.C().raw.parcels.find((p) => p.gx === Math.floor(tx / 8) && p.gy === Math.floor(ty / 8));
  }

  private drawGround(s: GameState, season: string) {
    const rt = this.ground;
    rt.clear();
    const rnd = new G.Rng('ground');
    const isPath = (tx: number, ty: number) => ty === 15 || tx === 15;
    for (let ty = 0; ty < 24; ty++) {
      for (let tx = 0; tx < 24; tx++) {
        const p = this.parcelAt(tx, ty)!;
        const st = s.parcels[p.id];
        const lx = tx % 8;
        let key = 'tile_grass';
        if (st === 'overgrown') key = rnd.chance(0.5) ? 'tile_bramble_dense' : 'tile_bramble';
        else if (p.ground === 'meadow') key = rnd.chance(0.3) ? 'tile_grass' : 'tile_meadow';
        else if (p.ground === 'woods') key = rnd.chance(0.6) ? 'tile_woods_floor' : 'tile_grass_dark';
        else if (p.ground === 'gravel') key = lx < 2 || ty % 8 > 5 ? 'tile_grass' : 'tile_gravel';
        else if (p.ground === 'creek') key = lx === 6 ? 'tile_water' : lx === 5 || lx === 7 ? 'tile_creek_bank' : 'tile_grass';
        else key = rnd.chance(0.25) ? 'tile_grass_dark' : 'tile_grass';
        if (st !== 'overgrown' && isPath(tx, ty) && key !== 'tile_water') key = 'tile_path';
        if (st !== 'overgrown' && season === 'summer' && p.id === 'homestead' && lx === 7 && ty % 8 === 7) key = 'tile_sand';
        rt.drawFrame(key, undefined, tx * T, ty * T);
      }
    }
    // fences around fully restored parcels
    for (const p of G.C().raw.parcels) {
      if (s.parcels[p.id] !== 'restored') continue;
      const ox = p.gx * 8 * T;
      const oy = p.gy * 8 * T;
      for (let i = 0; i < 8; i++) {
        if (p.gx * 8 + i !== 15) {
          rt.drawFrame('tile_fence_h', undefined, ox + i * T, oy - 12);
          rt.drawFrame('tile_fence_h', undefined, ox + i * T, oy + 8 * T - 20);
        }
        if (p.gy * 8 + i !== 15) {
          rt.drawFrame('tile_fence_v', undefined, ox - 14, oy + i * T);
          rt.drawFrame('tile_fence_v', undefined, ox + 8 * T - 18, oy + i * T);
        }
      }
    }
    const [col, alpha] = SEASON_OVERLAY[season] ?? [0xffffff, 0];
    rt.fill(col, alpha);
    if (season === 'winter') {
      for (let i = 0; i < 40; i++) rt.drawFrame('tile_snow_patch', undefined, rnd.int(0, 23) * T, rnd.int(0, 23) * T);
    }
  }

  /** Trees and bramble thickets: woods, the orchard, and overgrown acres. */
  private placeScenery(s: GameState) {
    const key = JSON.stringify(s.parcels);
    if (key === this.sceneryKey) return;
    this.sceneryKey = key;
    this.scenery.forEach((o) => o.destroy());
    this.scenery = [];
    const add = (id: string, x: number, y: number, mult = 1) => this.scenery.push(this.fit(this.add.image(x * T, y * T, id).setOrigin(0.5, 1).setDepth(y * T), id, undefined, mult));
    const rnd = new G.Rng('scenery');
    // Selleck Woods keeps its trees whatever its state (away from the plots and the hive)
    for (const [x, y, id] of [[0.9, 1.6, 'prop_fir'], [3.2, 1.2, 'prop_tree'], [6.6, 1.4, 'prop_fir'], [1.2, 4.6, 'prop_tree'], [4.4, 4.4, 'prop_fir'], [7.2, 4.2, 'prop_fir'], [0.8, 7.6, 'prop_fir'], [3.4, 7.7, 'prop_tree']] as [number, number, string][]) add(id, x, y, rnd.range(0.8, 1.05));
    // the orchard part of Coop and Orchard
    for (const [x, y] of [[16.6, 12.3], [20.3, 12.2], [23.5, 12.6]]) add('prop_tree_apple', x, y, 0.85);
    // bramble thickets on overgrown acres (the woods are trees enough)
    for (const p of G.C().raw.parcels) {
      if (s.parcels[p.id] !== 'overgrown' || p.id === 'selleck_woods') continue;
      for (let i = 0; i < 5; i++) add('prop_brambles', p.gx * 8 + 0.8 + rnd.range(0, 6.4), p.gy * 8 + 1.2 + rnd.range(0, 6.4), rnd.range(0.9, 1.3));
    }
  }

  private setSeasonProps(s: GameState, season: string) {
    this.seasonProps.forEach((p) => p.destroy());
    this.seasonProps = [];
    const def = G.C().raw.seasons.find((x) => x.id === season);
    const spots = [[14.4, 14.95]];
    def?.props.slice(0, spots.length).forEach((id, i) => {
      const [x, y] = spots[i];
      if (!this.textures.exists(`decor_${id}`)) return;
      this.seasonProps.push(this.fit(this.add.image(x * T, y * T, `decor_${id}`).setOrigin(0.5, 1).setDepth(y * T), `decor_${id}`));
    });
    // particles
    const tex = { spring: 'fx_petal', summer: 'fx_sparkle', fall: 'fx_leaf', winter: 'fx_snow' }[season] ?? 'fx_sparkle';
    if (this.particleTex !== tex || !this.particles) {
      this.particles?.destroy();
      this.particleTex = tex;
      this.particles = this.add.particles(0, 0, tex, {
        emitZone: { type: 'random', source: this.emitRect, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: 9000,
        speedY: { min: season === 'summer' ? -8 : 14, max: season === 'summer' ? 8 : 34 },
        speedX: { min: -14, max: 14 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 0.95, end: 0.2 },
        scale: { min: 0.6, max: 1 },
        frequency: season === 'winter' ? 220 : 520,
        quantity: 1,
      }).setDepth(9000);
    }
    this.particles.setVisible(!s.settings.reduceMotion);
    if (s.settings.reduceMotion) this.particles.stop();
    else this.particles.start();
  }

  // ---------- sync from state ----------
  private sync(force = false) {
    const s = store.state;
    const now = store.now();
    const season = G.currentSeason(s, now);
    const gk = `${JSON.stringify(s.parcels)}|${season}`;
    if (force || gk !== this.groundKey) {
      this.groundKey = gk;
      this.drawGround(s, season);
      this.setSeasonProps(s, season);
      this.placeScenery(s);
    }
    this.syncPlots(s, now);
    this.syncBuildings(s, now);
    this.syncAnimals(s, now);
    this.syncDecor(s);
    this.syncPeople(s, now);
    this.syncParcelLabels(s);
    this.drawGrid();
  }

  private syncPlots(s: GameState, now: number) {
    const seen = new Set<string>();
    for (const p of s.plots) {
      if (p.greenhouse || !G.plotAvailable(s, p)) continue;
      seen.add(p.id);
      let v = this.plots.get(p.id);
      const soilKey = p.cleared ? (p.crop ? 'tile_soil_wet' : 'tile_soil') : 'tile_bramble';
      if (!v) {
        v = { soil: this.add.image(p.x * T, p.y * T, soilKey).setOrigin(0, 0).setDepth(-5), stage: -1, ready: false };
        this.plots.set(p.id, v);
      }
      v.soil.setTexture(soilKey);
      const crop = p.crop ? G.C().crops.get(G.resolveId(p.crop)) : undefined;
      if (crop) {
        const prog = G.growthProgress(p, now);
        const ready = G.isReady(p, now);
        const stage = ready ? 3 : prog < 0.25 ? 0 : prog < 0.6 ? 1 : 2;
        if (!v.crop || v.cropId !== crop.id) {
          v.crop?.destroy();
          v.crop = this.add.sprite(p.x * T + T / 2, p.y * T + T - 2, `crop_${crop.id}`, 0).setOrigin(0.5, 1).setDepth(p.y * T + T - 2);
          v.cropId = crop.id;
          v.stage = -1;
        }
        if (stage !== v.stage) {
          const cid = `crop_${crop.id}`;
          // final art may cover only some stages (often just the ready one)
          if (hasFrameArt(cid, stage)) this.fit(v.crop.setTexture(frameKey(cid, stage)), cid, stage);
          else this.fit(v.crop.setTexture(cid, hasRealArt(cid) && this.textures.get(cid).frameTotal <= 2 ? undefined : stage), cid);
        }
        if (ready && !v.ready && !s.settings.reduceMotion) {
          const b = this.base(v.crop);
          this.tweens.add({ targets: v.crop, scaleY: b * 1.08, scaleX: b * 0.95, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
        }
        if (!ready && v.ready) {
          this.tweens.killTweensOf(v.crop);
          v.crop.setScale(this.base(v.crop));
        }
        v.stage = stage;
        v.ready = ready;
      } else if (v.crop) {
        this.tweens.killTweensOf(v.crop);
        v.crop.destroy();
        v.crop = undefined;
        v.cropId = undefined;
        v.ready = false;
      }
      // price tag for plots that still need clearing
      const def = G.plotDef(p);
      if (!p.cleared && def && def.cost > 0) this.label(`plot:${p.id}`, G.formatNumber(def.cost), (p.x + 0.5) * T, (p.y + 0.82) * T, 'tag');
      else this.removeLabel(`plot:${p.id}`);
    }
    for (const [id, v] of this.plots) {
      if (seen.has(id)) continue;
      v.soil.destroy();
      v.crop?.destroy();
      this.plots.delete(id);
      this.removeLabel(`plot:${id}`);
    }
  }

  private buildingPos(id: string) {
    const b = G.C().buildings.get(id)!;
    const p = G.C().parcels.get(b.parcel)!;
    return { x: (p.gx * 8 + b.x) * T, y: (p.gy * 8 + b.y + b.h) * T, w: b.w * T, h: b.h * T + 16 };
  }

  private syncBuildings(s: GameState, now: number) {
    for (const b of G.C().raw.buildings) {
      const st = s.buildings[b.id];
      const visible = st && G.buildingVisible(s, b.id) && s.parcels[b.parcel] !== undefined;
      let v = this.buildings.get(b.id);
      if (!visible) {
        if (v) {
          v.sprite.destroy();
          v.roof.destroy();
          v.bar.destroy();
          v.bubble.destroy();
          v.extras.forEach((o) => o.destroy());
          this.buildings.delete(b.id);
        }
        this.removeLabel(`bld:${b.id}`);
        continue;
      }
      const pos = this.buildingPos(b.id);
      const stageName = ['ruined', 'repair', 'restored'][st.stage];
      const stageKey = `bld_${b.id}_${stageName}`;
      const restoredKey = `bld_${b.id}_restored`;
      // with only restored final art, earlier stages are drawn from it (weathered, or under scaffolding)
      const derived = st.stage < 2 && !hasRealArt(stageKey) && hasRealArt(restoredKey);
      const key = derived ? `${restoredKey}~${stageName}` : stageKey;
      const texKey = derived ? restoredKey : stageKey;
      if (!v) {
        const sprite = this.add.sprite(pos.x, pos.y, texKey).setOrigin(0, 1).setDepth(pos.y);
        v = { sprite, key: '', roof: this.add.graphics().setDepth(pos.y + 1), bar: this.add.graphics().setDepth(pos.y + 2), bubble: this.add.image(pos.x + pos.w / 2, pos.y - pos.h - 4, 'ui_star').setDepth(pos.y + 3).setScale(0.6).setVisible(false), extras: [] };
        this.buildings.set(b.id, v);
      }
      if (v.key !== key) {
        const first = v.key === '';
        this.fit(v.sprite.setTexture(texKey), texKey);
        v.key = key;
        v.extras.forEach((o) => o.destroy());
        v.extras = [];
        if (derived && st.stage === 0) {
          // brambles creeping up the walls
          const n = Math.max(2, Math.round(pos.w / 28));
          for (let i = 0; i < n; i++) {
            const bx = pos.x + (pos.w * (i + 0.5)) / n;
            v.extras.push(this.fit(this.add.image(bx, pos.y + 2, 'prop_brambles').setOrigin(0.5, 1).setDepth(pos.y + 0.5), 'prop_brambles', undefined, 0.75 + (i % 2) * 0.2));
          }
        }
        if (st.stage === 2 && !first && !s.settings.reduceMotion) {
          const base = this.base(v.sprite);
          this.tweens.add({ targets: v.sprite, scaleY: base * 1.06, yoyo: true, duration: 180 });
        }
        v.bubble.setY(pos.y - v.sprite.displayHeight - 4);
      }
      // paint and roof cosmetics (visible on restored buildings)
      v.sprite.clearTint();
      v.roof.clear();
      if (derived) {
        if (st.stage === 0) v.sprite.setTint(0x8f8680);
        else {
          v.sprite.setTint(0xd9cbbd);
          const top = pos.y - v.sprite.displayHeight;
          v.roof.lineStyle(2, 0x8a5a34, 1);
          for (let x = pos.x + 4; x < pos.x + pos.w; x += 14) v.roof.lineBetween(x, top + 6, x, pos.y);
          for (let y = top + 12; y < pos.y; y += 14) v.roof.lineBetween(pos.x, y, pos.x + pos.w, y);
        }
      }
      if (st.stage === 2) {
        if (st.paint) {
          const c = Phaser.Display.Color.HexStringToColor(G.C().cosmetics.get(st.paint)?.color ?? '#FFFFFF');
          const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), c, 100, 55);
          v.sprite.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
        }
        if (st.roof && !hasRealArt(restoredKey)) {
          const rc = Phaser.Display.Color.HexStringToColor(G.C().cosmetics.get(st.roof)?.color ?? '#5A5F73').color;
          const top = pos.y - pos.h;
          const wallTop = top + Math.floor(pos.h * 0.45);
          v.roof.fillStyle(rc, 0.75).fillTriangle(pos.x - 1, wallTop, pos.x + pos.w / 2, top + 4, pos.x + pos.w + 1, wallTop);
        }
        if (st.skin) {
          const sc = Phaser.Display.Color.HexStringToColor(G.C().cosmetics.get(st.skin)?.color ?? '#FFFFFF').color;
          v.roof.fillStyle(sc, 1).fillRect(pos.x + 4, pos.y - 10, pos.w - 8, 3);
        }
        // a star per visible-level milestone reached
        const stars = b.visibleLevels.filter((l) => st.level >= l).length;
        for (let i = 0; i < stars; i++) v.roof.fillStyle(0xffd93b, 1).fillCircle(pos.x + 6 + i * 7, pos.y - v.sprite.displayHeight + 6, 2.5);
      }
      v.bar.clear();
      if (st.stage === 1 && st.repairEndsAt && st.repairStartedAt) {
        const prog = Phaser.Math.Clamp((now - st.repairStartedAt) / Math.max(1, st.repairEndsAt - st.repairStartedAt), 0, 1);
        v.bar.fillStyle(0x2b1b3d, 0.9).fillRect(pos.x + 4, pos.y + 2, pos.w - 8, 5);
        v.bar.fillStyle(0xb48ae0, 1).fillRect(pos.x + 5, pos.y + 3, (pos.w - 10) * prog, 3);
        this.label(`bld:${b.id}`, G.formatDuration(st.repairEndsAt - now), pos.x + pos.w / 2, pos.y + 14, 'timer');
      } else if (st.stage === 0) {
        this.label(`bld:${b.id}`, 'Repair', pos.x + pos.w / 2, pos.y - v.sprite.displayHeight / 2, 'tag');
      } else this.removeLabel(`bld:${b.id}`);
      // attention bubble
      let bubble: string | null = null;
      if (b.produces && G.producerPending(s, b.id, now) > 0) bubble = b.produces.item === 'coins' ? 'ui_coin' : `item_${b.produces.item}`;
      if (b.id === 'kitchen' && s.kitchen.jobs.some((j) => now >= j.endsAt)) bubble = 'ui_check';
      if (b.id === 'winery' && s.winery.batches.some((w) => now >= w.readyAt)) bubble = 'item_wine_blackberry';
      if (b.id === 'county_fair') bubble = 'ui_heirloom_seed';
      if (bubble) {
        v.bubble.setTexture(bubble).setVisible(true);
        if (!this.tweens.isTweening(v.bubble) && !s.settings.reduceMotion) this.tweens.add({ targets: v.bubble, y: v.bubble.y - 4, yoyo: true, repeat: -1, duration: 500 });
      } else v.bubble.setVisible(false);
    }
  }

  private animalArea(kind: string) {
    return kind === 'cow' ? new Phaser.Geom.Rectangle(0.6 * T, 11.6 * T, 6.8 * T, 3.2 * T) : new Phaser.Geom.Rectangle(19.6 * T, 8.8 * T, 3.8 * T, 2.6 * T);
  }

  private syncAnimals(s: GameState, now: number) {
    const seen = new Set<string>();
    for (const a of s.animals) {
      const def = G.C().animals.get(a.kind);
      if (!def) continue;
      seen.add(a.id);
      let v = this.animals.get(a.id);
      if (!v || v.kind !== a.kind) {
        v?.c.destroy();
        const area = this.animalArea(def.kind);
        const pt = area.getRandomPoint();
        const body = this.fit(this.add.sprite(0, 0, `anim_${a.kind}`).setOrigin(0.5, 1), `anim_${a.kind}`);
        this.idle(body, `anim_${a.kind}`, s.settings.reduceMotion);
        const bubble = this.add.image(0, -body.displayHeight - 8, 'item_egg').setVisible(false);
        const c = this.add.container(pt.x, pt.y, [body, bubble]);
        v = { c, body, bubble, kind: a.kind, nextMove: now + Math.random() * 4000 };
        this.animals.set(a.id, v);
      }
      this.dressAnimal(v, a);
      v.bubble.setVisible(a.stored > 0);
      if (def.product && v.bubble.texture.key !== `item_${def.product}`) this.fit(v.bubble.setTexture(`item_${def.product}`), `item_${def.product}`, undefined, 0.55);
      v.c.setDepth(v.c.y);
    }
    for (const [id, v] of this.animals) if (!seen.has(id)) {
      v.c.destroy();
      this.animals.delete(id);
    }
  }

  /** Head position in container space (scaled from the art's own pixels), before mirroring. */
  private headOffset(v: AnimalView): { x: number; y: number; span?: number } {
    const id = `anim_${v.kind}`;
    const meta = artMeta(id);
    const sc = this.base(v.body);
    const [hx, hy] = meta.headAnchor ?? [v.body.width / 2, 4];
    return { x: (hx - v.body.width / 2) * sc, y: (hy - v.body.height) * sc, span: meta.hornSpan ? meta.hornSpan * sc : undefined };
  }

  private dressAnimal(v: AnimalView, a: AnimalState) {
    const head = this.headOffset(v);
    if (a.hat !== v.hatId) {
      v.hat?.destroy();
      const key = `cos_${a.hat}`;
      v.hat = a.hat && this.textures.exists(key) ? this.add.image(head.x, head.y + 2, key).setOrigin(0.5, 1) : undefined;
      if (v.hat) {
        // horn-aware: hats sit between the horns and are sized to the horn span (or the head)
        const target = head.span ? head.span * 0.75 : v.body.displayWidth * 0.4;
        const natural = v.hat.width * displayScale(key);
        v.hat.setScale(displayScale(key) * (hasRealArt(key) || hasRealArt(`anim_${a.kind}`) || natural > target ? target / natural : 1));
        v.c.add(v.hat);
      }
      v.hatId = a.hat;
    }
    if (a.neck !== v.neckId) {
      v.neck?.destroy();
      v.neck = a.neck && this.textures.exists(`cos_${a.neck}`) ? this.fit(this.add.image(head.x, head.y + v.body.displayHeight * 0.25, `cos_${a.neck}`), `cos_${a.neck}`) : undefined;
      if (v.neck) v.c.add(v.neck);
      v.neckId = a.neck;
    }
  }

  /** Flip so the animal faces where it is walking, whichever way its art was drawn. */
  private face(v: AnimalView, towardLeft: boolean) {
    const drawnLeft = artMeta(`anim_${v.kind}`).facing === 'left';
    v.body.setFlipX(towardLeft !== drawnLeft);
  }

  private syncDecor(s: GameState) {
    const seen = new Set<string>();
    for (const d of s.placed) {
      const def = G.C().decor.get(d.id);
      if (!def) continue; // unknown decor id from a newer save: ignored, never deleted
      seen.add(d.uid);
      let sp = this.decor.get(d.uid);
      const fw = d.rot ? def.h : def.w;
      const fh = d.rot ? def.w : def.h;
      const x = (d.x + fw / 2) * T;
      const y = (d.y + fh) * T;
      if (!sp) {
        sp = this.fit(this.add.sprite(x, y, `decor_${d.id}`).setOrigin(0.5, 1), `decor_${d.id}`);
        if (def.animated && this.anims.exists(`decor_${d.id}_idle`)) sp.play(`decor_${d.id}_idle`);
        this.decor.set(d.uid, sp);
      }
      if (this.dragDecor !== d.uid) sp.setPosition(x, y);
      sp.setFlipX(d.rot === 1);
      sp.setDepth(def.walkable ? -4 : y);
      const selected = nav.editDecor?.selected === d.uid;
      sp.setAlpha(selected ? 0.75 : 1);
    }
    for (const [uid, sp] of this.decor) if (!seen.has(uid)) {
      sp.destroy();
      this.decor.delete(uid);
    }
  }

  private syncPeople(s: GameState, now: number) {
    const spot = G.lunaSpot(s, now);
    const lx = spot.x * T;
    const ly = spot.y * T + 8;
    if (this.luna.x !== lx || this.luna.y !== ly) this.luna.setPosition(lx, ly);
    this.luna.setDepth(ly + 30);
    this.luke.setDepth(this.luke.y);
    const roadside = s.parcels.roadside !== 'overgrown';
    this.van.setVisible(roadside).setDepth(this.van.y);
    this.andrewSign.setDepth(this.andrewSign.y);
    this.label('andrew', "Andrew's Store", this.andrewSign.x, this.andrewSign.y - 34, 'sign');
    // avatar layers, tinted from the player's picks
    const av = s.avatar;
    const layers = ['avatar_body', `avatar_${av.outfit}`, `avatar_${av.hair}`, `avatar_${av.hat}`, `avatar_${av.acc}`].filter((k) => this.textures.exists(k));
    const keyNow = layers.join('|') + av.skin + av.hairColor + av.outfitColor;
    if (this.avatar.getData('key') !== keyNow) {
      this.avatar.removeAll(true);
      for (const k of layers) {
        const sp = this.add.sprite(0, 0, k).setOrigin(0.5, 1);
        if (this.anims.exists(`${k}_idle`)) sp.play(`${k}_idle`);
        const tint = k === 'avatar_body' ? av.skin : k.includes('hair') ? av.hairColor : k.includes('outfit') ? av.outfitColor : null;
        if (tint) sp.setTint(Phaser.Display.Color.HexStringToColor(tint).color);
        this.avatar.add(sp);
      }
      this.avatar.setData('key', keyNow);
    }
    this.avatar.setDepth(this.avatar.y);
  }

  private syncParcelLabels(s: GameState) {
    for (const p of G.C().raw.parcels) {
      const cx = (p.gx * 8 + 4) * T;
      const cy = (p.gy * 8 + 4) * T;
      if (s.parcels[p.id] === 'overgrown') this.label(`parcel:${p.id}`, `${p.name}\nTap to clear`, cx, cy, 'parcel');
      else this.removeLabel(`parcel:${p.id}`);
    }
  }

  private drawGrid() {
    this.grid.clear();
    const edit = nav.editDecor;
    if (!edit) return;
    const s = store.state;
    const blocked = G.blockedTiles(s);
    for (let ty = 0; ty < 24; ty++) for (let tx = 0; tx < 24; tx++) {
      const p = this.parcelAt(tx, ty)!;
      if (s.parcels[p.id] === 'overgrown') continue;
      const b = blocked.has(`${tx},${ty}`);
      this.grid.lineStyle(1, b ? 0xe5384f : 0xffffff, b ? 0.15 : 0.35).strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1);
    }
  }

  // ---------- world labels (sharp DOM text over the canvas) ----------
  private label(id: string, text: string, wx: number, wy: number, cls: string) {
    if (!this.labels) return;
    let el = this.labelEls.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = `wlabel wlabel-${cls}`;
      this.labels.appendChild(el);
      this.labelEls.set(id, el);
    }
    if (el.dataset.text !== text) {
      el.textContent = text;
      el.dataset.text = text;
    }
    el.dataset.wx = String(wx);
    el.dataset.wy = String(wy);
  }

  private removeLabel(id: string) {
    const el = this.labelEls.get(id);
    if (el) {
      el.remove();
      this.labelEls.delete(id);
    }
  }

  private clearLabels() {
    for (const id of [...this.labelEls.keys()]) this.removeLabel(id);
  }

  private placeLabels() {
    const cam = this.cameras.main;
    const dpr = this.scale.width / (this.scale.canvas.clientWidth || this.scale.width);
    const hidden = nav.tab !== 'farm' || nav.photo || store.inMinigame;
    this.labels.style.display = hidden ? 'none' : '';
    if (hidden) return;
    for (const el of this.labelEls.values()) {
      const wx = Number(el.dataset.wx);
      const wy = Number(el.dataset.wy);
      const sx = ((wx - cam.worldView.x) * cam.zoom) / dpr;
      const sy = ((wy - cam.worldView.y) * cam.zoom) / dpr;
      el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -50%)`;
    }
  }

  worldToCss(wx: number, wy: number) {
    const cam = this.cameras.main;
    const dpr = this.scale.width / (this.scale.canvas.clientWidth || this.scale.width);
    return { x: ((wx - cam.worldView.x) * cam.zoom) / dpr, y: ((wy - cam.worldView.y) * cam.zoom) / dpr };
  }

  floatText(wx: number, wy: number, text: string, color = '#FFF6DD') {
    if (!this.labels) return;
    const el = document.createElement('div');
    el.className = 'wfloat';
    el.textContent = text;
    el.style.color = color;
    const p = this.worldToCss(wx, wy);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    this.labels.parentElement?.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // ---------- input ----------
  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? -1 : 1, p.x, p.y));
  }

  private twoPointers() {
    const ps = [this.input.pointer1, this.input.pointer2].filter((p) => p?.isDown);
    return ps.length === 2 ? ps : null;
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (store.inMinigame || nav.tab !== 'farm') return;
    const two = this.twoPointers();
    if (two) {
      this.pinch = { dist: Phaser.Math.Distance.Between(two[0].x, two[0].y, two[1].x, two[1].y), zoom: this.cameras.main.zoom };
      this.down = undefined;
      this.longPressTimer?.remove();
      return;
    }
    const cam = this.cameras.main;
    this.down = { x: p.x, y: p.y, wx: p.worldX, wy: p.worldY, t: this.time.now, camX: cam.scrollX, camY: cam.scrollY };
    this.panning = false;
    this.sweeping = false;
    this.dragDecor = null;
    const hit = this.hitTest(p.worldX, p.worldY);
    // drag-harvest sweep starts on a ready plot
    if (hit?.kind === 'plot') {
      const plot = store.state.plots.find((x) => x.id === hit.id);
      if (plot && G.isReady(plot, store.now())) {
        this.sweeping = true;
        this.harvestPlot(plot);
      }
    }
    // decor: drag immediately in edit mode, or after a long press otherwise
    if (hit?.kind === 'decor') {
      if (nav.editDecor) {
        this.dragDecor = hit.uid;
        nav.setEdit({ placing: null, selected: hit.uid });
      } else {
        this.longPressTimer = this.time.delayedCall(450, () => {
          if (this.down && !this.panning) {
            this.dragDecor = hit.uid;
            webPlatform.haptic('medium');
            nav.setEdit({ placing: null, selected: hit.uid });
          }
        });
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (store.inMinigame) return;
    const two = this.twoPointers();
    if (two && this.pinch) {
      const d = Phaser.Math.Distance.Between(two[0].x, two[0].y, two[1].x, two[1].y);
      const target = this.pinch.zoom * (d / Math.max(1, this.pinch.dist));
      const z = this.zoomLevels.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
      this.setZoomAt(z, (two[0].x + two[1].x) / 2, (two[0].y + two[1].y) / 2);
      return;
    }
    if (!this.down || !p.isDown) {
      this.updateGhost(p);
      return;
    }
    const dist = Phaser.Math.Distance.Between(p.x, p.y, this.down.x, this.down.y);
    if (this.dragDecor) {
      const sp = this.decor.get(this.dragDecor);
      const d = store.state.placed.find((x) => x.uid === this.dragDecor);
      const def = d && G.C().decor.get(d.id);
      if (sp && d && def) {
        const fw = d.rot ? def.h : def.w;
        const fh = d.rot ? def.w : def.h;
        const tx = Math.floor(p.worldX / T - fw / 2 + 0.5);
        const ty = Math.floor(p.worldY / T - fh / 2 + 0.5);
        sp.setPosition((tx + fw / 2) * T, (ty + fh) * T);
        sp.setAlpha(G.canPlace(store.state, d.id, tx, ty, d.rot, d.uid) ? 0.8 : 0.4);
      }
      return;
    }
    if (this.sweeping) {
      const hit = this.hitTest(p.worldX, p.worldY);
      if (hit?.kind === 'plot') {
        const plot = store.state.plots.find((x) => x.id === hit.id);
        if (plot && G.isReady(plot, store.now())) this.harvestPlot(plot);
      }
      return;
    }
    if (dist > 8 * (window.devicePixelRatio || 1)) {
      this.panning = true;
      this.longPressTimer?.remove();
      const cam = this.cameras.main;
      cam.scrollX = this.down.camX - (p.x - this.down.x) / cam.zoom;
      cam.scrollY = this.down.camY - (p.y - this.down.y) / cam.zoom;
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    this.longPressTimer?.remove();
    if (this.pinch) {
      if (!this.twoPointers()) this.pinch = undefined;
      return;
    }
    if (store.inMinigame || !this.down) return;
    const down = this.down;
    this.down = undefined;
    if (this.dragDecor) {
      const uid = this.dragDecor;
      this.dragDecor = null;
      const d = store.state.placed.find((x) => x.uid === uid);
      const def = d && G.C().decor.get(d.id);
      if (d && def && Phaser.Math.Distance.Between(p.x, p.y, down.x, down.y) > 6) {
        const fw = d.rot ? def.h : def.w;
        const fh = d.rot ? def.w : def.h;
        const tx = Math.floor(p.worldX / T - fw / 2 + 0.5);
        const ty = Math.floor(p.worldY / T - fh / 2 + 0.5);
        store.act((s) => G.moveDecor(s, uid, tx, ty));
      }
      this.sync();
      return;
    }
    if (this.sweeping || this.panning) return;
    this.onTap(p.worldX, p.worldY);
  }

  private updateGhost(p: Phaser.Input.Pointer) {
    const placing = nav.editDecor?.placing;
    if (!placing) {
      this.ghost?.setVisible(false);
      return;
    }
    const def = G.C().decor.get(placing);
    if (!def) return;
    if (!this.ghost || this.ghost.texture.key !== `decor_${placing}`) {
      this.ghost?.destroy();
      this.ghost = this.fit(this.add.sprite(0, 0, `decor_${placing}`).setOrigin(0.5, 1).setDepth(9500).setAlpha(0.6), `decor_${placing}`);
    }
    const tx = Math.floor(p.worldX / T - def.w / 2 + 0.5);
    const ty = Math.floor(p.worldY / T - def.h / 2 + 0.5);
    this.ghost.setVisible(true).setPosition((tx + def.w / 2) * T, (ty + def.h) * T);
  }

  private hitTest(wx: number, wy: number): Hit | null {
    const s = store.state;
    const now = store.now();
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      const r = c.kind === 'tourist' ? 22 : 18;
      if (Phaser.Math.Distance.Between(wx, wy, c.sprite.x, c.sprite.y - (c.kind === 'tourist' ? 20 : 0)) < r) return { kind: 'critter', idx: i };
    }
    if (this.luna.getBounds().contains(wx, wy)) return { kind: 'luna' };
    for (const [id, v] of this.animals) {
      const b = v.body.getBounds();
      if (Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(b.x - 4, b.y - 8, b.width + 8, b.height + 12), wx, wy)) return { kind: 'animal', id };
    }
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    for (const d of [...s.placed].reverse()) {
      const def = G.C().decor.get(d.id);
      if (!def) continue;
      const fw = d.rot ? def.h : def.w;
      const fh = d.rot ? def.w : def.h;
      if (tx >= d.x && tx < d.x + fw && ty >= d.y && ty < d.y + fh) return { kind: 'decor', uid: d.uid };
    }
    for (const p of s.plots) if (!p.greenhouse && p.x === tx && p.y === ty && G.plotAvailable(s, p)) return { kind: 'plot', id: p.id };
    for (const [id, v] of this.buildings) {
      const b = v.sprite.getBounds();
      if (b.contains(wx, wy)) return { kind: 'building', id };
    }
    if (this.luke.getBounds().contains(wx, wy)) return { kind: 'luke' };
    if (this.avatar.getBounds().contains(wx, wy)) return { kind: 'avatar' };
    if (this.van.visible && this.van.getBounds().contains(wx, wy)) return { kind: 'van' };
    if (this.andrewSign.getBounds().contains(wx, wy)) return { kind: 'andrew' };
    const parcel = tx >= 0 && ty >= 0 && tx < 24 && ty < 24 ? this.parcelAt(tx, ty) : undefined;
    if (parcel) return { kind: 'parcel', id: parcel.id };
    void now;
    return null;
  }

  private onTap(wx: number, wy: number) {
    const s = store.state;
    const now = store.now();
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    const edit = nav.editDecor;
    if (edit?.placing) {
      const def = G.C().decor.get(edit.placing);
      if (def) {
        const x = Math.floor(wx / T - def.w / 2 + 0.5);
        const y = Math.floor(wy / T - def.h / 2 + 0.5);
        const r = store.act((st) => G.placeDecor(st, edit.placing!, x, y));
        if (r.ok && G.stashCount(store.state, edit.placing) <= 0) nav.setEdit({ placing: null, selected: null });
      }
      return;
    }
    const hit = this.hitTest(wx, wy);
    if (edit) {
      nav.setEdit({ placing: null, selected: hit?.kind === 'decor' ? hit.uid : null });
      return;
    }
    if (!hit) return;
    sfx('tap');
    switch (hit.kind) {
      case 'critter':
        this.catchCritter(hit.idx);
        break;
      case 'luna': {
        const res = store.act((st, n) => G.tapLuna(st, n));
        this.hearts(this.luna.x, this.luna.y - 16);
        this.checkEgg('lunaTap', s.luna.moments);
        if (!res.newSpot && !res.gift && Math.random() < 0.25) nav.openSheet({ kind: 'luna' });
        break;
      }
      case 'animal': {
        const a = s.animals.find((x) => x.id === hit.id);
        const v = this.animals.get(hit.id);
        if (a && a.stored > 0) {
          const def = G.C().animals.get(a.kind)!;
          const qty = store.act((st, n) => G.collectAnimal(st, hit.id, n));
          if (v && qty) this.floatText(v.c.x, v.c.y - 30, `+${qty} ${G.itemName(def.product!)}`);
          if (v && !s.settings.reduceMotion) this.tweens.add({ targets: v.body, scaleY: this.base(v.body) * 0.85, yoyo: true, duration: 120 });
        } else nav.openSheet({ kind: 'animal', id: hit.id });
        break;
      }
      case 'decor': {
        const d = s.placed.find((x) => x.uid === hit.uid);
        if (d) {
          s.decorTaps[d.id] = (s.decorTaps[d.id] ?? 0) + 1;
          this.checkEgg('decorTap', s.decorTaps[d.id], d.id);
          const sp = this.decor.get(hit.uid);
          if (sp && !s.settings.reduceMotion) this.tweens.add({ targets: sp, scaleY: this.base(sp) * 1.08, scaleX: this.base(sp) * 0.94, yoyo: true, duration: 110 });
        }
        break;
      }
      case 'plot': {
        const plot = s.plots.find((x) => x.id === hit.id)!;
        if (!plot.cleared) {
          const r = store.act((st) => G.clearPlot(st, plot.id));
          if (r.ok) {
            this.dust(plot.x * T + 16, plot.y * T + 16);
            this.floatText(plot.x * T + 16, plot.y * T, 'Cleared!');
          }
        } else if (G.isReady(plot, now)) this.harvestPlot(plot);
        else if (plot.crop) {
          const r = G.tend(s, plot.id, now);
          if (r.ok) {
            store.flush();
            store.scheduleSave();
            store.notify();
            this.drops(plot.x * T + 16, plot.y * T + 10);
          } else nav.openSheet({ kind: 'plot', id: plot.id });
        } else nav.openSheet({ kind: 'plot', id: plot.id });
        break;
      }
      case 'building': {
        const b = G.C().buildings.get(hit.id)!;
        // two taps max for the common action: tap a producer to collect it
        if (b.produces && G.producerPending(s, hit.id, now) > 0) {
          const n = store.act((st, t) => G.collectProducer(st, hit.id, t));
          const pos = this.buildingPos(hit.id);
          this.floatText(pos.x + pos.w / 2, pos.y - pos.h, b.produces.item === 'coins' ? `+${G.formatNumber(n)} coins` : `+${n} ${G.itemName(b.produces.item)}`, '#FFD93B');
        } else nav.openSheet({ kind: 'building', id: hit.id });
        break;
      }
      case 'luke':
        nav.openSheet({ kind: 'luke' });
        break;
      case 'avatar':
        nav.setTab('style', 'avatar');
        break;
      case 'van':
        nav.setTab('shops', 'claire');
        break;
      case 'andrew':
        nav.setTab('shops', 'andrew');
        break;
      case 'parcel':
        if (s.parcels[hit.id] !== 'restored') nav.openSheet({ kind: 'parcel', id: hit.id });
        break;
    }
    void tx;
    void ty;
  }

  private harvestPlot(plot: Plot) {
    const crop = plot.crop;
    const r = store.act((st, n) => G.harvest(st, plot.id, n));
    if (r.ok && crop) {
      sfx('harvest', 0.9 + Math.random() * 0.25);
      webPlatform.haptic('light');
      this.floatText(plot.x * T + 16, plot.y * T, `+1 ${G.itemName(crop)}`);
      this.pop(plot.x * T + 16, plot.y * T + 16, `item_${crop}`);
    }
  }

  private checkEgg(kind: string, count: number, id?: string) {
    const eggs = G.C().personal.easterEggs;
    for (const egg of eggs) {
      const [k, a, b] = egg.trigger.split(':');
      const hit = (k === 'decorTap' && kind === 'decorTap' && a === id && count === Number(b)) || (k === 'lunaTap' && kind === 'lunaTap' && count === Number(a));
      if (hit && !store.state.easterEggsSeen.includes(egg.trigger)) {
        store.state.easterEggsSeen.push(egg.trigger);
        nav.pushDialog({ kind: 'message', title: 'A little secret', text: egg.text, speaker: 'luke' });
      }
    }
  }

  // ---------- juice ----------
  private pop(x: number, y: number, key: string) {
    if (!this.textures.exists(key)) return;
    const img = this.fit(this.add.image(x, y, key).setDepth(9800), key, undefined, 0.6);
    this.tweens.add({ targets: img, y: y - 30, scale: this.base(img) * 1.5, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  private burst(x: number, y: number, key: string, n: number) {
    if (store.state.settings.reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(x, y, key).setDepth(9800);
      const ang = Math.random() * Math.PI * 2;
      this.tweens.add({ targets: img, x: x + Math.cos(ang) * 22, y: y + Math.sin(ang) * 16 - 10, alpha: 0, duration: 600 + Math.random() * 300, onComplete: () => img.destroy() });
    }
  }

  private hearts(x: number, y: number) {
    this.burst(x, y, 'fx_heart', 4);
  }
  private dust(x: number, y: number) {
    this.burst(x, y, 'fx_dust', 8);
  }
  private drops(x: number, y: number) {
    this.burst(x, y, 'fx_water_drop', 5);
  }

  private onCoreEvent(e: G.CoreEvent) {
    if (!this.scene.isActive()) return;
    if (e.type === 'building' && e.stage === 2) {
      const pos = this.buildingPos(e.id);
      this.burst(pos.x + pos.w / 2, pos.y - pos.h / 2, 'fx_sparkle', 14);
    }
    if (e.type === 'levelUp') this.burst(this.avatar.x, this.avatar.y - 30, 'fx_sparkle', 16);
  }

  private onNav() {
    if (!nav.editDecor) this.ghost?.setVisible(false);
    this.drawGrid();
    this.syncDecor(store.state);
  }

  // ---------- lucky critters ----------
  private spawnCritter() {
    const s = store.state;
    const now = store.now();
    const events = G.C().raw.events.lucky.filter((e) => e.kind !== 'tourist' || s.parcels.roadside !== 'overgrown');
    const rng = new G.Rng(`critter:${now}`);
    const ev = rng.weighted(events, (e) => e.weight);
    const view = this.cameras.main.worldView;
    let from: Phaser.Math.Vector2;
    let to: Phaser.Math.Vector2;
    let key: string;
    let dur: number;
    if (ev.kind === 'tourist') {
      key = 'char_tourist';
      from = new Phaser.Math.Vector2(15.5 * T, 24.5 * T);
      to = new Phaser.Math.Vector2(15.5 * T, 15.6 * T);
      dur = 26000;
    } else {
      const leftToRight = rng.chance(0.5);
      const y0 = view.y + view.height * rng.range(0.2, 0.7);
      from = new Phaser.Math.Vector2(leftToRight ? view.x - 20 : view.right + 20, y0);
      to = new Phaser.Math.Vector2(leftToRight ? view.right + 20 : view.x - 20, y0 + rng.range(-60, 60));
      key = ev.id === 'blue_butterfly' ? 'lucky_blue_butterfly' : ev.kind === 'butterfly' ? 'lucky_butterfly' : 'lucky_ladybug';
      dur = ev.kind === 'ladybug' ? 14000 : 10000;
    }
    const sprite = this.add.sprite(from.x, from.y, key).setDepth(9600).setOrigin(0.5, ev.kind === 'tourist' ? 1 : 0.5);
    if (this.anims.exists(`${key}_idle`)) sprite.play({ key: `${key}_idle`, frameRate: ev.kind === 'tourist' ? 2 : 8 });
    if (ev.kind !== 'tourist') sprite.setScale(1.25);
    this.critters.push({ sprite, eventId: ev.id, kind: ev.kind, start: this.time.now, dur, from, to, phase: rng.range(0, 6) });
  }

  private catchCritter(idx: number) {
    const c = this.critters[idx];
    if (!c) return;
    this.critters.splice(idx, 1);
    if (c.kind === 'tourist') {
      const offer = G.touristOffer(store.state, store.now());
      if (offer) nav.openSheet({ kind: 'tourist', ...offer });
      else store.toast('The tourist looks around, shrugs, and buys nothing. You have nothing to sell!');
      this.tweens.add({ targets: c.sprite, alpha: 0, delay: 1500, duration: 800, onComplete: () => c.sprite.destroy() });
      return;
    }
    const text = store.act((s, n) => G.claimLucky(s, c.eventId, n));
    this.burst(c.sprite.x, c.sprite.y, 'fx_sparkle', 10);
    c.sprite.destroy();
    if (text) store.toast(text, 'info', 'sparkle');
  }

  private updateCritters(time: number) {
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      const t = (time - c.start) / c.dur;
      if (t >= 1) {
        if (c.kind === 'tourist' && t < 1.6) continue; // tourists linger by the road for a bit
        c.sprite.destroy();
        this.critters.splice(i, 1);
        continue;
      }
      const x = Phaser.Math.Linear(c.from.x, c.to.x, t);
      const y = Phaser.Math.Linear(c.from.y, c.to.y, t) + (c.kind === 'tourist' ? 0 : Math.sin(t * 18 + c.phase) * 10);
      c.sprite.setFlipX(c.to.x < c.from.x);
      c.sprite.setPosition(x, y);
      if (c.kind === 'tourist') c.sprite.setDepth(y);
    }
    if (time > this.nextCritter && nav.tab === 'farm' && !nav.editDecor && !store.inMinigame) {
      const rate = G.luckyRate(store.state, store.now());
      this.nextCritter = time + (60_000 + Math.random() * 120_000) / rate;
      if (this.critters.length < 2) this.spawnCritter();
    }
  }

  /** Debug helper: spawn a specific lucky event now. */
  debugCritter() {
    this.nextCritter = 0;
  }

  // ---------- frame ----------
  update(time: number, delta: number) {
    const s = store.state;
    if (!s) return;
    const now = store.now();
    if (store.version !== this.lastVersion || time - this.lastSlowSync > 1000) {
      this.lastVersion = store.version;
      this.lastSlowSync = time;
      this.sync();
    }
    // wandering animals
    for (const v of this.animals.values()) {
      if (now > v.nextMove && !s.settings.reduceMotion) {
        const def = G.C().animals.get(v.kind);
        const pt = this.animalArea(def?.kind ?? 'cow').getRandomPoint();
        const dist = Phaser.Math.Distance.Between(v.c.x, v.c.y, pt.x, pt.y);
        this.face(v, pt.x < v.c.x);
        this.tweens.add({ targets: v.c, x: pt.x, y: pt.y, duration: dist * (def?.kind === 'cow' ? 90 : 45), ease: 'Linear', onUpdate: () => v.c.setDepth(v.c.y) });
        v.nextMove = now + 3000 + Math.random() * 7000 + dist * 60;
      }
    }
    // keep animal accessories mirrored with the body
    for (const v of this.animals.values()) {
      const off = this.headOffset(v).x;
      if (v.hat) v.hat.x = v.body.flipX ? -off : off;
      if (v.neck) v.neck.x = v.body.flipX ? -off : off;
    }
    const view = this.cameras.main.worldView;
    this.emitRect.setTo(view.x, view.y - 10, view.width, 2);
    this.updateCritters(time);
    this.placeLabels();
    void delta;
  }

  /** Photo mode: grab the canvas as a PNG. */
  snapshot(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.game.renderer.snapshot((img) => {
        const el = img as HTMLImageElement;
        const c = document.createElement('canvas');
        c.width = el.width;
        c.height = el.height;
        c.getContext('2d')!.drawImage(el, 0, 0);
        c.toBlob((b) => resolve(b), 'image/png');
      });
    });
  }
}
