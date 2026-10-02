import * as G from '../core';
import { useStore, useNow } from './hooks';
import { nav } from './nav';
import { Sprite, Coins, crisp } from './components';
import { sfx } from '../audio/audio';

export function Hud() {
  const s = useStore();
  const now = useNow();
  const season = G.currentSeason(s, now);
  const def = G.C().raw.seasons.find((x) => x.id === season)!;
  const days = G.daysLeftInWeek(now);
  const level = G.levelOf(s);
  const lo = G.xpForLevel(level);
  const hi = G.xpForLevel(level + 1);
  return (
    <header class={`hud season-${season}`} data-testid="hud">
      <div class="hud-row">
        <div class="hud-money" data-testid="coins">
          <Coins n={s.coins} />
        </div>
        <div class="hud-money" data-testid="ribbons" title="Blue Ribbons">
          <Sprite id="ui_ribbon" scale={0.5} />
          {s.ribbons}
        </div>
        <button class="season-banner" onClick={() => nav.setTab('menu', 'journal')} title={def.theme}>
          <span class="season-name">{def.name}</span>
          <span class="season-days">{days === 1 ? 'Last day' : `${days} days left`}</span>
        </button>
        <button
          class="luke-btn"
          aria-label="Ask Luke"
          data-testid="ask-luke"
          onClick={() => {
            sfx('tap');
            nav.openSheet({ kind: 'luke' });
          }}
        >
          ?
        </button>
      </div>
      <div class="hud-xp" title={`Farm level ${level}`}>
        <span class="lvl">Lv {level}</span>
        <div class="xpbar">
          <div style={{ width: `${Math.min(100, ((s.xp - lo) / Math.max(1, hi - lo)) * 100)}%` }} />
        </div>
        {s.farmYear > 1 ? <span class="lvl">Year {s.farmYear}</span> : null}
      </div>
    </header>
  );
}

const TABS: { id: import('./nav').Tab; label: string; icon: string }[] = [
  { id: 'farm', label: 'Farm', icon: 'ui_tab_farm' },
  { id: 'craft', label: 'Craft', icon: 'ui_tab_craft' },
  { id: 'shops', label: 'Shops', icon: 'ui_tab_shops' },
  { id: 'style', label: 'Style', icon: 'ui_tab_style' },
  { id: 'menu', label: 'Menu', icon: 'ui_tab_menu' },
];

export function BottomNav() {
  const s = useStore();
  const now = useNow(2000);
  const ready = G.readyCounts(s, now);
  const orders = s.claire.slots.filter((x) => x.order && G.canFill(s, x.order)).length;
  const journal = G.journalTier(s) - s.journal.claimed;
  const badges: Record<string, number> = {
    farm: ready.crops + ready.animals + ready.producers,
    craft: ready.crafts + ready.wines,
    shops: orders + (G.marketStatus(s, now).open ? 1 : 0),
    style: 0,
    menu: journal + (G.dailyAvailable(s, now) ? 1 : 0) + (G.prestigeAvailable(s) && s.farmYear === 1 ? 0 : 0),
  };
  return (
    <nav class="bottomnav" data-testid="bottomnav">
      {TABS.map((t) => (
        <button
          key={t.id}
          class={`navbtn ${nav.tab === t.id ? 'active' : ''}`}
          data-testid={`tab-${t.id}`}
          aria-label={t.label}
          onClick={() => {
            sfx('tap');
            nav.setTab(t.id);
          }}
        >
          <span class="navicon" style={{ width: `${crisp(32, 0.75)}px`, height: `${crisp(32, 0.75)}px` }}>
            <Sprite id={t.icon} scale={0.75} />
          </span>
          <span class="navlabel">{t.label}</span>
          {badges[t.id] ? <span class="badge">{badges[t.id] > 99 ? '99+' : badges[t.id]}</span> : null}
        </button>
      ))}
    </nav>
  );
}
