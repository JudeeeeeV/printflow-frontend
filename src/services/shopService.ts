import { apiClient } from './apiClient';
import type { PrintShop } from './orderService';

type GcashQr = { gcash_qr_url: string | null };
type MyShop = GcashQr & { id: string; name: string; status: string; verification_status: string };
let pendingShop: Promise<MyShop> | null = null;

export const shopService = {
 async getShops(): Promise<PrintShop[]> {
 return apiClient<PrintShop[]>('/shops');
 },

 getMyShop(): Promise<MyShop> {
 // Share concurrent layout/dashboard requests, without caching private data.
 if (!pendingShop) {
 pendingShop = apiClient<MyShop>('/shops/me').finally(() => { pendingShop = null; });
 }
 return pendingShop;
 },

 async verifyPermit(file: File): Promise<any> {
 const formData = new FormData();
 formData.append('permit', file);

 return apiClient<any>('/shops/verify', {
 method: 'POST',
 body: formData,
 });
 },

 async getGcashQr(): Promise<GcashQr> {
 const { gcash_qr_url } = await this.getMyShop();
 return { gcash_qr_url };
 },

 async uploadGcashQr(file: File): Promise<GcashQr> {
 const formData = new FormData();
 formData.append('qrCode', file);

 return apiClient<GcashQr>('/shops/gcash-qr', {
 method: 'POST',
 body: formData,
 });
 },

 async removeGcashQr(): Promise<GcashQr> {
 return apiClient<GcashQr>('/shops/gcash-qr', { method: 'DELETE' });
 }
};
