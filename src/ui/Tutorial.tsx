// Luke's interactive onboarding: short, skippable, never blocks the game.
import * as G from '../core';
import { store } from './store';
import { nav } from './nav';
import { useStore } from './hooks';
import { Portrait, Btn } from './components';
import { lukeSays } from './luke';
import { useState } from 'preact/hooks';

export function TutorialBubble() {
  const s = useStore();
  const [intro, setIntro] = useState(() => (s.stats.plant ?? 0) === 0 && !s.tutorial.skipped && !s.tutorial.done);
  if (s.tutorial.done || s.tutorial.skipped || nav.tab !== 'farm' || nav.editDecor || nav.photo) return null;
  const q = G.tutorialQuest(s);
  if (!q && !intro) return null;
  const skip = () => {
    store.act((x) => {
      x.tutorial.skipped = true;
    });
    store.toast(lukeSays('tutorial_skip'));
  };
  if (intro) {
    return (
      <div class="tutorial" data-testid="tutorial">
        <Portrait who="luke" />
        <div class="grow">
          <p>{lukeSays('tutorial_start')}</p>
          <div class="btn-row">
            <Btn small testid="tutorial-start" onClick={() => setIntro(false)}>Show me around</Btn>
            <Btn small kind="ghost" testid="tutorial-skip" onClick={skip}>Skip</Btn>
          </div>
        </div>
      </div>
    );
  }
  const p = G.objectiveProgress(s, q!.objective);
  return (
    <div class="tutorial" data-testid="tutorial">
      <Portrait who="luke" scale={0.75} />
      <div class="grow">
        <strong>{q!.title}</strong>
        <p class="small">{q!.text}</p>
        {p.need > 1 ? <p class="small">{Math.min(p.have, p.need)}/{p.need}</p> : null}
      </div>
      <button class="close" aria-label="Skip tutorial" data-testid="tutorial-skip" onClick={skip}>
        ×
      </button>
    </div>
  );
}
