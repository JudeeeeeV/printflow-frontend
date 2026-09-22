import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shopService } from '../../services/shopService';
import { DashboardSkeleton } from '../../components/dashboard/DashboardSkeleton';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/dashboard/OrderCard';
import { PaymentReviewPanel } from '../../components/dashboard/PaymentReviewPanel';
import { QueuePagination } from '../../components/dashboard/QueuePagination';
import { daemonSocketService } from '../../services/daemonSocketService';
import { API_URL } from '../../config/runtime';
import type { DaemonStatus } from '../../services/daemonSocketService';
import { PrintJobProgressModal } from '../../components/dashboard/PrintJobProgressModal';
import { KanbanFilterBar } from '../../components/dashboard/KanbanFilterBar';
import { AlertModal } from '../../components/common/AlertModal';
import { apiClient } from '../../services/apiClient';

const QUEUE_PAGE_SIZE = 3;
type QueueKey = 'new' | 'ready' | 'completed';
const QUEUE_LABELS: Record<QueueKey, string> = { new: 'New Orders', ready: 'Print Ready', completed: 'Completed' };

export const ShopDashboard: React.FC = () => {
 const navigate = useNavigate();
 const [shopData, setShopData] = useState<any>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [permitFile, setPermitFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadError, setUploadError] = useState<string | null>(null);

 const [qrFile, setQrFile] = useState<File | null>(null);
 const [isUploadingQr, setIsUploadingQr] = useState(false);
 const [uploadQrError, setUploadQrError] = useState<string | null>(null);

 const [shopOrders, setShopOrders] = useState<any[]>([]);
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

 // Filter states
 const [searchQuery, setSearchQuery] = useState('');
 const [paperSizeFilter, setPaperSizeFilter] = useState('ALL');
 const [colorModeFilter, setColorModeFilter] = useState('ALL');

 const [queuePages, setQueuePages] = useState<Record<QueueKey, number>>({ new: 1, ready: 1, completed: 1 });
 const filterKey = JSON.stringify([searchQuery, paperSizeFilter, colorModeFilter]);
 const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
 const [pageAnnouncement, setPageAnnouncement] = useState('');
 const queueBoardRef = useRef<HTMLDivElement>(null);

 // Prune only orders that left production, not selections hidden by filters or pagination.
 const readyOrderIds = new Set(shopOrders.filter(order => order.state === 'IN_PRODUCTION').map(order => order.id));
 const validSelectedReadyOrders = selectedReadyOrders.filter(id => readyOrderIds.has(id));
 if (validSelectedReadyOrders.length !== selectedReadyOrders.length) {
 setSelectedReadyOrders(validSelectedReadyOrders);
 }

 if (previousFilterKey !== filterKey) {
 setPreviousFilterKey(filterKey);
 setQueuePages({ new: 1, ready: 1, completed: 1 });
 }

 const [alertState, setAlertState] = useState<{isOpen: boolean; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'}>({ isOpen: false, message: '' });
 const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', title?: string) => {
 setAlertState({ isOpen: true, message, type, title });
 };

 const loadShopData = () => {
 shopService.getMyShop()
 .then(data => {
 setShopData(data);
 if (data.verification_status === 'VERIFIED' || data.verification_status === 'OPEN') {
 return orderService.getShopOrders();
 }
 return [];
 })
 .then(orders => {
 setShopOrders(orders);
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

 useEffect(() => {
 if (shopData?.verification_status === 'VERIFIED' || shopData?.verification_status === 'OPEN') {
 const timer = setInterval(() => {
 orderService.getShopOrders()
 .then(orders => setShopOrders(orders))
 .catch(console.error);
 }, 10000);
 return () => clearInterval(timer);
 }
 }, [shopData?.verification_status]);

 useEffect(() => {
 if (shopData?.id) {
 daemonSocketService.connect(shopData.id);

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
 loadShopData();
 }
 });

 const unsubscribePrinters = daemonSocketService.onPrintersList((printers) => {
 setAvailablePrinters(printers);
 if (printers.length > 0 && !selectedPrinter) {
 setSelectedPrinter(printers[0]);
 }
 });

 return () => {
 unsubscribeStatus();
 unsubscribeProgress();
 unsubscribePrinters();
 daemonSocketService.disconnect();
 };
 }
 }, [shopData?.id]);

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

 const handleUploadQr = async () => {
 if (!qrFile) return;
 setIsUploadingQr(true);
 setUploadQrError(null);
 try {
 await shopService.uploadGcashQr(qrFile);
 loadShopData();
 setQrFile(null);
 showAlert('GCash QR Code uploaded successfully!', 'success', 'Success');
 } catch (err: any) {
 setUploadQrError(err.message || 'Failed to submit GCash QR code.');
 } finally {
 setIsUploadingQr(false);
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
 loadShopData();
 } catch (err: any) {
 showAlert(err.message || 'Failed to verify payment', 'error', 'Verification Failed');
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
 loadShopData();
 }
 };

 const handleBatchComplete = async () => {
 if (selectedReadyOrders.length === 0) return;
 
 setIsBatchProcessing(true);
 // Initialize progresses for all selected orders
 setJobProgresses(selectedReadyOrders.map(id => ({ orderId: id, status: 'QUEUED' })));
 setIsProgressModalOpen(true);
 
 try {
  const response = await fetch(`${API_URL}/edge/batch-execute`, {
 method: 'POST',
 credentials: 'include',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ 
 orderIds: selectedReadyOrders,
 printerName: selectedPrinter || undefined
 })
 });
 
 if (!response.ok) {
 const errData = await response.json();
 throw new Error(errData.message || 'Failed to dispatch batch');
 }
 
 setSelectedReadyOrders([]);
 // Don't close modal here, wait for daemon status updates via WS
 } catch (err: any) {
 showAlert('Batch error: ' + err.message, 'error', 'Batch Failed');
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

 // Derived Kanban Data
 const searchLower = searchQuery.toLowerCase();
 const filteredShopOrders = shopOrders.filter(order => {
 const matchSearch = !searchQuery || 
 order.id.slice(0, 8).toLowerCase().includes(searchLower) || 
 (order.client_id || '').slice(0, 8).toLowerCase().includes(searchLower);
 const matchPaper = paperSizeFilter === 'ALL' || order.paper_size === paperSizeFilter;
 const matchColor = colorModeFilter === 'ALL' || order.print_color_mode === colorModeFilter;
 return matchSearch && matchPaper && matchColor;
 });

 // New Orders: Pending review, approved proof, awaiting payment, or just open inquiry
 const newOrders = filteredShopOrders
 .filter(o => ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(o.state))
 .sort((a, b) => {
 // Put AWAITING_PAYMENT_VERIFICATION at the very top
 if (a.state === 'AWAITING_PAYMENT_VERIFICATION' && b.state !== 'AWAITING_PAYMENT_VERIFICATION') return -1;
 if (b.state === 'AWAITING_PAYMENT_VERIFICATION' && a.state !== 'AWAITING_PAYMENT_VERIFICATION') return 1;
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 });

 const printReadyOrders = filteredShopOrders
 .filter(o => ['IN_PRODUCTION'].includes(o.state))
 .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

 const completedOrders = filteredShopOrders
 .filter(o => ['READY_FOR_PICKUP', 'COMPLETED', 'PRINTED'].includes(o.state))
 .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
 // Store the clamp so a later poll cannot restore an obsolete page number.
 if (previousFilterKey === filterKey && (pages.new !== queuePages.new || pages.ready !== queuePages.ready || pages.completed !== queuePages.completed)) {
 setQueuePages(pages);
 }
 const visibleNewOrders = newOrders.slice((pages.new - 1) * QUEUE_PAGE_SIZE, pages.new * QUEUE_PAGE_SIZE);
 const visibleReadyOrders = printReadyOrders.slice((pages.ready - 1) * QUEUE_PAGE_SIZE, pages.ready * QUEUE_PAGE_SIZE);
 const visibleCompletedOrders = completedOrders.slice((pages.completed - 1) * QUEUE_PAGE_SIZE, pages.completed * QUEUE_PAGE_SIZE);
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
 {/* Dashboard Top Bar (QR Code & Status) */}
 <div className="z-10 flex shrink-0 flex-col gap-2 border-b border-gray-300 bg-white px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
 <div className="flex min-h-10 items-center border-l-4 border-green-500 bg-carbon-gray-10 px-3">
 <span className="mr-2.5 flex h-2.5 w-2.5 shrink-0">
 <span className="relative inline-flex h-2.5 w-2.5 bg-green-500"></span>
 </span>
 <span className="text-sm font-black tracking-tight text-carbon-gray-100">Queue Active</span>
 </div>

 <div className="flex min-w-0 flex-col gap-1 lg:items-end">
 <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
 <label className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600">GCash QR:</label>
 <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
 <input
 type="file"
 accept="image/*"
 className="min-h-11 w-full min-w-0 cursor-pointer border border-gray-300 bg-carbon-gray-10 text-xs text-gray-600 file:mr-2 file:min-h-11 file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-carbon-blue-70 hover:file:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
 onChange={(e) => setQrFile(e.target.files?.[0] || null)}
 disabled={isUploadingQr}
 />
 <button
 onClick={handleUploadQr}
 disabled={!qrFile || isUploadingQr}
 className={`min-h-11 shrink-0 px-4 py-2 text-xs font-bold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 ${
 !qrFile || isUploadingQr ? 'cursor-not-allowed bg-gray-300' : 'bg-carbon-blue-60 hover:bg-carbon-blue-70'
 }`}
 >
 {isUploadingQr ? 'Saving...' : 'Update'}
 </button>
 </div>
 </div>
 {uploadQrError && <span className="border-l-4 border-carbon-gray-100 bg-carbon-gray-10 px-3 py-2 text-xs font-bold text-carbon-gray-100" role="alert">{uploadQrError}</span>}
 </div>
 </div>

 <div className="shrink-0 border-b border-gray-300 bg-carbon-gray-10 px-3 py-2 sm:px-5 lg:px-7">
 <div className="border border-gray-300 bg-white [&>div]:border-b-0">
 <KanbanFilterBar 
 onSearch={setSearchQuery} 
 paperSizeFilter={paperSizeFilter} 
 setPaperSizeFilter={setPaperSizeFilter} 
 colorModeFilter={colorModeFilter} 
 setColorModeFilter={setColorModeFilter} 
 />
 </div>
 </div>

 <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{pageAnnouncement}</p>
 <div ref={queueBoardRef} data-live-queue className="flex flex-none flex-col gap-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-5 lg:overflow-x-auto lg:overflow-y-hidden lg:p-6">
 
 {/* Column 1: New Orders */}
 <div className="flex w-full min-w-0 flex-none flex-col border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-gray-100 lg:min-h-0 lg:min-w-[320px] lg:flex-1 lg:overflow-hidden">
 <div className="flex shrink-0 items-center justify-between border-b border-gray-300 bg-white px-4 py-3.5">
 <h3 id="queue-new-heading" tabIndex={-1} className="text-lg font-black tracking-tight text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">New Orders</h3>
 <span className="min-w-8 bg-blue-50 px-2.5 py-1 text-center text-sm font-black tabular-nums text-carbon-blue-70">{newOrders.length}</span>
 </div>
 <div id="queue-new-orders" aria-labelledby="queue-new-heading" className="space-y-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
 {visibleNewOrders.map(order => (
 <OrderCard 
 key={order.id} 
 order={order} 
 onClick={() => ['AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(order.state) ? setSelectedPaymentOrder(order) : null} 
 />
 ))}
 {newOrders.length === 0 && (
 <div className="flex lg:h-full min-h-48 items-center justify-center border border-dashed border-gray-300 bg-white px-6 text-center">
 <p className="text-sm font-medium leading-relaxed text-gray-500">
 {shopOrders.filter(o => ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(o.state)).length > 0 
 ? "No orders match your filters." 
 : "No new orders."}
 </p>
 </div>
 )}
 </div>
 <QueuePagination label="New Orders" controlsId="queue-new-orders" page={pages.new} pageSize={QUEUE_PAGE_SIZE} total={newOrders.length} onPageChange={page => handleQueuePageChange('new', page)} />
 </div>

 {/* Column 2: Print Ready */}
 <div className="flex w-full min-w-0 flex-none flex-col border border-carbon-gray-100 border-t-4 border-t-carbon-gray-100 bg-gray-100 shadow-[0_8px_20px_rgba(22,22,22,0.08)] lg:min-h-0 lg:min-w-[320px] lg:flex-1 lg:overflow-hidden">
 <div className="flex shrink-0 items-center justify-between border-b border-carbon-gray-100 bg-carbon-gray-100 px-4 py-3.5 text-white">
 <h3 id="queue-ready-heading" tabIndex={-1} className="text-lg font-black tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Print Ready</h3>
 <span className="min-w-8 bg-white px-2.5 py-1 text-center text-sm font-black tabular-nums text-carbon-gray-100">{printReadyOrders.length}</span>
 </div>
 
 <div id="queue-ready-orders" aria-labelledby="queue-ready-heading" className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
 {/* Batch Controls */}
 {(printReadyOrders.length > 0 || selectedReadyOrders.length > 0) && (
 <div className="z-10 flex shrink-0 flex-col gap-3 border-b border-gray-300 bg-white p-4">
 <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
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
 <span>Select all matching orders<span id="ready-selection-scope" className="block text-xs font-normal text-gray-600">Across all pages</span></span>
 </label>
 <span className="bg-carbon-gray-10 px-2.5 py-1 text-xs font-bold tabular-nums text-gray-600">{selectedReadyOrders.length} selected{offPageSelectedCount > 0 && <span className="block font-normal">{offPageSelectedCount} not on this page</span>}</span>
 {selectedReadyOrders.length > 0 && (
 <button type="button" onClick={() => setSelectedReadyOrders([])} className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-carbon-blue-70 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">Clear selection</button>
 )}
 </div>
 
 {daemonStatus === 'CONNECTED' ? (
 <div className="flex flex-col gap-3">
 {availablePrinters.length > 0 ? (
 <div className="w-full">
 <select 
 className="block min-h-11 w-full cursor-pointer border border-gray-500 bg-carbon-gray-10 p-2.5 text-sm font-semibold text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
 value={selectedPrinter}
 onChange={(e) => setSelectedPrinter(e.target.value)}
 >
 {availablePrinters.map(printer => (
 <option key={printer} value={printer}>{printer}</option>
 ))}
 </select>
 </div>
 ) : (
 <span className="border-l-4 border-gray-300 bg-carbon-gray-10 px-3 py-2 text-xs font-medium italic text-gray-500">Fetching printers...</span>
 )}
 <button 
 onClick={handleBatchComplete}
 disabled={selectedReadyOrders.length === 0 || isBatchProcessing}
 className="flex min-h-12 w-full items-center justify-center gap-2 bg-carbon-blue-60 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:pointer-events-none disabled:opacity-50"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
 </svg>
 Send to Daemon (Batch)
 </button>
 </div>
 ) : (
 <div className="flex w-full flex-col gap-3 border border-gray-300 border-l-4 border-l-gray-500 bg-carbon-gray-10 p-3">
 <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-carbon-gray-100">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 Daemon Offline
 </span>
 <button 
 onClick={handleManualDownload}
 disabled={selectedReadyOrders.length === 0}
 className="min-h-11 w-full border border-gray-400 bg-white px-3 py-2 text-xs font-bold text-carbon-gray-100 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50"
 >
 Download Assets Manually
 </button>
 </div>
 )}
 </div>
 )}

 <div className="space-y-4 p-3 sm:p-4">
 {visibleReadyOrders.map(order => (
 <div key={order.id} className={`group flex items-center gap-3 border-l-4 transition-colors ${selectedReadyOrders.includes(order.id) ? 'border-carbon-blue-60 bg-blue-50' : 'border-transparent'}`}>
 <div className="shrink-0 pl-2">
 <input 
 type="checkbox" 
 className="h-5 w-5 cursor-pointer border-gray-500 text-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
 aria-label={`Select order ${order.id.slice(0, 8)}`}
 checked={selectedReadyOrders.includes(order.id)}
 onChange={() => handleToggleReadySelection(order.id)}
 />
 </div>
 <div className={`min-w-0 flex-1 transition-[transform,opacity] duration-200 ${selectedReadyOrders.includes(order.id) ? 'scale-[0.985] opacity-95' : 'scale-100'}`}>
 <OrderCard order={order} onClick={() => handleToggleReadySelection(order.id)} />
 </div>
 </div>
 ))}
 {printReadyOrders.length === 0 && (
 <div className="flex lg:h-full min-h-48 items-center justify-center border border-dashed border-gray-300 bg-white px-6 text-center">
 <p className="text-sm font-medium leading-relaxed text-gray-500">
 {shopOrders.filter(o => ['IN_PRODUCTION'].includes(o.state)).length > 0 
 ? "No orders match your filters." 
 : "No orders in production."}
 </p>
 </div>
 )}
 </div>
 </div>
 <QueuePagination label="Print Ready" controlsId="queue-ready-orders" page={pages.ready} pageSize={QUEUE_PAGE_SIZE} total={printReadyOrders.length} onPageChange={page => handleQueuePageChange('ready', page)} />
 </div>

 {/* Column 3: Completed */}
 <div className="flex w-full min-w-0 flex-none flex-col border border-gray-300 border-t-4 border-t-gray-400 bg-gray-100 lg:min-h-0 lg:min-w-[320px] lg:flex-1 lg:overflow-hidden">
 <div className="flex shrink-0 items-center justify-between border-b border-gray-300 bg-gray-50 px-4 py-3.5">
 <h3 id="queue-completed-heading" tabIndex={-1} className="text-lg font-black tracking-tight text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">Completed</h3>
 <span className="min-w-8 bg-gray-200 px-2.5 py-1 text-center text-sm font-black tabular-nums text-gray-700">{completedOrders.length}</span>
 </div>
 <div id="queue-completed-orders" aria-labelledby="queue-completed-heading" className="space-y-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
 {visibleCompletedOrders.map(order => (
 <OrderCard key={order.id} order={order} onClick={() => {}} />
 ))}
 {completedOrders.length === 0 && (
 <div className="flex lg:h-full min-h-48 items-center justify-center border border-dashed border-gray-300 bg-white px-6 text-center">
 <p className="text-sm font-medium leading-relaxed text-gray-500">
 {shopOrders.filter(o => ['READY_FOR_PICKUP', 'COMPLETED', 'PRINTED'].includes(o.state)).length > 0 
 ? "No orders match your filters." 
 : "No completed orders."}
 </p>
 </div>
 )}
 </div>
 <QueuePagination label="Completed" controlsId="queue-completed-orders" page={pages.completed} pageSize={QUEUE_PAGE_SIZE} total={completedOrders.length} onPageChange={page => handleQueuePageChange('completed', page)} />
 </div>

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
