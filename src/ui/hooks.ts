import { useEffect, useState } from 'preact/hooks';
import { store } from './store';

/** Re-render whenever the store changes. */
export function useStore() {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((n) => n + 1)) as () => void, []);
  return store.state;
}

/** A clock that re-renders every second. */
export function useNow(ms = 1000) {
  const [now, set] = useState(store.now());
  useEffect(() => {
    const t = window.setInterval(() => set(store.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
