import { useStore } from '../state/store';
import { toastStore } from '../state/toast';

export function Toasts() {
  const list = useStore(toastStore);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div class={`toast ${t.kind}`} key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
