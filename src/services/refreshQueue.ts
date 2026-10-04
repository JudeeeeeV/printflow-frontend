/** Coalesce refreshes, including one fresh read after mutations during a read. */
export function createRefreshQueue<T>(load: () => Promise<T>, apply: (value: T) => void) {
  let pending: Promise<void> | null = null;
  let queued = false;
  return (queueIfBusy = true): Promise<void> => {
    if (pending) {
      if (queueIfBusy) queued = true;
      return pending;
    }
    pending = (async () => {
      do {
        queued = false;
        const value = await load();
        // A mutation arrived during this request. Discard the older snapshot.
        if (!queued) apply(value);
      } while (queued);
    })().finally(() => { pending = null; });
    return pending;
  };
}
