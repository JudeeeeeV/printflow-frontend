import { apiClient } from './apiClient';
import type { AttemptProgress, OutputCheckKey } from '../components/dashboard/printFulfillment';

export type ExecutionMode = 'AGENT' | 'MANUAL';

export interface BatchResult {
  message: string;
  requestId: string;
  attempts: AttemptProgress[];
  skipped: Array<{ orderId: string; code: string }>;
  replayed?: boolean;
}

export interface ManualDownload {
  attemptId: string;
  orderId: string;
  url: string;
  fileName: string;
}

export interface FollowUpResult {
  message: string;
  attempt: AttemptProgress;
  download?: { url: string; fileName: string };
}

/** One identifier per reviewed batch; reuse it only to retry the same request. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

export const printFulfillmentService = {
  sendBatch(orderIds: string[], printerName: string, requestId: string) {
    return apiClient<BatchResult>('/edge/batch-execute', {
      method: 'POST',
      body: JSON.stringify({ orderIds, printerName, requestId }),
    });
  },

  startManualProduction(orderIds: string[], requestId: string) {
    return apiClient<BatchResult & { downloads: ManualDownload[] }>('/edge/manual-production', {
      method: 'POST',
      body: JSON.stringify({ orderIds, requestId }),
    });
  },

  retry(
    attemptId: string,
    body: { mode: ExecutionMode; printerName?: string; reason?: string; queueCleared?: boolean },
  ) {
    return apiClient<FollowUpResult>(`/edge/attempts/${attemptId}/retry`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  reprint(
    orderId: string,
    body: {
      expectedAttemptId: string | null;
      mode: ExecutionMode;
      printerName?: string;
      reason: string;
      confirmFullJob: true;
    },
  ) {
    return apiClient<FollowUpResult>(`/edge/orders/${orderId}/reprint`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  recordStillUncertain(attemptId: string, reason: string) {
    return apiClient<{ message: string }>(`/edge/attempts/${attemptId}/still-uncertain`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  confirmOutput(
    orderId: string,
    expectedAttemptId: string | null,
    checks: Record<OutputCheckKey, boolean>,
    reconciliationReason?: string,
  ) {
    return apiClient<{ message: string; state: string; duplicate: boolean }>(`/orders/${orderId}/state`, {
      method: 'PATCH',
      body: JSON.stringify({
        state: 'READY_FOR_PICKUP',
        expectedAttemptId,
        confirmed: true,
        checks,
        ...(reconciliationReason ? { reconciliationReason } : {}),
      }),
    });
  },

  recordHandover(orderId: string, expectedAttemptId: string | null) {
    return apiClient<{ message: string; state: string; duplicate: boolean }>(`/orders/${orderId}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'COMPLETED', expectedAttemptId, confirmed: true }),
    });
  },
};

/** Saves a pinned file returned by manual production or a manual retry. */
export async function downloadPinnedFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
