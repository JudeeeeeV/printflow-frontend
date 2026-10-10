import { API_URL } from '../config/runtime';

export type DataResource = 'assets' | 'devices' | 'notifications' | 'orders' | 'print-jobs' | 'receipts' | 'shops' | 'users';
type Listener = { resources: Set<DataResource>; callback: () => void };

class DataEvents {
  private source: EventSource | null = null;
  private listeners = new Set<Listener>();
  private pending = new Set<Listener>();
  private flushTimer: number | null = null;

  subscribe(resources: DataResource[], callback: () => void) {
    const listener = { resources: new Set(resources), callback };
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
      this.pending.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  private connect() {
    if (this.source || this.listeners.size === 0) return;
    this.source = new EventSource(`${API_URL}/events/user`, { withCredentials: true });
    this.source.onmessage = (event) => {
      try {
        const resources = new Set<DataResource>(JSON.parse(event.data).resources || []);
        if (resources.size === 0) return;
        for (const listener of this.listeners) {
          if ([...listener.resources].some((resource) => resources.has(resource))) this.pending.add(listener);
        }
        if (this.flushTimer === null) {
          this.flushTimer = window.setTimeout(() => {
            const callbacks = [...this.pending];
            this.pending.clear();
            this.flushTimer = null;
            callbacks.forEach(({ callback }) => callback());
          }, 100);
        }
      } catch {
        // Ignore malformed or heartbeat events; EventSource will keep listening.
      }
    };
  }

  private disconnect() {
    this.source?.close();
    this.source = null;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending.clear();
  }
}

export const dataEvents = new DataEvents();
