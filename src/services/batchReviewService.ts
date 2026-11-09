import { apiClient } from "./apiClient";
import type { SelectedOrder, ShopQueueOrder } from "./shopQueueService";
import type { AttemptProgress } from "../components/dashboard/printFulfillment";
import type { ExecutionMode, ManualDownload } from "./printFulfillmentService";

export interface BatchReview {
  orders: Array<
    Partial<ShopQueueOrder> & { id: string; blocking_reasons: string[] }
  >;
  blockers: string[];
  reviewToken: string | null;
  expiresAt: string | null;
  mode: ExecutionMode;
  printerName: string | null;
  orderCount: number;
  totalPrintedPages: number;
}
export interface AcceptedBatch {
  requestId: string;
  attempts: AttemptProgress[];
  acceptedOrderIds: string[];
  downloads?: ManualDownload[];
  downloadErrors?: { orderId: string; message: string }[];
}
export interface BatchRecovery {
  status: "ACCEPTED" | "PROCESSING" | "FAILED" | "COMPLETED";
  result?: AcceptedBatch | { statusCode?: number; body?: { message?: string } };
}
export const batchReviewService = {
  preview(
    selection: readonly SelectedOrder[],
    mode: ExecutionMode,
    printerName?: string,
  ) {
    return apiClient<BatchReview>("/edge/batch-preview", {
      method: "POST",
      timeoutMs: 300000,
      body: JSON.stringify({
        orders: selection.map(({ orderId, fingerprint }) => ({
          orderId,
          fingerprint,
        })),
        mode,
        printerName: mode === "AGENT" ? printerName : undefined,
      }),
    });
  },
  execute(
    selection: readonly SelectedOrder[],
    review: BatchReview,
    requestId: string,
  ) {
    return apiClient<AcceptedBatch>(
      review.mode === "AGENT"
        ? "/edge/batch-execute"
        : "/edge/manual-production",
      {
        method: "POST",
        timeoutMs: 300000,
        body: JSON.stringify({
          orderIds: selection.map((item) => item.orderId),
          reviewToken: review.reviewToken,
          requestId,
          printerName: review.mode === "AGENT" ? review.printerName : undefined,
        }),
      },
    );
  },
  recover(requestId: string) {
    return apiClient<BatchRecovery>(`/edge/batches/${requestId}`, {
      cache: "no-store",
      timeoutMs: 30000,
    });
  },
};

export interface PendingBatch {
  requestId: string;
  selection: SelectedOrder[];
  review: BatchReview;
}
export const pendingBatchKey = (shopId: string) => `pf_pending_batch:${shopId}`;
export function readPendingBatch(shopId: string): PendingBatch | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(pendingBatchKey(shopId)) || "null",
    );
    if (!value || typeof value !== "object") return null;
    const pending = value as Partial<PendingBatch>;
    if (
      typeof pending.requestId !== "string" ||
      !Array.isArray(pending.selection) ||
      pending.selection.length < 1 ||
      pending.selection.length > 25 ||
      !pending.selection.every(
        (item) =>
          item &&
          typeof item.orderId === "string" &&
          typeof item.fingerprint === "string" &&
          typeof item.paperSize === "string" &&
          typeof item.label === "string",
      ) ||
      !pending.review ||
      typeof pending.review.reviewToken !== "string" ||
      !["AGENT", "MANUAL"].includes(pending.review.mode)
    )
      return null;
    return pending as PendingBatch;
  } catch {
    return null;
  }
}
