import { apiClient } from './apiClient';

export type PaymentMethod = 'GCASH' | 'CASH_ON_PICKUP';
export type ShopDecision = 'ACCEPT' | 'REJECT_ORDER' | 'COLLECT_CASH' | 'RECORD_REFUND' | 'FLAG_UNCLAIMED' | 'CLEAR_UNCLAIMED';
export interface OrderDecisionResponse {
 message: string;
 state: string;
 order: { id: string; state: string; payment_status: string; acceptance_status: string; [key: string]: unknown };
}

export interface PrintShop {
 id: string;
 name: string;
 rating: number;
 status: 'OPEN' | 'CLOSED' | 'BUSY';
 location?: string | null;
 latitude?: number | null;
 longitude?: number | null;
 shop_photo_url?: string | null;
 pricing_matrix?: any;
 availability_override?: boolean;
 opens_at?: string;
 closes_at?: string;
 timezone?: string;
 is_open?: boolean;
}

export interface OrderEstimate {
 total: number;
 pageCount: number;
 basePrice: number;
 colorAdditive: number;
}

export interface SubmitOrderResponse {
 message: string;
 orderId: string;
 state: string;
}

/** What the server knows about a submission, keyed by its idempotency key. */
export interface OperationStatus<T> {
 status: 'unknown' | 'processing' | 'succeeded' | 'failed';
 retryAllowed: boolean;
 retryAfterSeconds?: number;
 result?: T;
 error?: { status: number | null; data: unknown };
}

export type DraftSettings = {
 shopId: string;
 paperSize: string;
 printColorMode: string;
 orderName: string;
 orientation: string;
 copies: number;
 paymentMethod: PaymentMethod;
};

export interface UploadReceiptResponse {
 message: string;
 state: string;
}

const READ_TIMEOUT_MS = 30_000;
const JSON_WRITE_TIMEOUT_MS = 30_000;
const MULTIPART_TIMEOUT_MS = 5 * 60_000;

const operationHeaders = (key: string) => ({ 'Idempotency-Key': key });

function draftChangeRequest(settings: DraftSettings, file: File | null, expectedVersion: number | undefined, key: string): { method: string; headers: Record<string, string>; body: BodyInit; timeoutMs: number } {
 const fields = { ...settings, orderName: settings.orderName.trim(), ...(expectedVersion === undefined ? {} : { expectedVersion }) };
 const shared = { method: 'PATCH', headers: operationHeaders(key) };
 if (!file) return { ...shared, body: JSON.stringify(fields), timeoutMs: JSON_WRITE_TIMEOUT_MS };
 const formData = new FormData();
 formData.append('file', file);
 Object.entries(fields).forEach(([name, value]) => formData.append(name, String(value)));
 return { ...shared, body: formData, timeoutMs: MULTIPART_TIMEOUT_MS };
}

