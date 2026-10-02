// Creates the Phaser game (crisp integer-scaled pixel art) and exposes a small API to the UI.
import Phaser from 'phaser';
import * as G from '../core';
import { BootScene } from './BootScene';
import { FarmScene } from './FarmScene';
import { MINIGAMES } from './minigames';
import { store } from '../ui/store';
import { nav } from '../ui/nav';
import { playMusic } from '../audio/audio';

let game: Phaser.Game | null = null;

function cssSize(parent: HTMLElement) {
  return { w: parent.clientWidth || window.innerWidth, h: parent.clientHeight || window.innerHeight };
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const dpr = Math.min(4, window.devicePixelRatio || 1);
  const { w, h } = cssSize(parent);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round(w * dpr),
    height: Math.round(h * dpr),
    backgroundColor: '#2B1B3D',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    input: { activePointers: 3 },
    scene: [BootScene, FarmScene, ...Object.values(MINIGAMES).map((m) => m.scene)],
    banner: false,
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: true },
  });
  const onResize = () => {
    if (!game) return;
    const d = Math.min(4, window.devicePixelRatio || 1);
    const size = cssSize(parent);
    game.scale.setZoom(1 / d);
    game.scale.resize(Math.round(size.w * d), Math.round(size.h * d));
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  return game;
}

export function farmScene(): FarmScene | null {
  const s = game?.scene.getScene('Farm') as FarmScene | undefined;
  return s && s.sys.isActive() ? s : null;
}

/** Launch a mini game over the farm. Results flow back through the core reward rules. */
export function startMinigame(id: string) {
  const mg = MINIGAMES[id];
  if (!game || !mg) return;
  store.inMinigame = true;
  nav.refresh();
  game.scene.sleep('Farm');
  void playMusic('menu');
  const s = store.state;
  mg.start({
    game,
    difficulty: G.difficultyFor(s, id),
    reduceMotion: s.settings.reduceMotion,
    lunaMoment: () => store.act((st) => G.lunaMoment(st)),
    finish(score, stars, quit) {
      game!.scene.stop(mg.sceneKey);
      game!.scene.wake('Farm');
      store.inMinigame = false;
      void playMusic(G.currentSeason(store.state, store.now()));
      if (!quit) {
        const outcome = store.act((st, now) => G.applyMinigameResult(st, id, score, stars, now));
        nav.pushDialog({ kind: 'minigameResult', game: id, score, stars, outcome });
      } else nav.refresh();
    },
  });
}

export async function takePhoto(): Promise<Blob | null> {
  const scene = farmScene();
  if (!scene) return null;
  return scene.snapshot();
}
