// Menu tab: Daily Basket, Season Journal, quests, wishes, codex, achievements, County Fair, settings.
import { useState } from 'preact/hooks';
import * as G from '../../core';
import { store } from '../store';
import { nav } from '../nav';
import { useStore, useNow } from '../hooks';
import { Btn, Coins, Progress, Row, Sprite, Empty, Portrait, Ribbons } from '../components';
import { webPlatform } from '../../platform/web';
import { setVolumes } from '../../audio/audio';
import { setHapticsEnabled } from '../../platform/web';

const SECTIONS: { id: string; label: string; icon: string }[] = [
  { id: 'journal', label: 'Season Journal', icon: 'ui_journal' },
  { id: 'quests', label: 'Quests', icon: 'ui_star' },
  { id: 'wishes', label: 'Daily Wishes and Basket', icon: 'ui_basket' },
  { id: 'codex', label: 'Codex and Collections', icon: 'ui_almanac' },
  { id: 'achievements', label: 'Achievements', icon: 'ui_ribbon' },
  { id: 'heirloom', label: 'County Fair and Heirloom Tree', icon: 'ui_heirloom_seed' },
  { id: 'settings', label: 'Settings', icon: 'ui_clock' },
];

export function MenuTab() {
  const s = useStore();
  const now = useNow();
  const sub = nav.sub.menu;
  if (!sub) {
    const badges: Record<string, number> = {
      journal: G.journalTier(s) - s.journal.claimed,
      wishes: G.dailyAvailable(s, now) ? 1 : 0,
      codex: G.codexSets(s).filter((c) => c.have >= c.total && !s.codex.claimed.includes(c.id)).length,
      heirloom: G.prestigeAvailable(s) ? 1 : 0,
    };
    return (
      <div class="tabpage" data-testid="menu-tab">
        {SECTIONS.map((sec) => (
          <Row key={sec.id} onClick={() => nav.setSub(sec.id)} testid={`menu-${sec.id}`}>
            <Sprite id={sec.icon} scale={0.75} />
            <span class="grow">{sec.label}</span>
            {badges[sec.id] ? <span class="badge static">{badges[sec.id]}</span> : null}
            <span>›</span>
          </Row>
        ))}
        <p class="small center">
          {G.C().personal.farmName} · Farm Year {s.farmYear} · v{__APP_VERSION__}
        </p>
      </div>
    );
  }
  const body = {
    journal: <Journal />,
    quests: <Quests />,
    wishes: <Wishes />,
    codex: <Codex />,
    achievements: <Achievements />,
    heirloom: <Heirloom />,
    settings: <Settings />,
  }[sub] ?? <Empty>Unknown page</Empty>;
  return (
    <div class="tabpage">
      <button class="back" data-testid="menu-back" onClick={() => nav.setSub('')}>
        ‹ Menu
      </button>
      {body}
    </div>
  );
}

