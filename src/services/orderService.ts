import { apiClient } from './apiClient';

export interface PrintShop {
 id: string;
 name: string;
 rating: number;
 status: 'OPEN' | 'CLOSED' | 'BUSY';
 pricing_matrix?: any;
}

export interface ValidationResult {
 passed: boolean;
 dpi?: number;
 colorProfile?: string;
 errorMessage?: string;
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

export interface UploadReceiptResponse {
 message: string;
 state: string;
}

export const orderService = {
 /**
 * Fetches available print shops for the directory.
 */
 async getShops(): Promise<PrintShop[]> {
 return apiClient<PrintShop[]>('/shops', { method: 'GET' });
 },

 /**
 * Validates the uploaded asset against shop constraints.
 */
 async validateAsset(file: File, shopId: string): Promise<ValidationResult> {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('shopId', shopId);

 // Bypassing default JSON headers to allow multipart/form-data
 return apiClient<ValidationResult>('/validation/asset', {
 method: 'POST',
 body: formData as unknown as BodyInit, // TypeScript workaround for FormData in generic fetch wrapper
 });
 },

 /**
 * Submits the final print order.
 */
 async submitOrder(shopId: string, file: File, paperSize: string, printColorMode: string): Promise<SubmitOrderResponse> {
 const formData = new FormData();
 formData.append('shopId', shopId);
 formData.append('file', file);
 formData.append('paperSize', paperSize);
 formData.append('printColorMode', printColorMode);

 return apiClient<SubmitOrderResponse>('/orders', {
 method: 'POST',
 body: formData as unknown as BodyInit,
 });
 },

 async getOrder(orderId: string): Promise<any> {
 return apiClient<any>(`/orders/${orderId}`, {
 method: 'GET',
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
 return apiClient<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }>(`/orders?${queryString}`, { method: 'GET' });
 },

 async getShopOrders(): Promise<any[]> {
 return apiClient<any[]>('/orders/shop', {
 method: 'GET',
 });
 },

 /**
 * Uploads the payment receipt for a specific order.
 */
 async uploadReceipt(orderId: string, receiptFile: File, referenceNumber?: string): Promise<{ message: string; state: string }> {
 const formData = new FormData();
 formData.append('receiptFile', receiptFile);
 if (referenceNumber) {
 formData.append('referenceNumber', referenceNumber);
 }

 return apiClient<{ message: string; state: string }>(`/orders/${orderId}/receipt`, {
 method: 'POST',
 body: formData,
 });
 },

 async verifyPayment(orderId: string, action: 'APPROVE' | 'REJECT', reason?: string): Promise<{ message: string }> {
 return apiClient<{ message: string }>(`/orders/${orderId}/verify-payment`, {
 method: 'POST',
 body: JSON.stringify({ action, reason }),
 });
 },

 async disputePayment(orderId: string, reason: string): Promise<{ message: string }> {
 return apiClient<{ message: string }>(`/orders/${orderId}/dispute-payment`, {
 method: 'POST',
 body: JSON.stringify({ reason }),
 });
 },

 async cancelOrder(orderId: string): Promise<{ message: string }> {
 return apiClient<{ message: string }>(`/orders/${orderId}`, {
 method: 'DELETE',
 });
 },

 // Fetch all drafts for the current user
 getDrafts: async (page: number = 1, limit: number = 10): Promise<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }> => {
 const queryParams = new URLSearchParams();
 queryParams.append('page', page.toString());
 queryParams.append('limit', limit.toString());
 const queryString = queryParams.toString();
 return await apiClient<{ data: any[], meta: { currentPage: number, totalPages: number, totalItems: number } }>(`/orders/drafts?${queryString}`, { 
 method: 'GET' 
 });
 },

 // Convert a draft to a real order (starts the 15-minute timer)
 submitDraft: async (draftId: string) => {
 return await apiClient(`/orders/${draftId}/submit`, { 
 method: 'PATCH' 
 });
 },

 // Delete a draft permanently
 deleteDraft: async (draftId: string) => {
 return await apiClient(`/orders/${draftId}`, { 
 method: 'DELETE' 
 });
 },

 saveDraft: async (shopId: string, file: File, paperSize: string, printColorMode: string) => {
 const formData = new FormData();
 formData.append('shopId', shopId);
 formData.append('file', file);
 formData.append('isDraft', 'true'); // THIS is the magic flag for the backend
 formData.append('paperSize', paperSize);
 formData.append('printColorMode', printColorMode);

 // Reusing your existing POST /orders endpoint
 return await apiClient('/orders', {
 method: 'POST',
 body: formData,
 });
 }
};
