import { useEffect, useState } from 'preact/hooks';

/** Minimal observable value with a Preact hook. */
export class Store<T> {
  private listeners = new Set<(v: T) => void>();
  constructor(protected value: T) {}
  get(): T {
    return this.value;
  }
  set(next: T): void {
    this.value = next;
    for (const fn of this.listeners) fn(next);
  }
  update(fn: (v: T) => T): void {
    this.set(fn(this.value));
  }
  subscribe(fn: (v: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function useStore<T>(store: Store<T>): T {
  const [v, setV] = useState(store.get());
  useEffect(() => {
    setV(store.get());
    return store.subscribe(setV);
  }, [store]);
  return v;
}
