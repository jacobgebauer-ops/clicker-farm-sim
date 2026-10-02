import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Platform } from './platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const installListeners: (() => void)[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installListeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installListeners.forEach((f) => f());
  });
}

let hapticsOn = true;
export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
}

export const webPlatform: Platform = {
  kind: 'web',
  storage: {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage full or blocked: the IndexedDB mirror still has a copy */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    async mirrorGet(key) {
      try {
        return (await idbGet<string>(key)) ?? null;
      } catch {
        return null;
      }
    },
    async mirrorSet(key, value) {
      try {
        await idbSet(key, value);
      } catch {
        /* ignore */
      }
    },
    async persist() {
      try {
        return (await navigator.storage?.persist?.()) ?? false;
      } catch {
        return false;
      }
    },
  },
  install: {
    available: () => !!deferred,
    async prompt() {
      if (!deferred) return false;
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      installListeners.forEach((f) => f());
      return choice.outcome === 'accepted';
    },
    onChange(cb) {
      installListeners.push(cb);
    },
    isStandalone: () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
  },
  monetization: { enabled: false },
  unlockAudio(ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
  },
  haptic(kind) {
    if (!hapticsOn || !navigator.vibrate) return;
    navigator.vibrate(kind === 'light' ? 8 : kind === 'medium' ? 18 : [10, 40, 18]);
  },
  async saveFile(blob, filename) {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] }) && /image\//.test(blob.type)) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch {
        /* fall back to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  },
};
