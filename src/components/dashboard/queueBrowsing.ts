import type { ShopQueueOrder } from '../../services/shopQueueService';

/** Display-only compatibility type. Queue classification and browsing live on the backend. */
export type ShopOrder = Partial<ShopQueueOrder> & { id: string; state: string };
