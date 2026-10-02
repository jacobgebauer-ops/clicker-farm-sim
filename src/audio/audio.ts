// WebAudio: generated sound effects (ZzFX) and music. Music loops load from
// /audio/music/<season>.ogg when present; otherwise a gentle procedural music box plays
// a per-season pentatonic loop. Separate music and SFX volumes, plus mute.
import type { SeasonId } from '../../content/schema';
import { webPlatform } from '../platform/web';

type ZzParams = (number | undefined)[];

const SFX: Record<string, ZzParams> = {
  tap: [0.4, 0, 900, 0, 0.01, 0.03, 1],
  pop: [0.8, 0.05, 620, 0, 0.02, 0.06, 0, 1.5, 22],
  harvest: [0.9, 0.05, 480, 0, 0.03, 0.12, 0, 1.8, 30, 0, 220, 0.05],
  coin: [0.8, 0.05, 1350, 0, 0.03, 0.16, 0, 1.4, 0, 0, 620, 0.05],
  levelup: [0.9, 0, 520, 0.02, 0.22, 0.32, 0, 1, 0, 0, 320, 0.08, 0.1],
  moo: [1.2, 0.1, 130, 0.06, 0.35, 0.3, 2, 0.6, -1.5, 0, 0, 0, 0, 0.15, 4],
  cluck: [0.8, 0.2, 720, 0, 0.03, 0.05, 3, 1, -30, 0, 0, 0, 0.06, 0.3],
  meow: [0.8, 0.05, 680, 0.05, 0.14, 0.2, 0, 1, 8, -1, -180, 0.1, 0, 0, 6],
  purr: [0.9, 0.1, 55, 0.05, 0.45, 0.2, 4, 1, 0, 0, 0, 0, 0.03, 1],
  cork: [1.2, 0.05, 320, 0, 0.01, 0.06, 4, 1, 0, 0, 0, 0, 0, 0.6],
  bell: [0.8, 0, 1180, 0, 0.05, 0.6, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.1],
  chime: [0.8, 0, 1580, 0, 0.08, 0.5, 0, 1, 0, 0, 420, 0.1],
  fanfare: [0.8, 0, 420, 0.01, 0.2, 0.4, 0, 1, 0, 0, 210, 0.1, 0.12],
  fireworks: [1.4, 0.2, 100, 0.02, 0.1, 0.7, 4, 1, 0, 0, 0, 0, 0, 1],
  water: [0.5, 0.2, 1200, 0, 0.02, 0.08, 0, 1, -20, 0, 0, 0, 0, 0.3],
  hammer: [0.8, 0.1, 210, 0, 0.02, 0.08, 4, 1, 0, 0, 0, 0, 0.08, 0.8],
  bubble: [0.6, 0.2, 300, 0, 0.05, 0.1, 0, 1, 40],
  ding: [0.8, 0, 1000, 0, 0.05, 0.3],
  sparkle: [0.6, 0, 2000, 0, 0.05, 0.2, 0, 1, 0, 0, 500, 0.05, 0.05],
  error: [0.5, 0, 200, 0, 0.05, 0.1, 1, 1, -10],
  rain: [0.25, 0.5, 800, 0.1, 1, 0.5, 4, 1, 0, 0, 0, 0, 0, 1],
  hit: [0.7, 0, 880, 0, 0.02, 0.08, 0, 1.5],
  miss: [0.4, 0, 160, 0, 0.03, 0.1, 1, 1, -5],
  golden: [0.9, 0, 1500, 0, 0.06, 0.3, 0, 1, 0, 0, 750, 0.06, 0.06],
};

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let build: ((...p: ZzParams) => number[]) | null = null;
const buffers = new Map<string, AudioBuffer>();
let volumes = { music: 0.5, sfx: 0.7, mute: false };

export async function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(ctx.destination);
    musicGain.connect(ctx.destination);
    applyVolumes();
    const mod = await import('zzfx');
    mod.ZZFX.sampleRate = ctx.sampleRate;
    build = (...p) => mod.ZZFX.buildSamples(...p);
    if (pendingSeason) void playMusic(pendingSeason);
  }
  webPlatform.unlockAudio(ctx);
}

export function setVolumes(v: { music: number; sfx: number; mute: boolean }) {
  volumes = v;
  applyVolumes();
}

function applyVolumes() {
  if (!ctx || !sfxGain || !musicGain) return;
  const t = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(volumes.mute ? 0 : volumes.sfx * 0.9, t, 0.05);
  musicGain.gain.setTargetAtTime(volumes.mute ? 0 : volumes.music * 0.35, t, 0.1);
}