export const orderService = {
 /**
 * Fetches available print shops for the directory.
 */
 async getShops(): Promise<PrintShop[]> {
 return apiClient<PrintShop[]>('/shops', { method: 'GET', timeoutMs: READ_TIMEOUT_MS });
 },

 /**
 * Submits the final print order.
 */
 async submitOrder(shopId: string, file: File, paperSize: string, printColorMode: string, orderName: string, orientation: string, copies: number, paymentMethod: PaymentMethod = 'GCASH', key: string, confirmDuplicate = false): Promise<SubmitOrderResponse> {
 const formData = new FormData();
 formData.append('shopId', shopId);
 formData.append('file', file);
 formData.append('paperSize', paperSize);
 formData.append('printColorMode', printColorMode);
 formData.append('orderName', orderName.trim());
 formData.append('orientation', orientation);
 formData.append('copies', String(copies));
 formData.append('paymentMethod', paymentMethod);
 if (confirmDuplicate) formData.append('confirmDuplicate', 'true');

 return apiClient<SubmitOrderResponse>('/orders', {
 method: 'POST',
 headers: operationHeaders(key),
 body: formData as unknown as BodyInit,
 timeoutMs: MULTIPART_TIMEOUT_MS,
 });
 },

 /** Asks what happened to a submission whose response never arrived. */
 async getOperation<T>(key: string): Promise<OperationStatus<T>> {
 return apiClient<OperationStatus<T>>(`/orders/operations/${key}`, {
 method: 'GET',
 cache: 'no-store',
 timeoutMs: READ_TIMEOUT_MS,
 });
 },

 async getOrder(orderId: string): Promise<any> {
 return apiClient<any>(`/orders/${orderId}`, {
 method: 'GET',
 cache: 'no-store',
 timeoutMs: READ_TIMEOUT_MS,
 });
 },

 async getUserOrders(sortByDate: 'asc' | 'desc' = 'desc', status: string = 'All', page: number = 1, limit: number = 10): Promise<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }> {
 const queryParams = new URLSearchParams();
 queryParams.append('sortByDate', sortByDate);
 if (status && status !== 'All') {
 queryParams.append('status', status);
 }
 queryParams.append('page', page.toString());
 queryParams.append('limit', limit.toString());
 
 const queryString = queryParams.toString();
 return apiClient<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }>(`/orders?${queryString}`, { method: 'GET', timeoutMs: READ_TIMEOUT_MS });
 },

 async getShopOrders(): Promise<any[]> {
 return apiClient<any[]>('/orders/shop', {
 method: 'GET',
 });
 },

 /**
 * Uploads the payment receipt for a specific order.
 */
 async uploadReceipt(orderId: string, receiptFile: File, referenceNumber: string | undefined, key: string): Promise<{ message: string; state: string }> {
 const formData = new FormData();
 formData.append('receiptFile', receiptFile);
 if (referenceNumber) {
 formData.append('referenceNumber', referenceNumber);
 }

 return apiClient<{ message: string; state: string }>(`/orders/${orderId}/receipt`, {
 method: 'POST',
 headers: operationHeaders(key),
 body: formData,
 timeoutMs: MULTIPART_TIMEOUT_MS,
 });
 },

 async verifyPayment(orderId: string, action: 'APPROVE' | 'REJECT', reason: string | undefined, receiptId: string, confirmed: boolean): Promise<OrderDecisionResponse> {
 return apiClient<OrderDecisionResponse>(`/orders/${orderId}/verify-payment`, {
 method: 'POST',
 body: JSON.stringify({ action, reason, receiptId, confirmed }),
 });
 },

 async disputePayment(orderId: string, reason: string): Promise<{ message: string }> {
 return apiClient<{ message: string }>(`/orders/${orderId}/dispute-payment`, {
 method: 'POST',
 body: JSON.stringify({ reason }),
 timeoutMs: JSON_WRITE_TIMEOUT_MS,
 });
 },

 async cancelOrder(orderId: string): Promise<{ message: string }> {
 return apiClient<{ message: string }>(`/orders/${orderId}`, {
 method: 'DELETE',
 timeoutMs: JSON_WRITE_TIMEOUT_MS,
 });
 },

 // Fetch all drafts for the current user
 getDrafts: async (page: number = 1, limit: number = 10): Promise<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }> => {
 const queryParams = new URLSearchParams();
 queryParams.append('page', page.toString());
 queryParams.append('limit', limit.toString());
 const queryString = queryParams.toString();
 return await apiClient<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }>(`/orders/drafts?${queryString}`, {
 method: 'GET',
 timeoutMs: READ_TIMEOUT_MS,
 });
 },

 // Convert a draft to a real order (starts the 15-minute timer), with any edits, in one step
 submitDraftChanges: async (draftId: string, settings: DraftSettings, file: File | null, expectedVersion: number | undefined, key: string) => {
 return await apiClient<SubmitOrderResponse>(`/orders/${draftId}/submit`, draftChangeRequest(settings, file, expectedVersion, key));
 },

 saveDraftChanges: async (draftId: string, settings: DraftSettings, file: File | null, expectedVersion: number | undefined, key: string) => {
 return await apiClient<SubmitOrderResponse>(`/orders/${draftId}/update-draft`, draftChangeRequest(settings, file, expectedVersion, key));
 },

 // Delete a draft permanently
 deleteDraft: async (draftId: string) => {
 return await apiClient(`/orders/${draftId}`, { 
 method: 'DELETE',
 timeoutMs: JSON_WRITE_TIMEOUT_MS,
 });
 },

  saveDraft: async (shopId: string, file: File, paperSize: string, printColorMode: string, orderName: string, orientation: string, copies: number, paymentMethod: PaymentMethod = 'GCASH', key: string) => {
    const formData = new FormData();
    formData.append('shopId', shopId);
    formData.append('file', file);
    formData.append('isDraft', 'true'); // THIS is the magic flag for the backend
    formData.append('paperSize', paperSize);
    formData.append('printColorMode', printColorMode);
    formData.append('orderName', orderName.trim());
    formData.append('orientation', orientation);
    formData.append('copies', String(copies));
    formData.append('paymentMethod', paymentMethod);

    // Reusing your existing POST /orders endpoint
    return await apiClient<SubmitOrderResponse>('/orders', {
      method: 'POST',
      headers: operationHeaders(key),
      body: formData,
      timeoutMs: MULTIPART_TIMEOUT_MS,
    });
  },

  async decideOrder(orderId: string, action: ShopDecision, data: { reason?: string; reference?: string; confirmed?: boolean } = {}): Promise<OrderDecisionResponse> {
    return apiClient<OrderDecisionResponse>(`/orders/${orderId}/decision`, {
      method: 'POST', body: JSON.stringify({ action, ...data }),
    });
  },


};
