// Developer tools, shown only with ?debug=1. Time travel, grants, forced seasons and market, events.
import { useState } from 'preact/hooks';
import * as G from '../core';
import { store } from './store';
import { nav } from './nav';
import { useStore, useNow } from './hooks';
import { farmScene } from '../game/game';

export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
const OFFSET_KEY = 'sh_debug_offset';

export function restoreDebugClock() {
  if (!DEBUG) return;
  const v = Number(localStorage.getItem(OFFSET_KEY) ?? 0);
  if (v) G.Clock.setOffset(v);
}

function travel(ms: number) {
  G.Clock.advance(ms);
  localStorage.setItem(OFFSET_KEY, String(G.Clock.getOffset()));
  const s = store.state;
  const away = G.applyOffline(s, store.now());
  store.tick();
  if (away) nav.pushDialog({ kind: 'away' });
  if (s.pendingRollover) nav.pushDialog({ kind: 'rollover' });
  store.saveNow();
}

export function DebugPanel() {
  const s = useStore();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState('');
  if (!DEBUG) return null;
  if (!open) {
    return (
      <button class="debug-fab" data-testid="debug-open" onClick={() => setOpen(true)}>
        DBG
      </button>
    );
  }
  const H = 3_600_000;
  const b = (label: string, fn: () => void, testid?: string) => (
    <button class="dbtn" data-testid={testid} onClick={() => fn()}>
      {label}
    </button>
  );
  return (
    <div class="debug" data-testid="debug-panel">
      <div class="debug-head">
        <strong>Debug</strong>
        <span class="small">
          {new Date(now).toLocaleString()} · week {G.weekIndex(now)} · {G.currentSeason(s, now)} · offset {Math.round(G.Clock.getOffset() / H)}h
        </span>
        <button class="close" onClick={() => setOpen(false)}>×</button>
      </div>
      <p>Time travel</p>
      <div class="dgrid">
        {b('+10 min', () => travel(10 * 60_000), 'dbg-10m')}
        {b('+1 h', () => travel(H), 'dbg-1h')}
        {b('+6 h', () => travel(6 * H))}
        {b('+1 day', () => travel(24 * H), 'dbg-1d')}
        {b('+7 days', () => travel(7 * 24 * H))}
        {b('Next Monday', () => travel(G.nextWeekStartMs(store.now()) - store.now() + 60_000), 'dbg-monday')}
        {b('Next Saturday', () => {
          const n = store.now();
          const dow = G.dayOfWeek(n);
          travel(((5 - dow + 7) % 7 || 7) * 24 * H - (n - new Date(new Date(n).toDateString()).getTime()) + 9 * H);
        }, 'dbg-saturday')}
        {b('Clock -2 h (backward)', () => {
          G.Clock.advance(-2 * H);
          localStorage.setItem(OFFSET_KEY, String(G.Clock.getOffset()));
          G.applyOffline(store.state, store.now());
          store.tick();
        })}
        {b('Reset clock', () => {
          G.Clock.setOffset(0);
          localStorage.removeItem(OFFSET_KEY);
          store.tick();
        })}
        {b('Finish all timers', () => store.act((x, n) => {
          for (const p of x.plots) if (p.readyAt) p.readyAt = Math.min(p.readyAt, n);
          for (const j of x.kitchen.jobs) j.endsAt = Math.min(j.endsAt, n);
          for (const w of x.winery.batches) w.readyAt = Math.min(w.readyAt, n);
          for (const st of Object.values(x.buildings)) if (st.repairEndsAt) st.repairEndsAt = n;
          for (const a of x.animals) a.prodAt -= 6 * H;
          x.minigames.cooldown = {};
          G.tick(x, n);
        }), 'dbg-finish')}
      </div>
      <p>Season</p>
      <div class="dgrid">
        {(['spring', 'summer', 'fall', 'winter'] as const).map((se) => b(se, () => store.act((x) => (x.forcedSeason = se))))}
        {b('Calendar', () => store.act((x) => (x.forcedSeason = null)))}
      </div>
      <p>Grant</p>
      <div class="dgrid">
        {b('+1K coins', () => store.act((x) => G.earn(x, 1000)), 'dbg-coins')}
        {b('+100K coins', () => store.act((x) => G.earn(x, 100_000)))}
        {b('+15M lifetime', () => store.act((x) => G.earn(x, G.CONFIG.PRESTIGE_COIN_GOAL)), 'dbg-prestige-coins')}
        {b('+20 ribbons', () => store.act((x) => G.addRibbons(x, 20)))}
        {b('+5 heirloom seeds', () => store.act((x) => (x.heirloomSeeds += 5)))}
        {b('20 of every crop', () => store.act((x) => G.C().raw.crops.forEach((c) => G.addItem(x, c.id, 20))))}
        {b('50 milk, eggs', () => store.act((x) => {
          G.addItem(x, 'milk', 50);
          G.addItem(x, 'egg', 50);
        }))}
        {b('100 materials', () => store.act((x) => G.C().raw.items.filter((i) => i.buyable).forEach((i) => G.addItem(x, i.id, 100))))}
        {b('All cosmetics', () => store.act((x) => G.C().raw.cosmetics.forEach((c) => !x.owned.cosmetics.includes(c.id) && x.owned.cosmetics.push(c.id))))}
        {b('All decor', () => store.act((x) => G.C().raw.decor.forEach((d) => (x.owned.decor[d.id] = (x.owned.decor[d.id] ?? 0) + 1))))}
        {b('Restore everything', () => store.act((x, n) => {
          for (const p of Object.keys(x.parcels)) x.parcels[p] = 'restored';
          for (const [id, st] of Object.entries(x.buildings)) {
            const def = G.C().buildings.get(id);
            if (def?.core) {
              st.stage = 2;
              st.level = Math.max(1, st.level);
              st.producedAt = n;
              G.onBuildingChange(x, id, n);
            }
          }
          for (const p of x.plots) p.cleared = true;
          G.tick(x, n);
        }), 'dbg-restore')}
        {b('Skip tutorial', () => store.act((x) => (x.tutorial.skipped = true)))}
      </div>
      <p>Market</p>
      <div class="dgrid">
        <select value={hot} onChange={(e) => setHot((e.target as HTMLSelectElement).value)}>
          <option value="">Pick a hot item</option>
          {[...G.C().items.values()].filter((i) => i.kind !== 'material').map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        {b('Force hot (this week)', () => hot && store.act((x, n) => (x.market.forced = { week: G.weekIndex(n), items: [...(x.market.forced?.week === G.weekIndex(n) ? x.market.forced.items : []), hot] })))}
        {b('Force hot (next week)', () => hot && store.act((x, n) => (x.market.forced = { week: G.weekIndex(n) + 1, items: [hot] })))}
        {b('Clear forced', () => store.act((x) => (x.market.forced = undefined)))}
      </div>
      <p>Events</p>
      <div class="dgrid">
        {b('Lucky critter', () => farmScene()?.debugCritter())}
        {b('Tourist', () => {
          const offer = G.touristOffer(store.state, store.now());
          if (offer) nav.openSheet({ kind: 'tourist', ...offer });
          else store.toast('Nothing for the tourist to buy');
        })}
        {b('Luna gift', () => store.act((x, n) => {
          const g = G.C().raw.luna.gifts.find((gg) => !x.codex.lunaGifts.includes(gg.id));
          if (g) x.codex.lunaGifts.push(g.id);
          G.emit({ type: 'luna', text: `Luna presents you with a gift: ${g?.name ?? 'a sock'}.` });
          void n;
        }))}
        {b('Away 12 h', () => {
          store.state.lastSeen = store.now() - 12 * H;
          const away = G.applyOffline(store.state, store.now());
          store.tick();
          if (away) nav.pushDialog({ kind: 'away' });
        })}
        {b("What's new", () => nav.pushDialog({ kind: 'whatsnew' }))}
        {b('Dedication', () => nav.pushDialog({ kind: 'dedication' }))}
        {b('Update prompt', () => nav.pushDialog({ kind: 'update' }))}
        {b('Backup reminder', () => nav.pushDialog({ kind: 'backup' }))}
        {b('Reset save', () => {
          if (confirm('Erase this farm?')) {
            store.replaceState(G.newGame(store.now()));
          }
        }, 'dbg-reset')}
      </div>
    </div>
  );
}
