import { Component, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  dismissPageRecovery,
  getPageRecoverySnapshot,
  requestPageRecovery,
  subscribePageRecovery,
} from '../../services/pageRecovery';

function RefreshDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="page-recovery-title"
      aria-describedby="page-recovery-description page-recovery-note"
      onCancel={event => { event.preventDefault(); dismissPageRecovery(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border border-gray-200 border-t-4 border-t-carbon-blue-60 bg-white p-0 text-carbon-gray-100 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8">
        <div aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center bg-blue-50 text-carbon-blue-60">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M6.1 7a7 7 0 0111.5-1L20 9M4 15l2.4 3A7 7 0 0017.9 17" />
          </svg>
        </div>
        <h2 id="page-recovery-title" className="mb-3 text-2xl font-bold">Refresh PrintFlow?</h2>
        <p id="page-recovery-description" className="text-sm leading-relaxed text-gray-600">
          Part of the page couldn’t load. A new version may be available, or your connection may have been interrupted. Refresh the page to try again.
        </p>
        <p id="page-recovery-note" className="mt-4 border-l-4 border-carbon-blue-60 bg-carbon-gray-10 p-3 text-sm font-medium">
          Unsaved changes may be lost when you refresh.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-gray-200 px-6 py-4 sm:px-8">
        <button ref={cancelRef} type="button" onClick={dismissPageRecovery}
          className="min-h-12 border border-gray-400 bg-white px-4 py-3 text-sm font-bold hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">
          Not now
        </button>
        <button type="button" onClick={() => window.location.reload()}
          className="min-h-12 bg-carbon-blue-60 px-4 py-3 text-sm font-bold text-white hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">
          Refresh page
        </button>
      </div>
    </dialog>, document.body,
  );
}

/** Eagerly loaded outside the route boundary so failed chunks cannot hide it. */
export function PageRecoveryModal() {
  const open = useSyncExternalStore(subscribePageRecovery, getPageRecoverySnapshot, () => false);
  return open ? <RefreshDialog /> : null;
}

export class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() { requestPageRecovery(); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-dvh items-center justify-center bg-carbon-gray-10 p-6 text-carbon-gray-100">
        <section className="w-full max-w-md border border-gray-200 border-t-4 border-t-carbon-blue-60 bg-white p-8 shadow-lg">
          <h1 className="mb-3 text-2xl font-bold">This page couldn’t load</h1>
          <p className="mb-6 text-sm leading-relaxed text-gray-600">Check your connection, then refresh PrintFlow when you’re ready to try again.</p>
          <button type="button" onClick={requestPageRecovery}
            className="min-h-12 bg-carbon-blue-60 px-5 py-3 text-sm font-bold text-white hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">
            Refresh options
          </button>
        </section>/
      </main>
    );
  }
}
