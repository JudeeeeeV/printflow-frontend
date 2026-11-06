import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { getOrderCardTitleParts } from "./orderCardTitle";
import { OrderCardDetailsDialog } from "./OrderCardDetailsDialog";

interface OrderCardProps {
  footer?: React.ReactNode;
  order: any;
  onClick?: () => void;
  onReviewPayment?: () => void;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
}

const paperSizeBackgrounds: Record<string, string> = {
  SHORT: "bg-red-500",
  A4: "bg-green-600",
  LONG: "bg-carbon-blue-60",
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick, onReviewPayment, isSelected = false, onToggleSelect, footer }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const [hasImageError, setHasImageError] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isPaymentPending = order.payment_status === 'PENDING_VERIFICATION' || order.state === "AWAITING_PAYMENT_VERIFICATION";
  const hasDocument = Array.isArray(order.assets) && order.assets.length > 0;
  const actionButtonClassName = "flex h-11 min-w-0 items-center justify-center gap-1.5 px-3 py-1 text-xs font-bold leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 xl:h-9 motion-reduce:transition-none";
  const title = getOrderCardTitleParts(order);
  const paperSize = order.paper_size || "A4";
  const paperSizeBackground = Object.hasOwn(paperSizeBackgrounds, paperSize)
    ? paperSizeBackgrounds[paperSize]
    : "bg-gray-600";
  const pageCount = Number.isInteger(order.page_count) && order.page_count > 0
    ? order.page_count as number
    : null;
  const copies = Number.isInteger(order.copies) && order.copies > 0 ? order.copies as number : 1;

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
      badgeText = order.acceptance_status === 'ACCEPTED' ? 'Awaiting payment' : 'Awaiting shop decision';
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
    case "READY_FOR_PICKUP":
      badgeText = "Ready For Pickup";
      badgeColor = "bg-carbon-gray-100 text-white";
      break;
    case "COMPLETED":
      badgeText = "Handed over";
      badgeColor = "bg-gray-100 text-gray-500";
      break;
    case "ESCALATED_DISPUTE":
      badgeText = "Dispute Under Review";
      badgeColor = "bg-gray-200 text-carbon-gray-100 border border-gray-400";
      isDisputed = true;
      break;
  }

  if (order.payment_status === 'DISPUTED') isDisputed = true;

  const canReviewPayment = (isPaymentPending || isDisputed) && !!onReviewPayment;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : 'cursor-default'} flex h-full min-w-0 flex-col bg-white transition-[border-color,box-shadow] duration-200 xl:min-h-64 ${isSelected ? 'border-4 border-carbon-blue-60 p-[9px] shadow-md' : `border border-black p-3 ${onClick ? 'hover:border-carbon-blue-60 hover:shadow-md' : ''}`}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-black leading-5 text-carbon-gray-100 [overflow-wrap:anywhere]">
            <button type="button" aria-label={`Show full title and customer for order ${order.id.slice(0, 8)}`} aria-haspopup="dialog" aria-expanded={isDetailsOpen} onClick={event => {
              event.stopPropagation();
              setIsDetailsOpen(true);
            }} className="block min-h-11 w-full text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 xl:min-h-10">
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
          <p className="whitespace-nowrap text-sm font-bold text-black leading-4">{title.date}</p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1 [&>span]:max-w-full [&>span]:break-words [&>span]:leading-3">
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
            B&W
          </span>
        )}
        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-bold border border-[#e0e0e0]">
          {pageCount === null ? 'Page count unavailable' : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`}
        </span>
        <span className="border border-[#e0e0e0] bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-800">
          {order.orientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT'}
        </span>
        <span className="border border-[#e0e0e0] bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-800">
          {copies} {copies === 1 ? 'COPY' : 'COPIES'}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Total Amount:</span>
          <span className="font-bold text-carbon-gray-100">
            ₱{order.total || 0}
          </span>
        </div>
      </div>

      {/* Payment actions share a row; selectable cards keep their checkbox. */}
      {order.payment_method && <div className="mb-3 space-y-1 text-xs leading-relaxed text-gray-700">
        <p><strong>{order.payment_method === 'CASH_ON_PICKUP' ? 'Cash on pickup' : 'GCash'}</strong> · {order.payment_status?.replaceAll('_', ' ')}</p>
        <p>Shop: {order.acceptance_status?.replaceAll('_', ' ')}</p>
        {order.acceptance_reason && <p className="text-red-700">{order.acceptance_reason}</p>}
      </div>}
      <div className={`mt-auto gap-2 border-t border-[#e0e0e0] pt-2 ${canReviewPayment ? `grid ${hasDocument ? 'grid-cols-2' : 'grid-cols-1'}` : 'flex min-h-11 items-center justify-between'}`}>
        {!canReviewPayment && (onToggleSelect ? (
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
        ) : <div />)}
        {hasDocument && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAssetLoading(true);
              setHasImageError(false);
              setPreviewUrl(order.assets[0].file_url);
              setIsPreviewOpen(true);
            }}
            className={`${actionButtonClassName} border border-black bg-white text-black hover:bg-[#e6e6e6]`}
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
        )}
        {canReviewPayment && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReviewPayment?.();
            }}
            className={`${actionButtonClassName} bg-carbon-gray-100 text-white hover:bg-[#454545]`}
          >
            Review Payment
          </button>
        )}
      </div>

      {isDisputed && (
        <div className="mt-1">
          <p className="w-full py-1 bg-gray-100 text-gray-600 font-bold text-[10px] leading-3 text-center uppercase tracking-wider">
            Administration Reviewing Payment
          </p>
        </div>
      )}

      {footer}

      {isDetailsOpen && <OrderCardDetailsDialog orderId={order.id} filename={title.filename} customer={title.customer} onClose={() => setIsDetailsOpen(false)} />}

      {/* Document Preview Modal */}
      {isPreviewOpen &&
        order.assets &&
        order.assets.length > 0 &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setIsPreviewOpen(false);
            }}
          >
            <div
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPreviewOpen(false);
                  }}
                  className="p-1 rounded-full text-gray-400 hover:text-carbon-gray-100 hover:bg-gray-100 transition-colors"
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
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{
                          opacity: isAssetLoading ? 0 : 1,
                          scale: isAssetLoading ? 0.95 : 1,
                          y: isAssetLoading ? 10 : 0,
                        }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        src={previewUrl}
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
                      referrerPolicy="no-referrer"
                      className="w-full h-full border-none bg-carbon-gray-10 relative z-20"
                      title="Document Preview"
                      onLoad={() => setIsAssetLoading(false)}
                      style={{
                        opacity: isAssetLoading ? 0 : 1,
                        transition: "opacity 0.4s ease-out",
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </motion.div>
  );
};
