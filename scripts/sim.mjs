// Pacing simulator: plays a light daily player (about 18 minutes a day in 3 check-ins)
// through the real game core and reports time-to-milestone against the spec targets.
// Run: npm run sim   (options: --days 300 --quiet)
import * as G from '../src/core/index.ts';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 300;
const QUIET = args.includes('--quiet');
const MIN = 60_000;
const DAY = 86_400_000;

// three check-ins: [hour, minute, length in minutes]
const SESSIONS = [
  [7, 30, 6],
  [12, 30, 4],
  [20, 0, 8],
];

const start = new Date(2026, 9, 5, 7, 30).getTime();
const s = G.newGame(start);
s.tutorial.skipped = true;

const milestones = {};
const income = {};
function measure(label, fn) {
  const before = s.lifetimeCoins;
  const r = fn();
  income[label] = (income[label] ?? 0) + (s.lifetimeCoins - before);
  return r;
}
const mark = (id, t) => {
  if (milestones[id] === undefined) milestones[id] = (t - start) / DAY;
};

function nextSessionStart(t) {
  for (let d = 0; d < 3; d++) {
    for (const [h, m] of SESSIONS) {
      const base = new Date(t);
      const cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d, h, m).getTime();
      if (cand > t) return cand;
    }
  }
  return t + DAY;
}

function bestCrop(t, sessionEnd) {
  const crops = G.availableCrops(s, t);
  const next = nextSessionStart(sessionEnd);
  const mult = G.sellMultiplier(s) * G.CONFIG.STAND_RATE;
  let best = null;
  for (const c of crops) {
    if (c.seedCost > s.coins) continue;
    const grow = c.growMin * MIN * G.growMultiplier(s);
    const readyAt = t + grow;
    const harvestAt = readyAt <= sessionEnd ? readyAt : readyAt <= next ? next : nextSessionStart(readyAt - 1) ;
    const cycle = Math.max(harvestAt - t, MIN);
    const value = (c.sellPrice * mult - c.seedCost) / cycle;
    if (!best || value > best.value) best = { id: c.id, value };
  }
  return best?.id;
}

const keepFor = new Set();
function reserved(id) {
  // keep a little of what Claire might want and what the kitchen and winery need
  if (['milk', 'egg'].includes(id)) return 6;
  const wineFruit = G.C().raw.wines.some((w) => w.fruit === id);
  if (wineFruit && s.buildings.winery.stage === 2) return 10;
  return keepFor.has(id) ? 4 : 0;
}

function sellSurplus(t) {
  const market = G.marketStatus(s, t).open;
  const keys = Object.keys(s.inventory)
    .filter((k) => {
      const info = G.itemInfo(k.split('@')[0]);
      return info && info.kind !== 'material';
    })
    .sort((a, b) => G.baseValue(b) * s.inventory[b] - G.baseValue(a) * s.inventory[a]);
  for (const k of keys) {
    const qty = s.inventory[k] - reserved(k);
    if (qty <= 0) continue;
    if (market && G.sellAtMarket(s, k, qty, t).ok) {
      mark('firstMarket', t);
      continue;
    }
    G.sellAtStand(s, k, qty, t);
  }
}

const SEED_RESERVE = () => Math.min(5000, 60 + s.coins * 0.05);

function tryBuy(t) {
  let bought = true;
  let guard = 0;
  while (bought && guard++ < 50) {
    bought = false;
    const opts = [];
    const add = (label, cost, fn, prio = 1) => opts.push({ label, cost, fn, prio });
    for (const p of G.C().raw.parcels) {
      if (s.parcels[p.id] === 'overgrown') add(`clear ${p.id}`, p.clear.coins + G.missingCost(s, p.clear.materials).coins, () => G.clearParcel(s, p.id), 1.3);
      else if (s.parcels[p.id] === 'cleared') add(`restore ${p.id}`, p.restore.coins + G.missingCost(s, p.restore.materials).coins, () => G.restoreParcel(s, p.id, t), 1.0);
    }
    for (const b of G.C().raw.buildings) {
      const st = s.buildings[b.id];
      if (!st || !G.buildingVisible(s, b.id)) continue;
      if (st.stage === 0 && G.canRepair(s, b.id).ok) add(`repair ${b.id}`, G.repairTotal(s, b.id).coins, () => G.startRepair(s, b.id, t), 2);
      if (st.stage === 2 && st.level < b.maxLevel && b.maxLevel > 0) {
        const cost = G.upgradeCost(b.id, st.level);
        const prio = b.id === 'honor_box' ? 1.2 : b.id === 'farmhouse' ? 1.1 : 0.7;
        add(`upgrade ${b.id}`, cost.coins + G.missingCost(s, cost.materials).coins, () => G.upgrade(s, b.id, t), prio);
      }
    }
    for (const p of s.plots) {
      if (p.cleared || p.greenhouse || !G.plotAvailable(s, p)) continue;
      add(`plot ${p.id}`, G.plotDef(p)?.cost ?? 0, () => G.clearPlot(s, p.id), 1.6);
    }
    const cows = G.animalsOfKind(s, 'cow').length;
    if (cows < G.animalCapacity(s, 'cow')) add('buy cow', 900, () => G.buyAnimal(s, 'highland_cow', t), 1.4);
    const hens = G.animalsOfKind(s, 'chicken').length;
    if (hens < G.animalCapacity(s, 'chicken')) add('buy hen', 80, () => G.buyAnimal(s, 'hen', t), 1.4);
    const alm = G.almanacNext(s);
    if (alm && s.buildings.farmhouse.stage === 2) add('almanac', alm.cost, () => G.upgradeAlmanac(s), 0.5);
    // a guided player follows Luke's quests first
    const questTargets = new Set(G.activeQuests(s).flatMap((q) => (q.objective.type === 'building' || q.objective.type === 'parcel' ? [q.objective.id] : [])));
    for (const o of opts) if ([...questTargets].some((id) => o.label.endsWith(' ' + id))) o.prio *= 10;
    // weight by priority: cheaper and more important first
    opts.sort((a, b) => a.cost / a.prio - b.cost / b.prio);
    for (const o of opts) {
      if (o.cost + SEED_RESERVE() > s.coins) continue;
      const r = o.fn();
      if (r && r.ok !== false) {
        bought = true;
        break;
      }
    }
  }
}

