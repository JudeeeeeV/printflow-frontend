import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from '@carbon/icons-react';
import { shopService } from '../../services/shopService';
import { DashboardSkeleton } from '../../components/dashboard/skeletons/DashboardSkeleton';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/dashboard/OrderCard';
import { PaymentReviewPanel } from '../../components/dashboard/PaymentReviewPanel';
import { ShopOrderActions } from '../../components/dashboard/ShopOrderActions';
import type { OrderDecisionResponse } from '../../services/orderService';
import { QueuePagination } from '../../components/dashboard/QueuePagination';
import { daemonSocketService } from '../../services/daemonSocketService';
import type { DaemonStatus } from '../../services/daemonSocketService';
import { PrintJobProgressModal } from '../../components/dashboard/PrintJobProgressModal';
import { KanbanFilterBar } from '../../components/dashboard/KanbanFilterBar';
import { AlertModal } from '../../components/common/AlertModal';
import { ApiError, apiClient, clearAuthTokens } from '../../services/apiClient';
import { createRefreshQueue } from '../../services/refreshQueue';
import { getQueuePage, queueGridClassName } from '../../components/dashboard/liveQueueLayout';
import { useLiveQueueLayout } from '../../components/dashboard/useLiveQueueLayout';
import { useDataEvents } from '../../hooks/useDataEvents';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { FulfillmentDialog, type FulfillmentMode } from '../../components/dashboard/FulfillmentDialog';
import { FulfillmentFooter } from '../../components/dashboard/FulfillmentFooter';
import { getOrderCardTitleParts } from '../../components/dashboard/orderCardTitle';
import {
 availableActions,
 canSelectForPrint,
 mergeAttempt,
 orderBadge,
 queueFor,
 TONE_CLASSES,
 upsertProgress,
 type AttemptProgress,
 type PrintableOrder,
 type QueueKey,
} from '../../components/dashboard/printFulfillment';
import { downloadPinnedFile, newRequestId, printFulfillmentService } from '../../services/printFulfillmentService';

type QueueFilterState = {
 searchQuery: string;
 paperSize: string;
 colorMode: string;
};

const QUEUE_ORDER: QueueKey[] = ['new', 'ready', 'pickup', 'completed'];
const QUEUE_LABELS: Record<QueueKey, string> = { new: 'New Orders', ready: 'Print Ready', pickup: 'Pickup', completed: 'Completed' };
const QUEUE_EMPTY_LABELS: Record<QueueKey, string> = {
 new: 'No new orders.',
 ready: 'No orders in production.',
 pickup: 'No orders waiting for an output check or pickup.',
 completed: 'No handed-over orders.',
};
const INITIAL_QUEUE_FILTERS: Record<QueueKey, QueueFilterState> = {
 new: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
 ready: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
 pickup: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
 completed: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
};
const orderLabel = (order: Parameters<typeof getOrderCardTitleParts>[0]) => {
 const title = getOrderCardTitleParts(order);
 return `${title.filename} · ${title.customer}`;
};

