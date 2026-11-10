import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveResource } from "../../hooks/useLiveResource";
import { useDataEvents } from "../../hooks/useDataEvents";
import {
  shopQueueService,
  initialFilters,
  addSelection,
  mergeMatchingSelection,
  reconcileSelection,
  type QueueFilters,
  type QueueSection,
  type SelectedOrder,
  type ShopQueueOrder,
} from "../../services/shopQueueService";
import { daemonSocketService } from "../../services/daemonSocketService";
import type { DaemonStatus } from "../../services/daemonSocketService";
import { downloadPinnedFile } from "../../services/printFulfillmentService";
import { BatchReviewDialog } from "./BatchReviewDialog";
import {
  readPendingBatch,
  batchReviewService,
  type AcceptedBatch,
  type BatchReview,
} from "../../services/batchReviewService";
import { useLiveQueueLayout } from "./useLiveQueueLayout";
import { getQueuePage, queueGridClassName } from "./liveQueueLayout";
import { KanbanFilterBar } from "./KanbanFilterBar";
import { QueuePagination } from "./QueuePagination";
import { OrderCard } from "./OrderCard";
import { OrderReviewDialog } from "./OrderReviewDialog";
import { FulfillmentDialog, type FulfillmentMode } from "./FulfillmentDialog";
import { PrintJobProgressModal } from "./PrintJobProgressModal";
import {
  mergeAttempt,
  orderBadge,
  TONE_CLASSES,
  type AttemptProgress,
  type PrintableOrder,
} from "./printFulfillment";
import { getOrderCardTitleParts } from "./orderCardTitle";
import { QueueCardSkeleton } from "./skeletons/DashboardSkeleton";

type LiveSection = Exclude<QueueSection, "history">;
const SECTIONS: LiveSection[] = ["new", "ready", "pickup"];
const LABELS = { new: "New Orders", ready: "Print Ready", pickup: "Pickup" };
const button =
  "min-h-11 border border-black bg-white px-3 py-2 text-sm font-bold hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50";

