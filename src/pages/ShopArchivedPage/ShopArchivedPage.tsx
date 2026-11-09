import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveResource } from "../../hooks/useLiveResource";
import {
  shopQueueService,
  initialFilters,
  type ShopQueueOrder,
} from "../../services/shopQueueService";
import { KanbanFilterBar } from "../../components/dashboard/KanbanFilterBar";
import { QueuePagination } from "../../components/dashboard/QueuePagination";
import { OrderCardDetailsDialog } from "../../components/dashboard/OrderCardDetailsDialog";
import {
  getOrderCardTitleParts,
  getOrderSpecifications,
  displayOrderStatus,
} from "../../components/dashboard/orderCardTitle";

export const ShopArchivedPage = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<ShopQueueOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRead = useRef(0);
  const live = useLiveResource(
    JSON.stringify(["history", filters, page]),
    () => shopQueueService.query("history", filters, page, 20),
    ["orders", "assets", "receipts", "print-jobs", "users"],
  );
  if (live.data && live.data.meta.currentPage !== page)
    setPage(live.data.meta.currentPage);
  const rows = live.data?.data || [];
  const open = async (order: ShopQueueOrder) => {
    const generation = ++detailRead.current;
    setDetails(order);
    setDetailLoading(true);
    setDetailError("");
    try {
      const fresh = await shopQueueService.details(order.id);
      if (generation !== detailRead.current) return;
      setDetails((current) => (current?.id === order.id ? fresh : current));
    } catch {
      if (generation !== detailRead.current) return;
      setDetailError("Fresh details could not be loaded. Close and try again.");
    } finally {
      if (generation === detailRead.current) setDetailLoading(false);
    }
  };
  const time = (order: ShopQueueOrder) => {
    const date = getOrderCardTitleParts({
      created_at: order.closed_at || order.created_at,
    });
    return (
      (order.closed_at ? "Closed " : "Created (legacy fallback) ") +
      date.date +
      " " +
      date.time +
      " PHT"
    );
  };
  return (
    <div className="min-w-0 space-y-3 p-3 font-sans sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Order History</h1>
        <Link
          className="min-h-11 py-2 font-bold text-carbon-blue-70 underline"
          to="/shop-dashboard"
        >
          Return to Live Queue
        </Link>
      </header>
      <KanbanFilterBar
        queue="history"
        contextLabel="Order History"
        filters={filters}
        searchQuery={filters.searchQuery}
        onSearch={(value) => {
          setFilters((previous) => ({ ...previous, searchQuery: value }));
          setPage(1);
        }}
        paperSizeFilter={filters.paperSize}
        setPaperSizeFilter={(value) => {
          setFilters((previous) => ({ ...previous, paperSize: value }));
          setPage(1);
        }}
        colorModeFilter={filters.colorMode}
        setColorModeFilter={(value) => {
          setFilters((previous) => ({ ...previous, colorMode: value }));
          setPage(1);
        }}
        onFilterChange={(field, value) => {
          setFilters((previous) => ({ ...previous, [field]: value }));
          setPage(1);
        }}
        onClear={() => {
          setFilters((previous) => ({
            ...initialFilters(),
            sort: previous.sort,
          }));
          setPage(1);
        }}
      />
      <p className="text-sm">
        {live.data?.meta.totalItems ?? "--"} matching closed orders |
        Asia/Manila (UTC+08:00)
      </p>
      {live.isLoading && <p role="status">Loading history...</p>}
      {live.error != null && (
        <div role="alert" className="border-l-4 border-red-600 bg-white p-3">
          History could not be refreshed. Existing results may be stale.{" "}
          <button
            type="button"
            className="min-h-11 border border-black px-3"
            onClick={() => void live.refresh()}
          >
            Retry
          </button>
        </div>
      )}
      <div
        id="history-orders"
        className="min-w-0 border border-gray-300 bg-white"
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-300 bg-carbon-gray-10">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Closed / created",
                  "Payment",
                  "Total",
                  "Status",
                ].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => {
                const title = getOrderCardTitleParts(order);
                return (
                  <tr key={order.id} className="border-b border-gray-200">
                    <td className="max-w-xs p-3">
                      <button
                        type="button"
                        className="min-h-11 max-w-full break-words text-left font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60"
                        onClick={() => void open(order)}
                      >
                        {title.filename}
                      </button>
                      <p className="break-all text-xs">#{order.id}</p>
                    </td>
                    <td className="p-3">{title.customer}</td>
                    <td className="p-3">{time(order)}</td>
                    <td className="p-3">
                      {displayOrderStatus(order.payment_method)}
                      <br />
                      {displayOrderStatus(order.payment_status)}
                    </td>
                    <td className="p-3">
                      {getOrderSpecifications(order).total}
                    </td>
                    <td className="p-3">{displayOrderStatus(order.state)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-300 md:hidden">
          {rows.map((order) => {
            const title = getOrderCardTitleParts(order);
            return (
              <article
                key={order.id}
                className="space-y-2 p-3 [overflow-wrap:anywhere]"
              >
                <button
                  type="button"
                  onClick={() => void open(order)}
                  className="min-h-11 text-left font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60"
                >
                  {title.filename}
                </button>
                <p className="text-sm">{title.customer}</p>
                <p className="font-mono text-xs">{order.id}</p>
                <p className="text-xs">{time(order)}</p>
                <p className="text-sm">
                  {getOrderSpecifications(order).total} |{" "}
                  {displayOrderStatus(order.payment_method)} |{" "}
                  {displayOrderStatus(order.payment_status)} |{" "}
                  {displayOrderStatus(order.state)}
                </p>
              </article>
            );
          })}
        </div>
        {!live.isLoading && rows.length === 0 && (
          <p className="p-6 text-center">
            No closed orders match these filters.
          </p>
        )}
      </div>
      <QueuePagination
        label="Order History"
        controlsId="history-orders"
        page={live.data?.meta.currentPage || page}
        pageSize={20}
        total={live.data?.meta.totalItems || 0}
        onPageChange={setPage}
      />
      {details && (
        <OrderCardDetailsDialog
          order={details}
          isLoading={detailLoading}
          loadError={detailError}
          onClose={() => {
            detailRead.current++;
            setDetails(null);
          }}
        />
      )}
    </div>
  );
};