export const ShopDashboard: React.FC = () => {
 const navigate = useNavigate();
 const [shopData, setShopData] = useState<any>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [permitFile, setPermitFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadError, setUploadError] = useState<string | null>(null);

 const [qrFile, setQrFile] = useState<File | null>(null);

 const [shopOrders, setShopOrders] = useState<any[]>([]);
 const refreshOrders = useMemo(() => createRefreshQueue(
 () => orderService.getShopOrders(), orders => setShopOrders(orders),
 ), []);
 const refreshOrdersAfterChange = useCallback(() => {
 void refreshOrders().catch(console.error);
 }, [refreshOrders]);
 const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState<string | null>(null);
 const selectedPaymentOrder = shopOrders.find(order => order.id === selectedPaymentOrderId) ?? null;
 const setSelectedPaymentOrder = (orderId: string | null) => setSelectedPaymentOrderId(orderId);
 const [isVerifying, setIsVerifying] = useState(false);

 // Batch processing state
 const [selectedReadyOrders, setSelectedReadyOrders] = useState<string[]>([]);
 const [isBatchProcessing, setIsBatchProcessing] = useState(false);
 
 // Daemon state
 const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>('OFFLINE');
 const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
 const [jobProgresses, setJobProgresses] = useState<AttemptProgress[]>([]);
 const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
 const [selectedPrinter, setSelectedPrinter] = useState<string>('');

 const [activeQueue, setActiveQueue] = useState<QueueKey>('new');
 const [tabDirection, setTabDirection] = useState(1);
 const [queueFilters, setQueueFilters] = useState<Record<QueueKey, QueueFilterState>>(INITIAL_QUEUE_FILTERS);
 const [queuePages, setQueuePages] = useState<Record<QueueKey, number>>({ new: 1, ready: 1, pickup: 1, completed: 1 });
 const { layout: queueLayout, gridRef } = useLiveQueueLayout();
 const [queuePageSizes, setQueuePageSizes] = useState<Record<QueueKey, number>>(() => ({ new: queueLayout.pageSize, ready: queueLayout.pageSize, pickup: queueLayout.pageSize, completed: queueLayout.pageSize }));
 const [pageAnnouncement, setPageAnnouncement] = useState('');
 const [agentUpdateRequired, setAgentUpdateRequired] = useState(false);
 // Socket updates supplement the persisted attempts loaded with the orders.
 const [liveAttempts, setLiveAttempts] = useState<Record<string, AttemptProgress>>({});
 const [pendingBatch, setPendingBatch] = useState<'AGENT' | 'MANUAL' | null>(null);
 const [fulfillment, setFulfillment] = useState<{ mode: FulfillmentMode; order: PrintableOrder } | null>(null);
 // Reused only to retry the same reviewed request after a network failure.
 const batchRequestRef = useRef<{ key: string; requestId: string } | null>(null);
 const queueBoardRef = useRef<HTMLDivElement>(null);
 const queueTabRefs = useRef<Record<QueueKey, HTMLButtonElement | null>>({ new: null, ready: null, pickup: null, completed: null });
 const prefersReducedMotion = useReducedMotion();

 const ordersWithAttempts = useMemo(
 () => shopOrders.map(order => ({ ...order, current_attempt: mergeAttempt(order.current_attempt, liveAttempts[order.id]) })),
 [shopOrders, liveAttempts],
 );
 const orderLabels = useMemo(
 () => Object.fromEntries(shopOrders.map(order => [order.id, orderLabel(order)])),
 [shopOrders],
 );
 const agentReady = daemonStatus === 'CONNECTED' && !agentUpdateRequired && availablePrinters.length > 0;

 // Prune only orders that can no longer start a batch, not selections hidden by filters or pagination.
 const readyOrderIds = new Set(ordersWithAttempts.filter(order => canSelectForPrint(order)).map(order => order.id));
 const validSelectedReadyOrders = selectedReadyOrders.filter(id => readyOrderIds.has(id));
 if (validSelectedReadyOrders.length !== selectedReadyOrders.length) {
 setSelectedReadyOrders(validSelectedReadyOrders);
 }

 const [alertState, setAlertState] = useState<{isOpen: boolean; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'}>({ isOpen: false, message: '' });
 const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', title?: string) => {
 setAlertState({ isOpen: true, message, type, title });
 };

 const updateQueueFilter = useCallback((queue: QueueKey, field: keyof QueueFilterState, value: string) => {
 setQueueFilters(previous => ({
 ...previous,
 [queue]: { ...previous[queue], [field]: value },
 }));
 setQueuePages(previous => ({ ...previous, [queue]: 1 }));
 }, []);

 const handleActiveSearch = useCallback((query: string) => {
 updateQueueFilter(activeQueue, 'searchQuery', query);
 }, [activeQueue, updateQueueFilter]);

 const handleQueueTabChange = (queue: QueueKey) => {
 if (queue === activeQueue) return;
 const currentIndex = QUEUE_ORDER.indexOf(activeQueue);
 const nextIndex = QUEUE_ORDER.indexOf(queue);
 setTabDirection(nextIndex > currentIndex ? 1 : -1);
 setActiveQueue(queue);
 setPageAnnouncement(`${QUEUE_LABELS[queue]} queue selected.`);
 };

 const handleQueueTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, queue: QueueKey) => {
 const currentIndex = QUEUE_ORDER.indexOf(queue);
 let nextIndex: number | null = null;
 if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % QUEUE_ORDER.length;
 if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + QUEUE_ORDER.length) % QUEUE_ORDER.length;
 if (event.key === 'Home') nextIndex = 0;
 if (event.key === 'End') nextIndex = QUEUE_ORDER.length - 1;
 if (nextIndex === null) return;
 event.preventDefault();
 const nextQueue = QUEUE_ORDER[nextIndex];
 handleQueueTabChange(nextQueue);
 requestAnimationFrame(() => queueTabRefs.current[nextQueue]?.focus());
 };

 const loadShopData = () => {
 setError(null);
 shopService.getMyShop()
 .then(data => {
 setShopData(data);
 if (data.verification_status === 'VERIFIED' || data.verification_status === 'OPEN') {
 return refreshOrders(false);
 }
 setShopOrders([]);
 })
 .then(() => {
 setIsLoading(false);
 })
 .catch(err => {
 setError(err.message || 'Failed to fetch shop data');
 setIsLoading(false);
 });
 };

 useEffect(() => {
 loadShopData();
 }, []);

 useDataEvents(['shops'], loadShopData);
 useDataEvents(['orders', 'receipts', 'assets', 'print-jobs'], refreshOrdersAfterChange);

 useEffect(() => {
 if (shopData?.verification_status === 'VERIFIED' || shopData?.verification_status === 'OPEN') {
 const refreshVisible = () => {
 if (document.visibilityState === 'visible') void refreshOrders(false).catch(console.error);
 };
 const timer = setInterval(refreshVisible, 10000);
 document.addEventListener('visibilitychange', refreshVisible);
 window.addEventListener('profile-updated', refreshOrdersAfterChange);
 return () => {
 clearInterval(timer);
 document.removeEventListener('visibilitychange', refreshVisible);
 window.removeEventListener('profile-updated', refreshOrdersAfterChange);
 };
 }
 }, [shopData?.verification_status, refreshOrders, refreshOrdersAfterChange]);

 useEffect(() => {
 if (shopData?.id) {
 const unsubscribeStatus = daemonSocketService.onStatusChange((status) => {
 setDaemonStatus(status);
 });

 const unsubscribeUpdate = daemonSocketService.onUpdateRequired(setAgentUpdateRequired);

 const unsubscribeProgress = daemonSocketService.onJobProgress(progress => {
 setLiveAttempts(previous => ({
 ...previous,
 [progress.orderId]: mergeAttempt(previous[progress.orderId], progress) ?? progress,
 }));
 setJobProgresses(previous =>
 previous.some(item => item.orderId === progress.orderId || item.attemptId === progress.attemptId)
 ? upsertProgress(previous, progress)
 : previous,
 );
 // Terminal reports change queues; reload the persisted state.
 if (['SUBMITTED', 'FAILED_PRE_SUBMISSION', 'OUTCOME_UNKNOWN', 'MANUAL_STARTED'].includes(progress.status)) {
 refreshOrdersAfterChange();
 }
 });

 const unsubscribePrinters = daemonSocketService.onPrintersList((printers) => {
 setAvailablePrinters(printers);
 setSelectedPrinter(current => printers.includes(current) ? current : (printers[0] || ''));
 });

 // connection managed by ShopLayout

 return () => {
 unsubscribeStatus();
 unsubscribeUpdate();
 unsubscribeProgress();
 unsubscribePrinters();
 // disconnection managed by ShopLayout
 };
 }
 }, [shopData?.id, refreshOrdersAfterChange]);

 const handleLogout = async () => {
 await apiClient('/auth/logout', { method: 'POST' }).catch(() => undefined);
 clearAuthTokens();
 localStorage.removeItem('user_role');
 navigate('/auth');
 };

 const handleUploadPermit = async () => {
 if (!permitFile || !qrFile) return;
 setIsUploading(true);
 setUploadError(null);
 try {
 await shopService.uploadGcashQr(qrFile);
 await shopService.verifyPermit(permitFile);
 loadShopData();
 } catch (err: any) {
 setUploadError(err.message || 'Failed to submit verification documents.');
 } finally {
 setIsUploading(false);
 }
 };

 const handleOrderUpdated = (order: OrderDecisionResponse['order']) => {
  setShopOrders(previous => previous.map(existing => existing.id === order.id ? { ...existing, ...order } : existing));
  refreshOrdersAfterChange();
 };
 const handleVerifyPayment = async (orderId: string, action: 'APPROVE' | 'REJECT', reason: string | undefined, receiptId: string, confirmed: boolean) => {
  setIsVerifying(true);
  try {
   const response = await orderService.verifyPayment(orderId, action, reason, receiptId, confirmed);
   handleOrderUpdated(response.order);
   setSelectedPaymentOrder(null);
  } finally { setIsVerifying(false); }
 };


 const handleToggleReadySelection = (orderId: string) => {
 setSelectedReadyOrders(prev => 
 prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
 );
 };

 const handleSelectAllReady = () => {
 if (allMatchingReadySelected) {
 setSelectedReadyOrders([]);
 } else {
 setSelectedReadyOrders(printReadyOrders.filter(o => canSelectForPrint(o)).map(o => o.id));
 }
 };

 /** One request ID per reviewed selection; reused only after a network failure. */
 const requestIdFor = (mode: 'AGENT' | 'MANUAL', orderIds: string[]) => {
 const key = JSON.stringify([mode, [...orderIds].sort(), mode === 'AGENT' ? selectedPrinter : null]);
 if (batchRequestRef.current?.key !== key) batchRequestRef.current = { key, requestId: newRequestId() };
 return batchRequestRef.current.requestId;
 };
 const settleRequest = (error?: unknown) => {
 // A server response (success or recorded failure) ends this request.
 if (!(error instanceof ApiError && error.status === 0)) batchRequestRef.current = null;
 };

 const startManualProduction = async () => {
 const orderIds = [...selectedReadyOrders];
 setPendingBatch(null);
 setIsBatchProcessing(true);
 try {
 const result = await printFulfillmentService.startManualProduction(orderIds, requestIdFor('MANUAL', orderIds));
 settleRequest();
 for (const download of result.downloads) await downloadPinnedFile(download.url, download.fileName);
 setSelectedReadyOrders([]);
 const skipped = result.skipped.length ? ` ${result.skipped.length} order(s) were skipped because they already have an unresolved attempt or are not printable.` : '';
 showAlert(`Manual production recorded for ${result.attempts.length} order(s). Print the downloaded files, then check each output in Pickup before marking it ready.${skipped}`, 'success', 'Manual Production Recorded');
 refreshOrdersAfterChange();
 } catch (err: unknown) {
 settleRequest(err);
 showAlert(err instanceof Error ? err.message : 'Manual production could not be recorded.', 'error', 'Manual Production Failed');
 } finally {
 setIsBatchProcessing(false);
 }
 };

 const sendToAgent = async () => {
 const orderIds = [...selectedReadyOrders];
 setPendingBatch(null);
 if (!agentReady || !availablePrinters.includes(selectedPrinter)) {
 showAlert('Wait for an up-to-date PrintFlow Agent to connect and select a detected printer before sending orders.', 'error', 'Printer Not Ready');
 return;
 }
 setIsBatchProcessing(true);
 try {
 const result = await printFulfillmentService.sendBatch(orderIds, selectedPrinter, requestIdFor('AGENT', orderIds));
 settleRequest();
 setJobProgresses(result.attempts);
 setIsProgressModalOpen(true);
 setSelectedReadyOrders([]);
 refreshOrdersAfterChange();
 } catch (err: unknown) {
 settleRequest(err);
 showAlert(err instanceof Error ? err.message : 'Failed to dispatch batch', 'error', 'Batch Failed');
 refreshOrdersAfterChange();
 } finally {
 setIsBatchProcessing(false);
 }
 };

 const openFulfillment = (mode: FulfillmentMode, order: PrintableOrder) => setFulfillment({ mode, order });
 const finishFulfillment = (message: string) => {
 setFulfillment(null);
 showAlert(message, 'success', 'Recorded');
 refreshOrdersAfterChange();
 };

 if (isLoading) return <DashboardSkeleton layout={queueLayout} gridRef={gridRef} />;
 if (error) return (
 <div className="flex min-h-full items-center justify-center bg-carbon-gray-10 p-4 font-sans sm:p-8">
 <div className="w-full max-w-lg border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-6 shadow-[0_12px_32px_rgba(22,22,22,0.08)] sm:p-8">
 <div className="mb-3 text-2xl font-black tracking-tight text-carbon-gray-100">Error</div>
 <p className="mb-6 leading-relaxed text-gray-700">{error}</p>
 <button onClick={handleLogout} className="min-h-11 bg-carbon-blue-60 px-6 py-2 font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">Logout</button>
 </div>
 </div>
 );

 const { verification_status } = shopData;

 // Derived queue data. Counts stay unfiltered while each queue owns its filter state.
 const unfilteredNewOrders = ordersWithAttempts
 .filter(o => queueFor(o) === 'new')
 .sort((a, b) => {
 if (a.state === 'AWAITING_PAYMENT_VERIFICATION' && b.state !== 'AWAITING_PAYMENT_VERIFICATION') return -1;
 if (b.state === 'AWAITING_PAYMENT_VERIFICATION' && a.state !== 'AWAITING_PAYMENT_VERIFICATION') return 1;
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });

 // Queued, processing, failed and uncertain work stays in Print Ready.
 const unfilteredPrintReadyOrders = ordersWithAttempts
 .filter(o => queueFor(o) === 'ready')
 .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

 // Submission-reported, manual and ready work waits for checks and handover.
 const unfilteredPickupOrders = ordersWithAttempts
 .filter(o => queueFor(o) === 'pickup')
 .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

 const unfilteredCompletedOrders = ordersWithAttempts
 .filter(o => queueFor(o) === 'completed')
 .sort((a, b) => new Date(b.handed_over_at || b.created_at).getTime() - new Date(a.handed_over_at || a.created_at).getTime());

 const unfilteredQueueOrders: Record<QueueKey, typeof shopOrders> = {
 new: unfilteredNewOrders,
 ready: unfilteredPrintReadyOrders,
 pickup: unfilteredPickupOrders,
 completed: unfilteredCompletedOrders,
 };
 const filterOrders = (orders: typeof shopOrders, filters: QueueFilterState) => {
 const searchLower = filters.searchQuery.trim().toLowerCase();
 return orders.filter(order => {
 const matchSearch = !searchLower
 || order.id.slice(0, 8).toLowerCase().includes(searchLower)
 || (order.client_name || '').toLowerCase().includes(searchLower);
 const matchPaper = filters.paperSize === 'ALL' || order.paper_size === filters.paperSize;
 const matchColor = filters.colorMode === 'ALL' || order.print_color_mode === filters.colorMode;
 return matchSearch && matchPaper && matchColor;
 });
 };
 const filteredQueueOrders: Record<QueueKey, typeof shopOrders> = {
 new: filterOrders(unfilteredNewOrders, queueFilters.new),
 ready: filterOrders(unfilteredPrintReadyOrders, queueFilters.ready),
 pickup: filterOrders(unfilteredPickupOrders, queueFilters.pickup),
 completed: filterOrders(unfilteredCompletedOrders, queueFilters.completed),
 };
 const printReadyOrders = filteredQueueOrders.ready;

 const pageSizes = queueLayout.queueKey === activeQueue ? { ...queuePageSizes, [activeQueue]: queueLayout.pageSize } : queuePageSizes;
 const pageTotals = Object.fromEntries(QUEUE_ORDER.map(queue => [
 queue, Math.max(1, Math.ceil(filteredQueueOrders[queue].length / pageSizes[queue])),
 ])) as Record<QueueKey, number>;
 const anchoredPages = { ...queuePages };
 if (queuePageSizes[activeQueue] !== pageSizes[activeQueue]) {
 anchoredPages[activeQueue] = getQueuePage(queuePages[activeQueue], queuePageSizes[activeQueue], pageSizes[activeQueue], filteredQueueOrders[activeQueue].length);
 setQueuePageSizes(pageSizes);
 }

 const pages = Object.fromEntries(QUEUE_ORDER.map(queue => [
 queue, Math.min(anchoredPages[queue], pageTotals[queue]),
 ])) as Record<QueueKey, number>;
 // Store poll-driven clamps so a later refresh cannot restore an obsolete page.
 if (QUEUE_ORDER.some(queue => pages[queue] !== queuePages[queue])) {
 setQueuePages(pages);
 }
 const visibleQueueOrders = Object.fromEntries(QUEUE_ORDER.map(queue => [
 queue, filteredQueueOrders[queue].slice((pages[queue] - 1) * pageSizes[queue], pages[queue] * pageSizes[queue]),
 ])) as Record<QueueKey, typeof shopOrders>;
 const visibleReadyOrders = visibleQueueOrders.ready;
 const activeFilters = queueFilters[activeQueue];
 const activeOrders = filteredQueueOrders[activeQueue];
 const activeVisibleOrders = visibleQueueOrders[activeQueue];
 const activeEmptyMessage = unfilteredQueueOrders[activeQueue].length > 0
 ? 'No orders match your filters.'
 : QUEUE_EMPTY_LABELS[activeQueue];
 const selectedReadyIds = new Set(selectedReadyOrders);
 const selectableReadyOrders = printReadyOrders.filter(order => canSelectForPrint(order));
 const matchingSelectedCount = selectableReadyOrders.filter(order => selectedReadyIds.has(order.id)).length;
 const allMatchingReadySelected = selectableReadyOrders.length > 0 && matchingSelectedCount === selectableReadyOrders.length;
 const someMatchingReadySelected = matchingSelectedCount > 0 && !allMatchingReadySelected;
 const offPageSelectedCount = selectedReadyOrders.length - visibleReadyOrders.filter(order => selectedReadyIds.has(order.id)).length;

 const handleQueuePageChange = (queue: QueueKey, requestedPage: number) => {
 const page = Math.max(1, Math.min(requestedPage, pageTotals[queue]));
 setQueuePages(previous => ({ ...previous, [queue]: page }));
 setPageAnnouncement(`${QUEUE_LABELS[queue]}, page ${page} of ${pageTotals[queue]}.`);
 requestAnimationFrame(() => {
 const heading = queueBoardRef.current?.querySelector<HTMLElement>(`#queue-${queue}-heading`);
 if (!heading) return;
 heading.focus({ preventScroll: true });
 if (!queueLayout.contained) {
 const scroller = heading.closest<HTMLElement>('[data-shop-scroll]');
 if (!scroller) return;
 const headingBounds = heading.getBoundingClientRect();
 const scrollBounds = scroller.getBoundingClientRect();
 if (headingBounds.top < scrollBounds.top || headingBounds.bottom > scrollBounds.bottom) {
 scroller.scrollTo({ top: scroller.scrollTop + headingBounds.top - scrollBounds.top - 12, behavior: 'instant' });
 }
 }
 });
 };

 const isVerified = verification_status === 'VERIFIED' || verification_status === 'OPEN';
 return (
 <div className={`flex min-h-full min-w-0 flex-col bg-carbon-gray-10 font-sans ${isVerified ? queueLayout.contained ? 'xl:h-full xl:min-h-0 xl:overflow-hidden' : '' : 'lg:h-full lg:min-h-0 lg:overflow-hidden'}`}>
 <div className={`flex flex-none flex-col ${isVerified ? queueLayout.contained ? 'xl:min-h-0 xl:flex-1 xl:overflow-hidden' : '' : 'lg:min-h-0 lg:flex-1 lg:overflow-hidden'}`}>
 {verification_status === 'PENDING_REVIEW' ? (
 <div className="p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-8">
 <div className="relative mx-auto mt-4 flex w-full max-w-2xl flex-col items-center justify-center overflow-hidden border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white px-6 py-12 text-center shadow-[0_12px_32px_rgba(22,22,22,0.08)] sm:mt-8 sm:px-10 sm:py-16">
 <span className="absolute left-0 top-0 h-24 w-24 border-b border-r border-gray-200" aria-hidden="true" />
 <div className="relative mb-6 flex h-20 w-20 items-center justify-center border border-carbon-blue-60 bg-blue-50">
 <svg className="h-10 w-10 text-carbon-blue-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
 </div>
 <h2 className="mb-3 text-2xl font-black tracking-tight text-carbon-gray-100 sm:text-3xl">Verification Under Review</h2>
 <p className="max-w-md text-base leading-relaxed text-gray-600">
 We have received your business permit and GCash QR code. Your shop verification is currently under review. Please check back later.
 </p>
 </div>
 </div>
 ) : verification_status !== 'VERIFIED' && verification_status !== 'OPEN' ? (
 // Unverified State
 <div className="p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-8">
 <div className="mx-auto mt-4 flex w-full max-w-3xl flex-col items-center justify-center border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-6 shadow-[0_12px_32px_rgba(22,22,22,0.08)] sm:mt-8 sm:p-8 lg:p-10">
 <div className="mb-5 flex h-16 w-16 items-center justify-center bg-carbon-gray-100 text-white">
 <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
 </div>
 <h2 className="mb-3 text-center text-2xl font-black tracking-tight text-carbon-gray-100 sm:text-3xl">Shop Verification Required</h2>
 <p className="mb-8 max-w-lg text-center leading-relaxed text-gray-600">
 Your shop is currently unverified. Please submit your official business permit and GCash QR code.
 </p>
 <div className="mb-2 flex w-full flex-col gap-4 border border-gray-300 bg-carbon-gray-10 p-4 sm:p-6">
 <div className="border-l-4 border-carbon-blue-60 bg-white p-4">
 <label className="mb-3 block text-sm font-bold text-carbon-gray-100">Upload Business Permit (Image/PDF)</label>
 <input
 type="file" accept="image/*,application/pdf"
 className="min-h-11 w-full cursor-pointer border border-gray-300 bg-carbon-gray-10 text-sm text-gray-600 file:mr-4 file:min-h-11 file:border-0 file:bg-carbon-blue-60 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50"
 onChange={(e) => setPermitFile(e.target.files?.[0] || null)}
 disabled={isUploading}
 />
 </div>
 <div className="border-l-4 border-carbon-gray-100 bg-white p-4">
 <label className="mb-3 block text-sm font-bold text-carbon-gray-100">Upload GCash QR Code (Image)</label>
 <input
 type="file" accept="image/*"
 className="min-h-11 w-full cursor-pointer border border-gray-300 bg-carbon-gray-10 text-sm text-gray-600 file:mr-4 file:min-h-11 file:border-0 file:bg-carbon-gray-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50"
 onChange={(e) => setQrFile(e.target.files?.[0] || null)}
 disabled={isUploading}
 />
 </div>
 {uploadError && <p className="border-l-4 border-carbon-gray-100 bg-white px-4 py-3 text-sm font-bold text-carbon-gray-100" role="alert">{uploadError}</p>}
 <button onClick={handleUploadPermit} disabled={!permitFile || !qrFile || isUploading} className={`mt-2 min-h-12 w-full px-5 py-3 font-bold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 ${!permitFile || !qrFile || isUploading ? 'cursor-not-allowed bg-gray-400' : 'bg-carbon-blue-60 hover:bg-carbon-blue-70'}`}>
 {isUploading ? 'Uploading & Analyzing...' : 'Submit for Verification'}
 </button>
 </div>
 </div>
 </div>
 ) : (
 // Kanban Board Layout
 <div className={`flex flex-none flex-col bg-carbon-gray-10 ${queueLayout.contained ? 'xl:min-h-0 xl:flex-1 xl:overflow-hidden' : ''}`}>
 <div role="tablist" aria-label="Live queue sections" aria-orientation="horizontal" className="grid shrink-0 grid-cols-2 gap-1 border-b sm:grid-cols-4 border-gray-300 bg-carbon-gray-10 p-1 sm:gap-2 sm:px-2">
 {QUEUE_ORDER.map(queue => {
 const isActive = activeQueue === queue;
 return (
 <button
 key={queue}
 ref={element => { queueTabRefs.current[queue] = element; }}
 id={`queue-tab-${queue}`}
 type="button"
 role="tab"
 aria-selected={isActive}
 aria-controls={`queue-panel-${queue}`}
 tabIndex={isActive ? 0 : -1}
 onClick={() => handleQueueTabChange(queue)}
 onKeyDown={event => handleQueueTabKeyDown(event, queue)}
 className={`group flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 border border-black px-2 text-xs font-black shadow-[0_2px_0_rgba(22,22,22,0.16)] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px active:shadow-none sm:gap-2 sm:px-4 sm:text-sm lg:min-h-9 ${isActive ? 'bg-[#0F62FE] text-white shadow-[0_2px_0_#0043CE] hover:bg-carbon-blue-70' : 'bg-white text-carbon-gray-100 hover:border-carbon-blue-60 hover:bg-blue-50 hover:text-carbon-blue-70 hover:shadow-[0_2px_0_#0F62FE]'} focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transform-none motion-reduce:transition-none`}
 >
 <span className="truncate">{QUEUE_LABELS[queue]}</span>
 <span className="min-w-7 shrink-0 border border-black bg-black px-2 py-0.5 text-center text-xs font-black tabular-nums text-white">
 {unfilteredQueueOrders[queue].length}
 </span>
 <ChevronRight aria-hidden="true" className={`hidden h-4 w-4 shrink-0 transition-transform duration-150 sm:block ${isActive ? 'rotate-90 text-white' : 'text-gray-500 group-hover:translate-x-0.5 group-hover:text-carbon-blue-70'} motion-reduce:transform-none motion-reduce:transition-none`} />
 </button>
 );
 })}
 </div>

 <KanbanFilterBar
 key={activeQueue}
 contextLabel={QUEUE_LABELS[activeQueue]}
 searchQuery={activeFilters.searchQuery}
 onSearch={handleActiveSearch}
 paperSizeFilter={activeFilters.paperSize}
 setPaperSizeFilter={size => updateQueueFilter(activeQueue, 'paperSize', size)}
 colorModeFilter={activeFilters.colorMode}
 setColorModeFilter={mode => updateQueueFilter(activeQueue, 'colorMode', mode)}
 />

 <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{pageAnnouncement}</p>
 <div ref={queueBoardRef} data-live-queue className={`flex flex-none flex-col overflow-hidden p-3 ${queueLayout.contained ? 'xl:min-h-0 xl:flex-1' : ''}`}>
 <motion.section
 key={activeQueue}
 id={`queue-panel-${activeQueue}`}
 role="tabpanel"
 aria-labelledby={`queue-tab-${activeQueue}`}
 className={`flex w-full min-w-0 flex-col overflow-hidden border border-black bg-gray-100 shadow-[0_8px_20px_rgba(22,22,22,0.08)] ${queueLayout.contained ? 'xl:min-h-0 xl:flex-1' : ''}`}
 initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: tabDirection * 32 }}
 animate={{ opacity: 1, x: 0 }}
 exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: tabDirection * -24 }}
 transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
 >
 <h2 id={`queue-${activeQueue}-heading`} tabIndex={-1} className="sr-only">{QUEUE_LABELS[activeQueue]}</h2>

 {activeQueue === 'ready' && (printReadyOrders.length > 0 || selectedReadyOrders.length > 0) && (
 <div className="z-10 flex shrink-0 flex-col gap-3 border-b border-gray-300 bg-white p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
 <label className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-carbon-gray-100">
 <input
 type="checkbox"
 className="mr-3 h-5 w-5 cursor-pointer border-gray-500 text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
 checked={allMatchingReadySelected}
 disabled={selectableReadyOrders.length === 0}
 ref={element => { if (element) element.indeterminate = someMatchingReadySelected; }}
 aria-describedby="ready-selection-scope"
 onChange={handleSelectAllReady}
 />
 <span>Select all matching<span id="ready-selection-scope" className="block text-xs font-normal text-gray-600">Across all pages; orders with an unresolved attempt are excluded</span></span>
 </label>
 <span className="bg-carbon-gray-10 px-2.5 py-1 text-xs font-bold tabular-nums text-gray-600">
 {selectedReadyOrders.length} selected
 {offPageSelectedCount > 0 && <span className="block font-normal">{offPageSelectedCount} not on this page</span>}
 </span>
 {selectedReadyOrders.length > 0 && (
 <button type="button" onClick={() => setSelectedReadyOrders([])} className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-carbon-blue-70 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">Clear selection</button>
 )}
 </div>

 {daemonStatus === 'CONNECTED' && agentUpdateRequired ? (
 <div className="flex min-w-0 flex-col gap-2 border border-black bg-carbon-gray-10 p-2 sm:flex-row sm:items-center lg:w-full lg:max-w-2xl">
 <span role="status" className="flex min-h-10 flex-1 flex-col justify-center text-xs text-carbon-gray-100">
 <span className="font-bold uppercase tracking-[0.08em]">Agent update required</span>
 <span>This PrintFlow Agent cannot report print attempts. <Link to="/shop-dashboard/printer-agent" className="font-bold text-carbon-blue-70 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Install the latest agent</Link> or use manual production.</span>
 </span>
 <button
 onClick={() => setPendingBatch('MANUAL')}
 disabled={selectedReadyOrders.length === 0 || isBatchProcessing}
 className="min-h-11 shrink-0 border border-black bg-white px-3 py-2 text-xs font-bold text-carbon-gray-100 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10 motion-reduce:transition-none"
 >
 Print Manually
 </button>
 </div>
 ) : daemonStatus === 'CONNECTED' ? (
 <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-full lg:max-w-2xl lg:justify-end">
 {availablePrinters.length > 0 ? (
 <select
 aria-label="Printer for selected orders"
 className="block min-h-11 w-full min-w-0 cursor-pointer border border-black bg-carbon-gray-10 px-3 py-2 text-sm font-semibold text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 sm:flex-1 lg:min-h-10"
 value={selectedPrinter}
 onChange={(e) => setSelectedPrinter(e.target.value)}
 >
 {availablePrinters.map(printer => (
 <option key={printer} value={printer}>{printer}</option>
 ))}
 </select>
 ) : (
 <span role="status" className="min-h-11 flex-1 border-l-4 border-gray-300 bg-carbon-gray-10 px-3 py-2 text-xs font-medium text-gray-600">Agent online. No printers detected yet; checking automatically.</span>
 )}
 <button
 onClick={() => setPendingBatch('AGENT')}
 disabled={selectedReadyOrders.length === 0 || isBatchProcessing || !availablePrinters.includes(selectedPrinter)}
 className="flex min-h-11 shrink-0 items-center justify-center gap-2 bg-carbon-blue-60 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:pointer-events-none disabled:opacity-50 lg:min-h-10 motion-reduce:transition-none"
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
 </svg>
 Send to Daemon
 </button>
 </div>
 ) : (
 <div className="flex min-w-0 flex-col gap-2 border border-black bg-carbon-gray-10 p-2 sm:flex-row sm:items-center lg:w-full lg:max-w-xl">
 <span role="status" className="flex min-h-10 flex-1 items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-carbon-gray-100">
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 {daemonStatus === 'RECONNECTING' ? 'Checking agent connection…' : 'Daemon offline — checking automatically'}
 </span>
 <button
 onClick={() => setPendingBatch('MANUAL')}
 disabled={selectedReadyOrders.length === 0 || isBatchProcessing}
 className="min-h-11 shrink-0 border border-black bg-white px-3 py-2 text-xs font-bold text-carbon-gray-100 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10 motion-reduce:transition-none"
 >
 Print Manually
 </button>
 </div>
 )}
 </div>
 )}

 <div ref={gridRef} data-queue={activeQueue} id={`queue-${activeQueue}-orders`} aria-labelledby={`queue-${activeQueue}-heading`} className={`${queueGridClassName} ${queueLayout.contained ? 'xl:min-h-0 xl:flex-1 xl:overflow-hidden' : ''}`} style={queueLayout.contained ? { gridTemplateRows: queueLayout.rows === 1 ? '16rem' : 'repeat(2, minmax(16rem, 1fr))' } : undefined}>
 {activeVisibleOrders.map(order => {
 if (activeQueue === 'new') return null;
 const attempt = order.current_attempt ?? null;
 const badge = orderBadge(order);
 const statusBadge = badge ? { text: badge.text, className: TONE_CLASSES[badge.tone] } : null;
 const footer = (
  <>
   <FulfillmentFooter
    order={order} attempt={attempt}
    actions={availableActions(order)}
    showMilestones={activeQueue !== 'ready'}
    orderLabel={orderLabels[order.id]}
    onAction={action => openFulfillment(action, order)}
   />
   <ShopOrderActions order={order} onUpdated={handleOrderUpdated} />
  </>
 );
  return activeQueue === 'ready' && canSelectForPrint(order) ? (
 <OrderCard
 key={order.id}
 order={order}
 statusBadge={statusBadge}
 onClick={() => handleToggleReadySelection(order.id)}
 isSelected={selectedReadyOrders.includes(order.id)}
 onToggleSelect={handleToggleReadySelection}
 />
 ) : (
 <OrderCard key={order.id} order={order} statusBadge={statusBadge} footer={footer} onReviewPayment={order.payment_status === 'PENDING_VERIFICATION' ? () => setSelectedPaymentOrder(order.id) : undefined} />
 );
 })}
 {activeQueue === 'new' && activeVisibleOrders.map(order => (
 <OrderCard
 key={order.id}
 order={order}
 onReviewPayment={order.payment_status === 'PENDING_VERIFICATION' ? () => setSelectedPaymentOrder(order.id) : undefined}
 footer={<ShopOrderActions order={order} onUpdated={handleOrderUpdated} />}
 />
 ))}
 {activeOrders.length === 0 && (
 <div className="col-span-full row-span-full flex min-h-48 items-center justify-center border border-dashed border-black bg-white px-6 text-center">
 <p className="text-sm font-medium leading-relaxed text-gray-600">{activeEmptyMessage}</p>
 </div>
 )}
 </div>

 <QueuePagination
 label={QUEUE_LABELS[activeQueue]}
 controlsId={`queue-${activeQueue}-orders`}
 page={pages[activeQueue]}
 pageSize={pageSizes[activeQueue]}
 total={activeOrders.length}
 onPageChange={page => handleQueuePageChange(activeQueue, page)}
 />
 </motion.section>
 </div>

 </div>
 )}
 </div>

 <PaymentReviewPanel
 isOpen={!!selectedPaymentOrder}
 order={selectedPaymentOrder}
 onClose={() => setSelectedPaymentOrder(null)}
 onVerify={handleVerifyPayment}
 onUpdated={handleOrderUpdated}
 isVerifying={isVerifying}
 />

 <PrintJobProgressModal
 isOpen={isProgressModalOpen}
 onClose={() => setIsProgressModalOpen(false)}
 jobs={jobProgresses}
 orderLabels={orderLabels}
 />

 <ConfirmModal
 isOpen={pendingBatch !== null}
 title={pendingBatch === 'MANUAL' ? 'Print selected orders manually?' : 'Send selected orders to the printer?'}
 message={pendingBatch === 'MANUAL'
 ? `${selectedReadyOrders.length} order(s) will be recorded as manual production and their approved PDFs downloaded. Downloading does not mark them ready; check each printed output in Pickup.`
 : `${selectedReadyOrders.length} order(s) will be sent to ${selectedPrinter || 'the selected printer'} with their approved settings. A submission report does not mean the pages printed; check each output in Pickup.`}
 confirmLabel={pendingBatch === 'MANUAL' ? 'Record and download' : 'Send to printer'}
 isBusy={isBatchProcessing}
 onConfirm={() => void (pendingBatch === 'MANUAL' ? startManualProduction() : sendToAgent())}
 onCancel={() => setPendingBatch(null)}
 />

 {fulfillment && (
 <FulfillmentDialog
 key={`${fulfillment.mode}-${fulfillment.order.id}`}
 mode={fulfillment.mode}
 order={fulfillment.order}
 attempt={fulfillment.order.current_attempt ?? null}
 title={orderLabels[fulfillment.order.id] || `Order #${fulfillment.order.id.slice(0, 8)}`}
 agentReady={agentReady}
 printers={availablePrinters}
 defaultPrinter={selectedPrinter}
 onClose={() => setFulfillment(null)}
 onDone={finishFulfillment}
 />
 )}

 <AlertModal 
 isOpen={alertState.isOpen}
 message={alertState.message}
 title={alertState.title}
 type={alertState.type}
 onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
 />
 </div>
 );
};
