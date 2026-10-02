// Shops tab: Claire's Cafe, Andrew's General Store, the Farmers Market, and the farm stand.
import * as G from '../../core';
import { store } from '../store';
import { nav } from '../nav';
import { useStore, useNow } from '../hooks';
import { Btn, Coins, ItemIcon, Progress, Row, Sprite, Tabs, Empty, Portrait, Ribbons } from '../components';
import { useState } from 'preact/hooks';

export function ShopsTab() {
  const s = useStore();
  const now = useNow();
  const sub = nav.sub.shops || 'claire';
  const fillable = s.claire.slots.filter((x) => x.order && G.canFill(s, x.order)).length;
  return (
    <div class="tabpage" data-testid="shops-tab">
      <Tabs
        value={sub}
        onChange={(id) => nav.setSub(id)}
        tabs={[
          { id: 'claire', label: "Claire's", badge: fillable },
          { id: 'andrew', label: "Andrew's" },
          { id: 'market', label: 'Market', badge: G.marketStatus(s, now).open ? 1 : 0 },
          { id: 'stand', label: 'Farm Stand' },
        ]}
      />
      {sub === 'claire' ? <Claire /> : sub === 'andrew' ? <Andrew /> : sub === 'market' ? <Market /> : <Stand />}
    </div>
  );
}

