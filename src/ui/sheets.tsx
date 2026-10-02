// Bottom sheets opened from the farm map: plots, buildings, parcels, animals, Luna, and more.
import { useState, useEffect } from 'preact/hooks';
import * as G from '../core';
import type { GameState } from '../core';
import { store } from './store';
import { nav } from './nav';
import { useStore, useNow } from './hooks';
import { Sheet, Btn, Coins, Cost, Progress, Row, Sprite, Empty, Portrait, Ribbons, Stars } from './components';
import { askLuke } from './luke';
import { startMinigame } from '../game/game';

export function SheetHost() {
  useStore();
  const sh = nav.sheet;
  if (!sh) return null;
  const close = () => nav.closeSheet();
  switch (sh.kind) {
    case 'plot':
      return <PlotSheet id={sh.id} close={close} />;
    case 'fields':
      return <FieldsSheet close={close} />;
    case 'building':
      return <BuildingSheet id={sh.id} close={close} />;
    case 'parcel':
      return <ParcelSheet id={sh.id} close={close} />;
    case 'animal':
      return <AnimalSheet id={sh.id} close={close} />;
    case 'luna':
      return <LunaSheet close={close} />;
    case 'tourist':
      return <TouristSheet offer={sh} close={close} />;
    case 'luke':
      return <LukeSheet close={close} />;
    default:
      return null;
  }
}

// ---------- seeds ----------
function SeedPicker({ greenhouse, onPick, testPrefix = 'seed' }: { greenhouse: boolean; onPick: (cropId: string) => void; testPrefix?: string }) {
  const s = useStore();
  const now = useNow();
  const crops = G.availableCrops(s, now, greenhouse).sort((a, b) => a.growMin - b.growMin);
  if (!crops.length) return <Empty>No seeds available right now.</Empty>;
  const last = s.lastSeed;
  const ordered = last && crops.some((c) => c.id === last) ? [crops.find((c) => c.id === last)!, ...crops.filter((c) => c.id !== last)] : crops;
  return (
    <div class="seed-grid">
      {ordered.map((c) => (
        <button key={c.id} class={`seed ${c.id === last ? 'last' : ''}`} data-testid={`${testPrefix}-${c.id}`} disabled={s.coins < c.seedCost} onClick={() => onPick(c.id)}>
          <Sprite id={`crop_${c.id}`} frame={3} scale={1} />
          <span class="seed-name">{c.name}</span>
          <span class="seed-meta">
            {G.formatDuration(c.growMin * 60_000 * G.growMultiplier(s))} · <Coins n={c.seedCost} />
          </span>
          <span class="seed-sell">sells ~{G.formatNumber(G.standPrice(s, c.id, now))}</span>
        </button>
      ))}
    </div>
  );
}

