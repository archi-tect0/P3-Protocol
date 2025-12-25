export type WalletEvent = 'connected' | 'disconnected' | 'accountChanged' | 'chainChanged';

export class EventBus<T> {
  private listeners = new Map<T, Set<Function>>();

  on(event: T, handler: Function) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
    return () => set.delete(handler);
  }

  emit(event: T, payload: unknown) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) h(payload);
  }
}