export function sfx(name: string, rate = 1) {
  if (!ctx || !sfxGain || !build || volumes.mute) return;
  const params = SFX[name];
  if (!params) return;
  let buf = buffers.get(name);
  if (!buf) {
    const samples = build(...params);
    buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.getChannelData(0).set(samples);
    buffers.set(name, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(sfxGain);
  src.start();
}

export function audioTime(): number {
  return ctx?.currentTime ?? 0;
}

/** A soft bell note at an exact audio time (used by music box and Milk Rhythm). */
export function bell(time: number, freq: number, dur = 0.5, gain = 0.25, dest: 'music' | 'sfx' = 'music') {
  if (!ctx) return;
  const out = dest === 'music' ? musicGain : sfxGain;
  if (!out) return;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o1.type = 'sine';
  o2.type = 'triangle';
  o1.frequency.value = freq;
  o2.frequency.value = freq * 2.01;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  o1.connect(g);
  o2.connect(g2).connect(g);
  g.connect(out);
  o1.start(time);
  o2.start(time);
  o1.stop(time + dur + 0.05);
  o2.stop(time + dur + 0.05);
}

// ---------- music ----------
const SCALES: Record<SeasonId | 'menu', { root: number; steps: number[]; bpm: number }> = {
  spring: { root: 392, steps: [0, 2, 4, 7, 9], bpm: 92 }, // G major pentatonic
  summer: { root: 440, steps: [0, 2, 4, 7, 9], bpm: 104 }, // A
  fall: { root: 349.2, steps: [0, 2, 4, 7, 9], bpm: 84 }, // F
  winter: { root: 329.6, steps: [0, 3, 5, 7, 10], bpm: 76 }, // E minor pentatonic (cozy, not gloomy)
  menu: { root: 261.6, steps: [0, 2, 4, 7, 9], bpm: 80 },
};

let musicTimer: number | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let currentTrack = '';
let pendingSeason: SeasonId | 'menu' | null = null;
const fileCache = new Map<string, AudioBuffer | null>();

async function loadTrack(name: string): Promise<AudioBuffer | null> {
  if (fileCache.has(name)) return fileCache.get(name)!;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/music/${name}.ogg`);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) throw new Error('missing');
    const buf = await ctx!.decodeAudioData(await res.arrayBuffer());
    fileCache.set(name, buf);
    return buf;
  } catch {
    fileCache.set(name, null);
    return null;
  }
}

export function stopMusic() {
  if (musicTimer !== null) clearInterval(musicTimer);
  musicTimer = null;
  try {
    musicSource?.stop();
  } catch {
    /* already stopped */
  }
  musicSource = null;
  currentTrack = '';
}

export async function playMusic(track: SeasonId | 'menu') {
  pendingSeason = track;
  if (!ctx || !musicGain) return;
  if (currentTrack === track) return;
  stopMusic();
  currentTrack = track;
  const file = await loadTrack(track);
  if (currentTrack !== track) return;
  if (file) {
    const src = ctx.createBufferSource();
    src.buffer = file;
    src.loop = true;
    src.connect(musicGain);
    src.start();
    musicSource = src;
    return;
  }
  musicBox(track);
}

/** Procedural music box: a calm 16-step melody over a slow bass, seeded per season. */
function musicBox(track: SeasonId | 'menu') {
  if (!ctx) return;
  const { root, steps, bpm } = SCALES[track];
  const beat = 60 / bpm / 2;
  let seed = [...track].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const freq = (deg: number, oct = 0) => root * Math.pow(2, (steps[((deg % steps.length) + steps.length) % steps.length] + 12 * (oct + Math.floor(deg / steps.length))) / 12);
  // two phrases of 16 steps, a gentle walk up and down the scale
  const phrase = (): (number | null)[] => {
    const out: (number | null)[] = [];
    let d = Math.floor(rand() * 3);
    for (let i = 0; i < 16; i++) {
      if (rand() < 0.28 && i % 4 !== 0) out.push(null);
      else {
        d += Math.floor(rand() * 3) - 1;
        d = Math.max(-1, Math.min(7, d));
        out.push(d);
      }
    }
    return out;
  };
  const melody = [...phrase(), ...phrase()];
  const bass = [0, 0, 3, 2];
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const schedule = () => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.6) {
      const m = melody[step % melody.length];
      if (m !== null) bell(next, freq(m, 0), 0.9, 0.18);
      if (step % 8 === 0) bell(next, freq(bass[(step / 8) % bass.length], -2), 2.2, 0.16);
      step++;
      next += beat;
    }
  };
  schedule();
  musicTimer = window.setInterval(schedule, 200);
}
