// The single source of time for the whole game. Nothing else may call Date.now().
// Debug time travel and tests move time by changing the offset or the source.

export interface TimeSource {
  now(): number;
}

const systemSource: TimeSource = { now: () => Date.now() };

let source: TimeSource = systemSource;
let offsetMs = 0;

export const Clock = {
  now(): number {
    return source.now() + offsetMs;
  },
  /** Replace the underlying time source (tests use a fixed or manual source). */
  setSource(next: TimeSource | null) {
    source = next ?? systemSource;
  },
  getOffset(): number {
    return offsetMs;
  },
  setOffset(ms: number) {
    offsetMs = ms;
  },
  /** Jump forward (or backward) by ms. Used by debug time travel. */
  advance(ms: number) {
    offsetMs += ms;
  },
  /** Real wall time with no offset (used to measure frame deltas, never game logic). */
  real(): number {
    return systemSource.now();
  },
};

/** A manual clock for tests and the pacing sim. */
export function manualSource(start: number): TimeSource & { set(t: number): void; add(ms: number): void } {
  let t = start;
  return {
    now: () => t,
    set(v: number) {
      t = v;
    },
    add(ms: number) {
      t += ms;
    },
  };
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
