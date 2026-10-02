// Resolves manifest ids to URLs: final art in /public/assets wins, placeholders otherwise.
// Final art may be drawn at any resolution; it is fitted to the slot when displayed.
import manifest from '../../assets/manifest.json';
import index from 'virtual:asset-index';
import { fitScale } from './artfit';

export interface ArtMeta {
  headAnchor?: [number, number];
  hornSpan?: number;
  facing?: 'left' | 'right';
}

export interface ManifestEntry {
  id: string;
  category: string;
  path: string;
  w: number;
  h: number;
  frames: number;
  anchor: [number, number];
  headAnchor?: [number, number];
  hornSpan?: number;
  footprint?: [number, number];
  color?: string;
  tint?: string;
  art?: ArtMeta;
}

export const MANIFEST = manifest as ManifestEntry[];
const byId = new Map(MANIFEST.map((e) => [e.id, e]));
const real = new Set(index.ids);

export function entry(id: string): ManifestEntry | undefined {
  return byId.get(id);
}

export function hasRealArt(id: string): boolean {
  return real.has(id);
}

/** Real-art override for one frame (for example only the ready stage of a crop). */
export function hasFrameArt(id: string, frame: number): boolean {
  return !!index.frames[id]?.includes(frame);
}

export function frameKey(id: string, frame: number): string {
  return `${id}#f${frame}`;
}

export function realSize(id: string, frame?: number): [number, number] | undefined {
  return index.sizes[frame === undefined ? id : frameKey(id, frame)];
}

export function frameOverrides(): { id: string; frame: number }[] {
  return Object.entries(index.frames).flatMap(([id, fs]) => fs.map((frame) => ({ id, frame })));
}

export function assetUrl(id: string, frame?: number): string {
  const e = byId.get(id);
  const base = import.meta.env.BASE_URL;
  if (e && frame !== undefined && hasFrameArt(id, frame)) return `${base}${e.path.replace(/\.png$/, `_f${frame}.png`)}`;
  if (e && real.has(id)) return `${base}${e.path}`;
  return `${base}placeholders/${id}.png`;
}

/** Placement data for the art actually in use (final art has its own anchors). */
export function artMeta(id: string): ArtMeta {
  const e = byId.get(id);
  if (e?.art && real.has(id)) return e.art;
  return { headAnchor: e?.headAnchor, hornSpan: e?.hornSpan, facing: 'right' };
}

/** Display scale for a slot given the texture actually loaded (1 for placeholders). */
export function displayScale(id: string, frame?: number): number {
  const e = byId.get(id);
  if (!e) return 1;
  const size = frame !== undefined && hasFrameArt(id, frame) ? realSize(id, frame) : real.has(id) ? realSize(id) : undefined;
  if (!size) return 1;
  const realFrames = frame !== undefined && hasFrameArt(id, frame) ? 1 : realFrameCount(id);
  return fitScale(e, size[0] / realFrames, size[1]);
}

/** Final art can be a strip with the slot's frame count, or a single image. */
export function realFrameCount(id: string): number {
  const e = byId.get(id);
  const size = realSize(id);
  if (!e || !size || e.frames <= 1) return 1;
  const stripAspect = (e.w * e.frames) / e.h;
  const aspect = size[0] / size[1];
  return Math.abs(aspect - stripAspect) / stripAspect < 0.15 ? e.frames : 1;
}

/** Item icon id for an inventory key like `wine_plum@reserve`. */
export function itemIconId(key: string): string {
  return `item_${key.split('@')[0]}`;
}
