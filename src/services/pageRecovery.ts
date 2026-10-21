let open = false;
const listeners = new Set<() => void>();

export function getPageRecoverySnapshot() { return open; }

export function subscribePageRecovery(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setOpen(value: boolean) {
  if (open === value) return;
  open = value;
  listeners.forEach(listener => listener());
}

export function requestPageRecovery() { setOpen(true); }
export function dismissPageRecovery() { setOpen(false); }

export function listenForPreloadErrors(target: EventTarget) {
  // Let a failed lazy import reject so the error boundary can render a usable
  // fallback. Preventing the event would return undefined to React.lazy.
  target.addEventListener('vite:preloadError', requestPageRecovery);
  return () => target.removeEventListener('vite:preloadError', requestPageRecovery);
}
