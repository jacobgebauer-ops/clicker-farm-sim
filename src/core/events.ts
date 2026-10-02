// A tiny outbox so pure core functions can announce things (toasts, fanfares, sounds)
// without importing any UI. The UI drains it after each action/tick.

export type CoreEvent =
  | { type: 'toast'; text: string; icon?: string }
  | { type: 'coins'; amount: number; x?: number; y?: number }
  | { type: 'ribbons'; amount: number }
  | { type: 'xp'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'quest'; id: string; title: string }
  | { type: 'achievement'; id: string; name: string }
  | { type: 'wish'; text: string }
  | { type: 'harvest'; plot: string; item: string }
  | { type: 'collect'; item: string; qty: number; x?: number; y?: number }
  | { type: 'unlock'; text: string }
  | { type: 'sfx'; name: string }
  | { type: 'luna'; text: string }
  | { type: 'building'; id: string; stage: number; level: number };

let queue: CoreEvent[] = [];

export function emit(e: CoreEvent) {
  queue.push(e);
  if (queue.length > 200) queue.shift();
}

export function drainEvents(): CoreEvent[] {
  const out = queue;
  queue = [];
  return out;
}
