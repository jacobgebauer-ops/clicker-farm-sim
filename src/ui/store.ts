// The single game store: owns the GameState, runs actions through the pure core,
// routes core events to sound/FX/toasts, and saves (localStorage + IndexedDB mirror).
import * as G from '../core';
import type { GameState, CoreEvent } from '../core';
import { webPlatform } from '../platform/web';
import { sfx } from '../audio/audio';

type Listener = () => void;

export interface Toast {
  id: number;
  text: string;
  icon?: string;
  kind?: 'info' | 'quest' | 'achievement' | 'level' | 'luna' | 'error';
}

export interface FloatFx {
  id: number;
  text: string;
  x?: number;
  y?: number;
  worldX?: number;
  worldY?: number;
  color?: string;
}

class Store {
  state!: GameState;
  version = 0;
  toasts: Toast[] = [];
  floats: FloatFx[] = [];
  private listeners = new Set<Listener>();
  private fxListeners = new Set<(e: CoreEvent) => void>();
  private saveTimer: number | null = null;
  private nextId = 1;
  loadedFrom: number | null = null;
  inMinigame = false;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onCoreEvent(fn: (e: CoreEvent) => void) {
    this.fxListeners.add(fn);
    return () => this.fxListeners.delete(fn);
  }

  notify() {
    this.version++;
    this.listeners.forEach((f) => f());
  }

  now() {
    return G.Clock.now();
  }

  /** Run a core action, then route its events and schedule a save. */
  act<T>(fn: (s: GameState, now: number) => T): T {
    const now = this.now();
    const out = fn(this.state, now);
    this.flush();
    this.scheduleSave();
    this.notify();
    if (out && typeof out === 'object' && 'ok' in (out as object) && (out as unknown as { ok: boolean }).ok === false) {
      const msg = (out as { msg?: string }).msg;
      if (msg) this.toast(msg, 'error');
      sfx('error');
    }
    return out;
  }

  flush() {
    for (const e of G.drainEvents()) this.route(e);
  }

  private route(e: CoreEvent) {
    this.fxListeners.forEach((f) => f(e));
    switch (e.type) {
      case 'sfx':
        sfx(e.name);
        break;
      case 'toast':
        this.toast(e.text, 'info', e.icon);
        break;
      case 'quest':
        this.toast(`Quest complete: ${e.title}`, 'quest');
        break;
      case 'achievement':
        this.toast(`Achievement: ${e.name}`, 'achievement');
        sfx('chime');
        break;
      case 'levelUp':
        this.toast(`Farm level ${e.level}!`, 'level');
        webPlatform.haptic('success');
        break;
      case 'wish':
        this.toast(`Wish granted: ${e.text}`, 'quest');
        break;
      case 'unlock':
        this.toast(e.text, 'info', 'gift');
        break;
      case 'luna':
        this.toast(e.text, 'luna');
        break;
      case 'ribbons':
        this.float(`+${e.amount} ribbon${e.amount > 1 ? 's' : ''}`, undefined, undefined, '#9AD7FF');
        break;
      default:
        break;
    }
  }

  toast(text: string, kind: Toast['kind'] = 'info', icon?: string) {
    const t = { id: this.nextId++, text, kind, icon };
    this.toasts = [...this.toasts.slice(-3), t];
    this.notify();
    window.setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.notify();
    }, kind === 'error' ? 2200 : 3600);
  }

  float(text: string, x?: number, y?: number, color?: string, world?: { x: number; y: number }) {
    const f: FloatFx = { id: this.nextId++, text, x, y, color, worldX: world?.x, worldY: world?.y };
    this.floats = [...this.floats.slice(-20), f];
    this.notify();
    window.setTimeout(() => {
      this.floats = this.floats.filter((x2) => x2.id !== f.id);
      this.notify();
    }, 1200);
  }

  // ---------- persistence ----------
  async load() {
    const storage = webPlatform.storage;
    const local = storage.get(G.SAVE_KEY);
    const mirror = await storage.mirrorGet(G.SAVE_KEY);
    const json = G.pickNewest([local, mirror]);
    const now = this.now();
    if (json) {
      try {
        const res = G.loadSave(json, now);
        if (res.backup) {
          storage.set(G.BACKUP_KEY, res.backup);
          await storage.mirrorSet(G.BACKUP_KEY, res.backup);
        }
        this.state = res.state;
        this.loadedFrom = res.migratedFrom;
      } catch (err) {
        console.error('Save could not be loaded; keeping a copy and starting fresh', err);
        storage.set(`${G.SAVE_KEY}_unreadable_${now}`, json);
        this.state = G.newGame(now);
      }
    } else {
      this.state = G.newGame(now);
      void storage.persist();
    }
    G.applyOffline(this.state, now);
    G.tick(this.state, now);
    G.drainEvents(); // don't replay a burst of toasts from catch-up
    this.saveNow();
  }

  scheduleSave() {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 1500);
  }

  saveNow() {
    if (!this.state) return;
    this.state.lastSeen = Math.max(this.state.lastSeen, this.now());
    const json = G.serialize(this.state);
    webPlatform.storage.set(G.SAVE_KEY, json);
    void webPlatform.storage.mirrorSet(G.SAVE_KEY, json);
  }

  replaceState(next: GameState) {
    this.state = next;
    this.saveNow();
    this.notify();
  }

  tick() {
    if (!this.state) return;
    const now = this.now();
    G.tick(this.state, now);
    this.flush();
    this.notify();
  }
}

export const store = new Store();
