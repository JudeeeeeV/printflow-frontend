import { getOrderCardTitleParts } from './orderCardTitle';

/** Fields supplied by the existing /orders/shop endpoint, including legacy gaps. */
export interface ShopOrder {
  id: string;
  state: string;
  created_at?: string | null;
  client_name?: string | null;
  order_name?: string | null;
  paper_size?: string | null;
  print_color_mode?: string | null;
  orientation?: string | null;
  page_count?: number | null;
  copies?: number | null;
  total?: number | null;
  assets?: { original_filename?: string | null; file_url: string | null }[] | null;
  payment_receipts?: { reference_number?: string | null; receipt_url?: string | null }[] | null;
}

export type QueueKey = 'new' | 'ready' | 'completed';
export type QueueSort = 'default' | 'oldest' | 'newest' | 'title' | 'customer';
export interface QueueFilterState {
  searchQuery: string;
  paperSize: string;
  colorMode: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  sort: QueueSort;
}

export const QUEUE_STATES: Record<QueueKey, readonly string[]> = {
  new: ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'],
  ready: ['IN_PRODUCTION'],
  completed: ['READY_FOR_PICKUP', 'COMPLETED', 'PRINTED'],
};

export function initialQueueFilters(): QueueFilterState {
  return { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL', status: 'ALL', dateFrom: '', dateTo: '', sort: 'default' };
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const timestamp = (order: ShopOrder) => {
  const value = order.created_at ? Date.parse(order.created_at) : NaN;
  return Number.isFinite(value) ? value : null;
};
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function activeQueueFilterCount(filters: QueueFilterState): number {
  return Number(Boolean(filters.searchQuery.trim())) + Number(filters.paperSize !== 'ALL') +
    Number(filters.colorMode !== 'ALL') + Number(filters.status !== 'ALL') +
    Number(Boolean(filters.dateFrom)) + Number(Boolean(filters.dateTo));
}

export function browseQueue(orders: readonly ShopOrder[], queue: QueueKey, filters: QueueFilterState): ShopOrder[] {
  const query = filters.searchQuery.trim().toLocaleLowerCase('en');
  // Manila has a fixed UTC+08:00 offset. Use an exclusive next-day boundary.
  const start = filters.dateFrom ? Date.parse(`${filters.dateFrom}T00:00:00+08:00`) : null;
  const end = filters.dateTo ? Date.parse(`${filters.dateTo}T00:00:00+08:00`) + 86_400_000 : null;
  return orders.filter(order => {
    if (!QUEUE_STATES[queue].includes(order.state)) return false;
    if (query && ![order.id, order.order_name, order.client_name, order.assets?.[0]?.original_filename]
      .some(value => text(value).toLocaleLowerCase('en').includes(query))) return false;
    if (filters.paperSize !== 'ALL' && order.paper_size !== filters.paperSize) return false;
    if (filters.colorMode !== 'ALL' && order.print_color_mode !== filters.colorMode) return false;
    if (filters.status !== 'ALL' && order.state !== filters.status) return false;
    const time = timestamp(order);
    return (start === null || (time !== null && time >= start)) &&
      (end === null || (time !== null && time < end));
  }).sort((a, b) => {
    if (filters.sort === 'default' && queue === 'new') {
      const priority = Number(b.state === 'AWAITING_PAYMENT_VERIFICATION') - Number(a.state === 'AWAITING_PAYMENT_VERIFICATION');
      if (priority) return priority;
    }
    let comparison: number;
    if (filters.sort === 'title' || filters.sort === 'customer') {
      const value = (order: ShopOrder) => {
        if (filters.sort === 'customer') return text(order.client_name);
        return text(order.order_name) || text(order.assets?.[0]?.original_filename)
          ? getOrderCardTitleParts(order).filename : '';
      };
      const left = value(a), right = value(b);
      comparison = !left ? (right ? 1 : 0) : !right ? -1 : collator.compare(left, right);
    } else {
      const left = timestamp(a), right = timestamp(b);
      const descending = filters.sort === 'newest' || (filters.sort === 'default' && queue === 'completed');
      comparison = left === null ? (right === null ? 0 : 1) : right === null ? -1 :
        (left - right) * (descending ? -1 : 1);
    }
    return comparison || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}
