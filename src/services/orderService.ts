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
            body: formData,
        });
    },

    /**
     * Submits the final print order.
     */
    async submitOrder(shopId: string, assetUrl: string): Promise<any> {
        return apiClient('/orders', {
            method: 'POST',
            body: JSON.stringify({ shopId, assetUrl }),
        });
    }
};