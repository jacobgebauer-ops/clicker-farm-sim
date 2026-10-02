// The seam between the game and the device. Today there is a web implementation;
// a Capacitor wrapper can implement the same interface later without touching the game.

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Durable mirror (IndexedDB on web). */
  mirrorGet(key: string): Promise<string | null>;
  mirrorSet(key: string, value: string): Promise<void>;
  /** Ask the browser not to evict our storage. */
  persist(): Promise<boolean>;
}

export interface InstallPrompt {
  available(): boolean;
  prompt(): Promise<boolean>;
  onChange(cb: () => void): void;
  isStandalone(): boolean;
}

/** Monetization seam. Intentionally empty in v1: no ads, no purchases, no SDKs. */
export interface Monetization {
  readonly enabled: false;
}

export interface Platform {
  kind: 'web' | 'capacitor';
  storage: Storage;
  install: InstallPrompt;
  monetization: Monetization;
  unlockAudio(ctx: AudioContext): void;
  haptic(kind: 'light' | 'medium' | 'success'): void;
  /** Share or save a file (photo mode, save backups). */
  saveFile(blob: Blob, filename: string): Promise<void>;
  copyText(text: string): Promise<boolean>;
}
