import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '@carbon/icons-react';
import type { ShopOrder } from './queueBrowsing';
import { displayOrderStatus, getOrderCardTitleParts, getOrderSpecifications } from './orderCardTitle';

interface OrderCardDetailsDialogProps {
  order: ShopOrder;
  onClose: () => void;
}

export function OrderCardDetailsDialog({ order, onClose }: OrderCardDetailsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const title = getOrderCardTitleParts(order);
  const specs = getOrderSpecifications(order);
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopyMessage('Order reference copied.');
    } catch {
      setCopyMessage('Could not copy. Select the full reference below and copy it manually.');
    }
  };
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
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? []).filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!controls.includes(document.activeElement as HTMLElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="order-card-details-title" aria-describedby="order-card-details-id" className="flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden border border-black bg-white text-carbon-gray-100 shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
          <div>
            <h2 id="order-card-details-title" className="text-lg font-black">Order details</h2>
            <p id="order-card-details-id" className="text-xs text-gray-600">Order #{order.id.slice(0, 8)}</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close order details" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
            <Close size={24} aria-hidden="true" />
          </button>
        </header>
        <div tabIndex={0} aria-label="Order details content" className="min-h-0 overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60">
          <dl className="space-y-3">
            {[
              ['Order title', title.filename], ['Original filename', title.originalFilename],
              ['Customer', title.customer], ['Full order reference', order.id],
              ['Created (Asia/Manila, UTC+08:00)', `${title.date} ${title.time}`],
              ['Status', displayOrderStatus(order.state)], ['Paper size', specs.paper],
              ['Color', specs.color], ['Orientation', specs.orientation], ['Pages', specs.pages],
              ['Copies', specs.copies], ['Total', specs.total],
            ].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-600">{label}</dt><dd className="select-text font-bold">{value}</dd></div>)}
          </dl>
          <button type="button" onClick={copyReference} className="mt-4 min-h-11 border border-black px-4 py-2 font-bold hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">Copy order reference</button>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-sm">{copyMessage}</p>
        </div>
      </div>
    </div>, document.body,
  );
}
