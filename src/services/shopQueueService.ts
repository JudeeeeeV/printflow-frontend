import { apiClient } from "./apiClient";
import type {
  PrintableOrder,
  OperatorAction,
} from "../components/dashboard/printFulfillment";

export type QueueSection = "new" | "ready" | "pickup" | "history";
export interface ShopQueueOrder extends PrintableOrder {
  fingerprint: string;
  section: QueueSection;
  selectable: boolean;
  has_document: boolean;
  blocking_reasons: string[];
  available_actions: Array<OperatorAction | "review">;
  payment_method: "GCASH" | "CASH_ON_PICKUP";
  payment_status: string;
  acceptance_status: string;
  is_unclaimed: boolean;
  total: number;
  created_at: string;
  closed_at?: string | null;
  assets: { original_filename?: string | null; file_url?: string | null }[];
  payment_receipts?: {
    id: string;
    verified?: boolean;
    receipt_url?: string | null;
    reference_number?: string | null;
  }[];
  current_receipt_id?: string | null;
}
export interface QueueFilters {
  searchQuery: string;
  paperSize: string;
  colorMode: string;
  paymentMethod: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  sort: "default" | "oldest" | "newest" | "title" | "customer";
}
export const initialFilters = (): QueueFilters => ({
  searchQuery: "",
  paperSize: "ALL",
  colorMode: "ALL",
  paymentMethod: "ALL",
  status: "ALL",
  dateFrom: "",
  dateTo: "",
  sort: "default",
});
export interface QueueResult {
  data: ShopQueueOrder[];
  meta: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  counts: Record<QueueSection, number>;
}
export interface SelectedOrder {
  orderId: string;
  fingerprint: string;
  paperSize: string;
  label: string;
}
export const shopQueueService = {
  query(
    section: QueueSection,
    filters: QueueFilters,
    page: number,
    pageSize: number,
    extra: {
      selectableOnly?: boolean;
      excludeIds?: string[];
      onlyIds?: string[];
    } = {},
  ) {
    const query = new URLSearchParams({
      section,
      search: filters.searchQuery,
      paperSize: filters.paperSize,
      colorMode: filters.colorMode,
      paymentMethod: filters.paymentMethod,
      status: filters.status,
      sort: filters.sort,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (extra.selectableOnly) query.set("selectableOnly", "true");
    if (extra.excludeIds?.length)
      query.set("excludeIds", extra.excludeIds.join(","));
    if (extra.onlyIds?.length) query.set("onlyIds", extra.onlyIds.join(","));
    return apiClient<QueueResult>(`/orders/shop/queue?${query}`, {
      cache: "no-store",
      timeoutMs: 30000,
    });
  },
  details(id: string) {
    return apiClient<ShopQueueOrder>(`/orders/shop/${encodeURIComponent(id)}`, {
      cache: "no-store",
      timeoutMs: 30000,
    });
  },
  selection(ids: string[]) {
    return apiClient<ShopQueueOrder[]>(
      `/orders/shop/selection?onlyIds=${ids.join(",")}`,
      { cache: "no-store", timeoutMs: 30000 },
    );
  },
};

export function addSelection(
  current: readonly SelectedOrder[],
  order: ShopQueueOrder,
): { selected: SelectedOrder[]; notice?: string } {
  if (current.some((item) => item.orderId === order.id))
    return { selected: current.filter((item) => item.orderId !== order.id) };
  if (
    !order.selectable ||
    !["SHORT", "A4", "LONG"].includes(order.paper_size || "")
  )
    return {
      selected: [...current],
      notice: "This order cannot be selected for initial printing.",
    };
  if (current.length >= 25)
    return {
      selected: [...current],
      notice: "A batch can contain at most 25 orders.",
    };
  if (current[0] && current[0].paperSize !== order.paper_size)
    return {
      selected: [...current],
      notice: `This batch uses ${current[0].paperSize}. Clear the selection before choosing another paper size.`,
    };
  return {
    selected: [
      ...current,
      {
        orderId: order.id,
        fingerprint: order.fingerprint,
        paperSize: order.paper_size!,
        label:
          order.order_name ||
          order.assets?.[0]?.original_filename ||
          `Order #${order.id.slice(0, 8)}`,
      },
    ],
  };
}

export function reconcileSelection(
  current: readonly SelectedOrder[],
  rows: readonly ShopQueueOrder[],
  checkedIds: readonly string[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const removed = current.filter(
    (item) =>
      checkedIds.includes(item.orderId) &&
      (!byId.get(item.orderId)?.selectable ||
        byId.get(item.orderId)?.fingerprint !== item.fingerprint),
  );
  const removedIds = new Set(removed.map((item) => item.orderId));
  return {
    selected: current.filter((item) => !removedIds.has(item.orderId)),
    removed,
  };
}

/** Merge a bulk response without toggling orders selected while it was loading. */
export function mergeMatchingSelection(
  current: readonly SelectedOrder[],
  rows: readonly ShopQueueOrder[],
) {
  let selected = [...current];
  for (const row of rows) {
    if (!selected.some((item) => item.orderId === row.id))
      selected = addSelection(selected, row).selected;
  }
  return selected;
}
