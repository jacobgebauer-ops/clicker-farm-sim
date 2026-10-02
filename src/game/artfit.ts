// How final art of any resolution is fitted to its slot. Pure, so it can be unit tested.

export interface Slot {
  category: string;
  w: number;
  h: number;
}

/** Categories that fill their footprint's width and may grow taller (roofs, tree tops). */
const WIDTH_FIT = new Set(['buildings', 'decor', 'props', 'tiles']);

export function fitScale(slot: Slot, artW: number, artH: number): number {
  if (artW <= 0 || artH <= 0) return 1;
  if (WIDTH_FIT.has(slot.category)) return slot.w / artW;
  return Math.min(slot.w / artW, slot.h / artH);
}
