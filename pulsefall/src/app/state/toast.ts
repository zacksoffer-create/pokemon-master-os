import { Store } from './store';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

export const toastStore = new Store<Toast[]>([]);
let next = 1;

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200): void {
  const t = { id: next++, text, kind };
  toastStore.update((list) => [...list.slice(-2), t]);
  setTimeout(() => toastStore.update((list) => list.filter((x) => x.id !== t.id)), ms);
}
