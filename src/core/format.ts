// Number and time formatting for the UI.

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function formatNumber(n: number, mode: 'short' | 'full' = 'short'): string {
  const v = Math.floor(n);
  if (mode === 'full' || Math.abs(v) < 10_000) return v.toLocaleString('en-US');
  let i = 0;
  let x = v;
  while (Math.abs(x) >= 1000 && i < SUFFIXES.length - 1) {
    x /= 1000;
    i++;
  }
  const digits = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
  return x.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1') + SUFFIXES[i];
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'Ready';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60 ? `${s % 60}s` : ''}`.trim();
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24 ? `${h % 24}h` : ''}`.trim();
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
