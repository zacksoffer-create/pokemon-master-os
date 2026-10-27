import { registerSW } from 'virtual:pwa-register';
import { Store } from './state/store';
import { toast } from './state/toast';

/** Set when a new version has been downloaded and is waiting; calling it reloads into it. */
export const updateStore = new Store<(() => void) | null>(null);

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateStore.set(() => void update(true));
    },
    onOfflineReady() {
      toast('Pulsefall is ready to work offline', 'success');
    },
  });
}