function Claire() {
  const s = useStore();
  const now = useNow();
  const level = G.cafeLevel(s);
  const next = G.cafeNextLevelAt(s);
  const chalk = G.hintsFor(s, now, 'claire');
  return (
    <div>
      <div class="namecard">
        <Portrait who="claire" />
        <div class="grow">
          <strong>Claire's Cafe</strong> <span class="small">level {level}</span>
          <Progress value={next ? s.claire.friendship / next : 1} label={next ? `Friendship ${s.claire.friendship}/${next}` : 'Best friends'} color="#C2477A" />
          {level < 3 ? <p class="small">At cafe level 3 Claire adds a wine pairing menu.</p> : null}
        </div>
      </div>
      <div class="chalkboard">
        <strong>Chalkboard</strong>
        {chalk.length ? chalk.map((h, i) => <p key={i}>{G.fill(G.pickLine('claire_chalkboard', { hint: h })?.text ?? h, {})}</p>) : <p>Today's special: whatever you bring me, dear. (Market hints show up midweek.)</p>}
      </div>
      <h3>Orders</h3>
      <div class="orders">
        {s.claire.slots.map((slot, i) => {
          const o = slot.order;
          if (!o) {
            return (
              <div class="order empty" key={i}>
                <span class="small">New order in {G.formatDuration(Math.max(0, slot.refillAt - now))}</span>
              </div>
            );
          }
          const can = G.canFill(s, o);
          const fast = now <= o.fastUntil;
          return (
            <div class={`order ${can ? 'ready' : ''}`} key={o.id} data-testid={`order-${i}`}>
              <div class="order-items">
                {o.items.map((it) => (
                  <span key={it.id} class={`mat ${G.haveForOrder(s, it.id) >= it.qty ? '' : 'short'}`}>
                    <ItemIcon id={it.id} />
                    {G.haveForOrder(s, it.id)}/{it.qty}
                    <span class="small">{G.itemName(it.id)}</span>
                  </span>
                ))}
              </div>
              <div class="order-reward">
                <Coins n={o.coins} />
                {o.ribbon ? <Ribbons n={1} /> : null}
                {fast ? <span class="pill">Speedy bonus {G.formatDuration(o.fastUntil - now)}</span> : null}
              </div>
              <div class="btn-row">
                <Btn small disabled={!can} testid={`fill-order-${i}`} onClick={() => {
                  const r = store.act((x, n) => G.fillOrder(x, i, n));
                  if (r.ok) store.toast(`Claire: "${G.pickLine('claire_order')?.text ?? 'Thank you!'}"`, 'info');
                }}>
                  Deliver
                </Btn>
                <Btn small kind="ghost" onClick={() => store.act((x, n) => G.skipOrder(x, i, n))}>Not today</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Andrew() {
  const s = useStore();
  const now = useNow();
  const [qty, setQty] = useState(5);
  const mats = G.C().raw.items.filter((i) => i.buyable && !i.deprecated);
  const stock = G.andrewStock(s, now);
  const weekly = stock.filter((x) => x.weekly);
  const catalog = stock.filter((x) => !x.weekly);
  const owned = (e: G.ShopEntry) => (e.type === 'cosmetic' ? s.owned.cosmetics.includes(e.id) : false);
  const entryRow = (e: G.ShopEntry) => (
    <Row key={`${e.type}:${e.id}:${e.weekly}`}>
      <Sprite id={e.type === 'decor' ? `decor_${e.id}` : `cos_${e.id}`} scale={0.75} />
      <span class="grow">
        {e.name}
        {e.type === 'decor' && s.owned.decor[e.id] ? <span class="small"> (own {s.owned.decor[e.id]})</span> : null}
      </span>
      <Btn small kind={e.ribbons ? 'gold' : 'primary'} disabled={owned(e) || (e.coins ? s.coins < e.coins : false) || (e.ribbons ? s.ribbons < e.ribbons : false)} onClick={() => store.act((x) => G.buyShopItem(x, e))}>
        {owned(e) ? 'Owned' : e.coins ? <Coins n={e.coins} /> : <Ribbons n={e.ribbons ?? 0} />}
      </Btn>
    </Row>
  );
  return (
    <div>
      <div class="namecard">
        <Portrait who="andrew" />
        <p class="grow">{G.pickLine('andrew')?.text}</p>
      </div>
      <h3>Building supplies</h3>
      <Tabs value={String(qty)} onChange={(v) => setQty(Number(v))} tabs={[{ id: '1', label: 'x1' }, { id: '5', label: 'x5' }, { id: '10', label: 'x10' }, { id: '25', label: 'x25' }]} />
      {mats.map((m) => (
        <Row key={m.id}>
          <ItemIcon id={m.id} />
          <span class="grow">
            {m.name} <span class="small">(have {G.count(s, m.id)})</span>
          </span>
          <Btn small testid={`buy-${m.id}`} disabled={s.coins < m.basePrice * qty} onClick={() => store.act((x) => G.buyMaterial(x, m.id, qty))}>
            <Coins n={m.basePrice * qty} />
          </Btn>
        </Row>
      ))}
      <h3>This week only</h3>
      {weekly.length ? weekly.map(entryRow) : <Empty>Nothing special this week.</Empty>}
      <h3>Catalog</h3>
      {catalog.map(entryRow)}
    </div>
  );
}

function sellableKeys(s: G.GameState) {
  return Object.keys(s.inventory)
    .filter((k) => s.inventory[k] > 0 && G.itemInfo(k) && G.itemInfo(k)!.kind !== 'material')
    .sort((a, b) => G.baseValue(b) - G.baseValue(a));
}

function Market() {
  const s = useStore();
  const now = useNow();
  const status = G.marketStatus(s, now);
  const wp = G.pricesFor(s, G.weekIndex(now));
  const goal = G.marketGoal(s);
  const keys = sellableKeys(s);
  const recap = G.pendingRecap(s, now);
  const nextHints = [...G.hintsFor(s, now, 'almanac'), ...G.hintsFor(s, now, 'claire')];
  return (
    <div>
      <div class="panel market-head">
        <strong>Farmers Market</strong>
        <p class="small">{status.open ? `Open today! ${s.market.distinct.length}/${G.stallSlots(s)} stall slots used.` : status.reason}</p>
        {status.open ? <Progress value={s.market.dayCoins / goal} label={s.market.goalDay === s.market.day ? 'Market goal reached!' : `Market goal ${G.formatNumber(s.market.dayCoins)}/${G.formatNumber(goal)}`} color="#3E64D8" /> : null}
      </div>
      {G.activeSeasonEvents(s, now).map((ev) => (
        <div class="panel" key={ev.id}>
          <strong>{ev.name}</strong>
          <p class="small">{ev.text}</p>
        </div>
      ))}
      {recap ? <Btn kind="secondary" wide onClick={() => nav.pushDialog({ kind: 'recap', week: recap.week })}>See last weekend's recap</Btn> : null}
      <h3>This week's demand</h3>
      <div class="demand">
        {wp.hot.map((h) => (
          <span key={h.id} class="pill hot">
            <ItemIcon id={h.id} scale={0.5} /> {G.itemName(h.id)} x{h.mult.toFixed(2)}
          </span>
        ))}
        {wp.slow.map((h) => (
          <span key={h.id} class="pill slow">
            <ItemIcon id={h.id} scale={0.5} /> {G.itemName(h.id)} x{h.mult.toFixed(2)}
          </span>
        ))}
      </div>
      <h3>Next week's whispers</h3>
      {nextHints.length ? (
        <ul class="hints">{nextHints.map((h, i) => <li key={i}>{h}</li>)}</ul>
      ) : (
        <p class="small">Hints about next week's hot items arrive on Wednesday from Luke, Claire's chalkboard, and the Almanac.</p>
      )}
      <h3>Sell</h3>
      {!keys.length ? <Empty>Nothing to sell yet.</Empty> : null}
      {keys.map((k) => {
        const price = G.marketUnitPrice(s, k, now);
        const mult = wp.mult(k.split('@')[0]);
        return (
          <Row key={k}>
            <ItemIcon id={k} />
            <span class="grow">
              {G.itemName(k)} <span class="small">x{G.count(s, k)}</span>
              {mult >= 1.5 ? <span class="pill hot">Hot</span> : mult < 0.85 ? <span class="pill slow">Slow</span> : null}
            </span>
            <span class="small"><Coins n={price} /> ea</span>
            <Btn small disabled={!status.open} testid={`market-sell-${k}`} onClick={() => store.act((x, n) => G.sellAtMarket(x, k, 1, n))}>1</Btn>
            <Btn small kind="secondary" disabled={!status.open} onClick={() => store.act((x, n) => G.sellAtMarket(x, k, G.count(x, k), n))}>All</Btn>
          </Row>
        );
      })}
    </div>
  );
}

function Stand() {
  const s = useStore();
  const now = useNow();
  const keys = sellableKeys(s);
  return (
    <div data-testid="stand">
      <p class="small">The farm stand by the road buys anything, any day, for a little less than the market pays.</p>
      {!keys.length ? <Empty>Nothing to sell yet.</Empty> : null}
      {keys.map((k) => (
        <Row key={k}>
          <ItemIcon id={k} />
          <span class="grow">
            {G.itemName(k)} <span class="small">x{G.count(s, k)}</span>
          </span>
          <span class="small"><Coins n={G.standPrice(s, k, now)} /> ea</span>
          <Btn small testid={`stand-sell-${k}`} onClick={() => store.act((x, n) => G.sellAtStand(x, k, 1, n))}>1</Btn>
          <Btn small kind="secondary" testid={`stand-sellall-${k}`} onClick={() => store.act((x, n) => G.sellAtStand(x, k, G.count(x, k), n))}>All</Btn>
        </Row>
      ))}
    </div>
  );
}