function Journal() {
  const s = useStore();
  const now = useNow();
  const tiers = G.C().raw.journal.tiers;
  const reached = G.journalTier(s);
  const season = G.currentSeason(s, now);
  return (
    <div>
      <h2>{G.capitalize(season)} Season Journal</h2>
      <p class="small">Resets Monday. Earn points by harvesting, cooking, filling orders, selling, and playing mini games.</p>
      <Progress value={reached >= 20 ? 1 : s.journal.points / tiers[reached]} label={`${Math.floor(s.journal.points)} points, tier ${reached}/20`} />
      {reached > s.journal.claimed ? (
        <Btn wide kind="gold" testid="claim-journal" onClick={() => store.act((x, n) => G.claimJournal(x, n))}>
          Claim {reached - s.journal.claimed} reward{reached - s.journal.claimed > 1 ? 's' : ''}
        </Btn>
      ) : null}
      <div class="journal">
        {tiers.map((need, i) => {
          const { label } = G.journalRewardAt(s, i, now);
          const claimed = i < s.journal.claimed;
          const special = G.C().raw.journal.poolTiers.includes(i + 1);
          return (
            <div key={i} class={`tier ${claimed ? 'claimed' : i < reached ? 'ready' : ''} ${special ? 'special' : ''}`}>
              <span class="tier-n">{i + 1}</span>
              <span class="grow">{label}</span>
              <span class="small">{claimed ? 'Claimed' : `${need} pts`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Quests() {
  const s = useStore();
  const active = G.activeQuests(s);
  const done = G.C().raw.quests.filter((q) => s.quests.done.includes(q.id));
  return (
    <div>
      <h2>Quests</h2>
      {(() => {
        const pages = G.C().raw.almanac.pages;
        const page = pages[Math.min(s.farmYear, pages.length) - 1];
        return page ? (
          <div class="panel">
            <strong>{page.title}</strong>
            <p class="small">{page.text}</p>
          </div>
        ) : null;
      })()}
      {!active.length ? <Empty>All caught up. The whole story so far is told!</Empty> : null}
      {active.map((q) => {
        const p = G.objectiveProgress(s, q.objective);
        return (
          <div class="quest" key={q.id} data-testid={`quest-${q.id}`}>
            <Portrait who={q.giver === 'rachel' ? 'rachel' : q.giver} scale={0.5} />
            <div class="grow">
              <strong>{q.title}</strong>
              <p class="small">{q.text}</p>
              <Progress value={p.have / p.need} label={`${Math.min(p.have, p.need)}/${p.need}`} />
              <p class="small">Reward: {G.describeReward(q.reward)}</p>
            </div>
          </div>
        );
      })}
      {done.length ? (
        <>
          <h3>Story so far ({done.length})</h3>
          {done.slice().reverse().map((q) => (
            <Row key={q.id} class="done">
              <Sprite id="ui_check" scale={0.5} />
              <span class="grow">{q.title}</span>
              <span class="small">Ch. {q.chapter}</span>
            </Row>
          ))}
        </>
      ) : null}
    </div>
  );
}

function Wishes() {
  const s = useStore();
  const now = useNow();
  const basket = G.C().raw.daily.basket;
  const idx = G.dailyRewardIndex(s);
  return (
    <div>
      <h2>Daily Basket</h2>
      <p class="small">Come back any day for a basket. Missing a day never resets your streak; it just waits for you.</p>
      <div class="basket-ladder">
        {basket.map((r, i) => (
          <div key={i} class={`basket-day ${i === idx ? 'today' : i < idx ? 'past' : ''}`}>
            <span class="small">Day {i + 1}</span>
            <Sprite id="ui_basket" scale={0.75} />
            <span class="tiny">{G.describeReward(r)}</span>
          </div>
        ))}
      </div>
      <Btn wide kind="gold" testid="claim-daily" disabled={!G.dailyAvailable(s, now)} onClick={() => store.act((x, n) => G.claimDaily(x, n))}>
        {G.dailyAvailable(s, now) ? "Open today's basket" : 'Come back tomorrow'}
      </Btn>
      <h2>Daily Wishes</h2>
      {s.wishes.list.map((w, i) => (
        <div class="quest" key={i}>
          <Sprite id={w.done ? 'ui_check' : 'ui_star_empty'} scale={0.75} />
          <div class="grow">
            <strong>{G.wishText(w)}</strong>
            <Progress value={G.wishProgress(s, w) / w.target} label={`${Math.max(0, G.wishProgress(s, w))}/${w.target}`} />
          </div>
          <Ribbons n={w.ribbons} />
        </div>
      ))}
    </div>
  );
}

function Codex() {
  const s = useStore();
  const sets = G.codexSets(s);
  const crops = G.C().raw.crops.filter((c) => G.isUnlocked(s, c.requires));
  return (
    <div>
      <h2>Collections</h2>
      {sets.map((c) => (
        <div class="quest" key={c.id}>
          <div class="grow">
            <strong>{c.name}</strong>
            <Progress value={c.have / c.total} label={`${c.have}/${c.total}`} />
          </div>
          {c.have >= c.total && !s.codex.claimed.includes(c.id) ? (
            <Btn small kind="gold" onClick={() => store.act((x) => G.claimCodex(x, c.id))}>Claim <Ribbons n={c.ribbons} /></Btn>
          ) : s.codex.claimed.includes(c.id) ? <Sprite id="ui_check" scale={0.5} /> : <Ribbons n={c.ribbons} />}
        </div>
      ))}
      <h3>Crop Codex</h3>
      <div class="inv-grid">
        {crops.map((c) => {
          const have = s.codex.crops.includes(c.id);
          return (
            <div key={c.id} class={`inv ${have ? '' : 'unknown'}`} title={have ? c.name : '???'}>
              <Sprite id={`item_${c.id}`} />
              <span class="inv-name">{have ? c.name : '???'}</span>
              <span class="tiny">{c.seasons.map((x) => x[0].toUpperCase()).join(' ')}</span>
            </div>
          );
        })}
      </div>
      <h3>Luna's gifts</h3>
      <div class="list">
        {G.C().raw.luna.gifts.map((g) => (
          <Row key={g.id}>
            <span class="grow">{s.codex.lunaGifts.includes(g.id) ? g.name : '???'}</span>
            <span class="small">{s.codex.lunaGifts.includes(g.id) ? g.desc : 'Keep petting Luna.'}</span>
          </Row>
        ))}
      </div>
      <h3>Luna's napping spots ({s.codex.lunaSpots.length}/{G.C().raw.luna.spots.length})</h3>
      <div class="list">
        {G.C().raw.luna.spots.filter((sp) => s.codex.lunaSpots.includes(sp.id)).map((sp) => (
          <p class="small" key={sp.id}>{sp.text}</p>
        ))}
      </div>
    </div>
  );
}

function Achievements() {
  const s = useStore();
  const list = G.C().raw.achievements.filter((a) => !a.deprecated);
  return (
    <div>
      <h2>Achievements ({s.achievements.length}/{list.length})</h2>
      {list.map((a) => {
        const got = s.achievements.includes(a.id);
        const p = G.objectiveProgress(s, a.condition);
        if (a.hidden && !got) return <Row key={a.id} class="locked"><span class="grow">??? (a secret)</span></Row>;
        return (
          <div class={`quest ${got ? 'done' : ''}`} key={a.id}>
            <Sprite id={got ? 'ui_ribbon' : 'ui_lock'} scale={0.75} />
            <div class="grow">
              <strong>{a.name}</strong>
              <p class="small">{a.desc}</p>
              {!got ? <Progress value={p.have / p.need} label={`${G.formatNumber(Math.min(p.have, p.need))}/${G.formatNumber(p.need)}`} /> : null}
            </div>
            <Ribbons n={a.ribbons} />
          </div>
        );
      })}
    </div>
  );
}

function Heirloom() {
  const s = useStore();
  const available = G.prestigeAvailable(s);
  const pct = G.restorationPercent(s);
  const tree = G.C().raw.heirloom;
  return (
    <div>
      <h2>County Fair</h2>
      <p class="small">
        An Heirloom Year is optional and gentle. Your restored land, cosmetics, decor, animals, wine labels, collections, story, and friendships all stay. Coins, goods, and building upgrade levels reset, and you earn Heirloom Seeds for permanent upgrades.
      </p>
      <Progress value={pct / 100} label={`Restoration ${pct}%`} />
      <Progress value={s.lifetimeCoins / G.CONFIG.PRESTIGE_COIN_GOAL} label={`Lifetime coins ${G.formatNumber(s.lifetimeCoins)}/${G.formatNumber(G.CONFIG.PRESTIGE_COIN_GOAL)}`} />
      <div class="panel">
        <p>
          <Sprite id="ui_heirloom_seed" scale={0.75} /> Heirloom Seeds: <strong>{s.heirloomSeeds}</strong>
        </p>
        <p class="small">Starting a new year now would earn {G.pendingSeeds(s)} seeds (based on {G.formatNumber(s.yearCoins)} coins earned this year, plus achievements).</p>
        {available ? (
          <Btn wide kind="gold" testid="start-heirloom" onClick={() => nav.pushDialog({ kind: 'prestige' })}>
            Start Heirloom Year {s.farmYear + 1}
          </Btn>
        ) : (
          <p class="small">The County Fair comes to town when the farm is 100% restored or lifetime coins reach the goal.</p>
        )}
      </div>
      <h3>Heirloom Tree</h3>
      {tree.map((u) => {
        const lvl = s.heirloom[u.id] ?? 0;
        const cost = G.heirloomCost(s, u.id);
        const prereqOk = u.prereq.every((p) => (s.heirloom[p] ?? 0) > 0);
        return (
          <div class="quest" key={u.id}>
            <div class="grow">
              <strong>{u.name}</strong> <span class="small">{lvl}/{u.maxLevel}</span>
              <p class="small">{u.desc}</p>
              {!prereqOk ? <p class="small">Needs: {u.prereq.map((p) => G.C().heirloom.get(p)?.name).join(', ')}</p> : null}
            </div>
            <Btn small kind="gold" disabled={cost === null || !prereqOk || s.heirloomSeeds < (cost ?? 0)} onClick={() => store.act((x) => G.buyHeirloom(x, u.id))}>
              {cost === null ? 'Max' : `${cost} seeds`}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

function Settings() {
  const s = useStore();
  const [code, setCode] = useState('');
  const [confirmReset, setConfirmReset] = useState(0);
  const st = s.settings;
  const update = (patch: Partial<G.Settings>) => {
    store.act((x) => Object.assign(x.settings, patch));
    setVolumes({ music: store.state.settings.music, sfx: store.state.settings.sfx, mute: store.state.settings.mute });
    setHapticsEnabled(store.state.settings.haptics);
  };
  const exportCode = async () => {
    const c = G.encodeSaveCode(store.state);
    const ok = await webPlatform.copyText(c);
    store.state.lastBackupPrompt = store.now();
    store.toast(ok ? 'Save code copied! Paste it somewhere safe.' : 'Could not copy; the code is shown below.');
    if (!ok) setCode(c);
  };
  const download = async () => {
    const blob = new Blob([G.serialize(store.state)], { type: 'application/json' });
    store.state.lastBackupPrompt = store.now();
    await webPlatform.saveFile(blob, `selleck-homestead-${G.dayKey(store.now())}.json`);
  };
  const importCode = () => {
    try {
      const json = code.trim().startsWith('{') ? code.trim() : G.decodeSaveCode(code);
      const res = G.loadSave(json, store.now());
      webPlatform.storage.set(G.BACKUP_KEY, G.serialize(store.state));
      store.replaceState(res.state);
      store.toast('Save imported. Welcome back to the farm!');
      setCode('');
    } catch (e) {
      store.toast((e as Error).message || 'That save code did not work.', 'error');
    }
  };
  return (
    <div data-testid="settings">
      <h2>Settings</h2>
      <label class="field">
        Music volume
        <input type="range" min="0" max="1" step="0.05" value={st.music} onInput={(e) => update({ music: Number((e.target as HTMLInputElement).value) })} />
      </label>
      <label class="field">
        Sound effects volume
        <input type="range" min="0" max="1" step="0.05" value={st.sfx} onInput={(e) => update({ sfx: Number((e.target as HTMLInputElement).value) })} />
      </label>
      <Toggle label="Mute everything" value={st.mute} onChange={(v) => update({ mute: v })} />
      <Toggle label="Reduce motion" value={st.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
      <Toggle label="Haptics (vibration)" value={st.haptics} onChange={(v) => update({ haptics: v })} />
      <Toggle label="Short numbers (1.2K instead of 1,200)" value={st.numberFormat === 'short'} onChange={(v) => update({ numberFormat: v ? 'short' : 'full' })} />

      <h3>Your save</h3>
      <p class="small">Your farm is saved on this phone automatically. A backup code lets you restore it anywhere.</p>
      <div class="btn-row wrap">
        <Btn testid="export-save" onClick={exportCode}>Copy save code</Btn>
        <Btn kind="secondary" onClick={download}>Download save file</Btn>
      </div>
      <textarea class="text code" data-testid="import-code" placeholder="Paste a save code here to import it" value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
      <Btn kind="secondary" testid="import-save" disabled={!code.trim()} onClick={importCode}>Import save code</Btn>

      <h3>Install</h3>
      <InstallHelp />

      <h3>About</h3>
      <div class="btn-row wrap">
        <Btn kind="ghost" onClick={() => nav.pushDialog({ kind: 'whatsnew' })}>What's new</Btn>
        {__BUILD_KIND__ === 'gift' ? <Btn kind="ghost" onClick={() => nav.pushDialog({ kind: 'dedication' })}>Dedication</Btn> : null}
      </div>
      <Credits />
      <p class="small">Version {__APP_VERSION__}</p>

      <h3>Start over</h3>
      <Btn kind="danger" testid="reset-save" onClick={() => {
        if (confirmReset === 0) setConfirmReset(1);
        else if (confirmReset === 1) setConfirmReset(2);
        else {
          webPlatform.storage.set(G.BACKUP_KEY, G.serialize(store.state));
          store.replaceState(G.newGame(store.now()));
          setConfirmReset(0);
          store.toast('A fresh start. Your old farm was kept as a backup copy.');
        }
      }}>
        {confirmReset === 0 ? 'Reset save' : confirmReset === 1 ? 'Are you sure? Tap again' : 'Really erase the farm? Last tap'}
      </Btn>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle">
      <span class="grow">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="switch" aria-hidden="true" />
    </label>
  );
}

function InstallHelp() {
  const [, force] = useState(0);
  webPlatform.install.onChange(() => force((n) => n + 1));
  if (webPlatform.install.isStandalone()) return <p class="small">Installed! The farm lives on your home screen.</p>;
  return (
    <div>
      {webPlatform.install.available() ? <Btn kind="gold" onClick={() => void webPlatform.install.prompt()}>Add to Home Screen</Btn> : null}
      <ol class="small">
        <li>Open this page in Chrome on your phone.</li>
        <li>Tap the three dots menu in the top right.</li>
        <li>Tap "Add to Home screen" (or "Install app"), then "Install".</li>
        <li>Open the farm from your home screen. It works offline too.</li>
      </ol>
    </div>
  );
}

function Credits() {
  return (
    <div class="small credits">
      <p>Made with love for {G.C().personal.playerName}.</p>
      <p>Font: Pixelify Sans (SIL Open Font License). Sound effects: ZzFX by Frank Force (MIT). Engine: Phaser (MIT), Preact (MIT).</p>
      <p>No ads, no tracking, no purchases. Just the farm.</p>
    </div>
  );
}

export { Coins };
