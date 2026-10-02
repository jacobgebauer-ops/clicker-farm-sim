// Resolves manifest ids to URLs: final art in /public/assets wins, placeholders otherwise.
import manifest from '../../assets/manifest.json';
import realArt from 'virtual:asset-index';

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
}

export const MANIFEST = manifest as ManifestEntry[];
const byId = new Map(MANIFEST.map((e) => [e.id, e]));
const real = new Set(realArt);

export function entry(id: string): ManifestEntry | undefined {
  return byId.get(id);
}

export function hasRealArt(id: string): boolean {
  return real.has(id);
}

export function assetUrl(id: string): string {
  const e = byId.get(id);
  const base = import.meta.env.BASE_URL;
  if (e && real.has(id)) return `${base}${e.path}`;
  return `${base}placeholders/${id}.png`;
}

/** Item icon id for an inventory key like `wine_plum@reserve`. */
export function itemIconId(key: string): string {
  return `item_${key.split('@')[0]}`;
}
