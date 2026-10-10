import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '@carbon/icons-react';

interface OrderCardDetailsDialogProps {
  orderId: string;
  filename: string;
  customer: string;
  onClose: () => void;
}

export function OrderCardDetailsDialog({ orderId, filename, customer, onClose }: OrderCardDetailsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  useEffect(() => { closeCallback.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previouslyInert = appRoot?.inert;
    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeCallback.current();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previouslyInert ?? false;
      const target = previousFocus?.isConnected && previousFocus.getClientRects().length && !previousFocus.closest('[inert]')
        ? previousFocus : document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      target?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={event => {
      event.stopPropagation();
      if (event.target === event.currentTarget) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="order-card-details-title" aria-describedby="order-card-details-id" className="flex max-h-[calc(100dvh-32px)] w-full max-w-md flex-col overflow-hidden border border-black bg-white text-carbon-gray-100 shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
          <div>
            <h2 id="order-card-details-title" className="text-lg font-black">Order details</h2>
            <p id="order-card-details-id" className="text-xs text-gray-600">Order #{orderId.slice(0, 8)}</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close order details" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
            <Close size={24} aria-hidden="true" />
          </button>
        </header>
        <dl className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere]">
          <div><dt className="text-sm text-gray-600">File / order title</dt><dd className="font-bold">{filename}</dd></div>
          <div><dt className="text-sm text-gray-600">Customer</dt><dd className="font-bold">{customer}</dd></div>
        </dl>
      </div>
    </div>, document.body,
  );
}
