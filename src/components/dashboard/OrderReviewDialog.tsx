import { useRef, useState } from "react";
import { useDialogFocus } from "../common/useDialogFocus";
import { useLiveResource } from "../../hooks/useLiveResource";
import { shopQueueService } from "../../services/shopQueueService";
import { orderService } from "../../services/orderService";
import { PaymentReviewPanel } from "./PaymentReviewPanel";
import { FulfillmentFooter } from "./FulfillmentFooter";
import { OrderReviewSkeleton } from "./skeletons/OrderReviewSkeleton";
import type { FulfillmentMode } from "./FulfillmentDialog";
import type { PrintableOrder, OperatorAction } from "./printFulfillment";
import { getOrderCardTitleParts } from "./orderCardTitle";
import { createPortal } from "react-dom";

export function OrderReviewDialog({
  orderId,
  onClose,
  onUpdated,
  onFulfillment,
}: {
  orderId: string;
  onClose: () => void;
  onUpdated: () => void;
  onFulfillment: (mode: FulfillmentMode, order: PrintableOrder) => void;
}) {
  const live = useLiveResource(
    orderId,
    () => shopQueueService.details(orderId),
    ["orders", "receipts", "assets", "print-jobs"],
  );
  const [verifying, setVerifying] = useState(false);
  const order = live.data;
  const loadingDialog = useRef<HTMLDivElement>(null);
  useDialogFocus(loadingDialog, !order, onClose);
  if (!order)
    return createPortal(
      <div
        role="dialog"
        ref={loadingDialog}
        aria-modal="true"
        aria-label="Loading order review"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      >
        {live.error == null ? (
          <OrderReviewSkeleton onClose={onClose} />
        ) : (
          <div className="space-y-3 border border-black bg-white p-6">
            <p role="alert">The order could not be loaded.</p>
            <button
              type="button"
              className="min-h-11 border border-black px-4"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="min-h-11 border border-black px-4"
              onClick={() => void live.refresh()}
            >
              Retry
            </button>
          </div>
        )}
      </div>,
      document.body,
    );
  const actions = order.available_actions.filter(
    (action): action is OperatorAction => action !== "review",
  );
  return (
    <PaymentReviewPanel
      isOpen
      order={order}
      isVerifying={verifying}
      decisionsDisabled={Boolean(live.error)}
      onClose={onClose}
      onVerify={async (id, action, reason, receiptId, confirmed) => {
        if (live.error) throw new Error("Refresh the order before making a decision.");
        setVerifying(true);
        try {
          await orderService.verifyPayment(
            id,
            action,
            reason,
            receiptId,
            confirmed,
          );
          onUpdated();
          onClose();
        } finally {
          setVerifying(false);
        }
      }}
      onUpdated={() => {
        onUpdated();
        void live.refresh();
      }}
      fulfillmentActions={
        <>
          {live.error != null && (
            <p role="alert">
              The latest status could not be confirmed. Refresh before making a
              decision.
              <button type="button" className="ml-2 min-h-11 underline" onClick={() => void live.refresh()}>
                Refresh order
              </button>
            </p>
          )}
          <FulfillmentFooter
            order={order}
            attempt={order.current_attempt || null}
            actions={live.error ? [] : actions}
            showMilestones
            orderLabel={getOrderCardTitleParts(order).filename}
            onAction={(action) => onFulfillment(action, order)}
          />
        </>
      }
    />
  );
}
