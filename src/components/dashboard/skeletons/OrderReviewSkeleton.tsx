import React from 'react';
import { Close } from '@carbon/icons-react';

/** Mirrors PaymentReviewPanel so the real dialog replaces it without a layout jump. */
export const OrderReviewSkeleton: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden border border-gray-300 bg-white shadow-xl motion-reduce:[&_.animate-pulse]:animate-none">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
      <div aria-hidden="true" className="min-w-0 flex-1 space-y-2">
        <div className="h-6 w-48 max-w-full animate-pulse bg-gray-200" />
        <div className="h-4 w-28 animate-pulse bg-gray-100" />
      </div>
      <button type="button" aria-label="Close order review" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 transition-colors hover:bg-carbon-gray-10 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">
        <Close size={24} aria-hidden="true" />
      </button>
    </header>

    <div role="status" aria-label="Loading order details" className="min-h-0 space-y-3 overflow-hidden p-4">
      <div aria-hidden="true" className="space-y-3">
        <div className="h-4 w-44 animate-pulse bg-gray-200" />

        <div className="flex items-center justify-between gap-3 border border-gray-300 bg-carbon-gray-10 p-3">
          <div className="h-4 w-20 animate-pulse bg-gray-200" />
          <div className="h-6 w-16 animate-pulse bg-gray-200" />
        </div>

        <div className="space-y-3 border border-gray-300 p-3">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1">
                <div className="h-3 w-14 animate-pulse bg-gray-100" />
                <div className="h-4 w-16 animate-pulse bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="h-4 w-32 animate-pulse bg-gray-200" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse bg-gray-200" />
          <div className="h-10 w-full animate-pulse border border-gray-300 bg-gray-100" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse bg-gray-200" />
          <div className="h-[min(240px,30dvh)] w-full animate-pulse border border-gray-300 bg-carbon-gray-10" />
        </div>
      </div>
    </div>
  </div>
);
