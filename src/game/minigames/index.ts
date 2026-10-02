// Mini game registry. Every folder here with an index.ts exporting a MiniGame is picked up
// automatically; content/minigames.json ties each one to a building.
import type { MiniGame } from './types';

const modules = import.meta.glob<{ default: MiniGame }>('./*/index.ts', { eager: true });

export const MINIGAMES: Record<string, MiniGame> = {};
for (const mod of Object.values(modules)) MINIGAMES[mod.default.id] = mod.default;
