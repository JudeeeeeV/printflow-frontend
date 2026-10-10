import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from '@carbon/icons-react';
import { shopService } from '../../services/shopService';
import { DashboardSkeleton } from '../../components/dashboard/skeletons/DashboardSkeleton';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/dashboard/OrderCard';
import { PaymentReviewPanel } from '../../components/dashboard/PaymentReviewPanel';
import { QueuePagination } from '../../components/dashboard/QueuePagination';
import { daemonSocketService } from '../../services/daemonSocketService';
import type { DaemonStatus } from '../../services/daemonSocketService';
import { PrintJobProgressModal } from '../../components/dashboard/PrintJobProgressModal';
import { KanbanFilterBar } from '../../components/dashboard/KanbanFilterBar';
import { AlertModal } from '../../components/common/AlertModal';
import { apiClient } from '../../services/apiClient';
import { createRefreshQueue } from '../../services/refreshQueue';
import { useDataEvents } from '../../hooks/useDataEvents';

const QUEUE_PAGE_SIZE = 3;
type QueueKey = 'new' | 'ready' | 'completed';
type QueueFilterState = {
 searchQuery: string;
 paperSize: string;
 colorMode: string;
};

const QUEUE_ORDER: QueueKey[] = ['new', 'ready', 'completed'];
const QUEUE_LABELS: Record<QueueKey, string> = { new: 'New Orders', ready: 'Print Ready', completed: 'Completed' };
const QUEUE_EMPTY_LABELS: Record<QueueKey, string> = {
 new: 'No new orders.',
 ready: 'No orders in production.',
 completed: 'No completed orders.',
};
const INITIAL_QUEUE_FILTERS: Record<QueueKey, QueueFilterState> = {
 new: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
 ready: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
 completed: { searchQuery: '', paperSize: 'ALL', colorMode: 'ALL' },
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
 const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any | null>(null);
 const [isVerifying, setIsVerifying] = useState(false);

 // Batch processing state
 const [selectedReadyOrders, setSelectedReadyOrders] = useState<string[]>([]);
 const [isBatchProcessing, setIsBatchProcessing] = useState(false);
 
 // Daemon state
 const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>('OFFLINE');
 const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
 const [jobProgresses, setJobProgresses] = useState<{ orderId: string; status: string }[]>([]);
 const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
 const [selectedPrinter, setSelectedPrinter] = useState<string>('');

 const [activeQueue, setActiveQueue] = useState<QueueKey>('new');
 const [tabDirection, setTabDirection] = useState(1);
 const [queueFilters, setQueueFilters] = useState<Record<QueueKey, QueueFilterState>>(INITIAL_QUEUE_FILTERS);
 const [queuePages, setQueuePages] = useState<Record<QueueKey, number>>({ new: 1, ready: 1, completed: 1 });
 const [pageAnnouncement, setPageAnnouncement] = useState('');
 const queueBoardRef = useRef<HTMLDivElement>(null);
 const queueTabRefs = useRef<Record<QueueKey, HTMLButtonElement | null>>({ new: null, ready: null, completed: null });
 const prefersReducedMotion = useReducedMotion();

 // Prune only orders that left production, not selections hidden by filters or pagination.
 const readyOrderIds = new Set(shopOrders.filter(order => order.state === 'IN_PRODUCTION').map(order => order.id));
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

 const unsubscribeProgress = daemonSocketService.onJobProgress(({ orderId, status }) => {
 setJobProgresses(prev => {
 const existing = prev.find(p => p.orderId === orderId);
 if (existing) {
 return prev.map(p => p.orderId === orderId ? { ...p, status } : p);
 }
 return [...prev, { orderId, status }];
 });
 
 // If a job completes, reload data to move it to the completed column
 if (status === 'COMPLETED' || status === 'SUCCESS') {
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
 unsubscribeProgress();
 unsubscribePrinters();
 // disconnection managed by ShopLayout
 };
 }
 }, [shopData?.id, refreshOrdersAfterChange]);

 const handleLogout = async () => {
 await apiClient('/auth/logout', { method: 'POST' }).catch(() => undefined);
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

 const handleVerifyPayment = async (orderId: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
 setIsVerifying(true);
 try {
 await orderService.verifyPayment(orderId, action, reason);
 setSelectedPaymentOrder(null);
 // Optimistic update
 setShopOrders(prev => prev.map(o => o.id === orderId ? { ...o, state: action === 'APPROVE' ? 'IN_PRODUCTION' : 'AWAITING_PAYMENT' } : o));
 // Actual refresh
 refreshOrdersAfterChange();
 } finally {
 setIsVerifying(false);
 }
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
 setSelectedReadyOrders(printReadyOrders.map(o => o.id));
 }
 };

 const handleManualDownload = async () => {
 let downloadCount = 0;
 for (const orderId of selectedReadyOrders) {
 const order = shopOrders.find(o => o.id === orderId);
 if (order && order.assets && order.assets.length > 0) {
 const assetUrl = order.assets[0].file_url;
 
 const urlParts = assetUrl.split('/');
 let rawName = decodeURIComponent(urlParts[urlParts.length - 1] || 'asset.pdf');
 const match = rawName.match(/-\d{13}-(.+)$/);
 let fileName = match ? match[1] : rawName;
 fileName = `Order_${order.id.slice(0, 8)}_${fileName}`;

 try {
 const response = await fetch(assetUrl);
 if (!response.ok) throw new Error('Network response was not ok');
 const blob = await response.blob();
 const objectUrl = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = objectUrl;
 link.download = fileName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 window.URL.revokeObjectURL(objectUrl);
 } catch (err) {
 console.error('Failed to force download, falling back to new tab:', err);
 window.open(assetUrl, '_blank', 'noopener,noreferrer');
 }
 downloadCount++;
 try {
 await orderService.updateOrderState(orderId, 'READY_FOR_PICKUP');
 } catch(updateErr) {
 console.error('Failed to update state for order:', orderId, updateErr);
 }
 }
 }
 if (downloadCount === 0) {
 showAlert("No assets found for the selected orders.", 'warning', 'No Assets Found');
 } else {
 showAlert(`Successfully downloaded ${downloadCount} asset(s). Orders marked as Ready for Pickup.`, 'success', 'Downloads Complete');
 setSelectedReadyOrders([]);
 refreshOrdersAfterChange();
 }
 };

 const handleBatchComplete = async () => {
 if (selectedReadyOrders.length === 0) return;
 if (daemonStatus !== 'CONNECTED' || !availablePrinters.includes(selectedPrinter)) {
 showAlert('Wait for the PrintFlow Agent to connect and select a detected printer before sending orders.', 'error', 'Printer Not Ready');
 return;
 }
 
 setIsBatchProcessing(true);
 // Initialize progresses for all selected orders
 setJobProgresses(selectedReadyOrders.map(id => ({ orderId: id, status: 'QUEUED' })));
 setIsProgressModalOpen(true);
 
 try {
  await apiClient('/edge/batch-execute', {
 method: 'POST',
 body: JSON.stringify({ 
 orderIds: selectedReadyOrders,
 printerName: selectedPrinter || undefined
 })
 });
 
 setSelectedReadyOrders([]);
 // Don't close modal here, wait for daemon status updates via WS
 } catch (err: unknown) {
 showAlert(err instanceof Error ? err.message : 'Failed to dispatch batch', 'error', 'Batch Failed');
 setIsProgressModalOpen(false);
 } finally {
 setIsBatchProcessing(false);
 }
 };

 if (isLoading) return <DashboardSkeleton />;
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
 const unfilteredNewOrders = shopOrders
 .filter(o => ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(o.state))
 .sort((a, b) => {
 if (a.state === 'AWAITING_PAYMENT_VERIFICATION' && b.state !== 'AWAITING_PAYMENT_VERIFICATION') return -1;
 if (b.state === 'AWAITING_PAYMENT_VERIFICATION' && a.state !== 'AWAITING_PAYMENT_VERIFICATION') return 1;
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });

 const unfilteredPrintReadyOrders = shopOrders
 .filter(o => ['IN_PRODUCTION'].includes(o.state))
 .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

 const unfilteredCompletedOrders = shopOrders
 .filter(o => ['READY_FOR_PICKUP', 'COMPLETED', 'PRINTED'].includes(o.state))
 .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

 const unfilteredQueueOrders: Record<QueueKey, typeof shopOrders> = {
 new: unfilteredNewOrders,
 ready: unfilteredPrintReadyOrders,
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
 completed: filterOrders(unfilteredCompletedOrders, queueFilters.completed),
 };
 const newOrders = filteredQueueOrders.new;
 const printReadyOrders = filteredQueueOrders.ready;
 const completedOrders = filteredQueueOrders.completed;

 const pageTotals = {
 new: Math.max(1, Math.ceil(newOrders.length / QUEUE_PAGE_SIZE)),
 ready: Math.max(1, Math.ceil(printReadyOrders.length / QUEUE_PAGE_SIZE)),
 completed: Math.max(1, Math.ceil(completedOrders.length / QUEUE_PAGE_SIZE)),
 };

 const pages = {
 new: Math.min(queuePages.new, pageTotals.new),
 ready: Math.min(queuePages.ready, pageTotals.ready),
 completed: Math.min(queuePages.completed, pageTotals.completed),
 };
 // Store poll-driven clamps so a later refresh cannot restore an obsolete page.
 if (pages.new !== queuePages.new || pages.ready !== queuePages.ready || pages.completed !== queuePages.completed) {
 setQueuePages(pages);
 }
 const visibleNewOrders = newOrders.slice((pages.new - 1) * QUEUE_PAGE_SIZE, pages.new * QUEUE_PAGE_SIZE);
 const visibleReadyOrders = printReadyOrders.slice((pages.ready - 1) * QUEUE_PAGE_SIZE, pages.ready * QUEUE_PAGE_SIZE);
 const visibleCompletedOrders = completedOrders.slice((pages.completed - 1) * QUEUE_PAGE_SIZE, pages.completed * QUEUE_PAGE_SIZE);
 const visibleQueueOrders: Record<QueueKey, typeof shopOrders> = {
 new: visibleNewOrders,
 ready: visibleReadyOrders,
 completed: visibleCompletedOrders,
 };
 const activeFilters = queueFilters[activeQueue];
 const activeOrders = filteredQueueOrders[activeQueue];
 const activeVisibleOrders = visibleQueueOrders[activeQueue];
 const activeEmptyMessage = unfilteredQueueOrders[activeQueue].length > 0
 ? 'No orders match your filters.'
 : QUEUE_EMPTY_LABELS[activeQueue];
 const selectedReadyIds = new Set(selectedReadyOrders);
 const matchingSelectedCount = printReadyOrders.filter(order => selectedReadyIds.has(order.id)).length;
 const allMatchingReadySelected = printReadyOrders.length > 0 && matchingSelectedCount === printReadyOrders.length;
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
 if (window.matchMedia('(min-width: 1024px)').matches) {
 queueBoardRef.current?.querySelector<HTMLElement>(`#queue-${queue}-orders`)?.scrollTo({ top: 0, behavior: 'instant' });
 } else {
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

 return (
 <div className="flex min-h-full min-w-0 flex-col bg-carbon-gray-10 font-sans lg:h-full lg:min-h-0 lg:overflow-hidden">
 <div className="flex flex-none flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
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
 <div className="flex flex-none flex-col bg-carbon-gray-10 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
 <div role="tablist" aria-label="Live queue sections" aria-orientation="horizontal" className="grid shrink-0 grid-cols-3 gap-1 border-b border-gray-300 bg-carbon-gray-10 p-1 sm:gap-2 sm:px-2">
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
 <div ref={queueBoardRef} data-live-queue className="flex flex-none flex-col overflow-hidden p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:p-5">
 <AnimatePresence mode="wait" initial={false}>
 <motion.section
 key={activeQueue}
 id={`queue-panel-${activeQueue}`}
 role="tabpanel"
 aria-labelledby={`queue-tab-${activeQueue}`}
 className="flex w-full min-w-0 flex-col overflow-hidden border border-black bg-gray-100 shadow-[0_8px_20px_rgba(22,22,22,0.08)] lg:min-h-0 lg:flex-1"
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
 disabled={printReadyOrders.length === 0}
 ref={element => { if (element) element.indeterminate = someMatchingReadySelected; }}
 aria-describedby="ready-selection-scope"
 onChange={handleSelectAllReady}
 />
 <span>Select all matching<span id="ready-selection-scope" className="block text-xs font-normal text-gray-600">Across all pages</span></span>
 </label>
 <span className="bg-carbon-gray-10 px-2.5 py-1 text-xs font-bold tabular-nums text-gray-600">
 {selectedReadyOrders.length} selected
 {offPageSelectedCount > 0 && <span className="block font-normal">{offPageSelectedCount} not on this page</span>}
 </span>
 {selectedReadyOrders.length > 0 && (
 <button type="button" onClick={() => setSelectedReadyOrders([])} className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-carbon-blue-70 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">Clear selection</button>
 )}
 </div>

 {daemonStatus === 'CONNECTED' ? (
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
 onClick={handleBatchComplete}
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
 onClick={handleManualDownload}
 disabled={selectedReadyOrders.length === 0}
 className="min-h-11 shrink-0 border border-black bg-white px-3 py-2 text-xs font-bold text-carbon-gray-100 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10 motion-reduce:transition-none"
 >
 Download Assets Manually
 </button>
 </div>
 )}
 </div>
 )}

 <div id={`queue-${activeQueue}-orders`} aria-labelledby={`queue-${activeQueue}-heading`} className="grid grid-cols-1 items-start gap-3 overflow-y-visible p-3 sm:p-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto xl:grid-cols-3">
 {activeVisibleOrders.map(order => activeQueue === 'ready' ? (
 <OrderCard
 key={order.id}
 order={order}
 onClick={() => handleToggleReadySelection(order.id)}
 isSelected={selectedReadyOrders.includes(order.id)}
 onToggleSelect={handleToggleReadySelection}
 />
 ) : (
 <OrderCard
 key={order.id}
 order={order}
 onReviewPayment={activeQueue === 'new' && ['AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(order.state) ? () => setSelectedPaymentOrder(order) : undefined}
 />
 ))}
 {activeOrders.length === 0 && (
 <div className="flex min-h-48 items-center justify-center border border-dashed border-black bg-white px-6 text-center md:col-span-2 xl:col-span-3 lg:h-full">
 <p className="text-sm font-medium leading-relaxed text-gray-600">{activeEmptyMessage}</p>
 </div>
 )}
 </div>

 <QueuePagination
 label={QUEUE_LABELS[activeQueue]}
 controlsId={`queue-${activeQueue}-orders`}
 page={pages[activeQueue]}
 pageSize={QUEUE_PAGE_SIZE}
 total={activeOrders.length}
 onPageChange={page => handleQueuePageChange(activeQueue, page)}
 />
 </motion.section>
 </AnimatePresence>
 </div>

 </div>
 )}
 </div>

 <PaymentReviewPanel
 isOpen={!!selectedPaymentOrder}
 order={selectedPaymentOrder}
 onClose={() => setSelectedPaymentOrder(null)}
 onVerify={handleVerifyPayment}
 isVerifying={isVerifying}
 />

 <PrintJobProgressModal
 isOpen={isProgressModalOpen}
 onClose={() => setIsProgressModalOpen(false)}
 jobs={jobProgresses}
 />
 
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
