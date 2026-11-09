import { newOperationKey } from "../../services/submissionRecovery";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../common/useDialogFocus";
import { useLiveResource } from "../../hooks/useLiveResource";
import { ApiError } from "../../services/apiClient";
import {
  batchReviewService,
  pendingBatchKey,
  type PendingBatch,
  type AcceptedBatch,
  type BatchReview,
} from "../../services/batchReviewService";
import type { ExecutionMode } from "../../services/printFulfillmentService";
import type { SelectedOrder } from "../../services/shopQueueService";
import {
  getOrderCardTitleParts,
  getOrderSpecifications,
  displayOrderStatus,
} from "./orderCardTitle";

const button =
  "min-h-11 border border-black px-4 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50";

export function BatchReviewDialog({
  shopId,
  selection,
  mode,
  printerName,
  printers,
  onPrinterChange,
  onRemove,
  onRefreshSelection,
  onClose,
  onAccepted,
  initialPending,
}: {
  shopId: string;
  selection: SelectedOrder[];
  mode: ExecutionMode;
  printerName: string;
  printers: string[];
  onPrinterChange: (printer: string) => void;
  onRemove: (id: string) => void;
  onRefreshSelection: (orders: BatchReview["orders"]) => void;
  onClose: () => void;
  onAccepted: (batch: AcceptedBatch) => void;
  initialPending?: PendingBatch | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const [request, setRequest] = useState<PendingBatch | null>(
    initialPending || null,
  );
  const [uncertain, setUncertain] = useState(Boolean(initialPending));
  const [retrySame, setRetrySame] = useState(false);
  const [error, setError] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const key = JSON.stringify([
    selection.map((item) => [item.orderId, item.fingerprint]),
    mode,
    printerName,
  ]);
  const live = useLiveResource(
    key,
    () => batchReviewService.preview(selection, mode, printerName),
    ["orders", "receipts", "assets", "print-jobs", "devices"],
  );
  const review = live.data;
  const blocked =
    !review?.reviewToken ||
    (mode === "AGENT" && !printers.includes(printerName));
  const close = () => {
    if (!pendingRef.current && !uncertain) onClose();
  };
  useDialogFocus(dialog, true, close, busy || uncertain);

  const finish = (result: AcceptedBatch) => {
    sessionStorage.removeItem(pendingBatchKey(shopId));
    setUncertain(false);
    setRequest(null);
    onAccepted(result);
  };
  const recover = async () => {
    if (!request || pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const recovered = await batchReviewService.recover(request.requestId);
      if (recovered.status === "ACCEPTED" || recovered.status === "COMPLETED")
        finish(recovered.result as AcceptedBatch);
      else if (recovered.status === "FAILED") {
        sessionStorage.removeItem(pendingBatchKey(shopId));
        setRequest(null);
        setUncertain(false);
        setRetrySame(false);
        setNeedsReview(true);
        setError(
          "The batch was rejected. Refresh the review before trying again.",
        );
        void live.refresh();
      } else
        setError(
          "The server is still processing this batch. Check its outcome again; do not send another batch.",
        );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        setRetrySame(true);
        setError(
          "No request is recorded yet. You may retry the same request safely; its ID will be preserved.",
        );
      } else
        setError(
          failure instanceof Error
            ? failure.message
            : "The outcome is still unknown. Check again.",
        );
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  const send = async () => {
    if (
      pendingRef.current ||
      (uncertain && !retrySame) ||
      (!uncertain && (blocked || needsReview)) ||
      !review
    )
      return;
    const next =
      uncertain && request
        ? request
        : { requestId: newOperationKey(), selection: [...selection], review };
    // Persist before sending. A reload must recover this request instead of creating a second one.
    try {
      sessionStorage.setItem(pendingBatchKey(shopId), JSON.stringify(next));
    } catch {
      setError(
        "The browser could not save the request ID. Allow session storage before printing.",
      );
      return;
    }
    setRequest(next);
    pendingRef.current = true;
    setBusy(true);
    setError("");
    setRetrySame(false);
    try {
      finish(
        await batchReviewService.execute(
          next.selection,
          next.review,
          next.requestId,
        ),
      );
    } catch (failure) {
      const ambiguous =
        !(failure instanceof ApiError) ||
        failure.status === 0 ||
        failure.status >= 500 ||
        (failure.data as { code?: string } | undefined)?.code ===
          "BATCH_PROCESSING";
      if (ambiguous) {
        setUncertain(true);
        setError(
          "The send outcome is uncertain. Check the recorded batch before sending again.",
        );
      } else {
        sessionStorage.removeItem(pendingBatchKey(shopId));
        setRequest(null);
        setUncertain(false);
        setError(failure.message);
        setNeedsReview(true);
        const affected =
          (
            failure.data as
              { conflicts?: { orderId: string; message: string }[] } | undefined
          )?.conflicts || [];
        setConflicts(
          Object.fromEntries(
            affected.map((item) => [item.orderId, item.message]),
          ),
        );
        void live.refresh();
      }
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-review-heading"
        aria-busy={busy}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden border border-black bg-white text-carbon-gray-100 shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
          <div>
            <h2 id="batch-review-heading" className="text-lg font-black">
              Review batch
            </h2>
            <p className="text-sm">
              {mode === "MANUAL"
                ? "Manual production"
                : `Printer: ${printerName || "Select a printer"}`}
            </p>
          </div>
          <button
            type="button"
            className={button}
            disabled={busy || uncertain}
            onClick={close}
          >
            Close
          </button>
        </header>
        <div
          tabIndex={0}
          aria-label="Batch review contents"
          className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60"
        >
          {mode === "AGENT" && (
            <label className="block text-sm font-bold">
              Selected printer
              <select
                className="mt-1 block min-h-11 w-full border border-black bg-white p-2"
                value={printers.includes(printerName) ? printerName : ""}
                disabled={busy || uncertain}
                onChange={(event) => onPrinterChange(event.target.value)}
              >
                <option value="">Choose a printer explicitly</option>
                {printers.map((printer) => (
                  <option key={printer}>{printer}</option>
                ))}
              </select>
            </label>
          )}
          <p className="font-bold">
            {review?.orderCount ?? selection.length} orders ·{" "}
            {review?.totalPrintedPages ?? "—"} total printed pages
          </p>
          <p className="text-sm">
            {mode === "MANUAL"
              ? "Confirming records manual production and downloads the reviewed PDFs."
              : "Confirming records the batch and sends it to the selected printer."}{" "}
            Check every physical output before marking it ready for pickup.
          </p>
          {live.isLoading && <p role="status">Loading fresh review…</p>}
          {live.error != null && (
            <p role="alert">
              Review could not be refreshed. Confirming is disabled until a
              fresh review succeeds.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="border-l-4 border-red-600 bg-red-50 p-3 text-sm"
            >
              {error}
            </p>
          )}
          {review?.blockers.map((reason) => (
            <p key={reason} role="alert" className="text-sm text-red-700">
              {reason}
            </p>
          ))}
          {mode === "AGENT" && !printers.includes(printerName) && (
            <p role="alert">
              The reviewed printer is unavailable. Select a replacement and
              review again.
            </p>
          )}
          <ol className="space-y-3">
            {review?.orders.map((order) => {
              const title = getOrderCardTitleParts(order),
                specs = getOrderSpecifications(order);
              return (
                <li
                  key={order.id}
                  className="min-w-0 space-y-2 border border-gray-300 p-3 [overflow-wrap:anywhere]"
                >
                  <h3 className="font-bold">{title.filename}</h3>
                  <p className="text-sm">
                    {title.originalFilename} · {title.customer}
                  </p>
                  <p className="select-text font-mono text-xs">{order.id}</p>
                  <p className="text-sm">
                    {specs.paper} · {specs.color} · {specs.orientation} ·{" "}
                    {specs.pages} · {specs.copies}
                  </p>
                  <p className="text-xs">
                    {displayOrderStatus(order.payment_method || "")} ·{" "}
                    {displayOrderStatus(order.payment_status || "")} ·{" "}
                    {displayOrderStatus(order.acceptance_status || "")}
                  </p>
                  {order.blocking_reasons.map((reason) => (
                    <p key={reason} className="text-sm font-bold text-red-700">
                      {reason}
                    </p>
                  ))}
                  {conflicts[order.id] && (
                    <p role="alert" className="text-sm font-bold text-red-700">
                      {conflicts[order.id]}
                    </p>
                  )}
                  <button
                    type="button"
                    className={button}
                    disabled={busy || uncertain}
                    onClick={() => onRemove(order.id)}
                  >
                    Remove from batch
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-300 p-3">
          {uncertain ? (
            <>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => void recover()}
              >
                Check recorded outcome
              </button>
              {retrySame && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void send()}
                >
                  Retry same request
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={button}
                disabled={busy || !review}
                onClick={() => {
                  setNeedsReview(false);
                  setConflicts({});
                  if (review) onRefreshSelection(review.orders);
                  void live.refresh();
                }}
              >
                Refresh and review again
              </button>
              <button
                type="button"
                className={`${button} bg-carbon-blue-60 text-white`}
                disabled={
                  busy ||
                  blocked ||
                  needsReview ||
                  Boolean(live.error) ||
                  live.isLoading
                }
                onClick={() => void send()}
              >
                {busy
                  ? "Sending…"
                  : mode === "MANUAL"
                    ? "Confirm and download"
                    : "Confirm and send"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
