import { apiClient } from './apiClient';
import type { PrintShop } from './orderService';

export const shopService = {
    async getShops(): Promise<PrintShop[]> {
        return apiClient<PrintShop[]>('/shops');
    },

    async getMyShop(): Promise<{ id: string, name: string, status: string, verification_status: string }> {
        return apiClient<{ id: string, name: string, status: string, verification_status: string }>('/shops/me');
    },

    async verifyPermit(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('permit', file);

        return apiClient<any>('/shops/verify', {
            method: 'POST',
            body: formData,
        });
    },

    async uploadGcashQr(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('qrCode', file);

        return apiClient<any>('/shops/gcash-qr', {
            method: 'POST',
            body: formData,
        });
    }
};
