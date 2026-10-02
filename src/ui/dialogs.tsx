// Modal dialogs: while-you-were-away, season rollover, what's new, recap, mini game results, prestige.
import type { ComponentChildren } from 'preact';
import * as G from '../core';
import { store } from './store';
import { nav } from './nav';
import { useStore } from './hooks';
import { Btn, Coins, ItemIcon, Portrait, Sprite, Stars, Ribbons } from './components';
import { lukeSays } from './luke';
import { webPlatform } from '../platform/web';

function Modal({ title, children, testid }: { title: string; children: ComponentChildren; testid?: string }) {
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-label={title} data-testid={testid}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Speech({ who, text }: { who: string; text: string }) {
  return (
    <div class="bubble-row">
      <Portrait who={who} />
      <div class="bubble">{text}</div>
    </div>
  );
}

export function DialogHost() {
  useStore();
  const d = nav.dialogs[0];
  if (!d) return null;
  const close = () => nav.closeDialog();
  switch (d.kind) {
    case 'away':
      return <Away close={close} />;
    case 'rollover':
      return <Rollover close={close} />;
    case 'whatsnew':
      return <WhatsNew close={close} />;
    case 'dedication':
      return <Dedication close={close} />;
    case 'recap':
      return <Recap week={d.week} close={close} />;
    case 'update':
      return <UpdatePrompt close={close} />;
    case 'backup':
      return <BackupReminder close={close} />;
    case 'minigameResult':
      return <MiniResult d={d} close={close} />;
    case 'prestige':
      return <PrestigeConfirm close={close} />;
    case 'message':
      return (
        <Modal title={d.title}>
          {d.speaker ? <Speech who={d.speaker} text={d.text} /> : <p>{d.text}</p>}
          <Btn wide onClick={close}>Okay</Btn>
        </Modal>
      );
    default:
      return null;
  }
}

function Away({ close }: { close: () => void }) {
  const s = useStore();
  const a = s.pendingAway;
  const done = () => {
    store.state.pendingAway = null;
    store.saveNow();
    close();
  };
  if (!a) {
    close();
    return null;
  }
  const spot = G.lunaSpot(s, store.now());
  const capped = a.ms > a.cappedMs;
  return (
    <Modal title="While you were away" testid="away-dialog">
      <Speech who="luke" text={lukeSays('away')} />
      <ul class="away-list">
        <li>You were gone {G.formatDuration(a.ms)}.{capped ? ` The farm worked for the first ${G.formatDuration(a.cappedMs)}.` : ''}</li>
        {a.crops ? <li>{a.crops} crop{a.crops > 1 ? 's are' : ' is'} ready to harvest</li> : null}
        {Object.entries(a.products).map(([id, n]) => (
          <li key={id}>
            <ItemIcon id={id} scale={0.5} /> {n} {G.itemName(id)} waiting
          </li>
        ))}
        {a.crafts ? <li>{a.crafts} kitchen dish{a.crafts > 1 ? 'es' : ''} finished</li> : null}
        {a.wines ? <li>{a.wines} wine batch{a.wines > 1 ? 'es' : ''} done fermenting</li> : null}
        {a.coins ? <li>The honor box collected <Coins n={a.coins} /></li> : null}
        {a.repairs.length ? <li>Repairs finished: {a.repairs.map((r) => G.C().buildings.get(r)?.name).join(', ')}</li> : null}
      </ul>
      <p class="small">Luna spent the whole time napping. {spot.text}</p>
      <Btn wide testid="away-ok" onClick={done}>Back to the farm</Btn>
    </Modal>
  );
}

function Rollover({ close }: { close: () => void }) {
  const s = useStore();
  const r = s.pendingRollover;
  if (!r) {
    close();
    return null;
  }
  const def = G.C().raw.seasons.find((x) => x.id === r.season)!;
  const done = () => {
    store.state.pendingRollover = null;
    store.saveNow();
    close();
  };
  return (
    <Modal title={`New week, new season: ${def.name}!`} testid="rollover-dialog">
      <div class={`season-card season-${r.season}`}>
        <strong>{def.banner}</strong>
        <p class="small">{def.theme}</p>
      </div>
      <Speech who="luke" text={lukeSays('rollover', { season: def.name })} />
      {r.composted ? <Speech who="luke" text={`${lukeSays('compost')} (${r.composted} crop${r.composted > 1 ? 's' : ''}, +${r.refund} coins)`} /> : null}
      <p>Gift: {G.describeReward(r.gift)}</p>
      <Btn wide testid="rollover-ok" onClick={done}>Thanks, Luke!</Btn>
    </Modal>
  );
}

function WhatsNew({ close }: { close: () => void }) {
  const log = G.C().raw.changelog;
  const done = () => {
    store.state.seenChangelog = __APP_VERSION__;
    store.saveNow();
    close();
  };
  return (
    <Modal title="What's new on the farm" testid="whatsnew-dialog">
      <Speech who="luke" text={lukeSays('whats_new')} />
      <div class="scroll">
        {log.slice(0, 3).map((v) => (
          <div key={v.version}>
            <h3>
              {v.title} <span class="small">v{v.version}</span>
            </h3>
            <ul>
              {v.items.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Btn wide onClick={done}>Let's go</Btn>
    </Modal>
  );
}

function Dedication({ close }: { close: () => void }) {
  const p = G.C().personal;
  const done = () => {
    store.state.dedicationSeen = true;
    store.saveNow();
    close();
  };
  return (
    <Modal title={`For ${p.playerName}`} testid="dedication-dialog">
      <div class="letter">
        {p.dedication.split('\n').map((line, i) => (
          <p key={i}>{line || ' '}</p>
        ))}
      </div>
      <Btn wide testid="dedication-ok" onClick={done}>Open the farm gate</Btn>
    </Modal>
  );
}

function Recap({ week, close }: { week: number; close: () => void }) {
  const s = useStore();
  const r = G.recapFor(s, week);
  const done = () => {
    store.state.market.recapSeen = Math.max(store.state.market.recapSeen, week);
    store.saveNow();
    close();
  };
  if (!r) {
    done();
    return null;
  }
  return (
    <Modal title="Market recap" testid="recap-dialog">
      <p>
        Last weekend you earned <Coins n={r.coins} /> at the Farmers Market.
      </p>
      <table class="stats">
        <thead>
          <tr>
            <th>Item</th>
            <th>Sold</th>
            <th>Coins</th>
            <th>Per hour of effort</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.slice(0, 8).map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.qty}</td>
              <td>{G.formatNumber(row.coins)}</td>
              <td>{G.formatNumber(row.perEffort)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Speech who="luke" text={r.message} />
      <Btn wide onClick={done}>Noted!</Btn>
    </Modal>
  );
}

function UpdatePrompt({ close }: { close: () => void }) {
  return (
    <Modal title="A new update is ready" testid="update-dialog">
      <p>Luke spotted a delivery truck. Reload to get the latest farm goodies. Your progress is saved.</p>
      <div class="btn-row">
        <Btn onClick={() => {
          store.saveNow();
          void (window as unknown as { __applyUpdate?: () => void }).__applyUpdate?.();
        }}>
          Reload
        </Btn>
        <Btn kind="ghost" onClick={close}>Later</Btn>
      </div>
    </Modal>
  );
}

function BackupReminder({ close }: { close: () => void }) {
  return (
    <Modal title="A gentle reminder">
      <Speech who="luke" text="It's been a month! Want to copy a save code and stash it somewhere safe? Just in case. I worry." />
      <div class="btn-row">
        <Btn onClick={async () => {
          const ok = await webPlatform.copyText(G.encodeSaveCode(store.state));
          store.toast(ok ? 'Save code copied!' : 'Copy failed; try Settings.');
          store.state.lastBackupPrompt = store.now();
          store.saveNow();
          close();
        }}>
          Copy save code
        </Btn>
        <Btn kind="ghost" onClick={() => {
          store.state.lastBackupPrompt = store.now();
          store.saveNow();
          close();
        }}>
          Not now
        </Btn>
      </div>
    </Modal>
  );
}

function MiniResult({ d, close }: { d: Extract<import('./nav').Dialog, { kind: 'minigameResult' }>; close: () => void }) {
  const mg = G.C().raw.minigames.find((m) => m.id === d.game);
  const o = d.outcome;
  return (
    <Modal title={mg?.name ?? 'Nice!'} testid="minigame-result">
      <div class="center">
        <Stars n={d.stars} />
        <p>Score: {d.score}{o.personalBest ? ' (new best!)' : ''}</p>
      </div>
      {o.rewarded ? (
        <p>
          Skipped {Math.round(o.skipShare * 100)}% of the {G.C().buildings.get(mg?.building ?? '')?.name ?? 'building'} timers and earned <Coins n={o.coins} />.
        </p>
      ) : d.stars > 0 ? (
        <p class="small">{lukeSays('minigame_cooldown')}</p>
      ) : (
        <p class="small">No stars this time. Try again!</p>
      )}
      {o.ribbon ? (
        <p>
          Bonus: <Ribbons n={1} />
        </p>
      ) : null}
      <Btn wide testid="minigame-ok" onClick={close}>Back to the farm</Btn>
    </Modal>
  );
}

function PrestigeConfirm({ close }: { close: () => void }) {
  const s = useStore();
  const seeds = G.pendingSeeds(s);
  return (
    <Modal title={`Start Heirloom Year ${s.farmYear + 1}?`} testid="prestige-dialog">
      <Speech who="luke" text={lukeSays('prestige_ready')} />
      <ul class="small">
        <li>You keep: restored land, animals, cosmetics, decor and layouts, wine names and labels, collections, ribbons, achievements, Luna moments, story, friendships.</li>
        <li>Resets: coins, crops and goods, building upgrade levels, cooking and wine queues, the market stall level, and the Almanac level.</li>
        <li>
          You gain: <Sprite id="ui_heirloom_seed" scale={0.5} /> {seeds} Heirloom Seeds for the Heirloom Tree.
        </li>
      </ul>
      <div class="btn-row">
        <Btn kind="secondary" testid="prestige-no" onClick={close}>Not yet</Btn>
        <Btn kind="gold" testid="prestige-yes" onClick={() => {
          const r = store.act((x, n) => G.startHeirloomYear(x, n));
          close();
          if (r.ok) nav.pushDialog({ kind: 'message', title: `Farm Year ${store.state.farmYear}`, text: lukeSays('prestige_done', { year: store.state.farmYear }), speaker: 'luke' });
        }}>
          Start the new year
        </Btn>
      </div>
    </Modal>
  );
}
