import * as G from '../core';
import { store } from './store';
import { nav } from './nav';
import { useStore, useNow } from './hooks';
import { Hud, BottomNav } from './Hud';
import { SheetHost } from './sheets';
import { DialogHost } from './dialogs';
import { TutorialBubble } from './Tutorial';
import { DebugPanel } from './Debug';
import { CraftTab } from './tabs/Craft';
import { ShopsTab } from './tabs/Shops';
import { StyleTab, DecorToolbar } from './tabs/Style';
import { MenuTab } from './tabs/Menu';
import { Btn, Sprite } from './components';
import { takePhoto } from '../game/game';
import { webPlatform } from '../platform/web';
import { useEffect } from 'preact/hooks';

const TINT: Record<G.TimeOfDay, string> = {
  morning: 'rgba(255, 196, 150, 0.10)',
  day: 'rgba(255, 255, 255, 0)',
  evening: 'rgba(255, 140, 70, 0.14)',
  night: 'rgba(46, 34, 120, 0.26)',
};

function TimeTint() {
  const now = useNow(30_000);
  useStore();
  if (nav.tab !== 'farm' || store.inMinigame) return null;
  return <div class="time-tint" style={{ background: TINT[G.timeOfDay(now)] }} />;
}

function Toasts() {
  useStore();
  return (
    <div class="toasts" aria-live="polite">
      {store.toasts.map((t) => (
        <div key={t.id} class={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Floats() {
  useStore();
  return (
    <div class="floats">
      {store.floats.map((f) => (
        <div key={f.id} class="float" style={{ color: f.color }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}

function FarmOverlay() {
  const s = useStore();
  const now = useNow();
  if (nav.editDecor) return <DecorToolbar />;
  const ready = G.readyCounts(s, now);
  return (
    <div class="farm-overlay">
      <div class="farm-actions">
        <button class="fab" data-testid="open-fields" aria-label="Fields" onClick={() => nav.openSheet({ kind: 'fields' })}>
          <Sprite id="ui_tab_farm" scale={0.75} />
          <span>Fields</span>
        </button>
        {G.dailyAvailable(s, now) ? (
          <button class="fab gold" data-testid="daily-basket" onClick={() => nav.setTab('menu', 'wishes')}>
            <Sprite id="ui_basket" scale={0.75} />
            <span>Basket</span>
          </button>
        ) : null}
      </div>
      {ready.total + ready.wines > 0 ? (
        <button
          class="collect-all"
          data-testid="collect-all"
          onClick={() => {
            const r = store.act((x, n) => G.collectAll(x, n));
            webPlatform.haptic('success');
            const parts = [r.crops && `${r.crops} crops`, r.animals && `${r.animals} animals`, r.crafts && `${r.crafts} dishes`, r.coins && `${G.formatNumber(r.coins)} coins`, r.items && `${r.items} honey`, r.wines && `${r.wines} wines`].filter(Boolean);
            store.toast(parts.length ? `Collected ${parts.join(', ')}` : 'Wine is still aging. Bottle it in the Winery.');
          }}
        >
          Collect all ({ready.total})
        </button>
      ) : null}
    </div>
  );
}

function PhotoBar() {
  return (
    <div class="photo-bar">
      <Btn kind="gold" onClick={async () => {
        const blob = await takePhoto();
        if (blob) {
          await webPlatform.saveFile(blob, `farm-photo-${G.dayKey(store.now())}.png`);
          store.act((x) => G.track(x, 'photo'));
        }
      }}>
        Take photo
      </Btn>
      <Btn kind="secondary" onClick={() => nav.setPhoto(false)}>Done</Btn>
    </div>
  );
}

export function App() {
  useStore();
  useEffect(() => nav.subscribe(() => store.notify()) as () => void, []);
  const tab = nav.tab;
  if (nav.photo) {
    return (
      <div class="app photo">
        <PhotoBar />
      </div>
    );
  }
  return (
    <div class={`app tab-${tab} ${store.inMinigame ? 'in-minigame' : ''} ${store.state.settings.reduceMotion ? 'reduce-motion' : ''}`}>
      <TimeTint />
      {!store.inMinigame ? <Hud /> : null}
      <main class={`content ${tab === 'farm' ? 'is-farm' : 'is-page'}`}>
        {store.inMinigame ? null : tab === 'farm' ? <FarmOverlay /> : tab === 'craft' ? <CraftTab /> : tab === 'shops' ? <ShopsTab /> : tab === 'style' ? <StyleTab /> : <MenuTab />}
      </main>
      {!store.inMinigame ? <BottomNav /> : null}
      {!store.inMinigame ? <TutorialBubble /> : null}
      <SheetHost />
      <DialogHost />
      <Toasts />
      <Floats />
      <DebugPanel />
    </div>
  );
}
