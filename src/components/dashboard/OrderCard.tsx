import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useDialogFocus } from "../common/useDialogFocus";
import { getOrderCardTitleParts, getOrderSpecifications } from "./orderCardTitle";
import type { ShopQueueOrder } from '../../services/shopQueueService';
import { OrderCardDetailsDialog } from "./OrderCardDetailsDialog";

interface OrderCardProps {
  order: ShopQueueOrder;
  loadOrder?: () => Promise<ShopQueueOrder>;
  onClick?: () => void;
  onReviewOrder?: () => void;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
  /** Overrides the order-state badge, e.g. with the current print attempt. */
  statusBadge?: { text: string; className: string } | null;
}

const paperSizeBackgrounds: Record<string, string> = {
  SHORT: "bg-red-500",
  A4: "bg-green-600",
  LONG: "bg-carbon-blue-60",
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, loadOrder, onClick, onReviewOrder, isSelected = false, onToggleSelect, statusBadge }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const [hasImageError, setHasImageError] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [details, setDetails] = useState<ShopQueueOrder | null>(null);
  const [loadError, setLoadError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const previewDialog = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus(previewDialog, isPreviewOpen, () => setIsPreviewOpen(false));
  const hasDocument = order.has_document ?? Boolean(order.assets?.[0]?.file_url);
  const fetchDetails = async () => {
    if (!loadOrder) return order;
    const fresh = await loadOrder(); setDetails(fresh); return fresh;
  };
  const actionButtonClassName = "flex h-11 min-w-0 items-center justify-center gap-1.5 px-3 py-1 text-xs font-bold leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 xl:h-9 motion-reduce:transition-none";
  const title = getOrderCardTitleParts(order);
  const specs = getOrderSpecifications(order);
  const paperSize = specs.paper;
  const paperSizeBackground = Object.hasOwn(paperSizeBackgrounds, paperSize)
    ? paperSizeBackgrounds[paperSize]
    : "bg-gray-600";
  // Determine the state badge configuration
  let badgeText = order.state;
  let badgeColor = "bg-gray-100 text-gray-800";
  let isDisputed = false;

  switch (order.state) {
    case "AWAITING_PAYMENT_VERIFICATION":
      badgeText = "Payment Review Pending";
      badgeColor = "bg-gray-200 text-carbon-gray-100 font-bold";
      break;
    case "AWAITING_PAYMENT":
      badgeText = "Awaiting Payment";
      badgeColor = "bg-gray-100 text-gray-600";
      break;
    case "OPEN_INQUIRY":
      badgeText = order.payment_status === 'DISPUTED' ? 'Dispute Under Review' : order.payment_status === 'REVIEW_REQUIRED' ? 'Payment review required' : order.payment_status === 'PENDING_VERIFICATION' ? 'Payment Review Pending' : order.payment_status === 'REJECTED' ? 'Receipt Rejected' : 'Awaiting shop / payment';
      badgeColor = "bg-gray-100 text-gray-600";
      break;
    case "PROOF_APPROVED":
      badgeText = "Proof Approved";
      badgeColor = "bg-gray-200 text-carbon-gray-100";
      break;
    case "IN_PRODUCTION":
      badgeText = "In Production";
      badgeColor = "bg-gray-200 text-carbon-gray-100";
      break;
    case "PRINTED":
      // Legacy state: a submission was reported but output was never checked.
      badgeText = "Awaiting Output Check";
      badgeColor = "bg-gray-200 text-carbon-gray-100";
      break;
    case "READY_FOR_PICKUP":
      badgeText = "Ready For Pickup";
      badgeColor = "bg-carbon-gray-100 text-white";
      break;
    case "COMPLETED":
      badgeText = "Completed";
      badgeColor = "bg-gray-100 text-gray-500";
      break;
    case "ESCALATED_DISPUTE":
      badgeText = "Dispute Under Review";
      badgeColor = "bg-gray-200 text-carbon-gray-100 border border-gray-400";
      isDisputed = true;
      break;
  }

  if (order.state === 'REJECTED') {
    badgeText = 'Order Rejected'; badgeColor = 'bg-red-100 text-red-800';
  } else if (['OPEN_INQUIRY', 'AWAITING_PAYMENT'].includes(order.state) && order.payment_status === 'REJECTED') {
    badgeText = 'Receipt Rejected'; badgeColor = 'bg-red-100 text-red-800';
  }
  isDisputed = isDisputed || order.payment_status === 'DISPUTED';

  if (statusBadge) {
    badgeText = statusBadge.text;
    badgeColor = statusBadge.className;
  }


  return (
    <motion.div
      layout={!reducedMotion}
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.15, ease: "easeOut" }}
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : 'cursor-default'} flex h-full min-h-52 min-w-0 flex-col bg-white transition-[border-color,box-shadow] duration-200 ${isSelected ? 'border-4 border-carbon-blue-60 p-[5px] shadow-md' : `border border-black p-2 ${onClick ? 'hover:border-carbon-blue-60 hover:shadow-md' : ''}`}`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-black leading-5 text-carbon-gray-100 [overflow-wrap:anywhere]">
            <button type="button" aria-label={`Show full title and customer for order ${order.id.slice(0, 8)}`} aria-haspopup="dialog" aria-expanded={isDetailsOpen} onClick={event => {
              event.stopPropagation();
              setIsDetailsOpen(true);
              if (loadOrder) {
                setDetailsLoading(true); setLoadError('');
                void fetchDetails().catch(() => setLoadError('Fresh details could not be loaded. Close and try again.')).finally(() => setDetailsLoading(false));
              }
            }} className="block min-h-11 w-full text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 xl:min-h-8">
              <span className="line-clamp-2">{title.filename}</span>
            </button>
          </h4>
          <p className="mt-1 truncate text-sm font-bold text-black leading-4">
            {title.customer}
          </p>
          <p className="text-xs text-gray-500 font-medium break-words">
            Order #{order.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-1">
          <div className={`max-w-full px-2 py-1 text-right text-[10px] font-bold leading-3 [overflow-wrap:anywhere] ${badgeColor}`}>
            {badgeText}
          </div>
          <p className="text-right text-xs font-bold text-black leading-4"><span className="block">Created {title.date}</span><span className="block">{title.time} PHT</span></p>
        </div>
      </div>

      <div className="mb-1 flex flex-wrap gap-1 [&>span]:max-w-full [&>span]:break-words [&>span]:leading-3">
        <span className={`px-2 py-0.5 text-white text-[10px] font-bold border border-[#e0e0e0] ${paperSizeBackground}`}>
          {paperSize}
        </span>
        {order.print_color_mode === "COLOR" ? (
          <span
            className="px-2 py-0.5 text-white text-[10px] font-bold border border-gray-300"
            style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), linear-gradient(to right, #00ffff 0%, #ff00ff 33%, #ffff00 67%, #000000 100%)", textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)" }}
          >
            COLOR
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-white text-black text-[10px] font-bold border border-gray-300">
            {specs.color}
          </span>
        )}
        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-bold border border-[#e0e0e0]">
          {specs.pages}
        </span>
        <span className="border border-[#e0e0e0] bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-800">
          {specs.orientation}
        </span>
        <span className="border border-[#e0e0e0] bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-800">
          {specs.copies}
        </span>
      </div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex flex-1 justify-between gap-2 text-sm">
          <span className="text-gray-500 font-medium">Total Amount:</span>
          <span className="font-bold text-carbon-gray-100">
            {specs.total}
          </span>
        </div>
        {onToggleSelect && (
          <label
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-carbon-gray-100 xl:min-h-9"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-5 w-5 cursor-pointer border-gray-500 text-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
              aria-label={`Select order ${order.id.slice(0, 8)}`}
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(order.id);
              }}
            />
            <span className="text-xs select-none">{isSelected ? 'Selected' : 'Select'}</span>
          </label>
        )}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[#e0e0e0] pt-2">
          <button
            type="button"
            disabled={!hasDocument}
            onClick={(e) => {
              e.stopPropagation();
              if (!hasDocument) return;
              setIsAssetLoading(true);
              setHasImageError(false);
              setIsPreviewOpen(true); setPreviewUrl(null); setLoadError('');
              void fetchDetails().then(fresh => {
                const url = fresh.assets?.[0]?.file_url;
                if (!url) throw new Error('File unavailable');
                setPreviewUrl(url);
              }).catch(() => { setIsAssetLoading(false); setLoadError('The document could not be loaded. Close and try again.'); });
            }}
            className={`${actionButtonClassName} border border-black bg-white text-black hover:bg-[#e6e6e6] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="min-w-0">Preview Document</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReviewOrder?.();
            }}
            className={`${actionButtonClassName} bg-carbon-gray-100 text-white hover:bg-[#454545]`}
          >
            Review Order
          </button>
      </div>

      {isDisputed && (
        <div className="mt-1">
          <p className="w-full py-1 bg-gray-100 text-gray-600 font-bold text-[10px] leading-3 text-center uppercase tracking-wider">
            Administration Reviewing Payment
          </p>
        </div>
      )}

      {isDetailsOpen && <OrderCardDetailsDialog order={details || order} isLoading={detailsLoading} loadError={loadError} onClose={() => setIsDetailsOpen(false)} />}

      {/* Document Preview Modal */}
      {isPreviewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setIsPreviewOpen(false);
            }}
          >
            <div
              ref={previewDialog}
              role="dialog"
              aria-modal="true"
              aria-label="Document preview"
              className="bg-white w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-10 shadow-sm">
                <h3 className="font-bold text-carbon-gray-100 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Document Preview
                </h3>
                <button
                  type="button"
                  aria-label="Close document preview"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPreviewOpen(false);
                  }}
                  className="min-h-11 min-w-11 p-1 rounded-full text-gray-400 hover:text-carbon-gray-100 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1 relative flex flex-col overflow-hidden bg-gray-50">
                {loadError && <p role="alert" className="p-6">{loadError}</p>}
                {previewUrl?.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i) ? (
                  <div
                    className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto relative"
                    style={{
                      backgroundImage:
                        "radial-gradient(#d1d5db 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  >
                    {isAssetLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-64 h-80 bg-white/50 backdrop-blur-sm animate-pulse rounded-xl shadow-lg border border-gray-200 flex flex-col items-center justify-center gap-4">
                          <svg
                            className="w-12 h-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <div className="h-2.5 w-24 bg-gray-300 rounded-full"></div>
                        </div>
                      </div>
                    )}
                    {hasImageError ? (
                      <div role="alert" className="w-full max-w-md border border-gray-300 bg-white p-6 text-center">
                        <h4 className="text-lg font-bold text-carbon-gray-100">Preview unavailable</h4>
                        <p className="mt-2 text-sm text-gray-600">The image could not be loaded. Try again.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAssetLoading(true);
                            setHasImageError(false);
                          }}
                          className="mt-4 min-h-11 bg-carbon-blue-60 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <motion.img
                        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.95, y: reducedMotion ? 0 : 10 }}
                        animate={{
                          opacity: isAssetLoading ? 0 : 1,
                          scale: isAssetLoading ? 0.95 : 1,
                          y: isAssetLoading ? 10 : 0,
                        }}
                        transition={{ duration: reducedMotion ? 0 : 0.4, ease: "easeOut" }}
                        src={previewUrl || undefined}
                        alt="Document Preview"
                        onLoad={() => setIsAssetLoading(false)}
                        onError={() => {
                          setIsAssetLoading(false);
                          setHasImageError(true);
                        }}
                        className={`w-full h-full object-contain bg-white shadow-2xl border border-gray-200 ring-1 ring-black/5 ${isAssetLoading ? "pointer-events-none" : ""}`}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    {isAssetLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 p-4">
                        <div className="w-full h-full flex flex-col gap-2 max-w-4xl mx-auto">
                          {/* Skeleton for PDF toolbar */}
                          <div className="h-14 w-full bg-gray-200 animate-pulse rounded-t-md"></div>
                          {/* Skeleton for PDF content */}
                          <div className="flex-1 w-full bg-gray-200 animate-pulse rounded-b-md"></div>
                        </div>
                      </div>
                    )}
                    <iframe
                      src={previewUrl ?? undefined}
                      tabIndex={-1}
                      referrerPolicy="no-referrer"
                      className="w-full h-full border-none bg-carbon-gray-10 relative z-20"
                      title="Document Preview"
                      onLoad={() => setIsAssetLoading(false)}
                      style={{
                        opacity: isAssetLoading ? 0 : 1,
                        transition: reducedMotion ? "none" : "opacity 0.4s ease-out",
                      }}
                    />
                  </>
                )}
              </div>
              {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="min-h-11 shrink-0 p-3 text-sm font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Open original document in a new tab</a>}
            </div>
          </div>,
          document.body,
        )}
    </motion.div>
  );
};