function craftAndWine(t) {
  for (const j of [...s.kitchen.jobs]) G.collectCraft(s, j.id, t);
  const recipes = G.C().raw.recipes.filter((r) => G.recipeUnlocked(s, r) && G.recipeInSeason(s, r, t));
  const ranked = recipes
    .map((r) => ({ r, gain: G.baseValue(r.id) - r.inputs.reduce((n, i) => n + G.baseValue(i.id) * i.qty, 0) }))
    .sort((a, b) => b.gain - a.gain);
  for (const { r } of ranked) {
    while (s.kitchen.jobs.length < G.kitchenSlots(s)) {
      const nonBuyable = r.inputs.filter((i) => !G.itemInfo(i.id)?.buyable);
      if (!nonBuyable.every((i) => G.count(s, i.id) >= i.qty)) break;
      if (!G.startCraft(s, r.id, t).ok) break;
    }
  }
  for (const b of [...s.winery.batches]) {
    const tier = G.wineTier(b, t);
    if (tier && tier !== 'young') {
      G.bottleWine(s, b.id, t);
      mark('firstWine', t);
    }
  }
  for (const w of G.C().raw.wines) {
    while (G.canStartWine(s, w.id).ok) {
      if (!G.startWine(s, w.id, t).ok) break;
    }
  }
}

function playSession(startT, length) {
  let t = startT;
  const end = startT + length * MIN;
  G.applyOffline(s, t);
  s.pendingAway = null;
  G.tick(s, t);
  if (s.pendingRollover) s.pendingRollover = null;
  G.claimDaily(s, t);
  let playedGame = false;
  while (t <= end) {
    G.tick(s, t);
    measure('honor box and quests', () => G.collectAll(s, t));
    // fill orders
    s.claire.slots.forEach((slot, i) => {
      if (slot.order && G.canFill(s, slot.order)) {
        measure('claire orders', () => G.fillOrder(s, i, t));
        mark('firstOrder', t);
      }
    });
    keepFor.clear();
    for (const slot of s.claire.slots) for (const it of slot.order?.items ?? []) keepFor.add(it.id);
    craftAndWine(t);
    measure('selling', () => sellSurplus(t));
    measure('quests and other', () => tryBuy(t));
    // play one mini game per session when it pays
    if (!playedGame) {
      for (const m of G.C().raw.minigames) {
        if (s.buildings[m.building]?.stage === 2 && G.cooldownLeft(s, m.building, t) === 0) {
          measure('mini games', () => G.applyMinigameResult(s, m.id, 100, 2, t));
          playedGame = true;
          break;
        }
      }
    }
    for (const p of s.plots) {
      if (!p.cleared || p.crop || !G.plotAvailable(s, p)) continue;
      const id = bestCrop(t, end);
      if (!id) break;
      G.plant(s, p.id, id, t);
    }
    // a few tend taps per minute, like a person poking at the garden
    let taps = 0;
    for (const p of s.plots) if (taps < 4 && p.crop && G.tend(s, p.id, t).ok) taps++;
    G.claimJournal(s, t);
    for (const set of G.codexSets(s)) G.claimCodex(s, set.id);
    // milestones
    if ((s.stats.harvest ?? 0) > 0) mark('firstHarvest', t);
    if (s.buildings.coop.stage === 2) mark('coopRepaired', t);
    if (s.buildings.barn.stage === 2) mark('barnRestored', t);
    if (G.animalsOfKind(s, 'cow').length) mark('firstCow', t);
    if (s.buildings.kitchen.stage === 2) mark('kitchenWorking', t);
    if (s.buildings.winery.stage === 2) mark('wineryRestored', t);
    if (s.owned.cosmetics.some((id) => ['cow_hat', 'chicken_hat'].includes(G.C().cosmetics.get(id)?.slot))) mark('firstHat', t);
    if (G.restoredCount(s) >= 5) mark('fiveParcels', t);
    if (G.restorationPercent(s) >= 100) mark('fullRestoration', t);
    if (G.prestigeAvailable(s)) mark('prestigeAvailable', t);
    t += MIN;
  }
  G.drainEvents();
}