function PlotSheet({ id, close }: { id: string; close: () => void }) {
  const s = useStore();
  const now = useNow();
  const plot = s.plots.find((p) => p.id === id);
  if (!plot) return null;
  const crop = plot.crop ? G.C().crops.get(G.resolveId(plot.crop)) : undefined;
  const title = plot.greenhouse ? 'Greenhouse Bed' : 'Garden Plot';
  if (!plot.cleared) {
    const cost = G.plotDef(plot)?.cost ?? 0;
    return (
      <Sheet title="Overgrown Plot" onClose={close} testid="plot-sheet">
        <p>Brambles have taken over this patch. Clear it to grow something here.</p>
        <Btn wide testid="clear-plot" disabled={s.coins < cost} onClick={() => store.act((st) => G.clearPlot(st, id)).ok && close()}>
          Clear for {cost ? <Coins n={cost} /> : 'free'}
        </Btn>
      </Sheet>
    );
  }
  if (crop && plot.readyAt !== undefined) {
    const ready = G.isReady(plot, now);
    return (
      <Sheet title={`${title}: ${crop.name}`} onClose={close} testid="plot-sheet">
        <div class="center">
          <Sprite id={`crop_${crop.id}`} frame={ready ? 3 : 1} scale={2} />
        </div>
        <Progress value={G.growthProgress(plot, now)} label={ready ? 'Ready!' : G.formatDuration(plot.readyAt - now)} />
        <div class="btn-row">
          {ready ? (
            <Btn wide testid="harvest-plot" onClick={() => store.act((st, n) => G.harvest(st, id, n)).ok && close()}>
              Harvest
            </Btn>
          ) : (
            <Btn wide kind="secondary" disabled={now < (plot.tendUntil ?? 0)} onClick={() => store.act((st, n) => G.tend(st, id, n))}>
              {now < (plot.tendUntil ?? 0) ? `Tended (${G.formatDuration((plot.tendUntil ?? 0) - now)})` : 'Tend (water)'}
            </Btn>
          )}
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={`Plant: ${title}`} onClose={close} testid="plot-sheet">
      <SeedPicker
        greenhouse={!!plot.greenhouse}
        onPick={(cropId) => {
          if (store.act((st, n) => G.plant(st, id, cropId, n)).ok) close();
        }}
      />
      {!plot.greenhouse && s.lastSeed ? (
        <Btn wide kind="secondary" testid="plant-all" onClick={() => {
          const n = store.act((st, t) => G.plantAll(st, s.lastSeed!, t));
          store.toast(`Planted ${n} ${G.itemName(s.lastSeed!)}`);
          close();
        }}>
          Plant all empty plots with {G.itemName(s.lastSeed)}
        </Btn>
      ) : null}
    </Sheet>
  );
}

function FieldsSheet({ close }: { close: () => void }) {
  const s = useStore();
  const now = useNow();
  const [pick, setPick] = useState<string | null>(null);
  const plots = s.plots.filter((p) => !p.greenhouse && G.plotAvailable(s, p));
  const ready = plots.filter((p) => G.isReady(p, now));
  const empty = plots.filter((p) => p.cleared && !p.crop);
  return (
    <Sheet title="Fields" onClose={close} testid="fields-sheet">
      <div class="btn-row">
        <Btn testid="fields-harvest" disabled={!ready.length} onClick={() => store.act((st, n) => ready.forEach((p) => G.harvest(st, p.id, n)))}>
          Harvest {ready.length}
        </Btn>
        <Btn kind="secondary" testid="fields-plant" disabled={!empty.length} onClick={() => setPick('pick')}>
          Plant {empty.length} empty
        </Btn>
      </div>
      {pick ? (
        <SeedPicker greenhouse={false} testPrefix="fields-seed" onPick={(cropId) => {
          const n = store.act((st, t) => G.plantAll(st, cropId, t));
          store.toast(`Planted ${n} ${G.itemName(cropId)}`);
          setPick(null);
        }} />
      ) : (
        <div class="list">
          {plots.map((p, i) => {
            const crop = p.crop ? G.C().crops.get(G.resolveId(p.crop)) : undefined;
            return (
              <Row key={p.id} testid={`plot-row-${i}`} onClick={() => nav.openSheet({ kind: 'plot', id: p.id })}>
                <span class="grow">{G.C().parcels.get(p.parcel)?.name} #{i + 1}</span>
                <span>{!p.cleared ? 'Overgrown' : crop ? (G.isReady(p, now) ? `${crop.name}: ready` : `${crop.name}: ${G.formatDuration((p.readyAt ?? now) - now)}`) : 'Empty'}</span>
              </Row>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// ---------- buildings ----------
function buildingEffect(s: GameState, id: string): string {
  const st = s.buildings[id];
  const lvl = st?.level ?? 1;
  switch (id) {
    case 'farmhouse':
      return `Reputation: everything sells for ${Math.round((G.reputationMult(s) - 1) * 100)}% more.`;
    case 'kitchen':
      return `${G.kitchenSlots(s)} cooking slots, ${Math.round((1 - G.kitchenSpeed(s)) * 100)}% faster.`;
    case 'coop':
      return `Room for ${G.animalCapacity(s, 'chicken')} chickens.`;
    case 'barn':
      return `Room for ${G.animalCapacity(s, 'cow')} Highland cows.`;
    case 'winery':
      return `${G.barrels(s)} barrels for fermenting.`;
    case 'greenhouse':
      return `${G.greenhouseBeds(s)} out-of-season bed${G.greenhouseBeds(s) > 1 ? 's' : ''}.`;
    case 'market_stall':
      return `${G.stallSlots(s)} stall slots per market day.`;
    case 'honor_box':
      return `About ${G.formatNumber(G.producerAmount(s, id))} coins an hour, holds 10 hours.`;
    case 'hive':
      return `${G.producerAmount(s, id)} honey every 4 hours.`;
    default:
      return lvl ? `Level ${lvl}` : '';
  }
}

function MinigameButton({ building }: { building: string }) {
  const s = useStore();
  const now = useNow();
  const mg = G.C().raw.minigames.find((m) => m.building === building);
  if (!mg || s.buildings[building]?.stage !== 2) return null;
  const cd = G.cooldownLeft(s, building, now);
  return (
    <div class="minigame-card">
      <div class="grow">
        <strong>{mg.name}</strong>
        <p class="small">{mg.blurb}</p>
        <p class="small">{cd > 0 ? `Reward cooldown: ${G.formatDuration(cd)}. Play for a high score!` : 'Stars skip timers: 1 star 15%, 2 stars 30%, 3 stars 50%.'}</p>
        {s.minigames.best[mg.id] ? <p class="small">Best: {s.minigames.best[mg.id]}</p> : null}
      </div>
      <Btn kind="gold" testid={`play-${mg.id}`} onClick={() => {
        nav.closeSheet();
        startMinigame(mg.id);
      }}>
        Play
      </Btn>
    </div>
  );
}

function BuildingSheet({ id, close }: { id: string; close: () => void }) {
  const s = useStore();
  const now = useNow();
  const b = G.C().buildings.get(id)!;
  const st = s.buildings[id];
  const parcelOk = s.parcels[b.parcel] !== 'overgrown';
  if (id === 'county_fair') {
    return (
      <Sheet title={b.name} onClose={close} testid="building-sheet">
        <p>{b.blurb}</p>
        <Btn wide kind="gold" testid="open-fair" onClick={() => { close(); nav.setTab('menu', 'heirloom'); }}>
          Visit the County Fair
        </Btn>
      </Sheet>
    );
  }
  return (
    <Sheet title={b.name} onClose={close} testid="building-sheet">
      <p class="small">{b.blurb}</p>
      {st.stage === 0 ? (
        <Panel>
          {parcelOk ? (
            <>
              <p>
                <strong>Ruined.</strong> Repair cost:
              </p>
              <Cost coins={b.repair.coins} materials={b.repair.materials} />
              <p class="small">Missing materials are bought from Andrew automatically. Takes {G.formatDuration(b.repair.minutes * 60_000)}.</p>
              <Btn wide testid="repair" disabled={!G.repairTotal(s, id).ok || s.coins < G.repairTotal(s, id).coins} onClick={() => store.act((x, n) => G.startRepair(x, id, n))}>
                Repair for <Coins n={G.repairTotal(s, id).coins} />
              </Btn>
            </>
          ) : (
            <p>Clear the {G.C().parcels.get(b.parcel)!.name} first.</p>
          )}
        </Panel>
      ) : st.stage === 1 ? (
        <Panel>
          <p><strong>Under repair.</strong></p>
          <Progress value={(now - (st.repairStartedAt ?? now)) / Math.max(1, (st.repairEndsAt ?? now) - (st.repairStartedAt ?? now))} label={G.formatDuration((st.repairEndsAt ?? now) - now)} />
          <Btn kind="secondary" disabled={s.ribbons < G.rushCost((st.repairEndsAt ?? now) - now)} onClick={() => store.act((x, n) => G.rushRepair(x, id, n))}>
            Finish now for <Ribbons n={G.rushCost((st.repairEndsAt ?? now) - now)} />
          </Btn>
        </Panel>
      ) : (
        <Panel>
          <p>
            <strong>Level {st.level}</strong>
            {b.maxLevel ? ` of ${b.maxLevel}` : ''}. {buildingEffect(s, id)}
          </p>
          {st.level < b.maxLevel ? (
            <>
              <Cost coins={G.upgradeCost(id, st.level).coins} materials={G.upgradeCost(id, st.level).materials} />
              <Btn wide testid="upgrade" disabled={s.coins < G.upgradeCost(id, st.level).coins + G.missingCost(s, G.upgradeCost(id, st.level).materials).coins} onClick={() => store.act((x, n) => G.upgrade(x, id, n))}>
                Upgrade to level {st.level + 1}
              </Btn>
            </>
          ) : (
            <p class="small">Fully upgraded. Beautiful.</p>
          )}
        </Panel>
      )}
      {st.stage === 2 ? <BuildingExtras id={id} close={close} /> : null}
    </Sheet>
  );
}

function Panel({ children }: { children: preact.ComponentChildren }) {
  return <div class="panel">{children}</div>;
}

function BuildingExtras({ id, close }: { id: string; close: () => void }) {
  const s = useStore();
  const now = useNow();
  const b = G.C().buildings.get(id)!;
  const go = (tab: import('./nav').Tab, sub: string) => {
    close();
    nav.setTab(tab, sub);
  };
  const parts: preact.ComponentChildren[] = [];
  if (b.produces) {
    const pending = G.producerPending(s, id, now);
    parts.push(
      <Panel key="prod">
        <p>Waiting to collect: {b.produces.item === 'coins' ? <Coins n={pending} /> : `${pending} ${G.itemName(b.produces.item)}`}</p>
        <Btn testid="collect-producer" disabled={!pending} onClick={() => store.act((x, n) => G.collectProducer(x, id, n))}>Collect</Btn>
      </Panel>,
    );
  }
  if (id === 'farmhouse') parts.push(<AlmanacPanel key="alm" />);
  if (id === 'kitchen') parts.push(<Btn key="k" wide onClick={() => go('craft', 'kitchen')}>Open the Kitchen</Btn>);
  if (id === 'winery') parts.push(<Btn key="w" wide onClick={() => go('craft', 'winery')}>Open the Winery</Btn>);
  if (id === 'market_stall') parts.push(<Btn key="m" wide onClick={() => go('shops', 'market')}>Go to the Farmers Market</Btn>);
  if (id === 'coop' || id === 'barn') parts.push(<AnimalPanel key="an" kind={id === 'barn' ? 'cow' : 'chicken'} />);
  if (id === 'greenhouse') {
    const beds = s.plots.filter((p) => p.greenhouse);
    parts.push(
      <Panel key="gh">
        <p><strong>Greenhouse beds</strong> (any season)</p>
        {beds.map((p) => {
          const crop = p.crop ? G.C().crops.get(G.resolveId(p.crop)) : undefined;
          return (
            <Row key={p.id} onClick={() => (G.isReady(p, now) ? store.act((x, n) => G.harvest(x, p.id, n)) : nav.openSheet({ kind: 'plot', id: p.id }))}>
              <span class="grow">{crop ? crop.name : 'Empty bed'}</span>
              <span>{crop ? (G.isReady(p, now) ? 'Harvest' : G.formatDuration((p.readyAt ?? now) - now)) : 'Plant'}</span>
            </Row>
          );
        })}
      </Panel>,
    );
  }
  parts.push(<MinigameButton key="mg" building={id} />);
  if (['farmhouse', 'barn', 'coop', 'kitchen', 'winery'].includes(id)) parts.push(<Btn key="st" kind="ghost" onClick={() => go('style', 'buildings')}>Paint and style</Btn>);
  return <>{parts}</>;
}

function AlmanacPanel() {
  const s = useStore();
  const now = useNow();
  const lvl = G.C().raw.almanac.levels.find((l) => l.level === s.almanacLevel)!;
  const next = G.almanacNext(s);
  const hints = G.hintsFor(s, now, 'almanac');
  const cover = G.C().raw.almanac.covers[Math.min(s.farmYear, G.C().raw.almanac.covers.length) - 1];
  return (
    <Panel>
      <p>
        <Sprite id="ui_almanac" scale={0.75} /> <strong>The Almanac</strong> (level {s.almanacLevel}, {cover?.name ?? ''} cover)
      </p>
      <p class="small">{lvl.text}</p>
      {hints.length ? (
        <ul class="hints">
          {hints.map((h, i) => (
            <li key={i}>{G.fill(G.pickLine('almanac', { hint: h })?.text ?? h, {})}</li>
          ))}
        </ul>
      ) : (
        <p class="small">Next week's market forecast appears on Wednesday.</p>
      )}
      {next ? (
        <>
          <Cost coins={next.cost} materials={next.materials} />
          <Btn kind="secondary" onClick={() => store.act((x) => G.upgradeAlmanac(x))}>Upgrade the Almanac</Btn>
        </>
      ) : null}
    </Panel>
  );
}

function AnimalPanel({ kind }: { kind: 'cow' | 'chicken' }) {
  const s = useStore();
  const now = useNow();
  const list = G.animalsOfKind(s, kind);
  const cap = G.animalCapacity(s, kind);
  const buyable = G.C().raw.animals.filter((a) => a.kind === kind && !a.deprecated);
  return (
    <Panel>
      <p>
        <strong>{kind === 'cow' ? 'Highland cows' : 'Chickens'}</strong> {list.length}/{cap}
      </p>
      {list.map((a) => {
        const def = G.C().animals.get(a.kind)!;
        return (
          <Row key={a.id} onClick={() => nav.openSheet({ kind: 'animal', id: a.id })}>
            <Sprite id={`anim_${a.kind}`} scale={kind === 'cow' ? 0.75 : 1} />
            <span class="grow">
              {a.name} <span class="small">({def.name})</span>
            </span>
            {a.stored > 0 ? <span class="pill">{a.stored} ready</span> : def.product ? <span class="small">{G.formatDuration(Math.max(0, a.prodAt + G.animalPeriod(s, a) - now))}</span> : null}
          </Row>
        );
      })}
      <div class="btn-row wrap">
        {buyable.map((d) => (
          <Btn key={d.id} kind="secondary" small disabled={list.length >= cap || s.coins < d.buyCost} onClick={() => store.act((x, n) => G.buyAnimal(x, d.id, n))}>
            Buy {d.name} <Coins n={d.buyCost} />
          </Btn>
        ))}
      </div>
    </Panel>
  );
}

// ---------- parcels ----------
function ParcelSheet({ id, close }: { id: string; close: () => void }) {
  const s = useStore();
  const p = G.C().parcels.get(id)!;
  const st = s.parcels[id];
  const cost = st === 'overgrown' ? p.clear : p.restore;
  const total = cost.coins + G.missingCost(s, cost.materials).coins;
  const plots = p.plots.length;
  return (
    <Sheet title={p.name} onClose={close} testid="parcel-sheet">
      <p>{p.blurb}</p>
      <p class="small">
        {st === 'overgrown' ? 'Overgrown with Himalayan blackberry. Clearing it opens up the buildings and the first plots.' : st === 'cleared' ? 'Cleared! Fully restoring it adds fences, fresh paint, more plots, and a reputation bonus.' : 'Fully restored.'}
      </p>
      <p class="small">{plots} plots in this acre.</p>
      {st !== 'restored' ? (
        <>
          <Cost coins={cost.coins} materials={cost.materials} />
          <Btn wide testid={st === 'overgrown' ? 'clear-parcel' : 'restore-parcel'} disabled={s.coins < total} onClick={() => {
            const r = store.act((x, n) => (st === 'overgrown' ? G.clearParcel(x, id) : G.restoreParcel(x, id, n)));
            if (r.ok) close();
          }}>
            {st === 'overgrown' ? 'Clear the brush' : 'Restore fully'} (<Coins n={total} />)
          </Btn>
        </>
      ) : null}
    </Sheet>
  );
}

// ---------- animals ----------
function AnimalSheet({ id, close }: { id: string; close: () => void }) {
  const s = useStore();
  const now = useNow();
  const a = s.animals.find((x) => x.id === id);
  const [name, setName] = useState(a?.name ?? '');
  if (!a) return null;
  const def = G.C().animals.get(a.kind)!;
  const isCow = def.kind === 'cow';
  const hats = s.owned.cosmetics.filter((c) => G.C().cosmetics.get(c)?.slot === (isCow ? 'cow_hat' : 'chicken_hat'));
  const necks = s.owned.cosmetics.filter((c) => G.C().cosmetics.get(c)?.slot === 'animal_neck');
  const bond = G.bondLevel(a);
  const th = G.CONFIG.BOND_THRESHOLDS;
  return (
    <Sheet title={a.name} onClose={close} testid="animal-sheet">
      <div class="namecard">
        <div class="animal-portrait">
          <Sprite id={`anim_${a.kind}`} scale={2} />
          {a.hat ? <span class="hat-badge"><Sprite id={`cos_${a.hat}`} scale={1} /></span> : null}
        </div>
        <div class="grow">
          <p class="small">{def.name}{a.growsAt ? `, grows up in ${G.formatDuration(a.growsAt - now)}` : ''}</p>
          {isCow ? (
            <>
              <p class="small">Bond level {bond}{bond >= 3 ? ' (double milk!)' : ''}</p>
              <Progress value={bond >= th.length - 1 ? 1 : (a.bond - th[bond]) / (th[bond + 1] - th[bond])} />
            </>
          ) : null}
          {def.product ? <p class="small">{a.stored > 0 ? `${a.stored} ${G.itemName(def.product)} ready` : `Next ${G.itemName(def.product)} in ${G.formatDuration(Math.max(0, a.prodAt + G.animalPeriod(s, a) - now))}`}</p> : null}
        </div>
      </div>
      <div class="btn-row">
        {def.product ? <Btn disabled={a.stored <= 0} onClick={() => store.act((x, n) => G.collectAnimal(x, id, n))}>Collect</Btn> : null}
        {isCow ? <Btn kind="secondary" disabled={now < a.brushUntil} onClick={() => store.act((x, n) => G.brush(x, id, n))}>{now < a.brushUntil ? `Brushed (${G.formatDuration(a.brushUntil - now)})` : 'Brush'}</Btn> : null}
      </div>
      <label class="field">
        Name
        <input value={name} maxLength={18} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={() => name !== a.name && store.act((x) => G.renameAnimal(x, id, name))} />
      </label>
      <p><strong>Hats</strong></p>
      <div class="chip-grid">
        <button class={`chip ${!a.hat ? 'on' : ''}`} onClick={() => store.act((x) => G.equipAnimal(x, id, 'hat', null))}>None</button>
        {hats.map((h) => (
          <button key={h} class={`chip ${a.hat === h ? 'on' : ''}`} onClick={() => store.act((x) => G.equipAnimal(x, id, 'hat', h))}>
            <Sprite id={`cos_${h}`} scale={1} /> {G.C().cosmetics.get(h)!.name}
          </button>
        ))}
      </div>
      <p><strong>Neckwear</strong></p>
      <div class="chip-grid">
        <button class={`chip ${!a.neck ? 'on' : ''}`} onClick={() => store.act((x) => G.equipAnimal(x, id, 'neck', null))}>None</button>
        {necks.map((h) => (
          <button key={h} class={`chip ${a.neck === h ? 'on' : ''}`} onClick={() => store.act((x) => G.equipAnimal(x, id, 'neck', h))}>
            <Sprite id={`cos_${h}`} scale={1} /> {G.C().cosmetics.get(h)!.name}
          </button>
        ))}
      </div>
      {!hats.length ? <p class="small">No hats yet. They come from quests, the Season Journal, and Andrew's shelf.</p> : null}
      <Btn kind="ghost" onClick={() => { close(); nav.setPhoto(true); }}>Photo mode</Btn>
    </Sheet>
  );
}

// ---------- Luna ----------
function LunaSheet({ close }: { close: () => void }) {
  const s = useStore();
  const now = useNow();
  const luna = G.C().raw.luna;
  const spot = G.lunaSpot(s, now);
  useEffect(() => {
    if (!store.state.stats['lunaStats']) store.act((x) => G.track(x, 'lunaStats'));
  }, []);
  return (
    <Sheet title="Luna" onClose={close} testid="luna-sheet">
      <div class="namecard">
        <Portrait who="luna" scale={1.25} />
        <div class="grow">
          <p class="small">An old black cat. {spot.text}</p>
        </div>
      </div>
      <table class="stats">
        <tbody>
          {luna.stats.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
          <tr>
            <th>Luna moments</th>
            <td>{s.luna.moments}</td>
          </tr>
          <tr>
            <th>Napping spots found</th>
            <td>
              {s.codex.lunaSpots.length}/{luna.spots.length}
            </td>
          </tr>
          <tr>
            <th>Gifts received</th>
            <td>
              {s.codex.lunaGifts.length}/{luna.gifts.length}
            </td>
          </tr>
        </tbody>
      </table>
      <Btn wide kind="secondary" onClick={() => store.act((x, n) => G.tapLuna(x, n))}>Pet Luna</Btn>
    </Sheet>
  );
}

function TouristSheet({ offer, close }: { offer: { key: string; qty: number; price: number }; close: () => void }) {
  const s = useStore();
  const have = G.count(s, offer.key);
  return (
    <Sheet title="A Traveling Tourist" onClose={close} testid="tourist-sheet">
      <div class="namecard">
        <Sprite id="char_tourist" scale={1.5} />
        <p class="grow">
          "Oh, how rustic! I simply must have {offer.qty} {G.itemName(offer.key)}. I'll pay <Coins n={offer.price} /> each!"
        </p>
      </div>
      <div class="btn-row">
        <Btn disabled={have < offer.qty} onClick={() => store.act((x) => G.acceptTourist(x, offer)).ok && close()}>
          Sell for <Coins n={offer.price * offer.qty} />
        </Btn>
        <Btn kind="ghost" onClick={close}>No thanks</Btn>
      </div>
    </Sheet>
  );
}

function LukeSheet({ close }: { close: () => void }) {
  useStore();
  const [lines] = useState(() => askLuke());
  return (
    <Sheet title="Luke" onClose={close} testid="luke-sheet">
      {lines.map((l, i) => (
        <div class="bubble-row" key={i}>
          {i === 0 ? <Portrait who="luke" /> : <span class="portrait-spacer" />}
          <div class={`bubble mood-${l.mood}`}>{l.text}</div>
        </div>
      ))}
      <Btn kind="ghost" onClick={close}>Thanks, Luke</Btn>
    </Sheet>
  );
}

export { Stars };
