import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { dataEvents, type DataResource } from '../services/dataEvents';
import { nextPollDelayMs } from '../services/pollingSchedule';
import { createRefreshQueue } from '../services/refreshQueue';

interface LiveState<T> {
  key: string;
  data: T | null;
  error: unknown;
  isLoading: boolean;
  confirmedAt: number | null;
}

/**
 * Keeps one resource current through polling and data events. The last good
 * value stays available while refreshes fail, so callers can keep it on screen.
 */
export function useLiveResource<T>(key: string, load: () => Promise<T>, resources: DataResource[]) {
  const initial: LiveState<T> = { key, data: null, error: null, isLoading: true, confirmedAt: null };
  const [state, setState] = useState<LiveState<T>>(initial);
  const [isOffline, setIsOffline] = useState(() => navigator.onLine === false);
  const loadRef = useRef(load);
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const resourceKey = resources.join(',');

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let disposed = false;
    let stopped = false;
    let failures = 0;
    let retryAfterMs: number | undefined;
    let timer: number | undefined;
    let inFlight: Promise<void> | null = null;

    const queue = createRefreshQueue(
      () => loadRef.current(),
      (data: T) => {
        if (disposed) return;
        failures = 0;
        retryAfterMs = undefined;
        stopped = false;
        setState({ key, data, error: null, isLoading: false, confirmedAt: Date.now() });
      },
    );

    const schedule = () => {
      window.clearTimeout(timer);
      if (disposed || stopped || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      timer = window.setTimeout(
        () => void refresh(),
        nextPollDelayMs({ failures, retryAfterMs, streamConnected: dataEvents.isConnected() }),
      );
    };

    const refresh = (): Promise<void> => {
      window.clearTimeout(timer);
      if (inFlight) {
        void queue();
        return inFlight;
      }
      inFlight = queue()
        .catch((error: unknown) => {
          if (disposed) return;
          failures += 1;
          retryAfterMs = error instanceof ApiError ? error.retryAfterMs : undefined;
          stopped = error instanceof ApiError && error.status === 404;
          setState((previous) => ({
            ...(previous.key === key ? previous : { key, data: null, confirmedAt: null }),
            error,
            isLoading: false,
          }));
        })
        .finally(() => {
          inFlight = null;
          schedule();
        });
      return inFlight;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
      else window.clearTimeout(timer);
    };
    const onOnline = () => {
      setIsOffline(false);
      void refresh();
    };
    const onOffline = () => {
      setIsOffline(true);
      window.clearTimeout(timer);
    };

    refreshRef.current = refresh;
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsubscribeData = dataEvents.subscribe(resources, () => void refresh());
    const unsubscribeConnection = dataEvents.subscribeConnection(schedule);
    void refresh();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribeData();
      unsubscribeConnection();
    };
    // The stable resource key avoids restarting when callers use an inline array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resourceKey]);

  const refresh = useCallback(() => refreshRef.current(), []);
  const current = state.key === key ? state : initial;
  return { ...current, isOffline, refresh };
}
