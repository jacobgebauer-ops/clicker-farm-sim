// Craft tab: Kitchen, Winery, and the Cellar collection.
import { useState } from 'preact/hooks';
import * as G from '../../core';
import { store } from '../store';
import { nav } from '../nav';
import { useStore, useNow } from '../hooks';
import { Btn, Coins, ItemIcon, Progress, Row, Sprite, Tabs, Empty, Ribbons } from '../components';

export function CraftTab() {
  useStore();
  const sub = nav.sub.craft || 'kitchen';
  return (
    <div class="tabpage" data-testid="craft-tab">
      <Tabs
        value={sub}
        onChange={(id) => nav.setSub(id)}
        tabs={[
          { id: 'kitchen', label: 'Kitchen' },
          { id: 'winery', label: 'Winery' },
          { id: 'cellar', label: 'Cellar' },
          { id: 'pantry', label: 'Pantry' },
        ]}
      />
      {sub === 'kitchen' ? <Kitchen /> : sub === 'winery' ? <Winery /> : sub === 'cellar' ? <Cellar /> : <Pantry />}
    </div>
  );
}

function Kitchen() {
  const s = useStore();
  const now = useNow();
  if (s.buildings.kitchen.stage !== 2) {
    return <Empty>The summer kitchen is still a wreck. Restore it on the Homestead to start cooking.</Empty>;
  }
  const slots = G.kitchenSlots(s);
  const recipes = G.C().raw.recipes.filter((r) => !r.deprecated && G.isUnlocked(s, r.requires));
  const unlocked = recipes.filter((r) => G.recipeUnlocked(s, r));
  const locked = recipes.filter((r) => !G.recipeUnlocked(s, r));
  return (
    <div>
      <h3>
        Cooking ({s.kitchen.jobs.length}/{slots})
      </h3>
      {s.kitchen.jobs.length === 0 ? <p class="small">Nothing cooking. Pick a recipe below.</p> : null}
      {s.kitchen.jobs.map((j) => {
        const r = G.C().recipes.get(j.recipe);
        const done = now >= j.endsAt;
        return (
          <Row key={j.id}>
            <ItemIcon id={j.recipe} />
            <div class="grow">
              <div>{r?.name ?? j.recipe}</div>
              <Progress value={(now - j.startedAt) / Math.max(1, j.endsAt - j.startedAt)} label={done ? 'Ready' : G.formatDuration(j.endsAt - now)} />
            </div>
            {done ? (
              <Btn small onClick={() => store.act((x, n) => G.collectCraft(x, j.id, n))}>Collect</Btn>
            ) : (
              <Btn small kind="ghost" disabled={s.ribbons < G.rushCost(j.endsAt - now)} onClick={() => store.act((x, n) => G.rushCraft(x, j.id, n))}>
                <Ribbons n={G.rushCost(j.endsAt - now)} />
              </Btn>
            )}
          </Row>
        );
      })}
      <h3>Recipes</h3>
      <div class="list">
        {unlocked.map((r) => {
          const can = G.canCraft(s, r.id, now);
          const inSeason = G.recipeInSeason(s, r, now);
          return (
            <div class="recipe" key={r.id}>
              <ItemIcon id={r.id} />
              <div class="grow">
                <div>
                  <strong>{r.name}</strong> <span class="small">({G.formatDuration(r.craftMin * 60_000 * G.kitchenSpeed(s))})</span>
                </div>
                <div class="ingredients">
                  {r.inputs.map((i) => (
                    <span key={i.id} class={`mat ${G.count(s, i.id) >= i.qty ? '' : 'short'}`}>
                      <ItemIcon id={i.id} scale={0.5} />
                      {G.count(s, i.id)}/{i.qty}
                    </span>
                  ))}
                </div>
                <div class="small">
                  Worth about <Coins n={G.standPrice(s, r.id, now)} /> at the stand{!inSeason ? `; only in ${r.seasons?.join(', ')}` : ''}
                  {can.buyCoins ? <>; pantry items <Coins n={can.buyCoins} /></> : null}
                </div>
              </div>
              <Btn small disabled={!can.ok} testid={`cook-${r.id}`} onClick={() => store.act((x, n) => G.startCraft(x, r.id, n))}>
                Cook
              </Btn>
            </div>
          );
        })}
      </div>
      {locked.length ? (
        <>
          <h3>Still to learn</h3>
          <div class="list">
            {locked.map((r) => (
              <Row key={r.id} class="locked">
                <Sprite id="ui_lock" scale={0.5} />
                <span class="grow">{r.name}</span>
                <span class="small">{r.unlock.quest ? 'From a quest' : `Kitchen level ${(r.unlock.level ?? 0) + 1}`}</span>
              </Row>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Winery() {
  const s = useStore();
  const now = useNow();
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [label, setLabel] = useState('label_classic');
  if (s.buildings.winery.stage !== 2) return <Empty>Grandpa's winery is waiting in the Vineyard. Clear the vineyard and restore it to start making wine.</Empty>;
  const labels = s.owned.cosmetics.filter((c) => G.C().cosmetics.get(c)?.slot === 'wine_label');
  const wines = G.C().raw.wines.filter((w) => G.wineUnlocked(s, w.id));
  return (
    <div>
      <h3>
        Barrels ({s.winery.batches.length}/{G.barrels(s)})
      </h3>
      {s.winery.batches.map((b) => {
        const w = G.C().wines.get(b.wine);
        const tier = G.wineTier(b, now);
        const next = G.nextTierIn(b, now);
        return (
          <div class="recipe" key={b.id}>
            <ItemIcon id={b.wine} />
            <div class="grow">
              <div>
                <strong>{s.wineNames[b.wine]?.name ?? w?.name ?? b.wine}</strong>
              </div>
              {tier ? (
                <div class="small">
                  {tier[0].toUpperCase() + tier.slice(1)}
                  {next ? `; ${next.tier[0].toUpperCase() + next.tier.slice(1)} in ${G.formatDuration(next.ms)}` : '; as good as it gets'}
                </div>
              ) : (
                <Progress value={(now - b.startedAt) / Math.max(1, b.readyAt - b.startedAt)} label={`Fermenting ${G.formatDuration(b.readyAt - now)}`} />
              )}
            </div>
            {tier ? (
              <Btn small testid="bottle" onClick={() => {
                setNaming(b.id);
                setName(s.wineNames[b.wine]?.name ?? w?.name ?? '');
                setLabel(s.wineNames[b.wine]?.label ?? 'label_classic');
              }}>
                Bottle
              </Btn>
            ) : null}
          </div>
        );
      })}
      {naming ? (
        <div class="panel">
          <h3>Name this wine</h3>
          <input class="text" value={name} maxLength={28} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <p class="small">Label style</p>
          <div class="chip-grid">
            {labels.map((l) => (
              <button key={l} class={`chip ${label === l ? 'on' : ''}`} onClick={() => setLabel(l)}>
                <Sprite id={`cos_${l}`} scale={0.5} /> {G.C().cosmetics.get(l)?.name}
              </button>
            ))}
          </div>
          <div class="btn-row">
            <Btn onClick={() => {
              store.act((x, n) => G.bottleWine(x, naming, n, name, label));
              setNaming(null);
            }}>
              Bottle it
            </Btn>
            <Btn kind="ghost" onClick={() => setNaming(null)}>Keep aging</Btn>
          </div>
        </div>
      ) : null}
      <h3>Start a batch</h3>
      <p class="small">Leave a batch in the barrel past its ferment time to age it: Young, then Cellared, then Reserve.</p>
      {wines.map((w) => {
        const can = G.canStartWine(s, w.id);
        return (
          <div class="recipe" key={w.id}>
            <ItemIcon id={w.id} />
            <div class="grow">
              <div>
                <strong>{w.name}</strong> <span class="small">({G.formatDuration(w.fermentMin * 60_000 * G.wineSpeed(s))})</span>
              </div>
              <div class="ingredients">
                {G.wineInputs(w.id).map((i) => (
                  <span key={i.id} class={`mat ${G.count(s, i.id) >= i.qty ? '' : 'short'}`}>
                    <ItemIcon id={i.id} scale={0.5} />
                    {G.count(s, i.id)}/{i.qty}
                  </span>
                ))}
              </div>
              <div class="small">{w.blurb}</div>
            </div>
            <Btn small disabled={!can.ok} onClick={() => store.act((x, n) => G.startWine(x, w.id, n))}>Start</Btn>
          </div>
        );
      })}
    </div>
  );
}

function Cellar() {
  const s = useStore();
  const wines = G.C().raw.wines.filter((w) => G.isUnlocked(s, w.requires));
  return (
    <div>
      <h3>
        Cellar collection ({s.codex.wines.length}/{wines.length})
      </h3>
      <div class="cellar-grid">
        {wines.map((w) => {
          const have = s.codex.wines.includes(w.id);
          const named = s.wineNames[w.id];
          const stock = ['young', 'cellared', 'reserve'].map((t) => G.count(s, `${w.id}@${t}`));
          return (
            <div key={w.id} class={`bottle-card ${have ? '' : 'unknown'}`}>
              <Sprite id={`cos_${named?.label ?? 'label_classic'}`} scale={1} />
              <strong>{have ? named?.name ?? w.name : '???'}</strong>
              <span class="small">{w.family ? 'Family recipe' : w.name}</span>
              {have ? <span class="small">Y {stock[0]} · C {stock[1]} · R {stock[2]}</span> : <span class="small">Not bottled yet</span>}
            </div>
          );
        })}
      </div>
      <h3>Recent bottlings</h3>
      {s.cellarLog.slice(0, 12).map((l, i) => (
        <Row key={i}>
          <ItemIcon id={l.wine} scale={0.75} />
          <span class="grow">{l.name}</span>
          <span class="small">{l.tier}</span>
        </Row>
      ))}
    </div>
  );
}

function Pantry() {
  const s = useStore();
  const keys = Object.keys(s.inventory)
    .filter((k) => s.inventory[k] > 0 && G.itemInfo(k))
    .sort((a, b) => (G.itemInfo(a)!.kind + a).localeCompare(G.itemInfo(b)!.kind + b));
  if (!keys.length) return <Empty>The pantry is empty. Go grow something!</Empty>;
  return (
    <div class="inv-grid" data-testid="pantry">
      {keys.map((k) => (
        <div class="inv" key={k} title={G.itemName(k)}>
          <ItemIcon id={k} />
          <span class="qty">{G.formatNumber(s.inventory[k])}</span>
          <span class="inv-name">{G.itemName(k)}</span>
        </div>
      ))}
    </div>
  );
}
