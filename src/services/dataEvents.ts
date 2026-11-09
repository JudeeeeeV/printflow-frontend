import { API_URL } from '../config/runtime';
import { ensureFreshSession, invalidateApiCache, getAccessToken } from './apiClient';

export type DataResource = 'assets' | 'devices' | 'notifications' | 'orders' | 'print-jobs' | 'receipts' | 'shops' | 'users';
type Listener = { resources: Set<DataResource>; callback: () => void };

const EVENT_SOURCE_CLOSED = 2;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

class DataEvents {
  private source: EventSource | null = null;
  private listeners = new Set<Listener>();
  private connectionListeners = new Set<() => void>();
  private pending = new Set<Listener>();
  private flushTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private connected = false;
  private hasConnected = false;

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

  isConnected() {
    return this.connected;
  }

  subscribeConnection(callback: () => void) {
    this.connectionListeners.add(callback);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected) return;
    this.connected = connected;
    this.connectionListeners.forEach((callback) => callback());
  }

  private connect() {
    if (this.source || this.listeners.size === 0) return;
    const token = getAccessToken();
    const url = token ? `${API_URL}/events/user?token=${encodeURIComponent(token)}` : `${API_URL}/events/user`;
    const source = new EventSource(url, { withCredentials: true });
    this.source = source;
    source.onopen = () => {
      if (source !== this.source) return;
      const isReconnect = this.hasConnected;
      this.hasConnected = true;
      this.reconnectAttempts = 0;
      this.setConnected(true);
      if (isReconnect) {
        // Changes made while the stream was down were never announced.
        invalidateApiCache();
        [...this.listeners].forEach(({ callback }) => callback());
      }
    };
    source.onerror = () => {
      if (source !== this.source) return;
      this.setConnected(false);
      // The browser retries by itself unless the server refused the stream,
      // which is how an expired token in the URL ends it.
      if (source.readyState === EVENT_SOURCE_CLOSED) {
        source.close();
        this.source = null;
        this.scheduleReconnect();
      }
    };
    source.onmessage = (event) => {
      try {
        const resources = new Set<DataResource>(JSON.parse(event.data).resources || []);
        if (resources.size === 0) return;
        invalidateApiCache();
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

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.listeners.size === 0) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void ensureFreshSession().then((outcome) => {
        // A refused session is handled by the next authenticated request.
        if (outcome === 'rejected') return;
        if (outcome === 'unavailable') this.scheduleReconnect();
        else this.connect();
      });
    }, delay);
  }

  private disconnect() {
    this.source?.close();
    this.source = null;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.hasConnected = false;
    this.pending.clear();
    this.setConnected(false);
  }
}

export const dataEvents = new DataEvents();
