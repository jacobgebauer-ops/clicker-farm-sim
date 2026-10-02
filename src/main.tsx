import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/styles.css';
import { render } from 'preact';
import personal from '@personal';
import * as G from './core';
import { store } from './ui/store';
import { nav } from './ui/nav';
import { App } from './ui/App';
import { createGame, farmScene } from './game/game';
import { restoreDebugClock } from './ui/Debug';
import { unlockAudio, playMusic, setVolumes } from './audio/audio';
import { setHapticsEnabled } from './platform/web';

async function fontsReady() {
  try {
    await Promise.race([document.fonts.load('16px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fall back to monospace */
  }
}

function startupDialogs(isNew: boolean) {
  const s = store.state;
  const now = store.now();
  if (__BUILD_KIND__ === 'gift' && !s.dedicationSeen) nav.pushDialog({ kind: 'dedication' });
  if (s.pendingRollover) nav.pushDialog({ kind: 'rollover' });
  if (s.pendingAway) nav.pushDialog({ kind: 'away' });
  if (isNew) s.seenChangelog = __APP_VERSION__;
  else if (s.seenChangelog !== __APP_VERSION__) nav.pushDialog({ kind: 'whatsnew' });
  const recap = G.pendingRecap(s, now);
  if (recap) nav.pushDialog({ kind: 'recap', week: recap.week });
  if (!isNew && G.backupReminderDue(s, now)) nav.pushDialog({ kind: 'backup' });
  // personal easter eggs tied to a date (birthdays, anniversaries): once per year
  for (const egg of G.C().personal.easterEggs) {
    const [kind, md] = egg.trigger.split(':');
    const key = `${egg.trigger}:${new Date(now).getFullYear()}`;
    if (kind === 'date' && md === G.mmdd(now) && !s.easterEggsSeen.includes(key)) {
      s.easterEggsSeen.push(key);
      nav.pushDialog({ kind: 'message', title: 'A special day', text: egg.text, speaker: 'luke' });
    }
  }
  if (!isNew) {
    const hi = G.pickLine('greeting', {}, G.currentSeason(s, now));
    if (hi) setTimeout(() => store.toast(`Luke: ${hi.text}`), 1200);
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    let waiting = false;
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        waiting = true;
        // never interrupt a mini game; ask afterwards
        const ask = () => {
          if (store.inMinigame) setTimeout(ask, 3000);
          else nav.pushDialog({ kind: 'update' });
        };
        ask();
      },
      onRegisteredSW(_url, reg) {
        // check for updates every hour while the app is open
        if (reg) setInterval(() => void reg.update(), 3_600_000);
      },
    });
    (window as unknown as { __applyUpdate: () => void }).__applyUpdate = () => {
      if (waiting) void updateSW(true);
      else location.reload();
    };
  } catch (e) {
    console.warn('Service worker registration failed', e);
  }
}

async function boot() {
  G.usePersonal(personal);
  restoreDebugClock();
  document.title = G.C().personal.farmName;
  await fontsReady();
  const hadSave = !!localStorage.getItem(G.SAVE_KEY);
  await store.load();
  const s = store.state;
  setVolumes({ music: s.settings.music, sfx: s.settings.sfx, mute: s.settings.mute });
  setHapticsEnabled(s.settings.haptics);
  createGame(document.getElementById('game')!);
  render(<App />, document.getElementById('app')!);
  startupDialogs(!hadSave);

  // the heartbeat
  setInterval(() => store.tick(), 1000);
  setInterval(() => store.saveNow(), 15_000);

  // unlock audio on the first tap, then play the season's music
  const unlock = async () => {
    await unlockAudio();
    void playMusic(G.currentSeason(store.state, store.now()));
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = store.now();
      store.saveNow();
    } else {
      const now = store.now();
      if (hiddenAt && now - hiddenAt > 60_000) {
        const away = G.applyOffline(store.state, now);
        store.tick();
        if (away) nav.pushDialog({ kind: 'away' });
        if (store.state.pendingRollover) nav.pushDialog({ kind: 'rollover' });
        const recap = G.pendingRecap(store.state, now);
        if (recap) nav.pushDialog({ kind: 'recap', week: recap.week });
      }
      void playMusic(G.currentSeason(store.state, now));
    }
  });
  window.addEventListener('pagehide', () => store.saveNow());
  // season change while the app is open
  let lastWeek = G.weekIndex(store.now());
  setInterval(() => {
    const w = G.weekIndex(store.now());
    if (w !== lastWeek) {
      lastWeek = w;
      if (store.state.pendingRollover) nav.pushDialog({ kind: 'rollover' });
      void playMusic(G.currentSeason(store.state, store.now()));
    }
  }, 5000);
  void registerServiceWorker();
  // expose for tests and debugging
  (window as unknown as { __farm: unknown }).__farm = { store, nav, G, farmScene };
}

void boot();