if (process.env.SIM_DEBUG) process.on("exit", () => { console.log("farmhouse", s.buildings.farmhouse.level, "mult", G.sellMultiplier(s).toFixed(2), "honor", s.buildings.honor_box.level, Object.entries(s.buildings).map(([k,v])=>k+":"+v.level).join(" ")); const st = Object.entries(s.stats).filter(([k])=>k.startsWith("harvest:")||k.startsWith("craft:")||k.startsWith("marketSell:")||k.startsWith("wineBottle")).sort((a,b)=>b[1]-a[1]).slice(0,25); console.log(st.map(x=>x.join("=")).join(" ")); });
const checkpoints = [1, 3, 7, 14, 28, 60, 90, 120, 180, 240, 300];
const log = [];
let t = start;
let lastDay = -1;
while (t < start + DAYS * DAY) {
  const [h, m, len] = SESSIONS.find(([hh, mm]) => new Date(t).getHours() === hh && new Date(t).getMinutes() === mm) ?? SESSIONS[0];
  playSession(t, t === start ? 12 : len); // the very first session is a longer tutorial session
  const day = Math.floor((t - start) / DAY) + 1;
  if (day !== lastDay && checkpoints.includes(day) && h === SESSIONS[2][0]) {
    log.push({ day, coins: Math.round(s.coins), lifetime: Math.round(s.lifetimeCoins), level: G.levelOf(s), restored: G.restoredCount(s), pct: G.restorationPercent(s), plots: s.plots.filter((p) => p.cleared).length, cows: G.animalsOfKind(s, 'cow').length });
    lastDay = day;
  }
  if (milestones.prestigeAvailable !== undefined && milestones.fullRestoration !== undefined && day > 250) break;
  t = nextSessionStart(t + len * MIN);
}

const TARGETS = [
  ['firstHarvest', 'First harvest', 0, 0.01],
  ['firstOrder', 'First Claire order', 0, 0.01],
  ['coopRepaired', 'Coop repaired', 0, 0.01],
  ['barnRestored', 'Barn restored', 2, 3],
  ['firstCow', 'First cow', 2, 3],
  ['kitchenWorking', 'Kitchen working', 4, 7, 'by'],
  ['firstMarket', 'First Farmers Market', 5, 7, 'by'],
  ['firstHat', 'First hat', 1, 7, 'by'],
  ['wineryRestored', 'Winery restored', 14, 28],
  ['firstWine', 'First wine', 14, 28],
  ['fiveParcels', '5 of 9 parcels restored', 75, 100],
  ['fullRestoration', '100% restoration', 180, 240],
  ['prestigeAvailable', 'First Heirloom Year available', 180, 240],
];

const fmt = (d) => (d === undefined ? 'never' : d < 1 ? `${Math.round(d * 24 * 60)} min` : `day ${d.toFixed(1)}`);
let flagged = 0;
console.log(`\nSelleck Homestead pacing report (${DAYS} simulated days, ~18 min/day in 3 check-ins)\n`);
console.log('Milestone'.padEnd(32) + 'Target'.padEnd(20) + 'Simulated'.padEnd(14) + 'Status');
for (const [id, label, lo, hi, kind] of TARGETS) {
  const v = milestones[id];
  // "first session" milestones are measured in session time: anything within day 0 counts
  const firstSession = hi <= 0.01;
  let ok;
  if (firstSession) ok = v !== undefined && v < 0.02;
  else ok = v !== undefined && (kind === 'by' || v >= lo * 0.75) && v <= hi * 1.25;
  if (!ok) flagged++;
  const target = firstSession ? 'first session' : lo === hi ? `day ${lo}` : `day ${lo} to ${hi}`;
  console.log(label.padEnd(32) + target.padEnd(20) + fmt(v).padEnd(14) + (ok ? 'ok' : 'OFF BY >25%'));
}
if (!QUIET) {
  console.log('\nCheckpoints');
  console.log('day'.padEnd(6) + 'coins'.padEnd(12) + 'lifetime'.padEnd(14) + 'level'.padEnd(7) + 'parcels'.padEnd(9) + 'restore%'.padEnd(10) + 'plots'.padEnd(7) + 'cows');
  for (const r of log) console.log(String(r.day).padEnd(6) + String(r.coins).padEnd(12) + String(r.lifetime).padEnd(14) + String(r.level).padEnd(7) + String(r.restored).padEnd(9) + String(r.pct).padEnd(10) + String(r.plots).padEnd(7) + r.cows);
}
if (!QUIET) {
  const total = Object.values(income).reduce((a, b) => a + b, 0);
  console.log('\nIncome by source');
  for (const [k, v] of Object.entries(income).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${String(Math.round(v)).padStart(12)}  ${((v / total) * 100).toFixed(1)}%`);
}
console.log(`\n${flagged ? `${flagged} milestone(s) deviate more than 25% from target.` : 'All milestones within 25% of target.'}`);
