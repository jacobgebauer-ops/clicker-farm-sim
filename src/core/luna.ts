// Luna: an old black cat who does absolutely nothing useful. No gameplay benefit, ever.
import { C } from './content';
import { emit } from './events';
import { Rng } from './rng';
import { dayKey } from './calendar';
import { track } from './economy';
import type { GameState } from './state';

/** Luna picks a new silly spot each morning and again after lunch. */
export function lunaSpot(s: GameState, now: number) {
  const spots = C().raw.luna.spots.filter((sp) => s.parcels[sp.parcel] && s.parcels[sp.parcel] !== 'overgrown');
  const list = spots.length ? spots : C().raw.luna.spots.slice(0, 1);
  const half = new Date(now).getHours() < 13 ? 'am' : 'pm';
  const rng = new Rng(`luna:${dayKey(now)}:${half}:${s.createdAt}`);
  return rng.pick(list);
}

export interface LunaTap {
  newSpot: boolean;
  spotText: string;
  gift?: { id: string; name: string; desc: string };
}

export function tapLuna(s: GameState, now: number): LunaTap {
  const spot = lunaSpot(s, now);
  s.luna.moments++;
  track(s, 'lunaTap');
  emit({ type: 'sfx', name: s.luna.moments % 2 ? 'purr' : 'meow' });
  const res: LunaTap = { newSpot: false, spotText: spot.text };
  if (!s.codex.lunaSpots.includes(spot.id)) {
    s.codex.lunaSpots.push(spot.id);
    res.newSpot = true;
    emit({ type: 'luna', text: `Found Luna: ${spot.text} (${s.codex.lunaSpots.length}/${C().raw.luna.spots.length})` });
  }
  // very rarely, a gift (at most once a day)
  const day = dayKey(now);
  const rng = new Rng(`lunagift:${s.luna.moments}:${s.createdAt}`);
  if (s.luna.lastGiftDay !== day && s.luna.moments >= 5 && rng.chance(0.04)) {
    const gifts = C().raw.luna.gifts;
    const unowned = gifts.filter((g) => !s.codex.lunaGifts.includes(g.id));
    const gift = unowned.length ? rng.pick(unowned) : rng.pick(gifts);
    if (!s.codex.lunaGifts.includes(gift.id)) s.codex.lunaGifts.push(gift.id);
    s.luna.lastGiftDay = day;
    res.gift = gift;
    emit({ type: 'luna', text: `Luna presents you with a gift: ${gift.name}. ${gift.desc}` });
  }
  return res;
}

/** A Luna moment that is not a tap on the farm (Weed Pull counts these). Never a benefit. */
export function lunaMoment(s: GameState) {
  s.luna.moments++;
  track(s, 'lunaTap');
}
