// UI navigation state shared by Preact and Phaser (which tab, which sheet, which dialog).
type Listener = () => void;

export type Tab = 'farm' | 'craft' | 'shops' | 'style' | 'menu';

export type Sheet =
  | { kind: 'plot'; id: string }
  | { kind: 'fields' }
  | { kind: 'building'; id: string }
  | { kind: 'parcel'; id: string }
  | { kind: 'animal'; id: string }
  | { kind: 'luna' }
  | { kind: 'tourist'; key: string; qty: number; price: number }
  | { kind: 'decor'; uid: string }
  | { kind: 'luke' }
  | null;

export type Dialog =
  | { kind: 'away' }
  | { kind: 'rollover' }
  | { kind: 'whatsnew' }
  | { kind: 'dedication' }
  | { kind: 'recap'; week: number }
  | { kind: 'daily' }
  | { kind: 'update' }
  | { kind: 'backup' }
  | { kind: 'minigameResult'; game: string; score: number; stars: number; outcome: import('../core').MiniGameOutcome }
  | { kind: 'prestige' }
  | { kind: 'message'; title: string; text: string; speaker?: string }
  | null;

class Nav {
  tab: Tab = 'farm';
  sub: Record<Tab, string> = { farm: '', craft: 'kitchen', shops: 'claire', style: 'avatar', menu: '' };
  sheet: Sheet = null;
  dialogs: Dialog[] = [];
  editDecor: { placing: string | null; selected: string | null } | null = null;
  photo = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  setTab(tab: Tab, sub?: string) {
    this.tab = tab;
    if (sub !== undefined) this.sub[tab] = sub;
    this.sheet = null;
    if (tab !== 'farm') this.editDecor = null;
    this.emit();
  }
  setSub(sub: string) {
    this.sub[this.tab] = sub;
    this.emit();
  }
  openSheet(sheet: Sheet) {
    this.sheet = sheet;
    if (sheet) this.tab = 'farm';
    this.emit();
  }
  closeSheet() {
    this.sheet = null;
    this.emit();
  }
  pushDialog(d: Dialog) {
    if (!d) return;
    if (this.dialogs.some((x) => x && x.kind === d.kind && d.kind !== 'message')) return;
    this.dialogs = [...this.dialogs, d];
    this.emit();
  }
  closeDialog() {
    this.dialogs = this.dialogs.slice(1);
    this.emit();
  }
  setEdit(edit: Nav['editDecor']) {
    this.editDecor = edit;
    if (edit) {
      this.tab = 'farm';
      this.sheet = null;
    }
    this.emit();
  }
  setPhoto(on: boolean) {
    this.photo = on;
    this.emit();
  }
  refresh() {
    this.emit();
  }
}

export const nav = new Nav();
