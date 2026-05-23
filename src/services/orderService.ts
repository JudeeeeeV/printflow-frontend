import { apiClient } from './apiClient';

export interface PrintShop {
    id: string;
    name: string;
    rating: number;
    status: 'OPEN' | 'CLOSED' | 'BUSY';
}

export interface ValidationResult {
    passed: boolean;
    dpi?: number;
    colorProfile?: string;
    errorMessage?: string;
}

export interface OrderEstimate {
    total: number;
    rushFee: number;
    estimatedDelivery: string;
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
    async submitOrder(shopId: string, file: File): Promise<SubmitOrderResponse> {
        const formData = new FormData();
        formData.append('shopId', shopId);
        formData.append('file', file);

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

    async getUserOrders(): Promise<any[]> {
        return apiClient<any[]>('/orders', {
            method: 'GET',
        });
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

    async cancelOrder(orderId: string): Promise<{ message: string }> {
        return apiClient<{ message: string }>(`/orders/${orderId}`, {
            method: 'DELETE',
        });
    },

    // Fetch all drafts for the current user
    getDrafts: async () => {
        return await apiClient('/orders/drafts', { 
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

    saveDraft: async (shopId: string, file: File) => {
        const formData = new FormData();
        formData.append('shopId', shopId);
        formData.append('file', file);
        formData.append('isDraft', 'true'); // THIS is the magic flag for the backend

        // Reusing your existing POST /orders endpoint
        return await apiClient('/orders', {
            method: 'POST',
            body: formData,
        });
    }
};