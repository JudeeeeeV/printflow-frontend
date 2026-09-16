import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface OrderCardProps {
  order: any;
  onClick: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const isPaymentPending = order.state === "AWAITING_PAYMENT_VERIFICATION";

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
      badgeText = "Pending Checkout";
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
      badgeText = "Completed";
      badgeColor = "bg-gray-100 text-gray-500";
      break;
    case "ESCALATED_DISPUTE":
      badgeText = "Dispute Under Review";
      badgeColor = "bg-gray-200 text-carbon-gray-100 border border-gray-400";
      isDisputed = true;
      break;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`bg-white border border-[#e0e0e0] p-4 hover:border-[#8d8d8d] hover:shadow-md cursor-pointer transition-all duration-200`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-black text-carbon-gray-100">
            Order #{order.id.slice(0, 8)}
          </h4>
          <p className="text-xs text-gray-500 font-medium">
            Client ID: {order.client_id.slice(0, 8)}
          </p>
        </div>
        <div className={`px-2 py-1 text-[10px] font-bold ${badgeColor}`}>
          {badgeText}
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold border border-[#e0e0e0]">
          {order.paper_size || "A4"}
        </span>
        {order.print_color_mode === "COLOR" ? (
          <span className="px-2 py-1 bg-gray-200 text-carbon-gray-100 text-[10px] font-bold border border-gray-300">
            COLOR
          </span>
        ) : (
          <span className="px-2 py-1 bg-carbon-gray-100 text-white text-[10px] font-bold">
            B&W
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Total Amount:</span>
          <span className="font-bold text-carbon-gray-100">
            ₱{order.total || 0}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 font-medium">Created:</span>
          <span className="font-semibold text-gray-700">
            {new Date(order.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {order.assets && order.assets.length > 0 && (
        <div className="mb-4 text-sm flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAssetLoading(true);
              setPreviewUrl(order.assets[0].file_url);
              setIsPreviewOpen(true);
            }}
            className="text-gray-600 hover:text-carbon-gray-100 font-bold flex items-center gap-1 transition-colors"
          >
            <svg
              className="w-4 h-4"
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
            Preview Document
          </button>
        </div>
      )}

      {isPaymentPending && (
        <div className="mt-4 pt-3 border-t border-[#e0e0e0]">
          <button className="w-full py-2.5 bg-carbon-gray-100 text-white font-bold text-xs hover:bg-black transition-colors">
            Review Payment
          </button>
        </div>
      )}

      {isDisputed && (
        <div className="mt-4 pt-3 border-t border-[#e0e0e0]">
          <p className="w-full py-2 bg-gray-100 text-gray-600 font-bold text-[10px] text-center uppercase tracking-wider">
            Administration Reviewing Payment
          </p>
        </div>
      )}

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
                      className={`w-full h-full object-contain bg-white shadow-2xl border border-gray-200 ring-1 ring-black/5 ${isAssetLoading ? "pointer-events-none" : ""}`}
                    />
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
