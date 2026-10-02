// "Ask Luke": context tips for the current screen, market gossip, and chatter.
import * as G from '../core';
import { store } from './store';
import { nav } from './nav';

export interface LukeLine {
  text: string;
  mood: string;
  speaker: 'luke' | 'claire' | 'andrew' | 'luna';
}

function screenKey(): string {
  if (nav.tab === 'farm') return 'screen:farm';
  if (nav.tab === 'craft') return nav.sub.craft === 'winery' || nav.sub.craft === 'cellar' ? 'screen:winery' : 'screen:kitchen';
  if (nav.tab === 'shops') return `screen:${nav.sub.shops === 'stand' ? 'market' : nav.sub.shops}`;
  if (nav.tab === 'style') return 'screen:style';
  const sub = nav.sub.menu;
  if (sub === 'journal' || sub === 'quests' || sub === 'codex' || sub === 'settings' || sub === 'heirloom') return `screen:${sub}`;
  return 'tip';
}

export function askLuke(): LukeLine[] {
  const s = store.state;
  const now = store.now();
  const season = G.currentSeason(s, now);
  const out: LukeLine[] = [];
  const tut = G.tutorialQuest(s);
  if (tut) out.push({ text: `${tut.title}: ${tut.hint ?? tut.text}`, mood: 'happy', speaker: 'luke' });
  const screen = G.pickLine(screenKey(), {}, season);
  if (screen) out.push({ text: screen.text, mood: screen.mood, speaker: 'luke' });
  const hints = G.hintsFor(s, now, 'luke');
  if (hints.length && Math.random() < 0.6) {
    const l = G.pickLine('market_hint', { hint: hints[0] }, season);
    if (l) out.push({ text: l.text, mood: l.mood, speaker: 'luke' });
  } else {
    const l = G.pickLine(Math.random() < 0.5 ? 'tip' : 'chatter', {}, season);
    if (l) out.push({ text: l.text, mood: l.mood, speaker: 'luke' });
  }
  return out;
}

export function lukeSays(trigger: string, vars: Record<string, string | number> = {}): string {
  const s = store.state;
  return G.pickLine(trigger, vars, G.currentSeason(s, store.now()))?.text ?? '';
}
