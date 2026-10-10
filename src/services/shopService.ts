import { apiClient } from './apiClient';
import type { PrintShop } from './orderService';

type GcashQr = { gcash_qr_url: string | null };
export type ShopSettingsValues = {
 name: string;
 location: string | null;
 description: string | null;
 latitude: number | null;
 longitude: number | null;
 availability_override: boolean;
 opens_at: string;
 closes_at: string;
};
type MyShop = GcashQr & Partial<ShopSettingsValues> & {
 id: string;
 name: string;
 status: string;
 verification_status: string;
 availability_override?: boolean;
 opens_at?: string;
 closes_at?: string;
 timezone?: string;
 is_open?: boolean;
 shop_photo_url?: string | null;
};
let pendingShop: Promise<MyShop> | null = null;
const SHOP_LIST_TTL_MS = 30_000;
let pendingShops: Promise<PrintShop[]> | null = null;
let cachedShops: { shops: PrintShop[]; expiresAt: number } | null = null;

export const shopService = {
 invalidateShops(): void {
 cachedShops = null;
 },

 getShops(): Promise<PrintShop[]> {
 if (cachedShops && Date.now() < cachedShops.expiresAt) {
 return Promise.resolve(cachedShops.shops);
 }
 if (!pendingShops) {
 pendingShops = apiClient<PrintShop[]>('/shops').then(shops => {
 cachedShops = { shops, expiresAt: Date.now() + SHOP_LIST_TTL_MS };
 return shops;
 }).finally(() => { pendingShops = null; });
 }
 return pendingShops;
 },

 getMyShop(): Promise<MyShop> {
 // Share concurrent layout/dashboard requests, without caching private data.
 if (!pendingShop) {
 pendingShop = apiClient<MyShop>('/shops/me').finally(() => { pendingShop = null; });
 }
 return pendingShop;
 },

 updateSettings(values: Partial<ShopSettingsValues>): Promise<ShopSettingsValues & { status: string }> {
 return apiClient('/shops/me', { method: 'PATCH', body: JSON.stringify(values) });
 },

 uploadShopPhoto(file: File): Promise<{ shop_photo_url: string | null }> {
 const formData = new FormData();
 formData.append('photo', file);
 return apiClient('/shops/me/photo', { method: 'POST', body: formData });
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