export function LiveShopQueue({ shopId }: { shopId: string }) {
  const [pending, setPending] = useState(() => readPendingBatch(shopId));
  const [active, setActive] = useState<LiveSection>("new");
  const [filters, setFilters] = useState<Record<LiveSection, QueueFilters>>({
    new: initialFilters(),
    ready: initialFilters(),
    pickup: initialFilters(),
  });
  const [pages, setPages] = useState({ new: 1, ready: 1, pickup: 1 });
  const { layout, gridRef } = useLiveQueueLayout(active);
  const [sizes, setSizes] = useState({
    new: layout.pageSize,
    ready: layout.pageSize,
    pickup: layout.pageSize,
  });
  const [selected, setSelected] = useState<SelectedOrder[]>(
    pending?.selection || [],
  );
  const [notice, setNotice] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [downloadRetry, setDownloadRetry] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [batchMode, setBatchMode] = useState<"AGENT" | "MANUAL" | null>(
    pending?.review.mode || null,
  );
  const [status, setStatus] = useState<DaemonStatus>("OFFLINE");
  const [printers, setPrinters] = useState<string[]>([]);
  const [printer, setPrinter] = useState(pending?.review.printerName || "");
  const [updateRequired, setUpdateRequired] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<{
    mode: FulfillmentMode;
    order: PrintableOrder;
  } | null>(null);
  const [progress, setProgress] = useState<AttemptProgress[]>([]);
  const [progressOpen, setProgressOpen] = useState(false);
  const [matchingSelected, setMatchingSelected] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<QueueSection, number> | null>(
    null,
  );
  const selectedRef = useRef(selected);
  const reviewOpenRef = useRef(batchMode !== null);
  const selectionRead = useRef(0);
  const liveProgress = useRef<Record<string, AttemptProgress>>({});
  const [progressLabels, setProgressLabels] = useState<Record<string, string>>(
    {},
  );
  const tabs = useRef<Partial<Record<LiveSection, HTMLButtonElement | null>>>(
    {},
  );
  const currentFilters = filters[active];
  const queryKey = JSON.stringify([
    active,
    currentFilters,
    pages[active],
    sizes[active],
  ]);
  const live = useLiveResource(
    queryKey,
    () =>
      shopQueueService.query(
        active,
        currentFilters,
        pages[active],
        sizes[active],
      ),
    ["orders", "assets", "receipts", "print-jobs", "users"],
  );
  const rows = live.data?.data || [];
  if (live.data && JSON.stringify(counts) !== JSON.stringify(live.data.counts))
    setCounts(live.data.counts);

  useEffect(() => {
    selectedRef.current = selected;
    reviewOpenRef.current = batchMode !== null;
  }, [selected, batchMode]);
  // Resizing keeps the old first item within the new page. Each tab owns its size/page.
  if (layout.queueKey === active && sizes[active] !== layout.pageSize) {
    const page = getQueuePage(
      pages[active],
      sizes[active],
      layout.pageSize,
      live.data?.meta.totalItems ?? pages[active] * sizes[active],
    );
    setSizes((previous) => ({ ...previous, [active]: layout.pageSize }));
    setPages((previous) => ({ ...previous, [active]: page }));
  }
  if (live.data && live.data.meta.currentPage !== pages[active]) {
    setPages((previous) => ({
      ...previous,
      [active]: live.data!.meta.currentPage,
    }));
  }

  const selectedKey = JSON.stringify(
    selected.map((item) => [item.orderId, item.fingerprint]),
  );
  const readyFilterKey = JSON.stringify(filters.ready);
  const validateSelection = useCallback(async () => {
    const generation = ++selectionRead.current;
    const snapshot = selectedRef.current;
    if (!snapshot.length) {
      setMatchingSelected([]);
      return;
    }
    const ids = snapshot.map((item) => item.orderId);
    try {
      const [fresh, matches] = await Promise.all([
        shopQueueService.selection(ids),
        shopQueueService.query("ready", filters.ready, 1, 25, { onlyIds: ids }),
      ]);
      if (generation !== selectionRead.current) return;
      setMatchingSelected(matches.data.map((item) => item.id));
      if (reviewOpenRef.current) return; // Open review retains invalid rows and displays their blockers.
      const result = reconcileSelection(snapshot, fresh, ids);
      if (result.removed.length) {
        setSelected((previous) =>
          previous.filter(
            (item) =>
              !result.removed.some(
                (removed) =>
                  removed.orderId === item.orderId &&
                  removed.fingerprint === item.fingerprint,
              ),
          ),
        );
        setNotice(
          `Removed from selection because eligibility or details changed: ${result.removed.map((item) => item.label).join(", ")}.`,
        );
      }
    } catch {
      setNotice(
        "The selection could not be refreshed. Batch review will check every selected order before sending.",
      );
    }
  }, [filters.ready]);
  useEffect(() => {
    void validateSelection();
    if (!selected.length) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void validateSelection();
    }, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") void validateSelection();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [selectedKey, readyFilterKey, validateSelection, selected.length]);
  useDataEvents(
    ["orders", "assets", "receipts", "print-jobs"],
    () => void validateSelection(),
  );

  useEffect(() => {
    const unsubscribers = [
      daemonSocketService.onStatusChange(setStatus),
      daemonSocketService.onPrintersList(setPrinters),
      daemonSocketService.onUpdateRequired(setUpdateRequired),
      daemonSocketService.onJobProgress((attempt) => {
        liveProgress.current[attempt.attemptId] =
          mergeAttempt(liveProgress.current[attempt.attemptId], attempt) ||
          attempt;
        setProgress((previous) =>
          previous.map((item) =>
            item.attemptId === attempt.attemptId
              ? mergeAttempt(item, attempt)!
              : item,
          ),
        );
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const updateFilter = (
    section: LiveSection,
    field: keyof QueueFilters,
    value: string,
  ) => {
    setFilters((previous) => ({
      ...previous,
      [section]: { ...previous[section], [field]: value },
    }));
    setPages((previous) => ({ ...previous, [section]: 1 }));
  };
  const toggle = (order: ShopQueueOrder) => {
    const result = addSelection(selected, order);
    setSelected((previous) => addSelection(previous, order).selected);
    setNotice(result.notice || "");
  };
  const bulk = async () => {
    const size = selected[0]?.paperSize || filters.ready.paperSize;
    if (size === "ALL") {
      setNotice(
        "Choose a paper size or select one order before selecting across pages.",
      );
      return;
    }
    if (selected.length >= 25) {
      setNotice("The 25-order batch limit has been reached.");
      return;
    }
    setBulkLoading(true);
    try {
      const result = await shopQueueService.query(
        "ready",
        { ...filters.ready, paperSize: size },
        1,
        25 - selected.length,
        {
          selectableOnly: true,
          excludeIds: selected.map((item) => item.orderId),
        },
      );
      setSelected((previous) => mergeMatchingSelection(previous, result.data));
      setNotice(
        "Matching selection refreshed. The batch limit and current paper size were preserved.",
      );
    } catch (failure) {
      setNotice(
        failure instanceof Error
          ? failure.message
          : "Selection failed. Try again.",
      );
    } finally {
      setBulkLoading(false);
    }
  };
  const downloadBatch = async (batch: AcceptedBatch) => {
    let unavailable = batch.downloadErrors?.length || 0;
    for (const file of batch.downloads || [])
      if (!(await downloadPinnedFile(file.url, file.fileName))) unavailable += 1;
    if (unavailable) {
      setDownloadRetry(batch.requestId);
      setNotice(`Batch accepted, but ${unavailable} manual file downloads are unavailable. Retry downloads without starting another production attempt.`);
    } else {
      setDownloadRetry(null);
      setNotice("Batch accepted. Check physical output in Pickup before confirming readiness.");
    }
  };
  const retryDownloads = async () => {
    if (!downloadRetry || downloadBusy) return;
    setDownloadBusy(true);
    try {
      const result = await batchReviewService.recover(downloadRetry);
      if (result.status === "ACCEPTED" || result.status === "COMPLETED")
        await downloadBatch(result.result as AcceptedBatch);
      else setNotice("The recorded downloads are not available yet. Try again.");
    } catch {
      setNotice("Downloads could not be refreshed. Retry downloads; do not start another production attempt.");
    } finally { setDownloadBusy(false); }
  };
  const accepted = async (batch: AcceptedBatch) => {
    setProgressLabels(
      Object.fromEntries(selected.map((item) => [item.orderId, item.label])),
    );
    setProgress(
      batch.attempts.map(
        (attempt) =>
          mergeAttempt(attempt, liveProgress.current[attempt.attemptId]) ||
          attempt,
      ),
    );
    setProgressOpen(true);
    setSelected([]);
    setBatchMode(null);
    setPending(null);
    void live.refresh();
    await downloadBatch(batch);
  };
  const refreshSelection = (orders: BatchReview["orders"]) => {
    const byId = new Map(orders.map((order) => [order.id, order]));
    setSelected((previous) =>
      previous.map((item) => ({
        ...item,
        fingerprint: byId.get(item.orderId)?.fingerprint || item.fingerprint,
        paperSize: byId.get(item.orderId)?.paper_size || item.paperSize,
      })),
    );
  };
  const offPage = selected.filter(
    (item) => !rows.some((row) => row.id === item.orderId),
  ).length;
  const hiddenByFilters = selected.filter(
    (item) => !matchingSelected.includes(item.orderId),
  ).length;
  const ready = status === "CONNECTED" && !updateRequired;

  return (
    <div
      className={`flex min-h-full min-w-0 flex-col bg-carbon-gray-10 ${layout.contained ? "xl:h-full xl:overflow-hidden" : ""}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-3">
        <h1 className="text-lg font-black">Live Queue</h1>
        <Link
          to="/shop-dashboard/archived"
          className="min-h-11 py-2 text-sm font-bold text-carbon-blue-70 underline"
        >
          Order History
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="Live queue sections"
        className="grid shrink-0 grid-cols-3 gap-1 border-b border-gray-300 p-1"
      >
        {SECTIONS.map((section) => (
          <button
            key={section}
            ref={(element) => {
              tabs.current[section] = element;
            }}
            id={`queue-tab-${section}`}
            role="tab"
            type="button"
            aria-selected={active === section}
            aria-controls={`queue-panel-${section}`}
            tabIndex={active === section ? 0 : -1}
            className={`${button} min-w-0 ${active === section ? "!bg-carbon-gray-100 text-white" : ""}`}
            onClick={() => setActive(section)}
            onKeyDown={(event) => {
              const index = SECTIONS.indexOf(section);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : null;
              if (next !== null) {
                event.preventDefault();
                setActive(SECTIONS[next]);
                tabs.current[SECTIONS[next]]?.focus();
              }
            }}
          >
            {LABELS[section]}{" "}
            <span className="tabular-nums">{counts?.[section] ?? "—"}</span>
          </button>
        ))}
      </div>
      <KanbanFilterBar
        key={active}
        queue={active}
        contextLabel={LABELS[active]}
        filters={currentFilters}
        searchQuery={currentFilters.searchQuery}
        onSearch={(value) => updateFilter(active, "searchQuery", value)}
        paperSizeFilter={currentFilters.paperSize}
        setPaperSizeFilter={(value) => updateFilter(active, "paperSize", value)}
        colorModeFilter={currentFilters.colorMode}
        setColorModeFilter={(value) => updateFilter(active, "colorMode", value)}
        onFilterChange={(field, value) => updateFilter(active, field, value)}
        onClear={() => {
          setFilters((previous) => ({
            ...previous,
            [active]: { ...initialFilters(), sort: previous[active].sort },
          }));
          setPages((previous) => ({ ...previous, [active]: 1 }));
        }}
      />
      <div className="shrink-0 space-y-2 border-b border-gray-300 bg-white p-3">
        <p className="text-xs">
          {live.data?.meta.totalItems ?? "—"} matching orders ·{" "}
          {selected.length}/25 selected
          {selected.length > 0 && (
            <>
              {" "}
              · {selected[0].paperSize} · {offPage} not on this page ·{" "}
              {hiddenByFilters} outside Print Ready filters
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {active === "ready" && (
            <button
              type="button"
              className={button}
              disabled={bulkLoading || selected.length >= 25}
              onClick={() => void bulk()}
            >
              {bulkLoading
                ? "Selecting…"
                : `Select up to 25 matching ${selected[0]?.paperSize || (filters.ready.paperSize === "ALL" ? "[choose paper size]" : filters.ready.paperSize)}`}
            </button>
          )}
          {selected.length > 0 && (
            <>
              <button
                type="button"
                className={button}
                onClick={() => setSelected([])}
              >
                Clear selection
              </button>
              <button
                type="button"
                className={button}
                onClick={() => setBatchMode("MANUAL")}
              >
                Review manual batch
              </button>
              <label className="text-sm font-bold">
                Printer
                <select
                  aria-label="Printer for selected orders"
                  value={printers.includes(printer) ? printer : ""}
                  onChange={(event) => setPrinter(event.target.value)}
                  className="ml-2 min-h-11 max-w-full border border-black bg-white p-2"
                >
                  <option value="">Choose a printer</option>
                  {printers.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`${button} !bg-carbon-blue-60 text-white`}
                disabled={!ready || !printers.includes(printer)}
                onClick={() => setBatchMode("AGENT")}
              >
                Review selected
              </button>
            </>
          )}
        </div>
        {!ready && (
          <p className="text-xs">
            {updateRequired
              ? "Agent update required."
              : `Agent ${status.toLowerCase()}.`}{" "}
            Manual production remains available through batch review.
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {downloadRetry && <button type="button" className={button} disabled={downloadBusy} onClick={() => void retryDownloads()}>
          {downloadBusy ? "Loading downloads..." : "Retry manual downloads"}
        </button>}
        {live.error != null && (
          <div role="alert" className="text-sm text-red-700">
            The queue could not be refreshed. Existing results may be stale.{" "}
            <button
              type="button"
              className={button}
              onClick={() => void live.refresh()}
            >
              Retry
            </button>
          </div>
        )}
      </div>
      <section
        id={`queue-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`queue-tab-${active}`}
        className={`flex flex-col p-3 ${layout.contained ? "xl:min-h-0 xl:flex-1" : ""}`}
      >
        <h2 id={`queue-${active}-heading`} className="sr-only">
          {LABELS[active]}
        </h2>
        {live.isLoading && (
          <span role="status" className="sr-only">
            Loading queue…
          </span>
        )}
        <div
          ref={gridRef}
          data-queue={active}
          id={`queue-${active}-orders`}
          className={`${queueGridClassName} ${layout.contained ? "xl:min-h-0 xl:flex-1 xl:overflow-hidden" : ""}`}
          style={
            layout.contained
              ? {
                  gridTemplateRows: `repeat(${layout.rows}, minmax(13rem, 1fr))`,
                }
              : undefined
          }
        >
          {rows.map((order) => {
            const badge = orderBadge(order);
            return (
              <OrderCard
                key={order.id}
                order={order}
                loadOrder={() => shopQueueService.details(order.id)}
                statusBadge={
                  badge
                    ? { text: badge.text, className: TONE_CLASSES[badge.tone] }
                    : null
                }
                isSelected={selected.some((item) => item.orderId === order.id)}
                onToggleSelect={
                  order.selectable ? () => toggle(order) : undefined
                }
                onReviewOrder={() => setReviewId(order.id)}
              />
            );
          })}
          {live.isLoading &&
            rows.length === 0 &&
            Array.from({ length: layout.pageSize }, (_, index) => (
              <QueueCardSkeleton key={index} />
            ))}
          {!live.isLoading && rows.length === 0 && (
            <p className="col-span-full p-6 text-center text-sm">
              No orders match this queue and its filters.
            </p>
          )}
        </div>
        <QueuePagination
          label={LABELS[active]}
          controlsId={`queue-${active}-orders`}
          page={live.data?.meta.currentPage || pages[active]}
          pageSize={sizes[active]}
          total={live.data?.meta.totalItems || 0}
          onPageChange={(page) =>
            setPages((previous) => ({ ...previous, [active]: page }))
          }
        />
      </section>
      {reviewId && (
        <OrderReviewDialog
          orderId={reviewId}
          onClose={() => setReviewId(null)}
          onUpdated={() => {
            void live.refresh();
            void validateSelection();
          }}
          onFulfillment={(mode, order) => {
            setReviewId(null);
            setFulfillment({ mode, order });
          }}
        />
      )}
      {batchMode && selected.length > 0 && (
        <BatchReviewDialog
          shopId={shopId}
          selection={selected}
          mode={batchMode}
          printerName={printer}
          printers={printers}
          onPrinterChange={setPrinter}
          onRemove={(id) => {
            setSelected((previous) =>
              previous.filter((item) => item.orderId !== id),
            );
            if (selected.length === 1) setBatchMode(null);
          }}
          onRefreshSelection={refreshSelection}
          onClose={() => {
            setBatchMode(null);
            // Dismissal is allowed only after any pending request is resolved.
            setPending(null);
          }}
          onAccepted={(batch) => void accepted(batch)}
          initialPending={pending}
        />
      )}
      {fulfillment && (
        <FulfillmentDialog
          mode={fulfillment.mode}
          order={fulfillment.order}
          attempt={fulfillment.order.current_attempt || null}
          title={getOrderCardTitleParts(fulfillment.order).filename}
          agentReady={ready}
          printers={printers}
          defaultPrinter={printer}
          onClose={() => setFulfillment(null)}
          onDone={(message) => {
            setFulfillment(null);
            setNotice(message);
            void live.refresh();
          }}
        />
      )}
      <PrintJobProgressModal
        isOpen={progressOpen}
        onClose={() => setProgressOpen(false)}
        jobs={progress}
        orderLabels={progressLabels}
      />
    </div>
  );
}
