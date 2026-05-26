import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shopService } from '../../services/shopService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/dashboard/OrderCard';
import { PaymentReviewPanel } from '../../components/dashboard/PaymentReviewPanel';
import { AnimatePresence } from 'framer-motion';
import { daemonSocketService } from '../../services/daemonSocketService';
import type { DaemonStatus } from '../../services/daemonSocketService';
import { PrintJobProgressModal } from '../../components/dashboard/PrintJobProgressModal';
import { KanbanFilterBar } from '../../components/dashboard/KanbanFilterBar';
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

    const loadShopData = () => {
        shopService.getMyShop()
            .then(data => {
                setShopData(data);
                return orderService.getShopOrders();
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
        
        // Optional polling to keep the Kanban board alive
        const timer = setInterval(() => {
            orderService.getShopOrders()
                .then(orders => setShopOrders(orders))
                .catch(console.error);
        }, 10000);
        return () => clearInterval(timer);
    }, []);

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

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
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
            alert('GCash QR Code uploaded successfully!');
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
            alert(err.message || 'Failed to verify payment');
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
        if (selectedReadyOrders.length === printReadyOrders.length) {
            setSelectedReadyOrders([]);
        } else {
            setSelectedReadyOrders(printReadyOrders.map(o => o.id));
        }
    };

    const handleManualDownload = () => {
        let downloadCount = 0;
        selectedReadyOrders.forEach(orderId => {
            const order = shopOrders.find(o => o.id === orderId);
            if (order && order.assets && order.assets.length > 0) {
                const assetUrl = order.assets[0].file_url;
                window.open(assetUrl, '_blank');
                downloadCount++;
            }
        });
        if (downloadCount === 0) {
            alert("No assets found for the selected orders.");
        } else {
            alert(`Initiated download for ${downloadCount} asset(s). Make sure your browser allows popups!`);
        }
    };

    const handleBatchComplete = async () => {
        if (selectedReadyOrders.length === 0) return;
        
        setIsBatchProcessing(true);
        // Initialize progresses for all selected orders
        setJobProgresses(selectedReadyOrders.map(id => ({ orderId: id, status: 'QUEUED' })));
        setIsProgressModalOpen(true);
        
        try {
            const response = await fetch(`http://localhost:3000/edge/batch-execute/${shopData.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
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
            alert('Batch error: ' + err.message);
            setIsProgressModalOpen(false);
        } finally {
            setIsBatchProcessing(false);
        }
    };

    if (isLoading) return <LoadingSpinner message="Loading Live Queue..." />;
    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="text-red-500 mb-4 text-xl font-bold">Error</div>
            <p className="mb-4 text-gray-700">{error}</p>
            <button onClick={handleLogout} className="px-6 py-2 bg-black text-white font-bold">Logout</button>
        </div>
    );

    const { name, verification_status } = shopData;

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


    return (
        <div className="flex flex-col h-full overflow-hidden font-sans">
            <div className="bg-white border-b border-gray-200 py-3 px-6 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-xl font-black text-black">{name}</h2>
                        <p className="text-xs font-medium text-gray-500">Live Queue</p>
                    </div>
                    
                    {/* Daemon Status Badge */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                        <span className={`relative flex h-2.5 w-2.5`}>
                            {daemonStatus === 'CONNECTED' && (
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            )}
                            {daemonStatus === 'RECONNECTING' && (
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500 animate-pulse"></span>
                            )}
                            {daemonStatus === 'OFFLINE' && (
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400"></span>
                            )}
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                            Daemon: {daemonStatus === 'CONNECTED' ? 'Connected' : daemonStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            <main className="flex-1 flex flex-col overflow-hidden">
                {verification_status === 'PENDING_REVIEW' ? (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white border border-gray-200 p-8 flex flex-col items-center justify-center mt-10 rounded-sm shadow-sm max-w-2xl mx-auto w-full">
                            <svg className="w-16 h-16 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification Under Review</h2>
                            <p className="text-gray-600 max-w-md text-center">
                                We have received your business permit and GCash QR code. Your shop verification is currently under review. Please check back later.
                            </p>
                        </div>
                    </div>
                ) : verification_status !== 'VERIFIED' && verification_status !== 'OPEN' ? (
                    // Unverified State (Unchanged structure, placed in center)
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white border border-gray-200 p-8 flex flex-col items-center justify-center mt-10 rounded-sm shadow-sm max-w-2xl mx-auto w-full">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Shop Verification Required</h2>
                            <p className="text-gray-600 max-w-md text-center mb-8">
                                Your shop is currently unverified. Please submit your official business permit and GCash QR code.
                            </p>
                            <div className="w-full bg-gray-50 border border-gray-200 p-6 rounded-sm mb-6 flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Upload Business Permit (Image/PDF)</label>
                                    <input
                                        type="file" accept="image/*,application/pdf"
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                                        onChange={(e) => setPermitFile(e.target.files?.[0] || null)}
                                        disabled={isUploading}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Upload GCash QR Code (Image)</label>
                                    <input
                                        type="file" accept="image/*"
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                                        disabled={isUploading}
                                    />
                                </div>
                                {uploadError && <p className="text-red-500 font-bold text-sm">{uploadError}</p>}
                                <button onClick={handleUploadPermit} disabled={!permitFile || !qrFile || isUploading} className={`w-full py-3 mt-2 font-bold text-white transition-colors ${!permitFile || !qrFile || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}>
                                    {isUploading ? 'Uploading & Analyzing...' : 'Submit for Verification'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Kanban Board Layout
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-100/50">
                        {/* Dashboard Top Bar (QR Code & Status) */}
                        <div className="bg-white border-b border-gray-200 p-4 shrink-0 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center">
                                <span className="flex h-3 w-3 relative mr-3">
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="font-bold text-gray-800">Queue Active</span>
                            </div>

                            <div className="flex items-center space-x-4">
                                <label className="text-sm font-bold text-gray-600">GCash QR:</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-48"
                                        onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                                        disabled={isUploadingQr}
                                    />
                                    <button
                                        onClick={handleUploadQr}
                                        disabled={!qrFile || isUploadingQr}
                                        className={`px-3 py-1.5 text-xs font-bold text-white transition-colors rounded-sm ${
                                            !qrFile || isUploadingQr ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        {isUploadingQr ? 'Saving...' : 'Update'}
                                    </button>
                                </div>
                                {uploadQrError && <span className="text-red-500 font-bold text-xs">{uploadQrError}</span>}
                            </div>
                        </div>

                        <KanbanFilterBar 
                            onSearch={setSearchQuery} 
                            paperSizeFilter={paperSizeFilter} 
                            setPaperSizeFilter={setPaperSizeFilter} 
                            colorModeFilter={colorModeFilter} 
                            setColorModeFilter={setColorModeFilter} 
                        />

                        <div className="flex-1 flex overflow-x-auto p-6 gap-6">
                        
                        {/* Column 1: New Orders */}
                        <div className="flex-1 min-w-[320px] max-w-md flex flex-col bg-gray-100 border border-gray-200 rounded-lg shadow-inner overflow-hidden">
                            <div className="p-4 bg-white border-b border-gray-200 shrink-0 flex justify-between items-center">
                                <h3 className="text-lg font-black text-gray-900">New Orders</h3>
                                <span className="bg-gray-200 text-gray-700 font-bold px-2.5 py-0.5 rounded-full text-sm">{newOrders.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <AnimatePresence>
                                    {newOrders.map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            onClick={() => ['AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(order.state) ? setSelectedPaymentOrder(order) : null} 
                                        />
                                    ))}
                                </AnimatePresence>
                                {newOrders.length === 0 && (
                                    <div className="h-full flex items-center justify-center text-center px-4">
                                        <p className="text-gray-400 font-medium">
                                            {shopOrders.filter(o => ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'ESCALATED_DISPUTE'].includes(o.state)).length > 0 
                                                ? "No orders match your filters." 
                                                : "No new orders."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Print Ready */}
                        <div className="flex-1 min-w-[320px] max-w-md flex flex-col bg-gray-100 border border-gray-200 rounded-lg shadow-inner overflow-hidden">
                            <div className="p-4 bg-white border-b border-gray-200 shrink-0 flex justify-between items-center">
                                <h3 className="text-lg font-black text-gray-900">Print Ready</h3>
                                <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full text-sm">{printReadyOrders.length}</span>
                            </div>
                            
                            {/* Batch Controls */}
                            {printReadyOrders.length > 0 && (
                                <div className="p-3 bg-white border-b border-gray-100 flex flex-col gap-2 shrink-0 shadow-sm z-10">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center text-sm font-bold text-gray-700 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="mr-2 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                checked={selectedReadyOrders.length === printReadyOrders.length && printReadyOrders.length > 0}
                                                onChange={handleSelectAllReady}
                                            />
                                            Select All
                                        </label>
                                        <span className="text-xs font-bold text-gray-500">{selectedReadyOrders.length} selected</span>
                                    </div>
                                    
                                    {daemonStatus === 'CONNECTED' ? (
                                        <div className="flex flex-col gap-2">
                                            {availablePrinters.length > 0 ? (
                                                <div className="w-full">
                                                    <select 
                                                        className="w-full text-xs bg-gray-50 border border-gray-300 text-gray-900 rounded-sm focus:ring-black focus:border-black block p-2"
                                                        value={selectedPrinter}
                                                        onChange={(e) => setSelectedPrinter(e.target.value)}
                                                    >
                                                        {availablePrinters.map(printer => (
                                                            <option key={printer} value={printer}>{printer}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500 font-medium italic">Fetching printers...</span>
                                            )}
                                            <button 
                                                onClick={handleBatchComplete}
                                                disabled={selectedReadyOrders.length === 0 || isBatchProcessing}
                                                className="w-full text-sm font-bold bg-black hover:bg-gray-800 text-white px-3 py-2.5 rounded-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                                </svg>
                                                Send to Daemon (Batch)
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full bg-red-50 border border-red-200 rounded-sm p-3 flex flex-col gap-2">
                                            <span className="text-xs font-bold text-red-700 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Daemon Offline
                                            </span>
                                            <button 
                                                onClick={handleManualDownload}
                                                disabled={selectedReadyOrders.length === 0}
                                                className="w-full text-xs font-bold bg-white text-red-700 border border-red-200 px-3 py-1.5 rounded-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                Download Assets Manually
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <AnimatePresence>
                                    {printReadyOrders.map(order => (
                                        <div key={order.id} className="flex items-center gap-3 group">
                                            <div className="shrink-0 pl-1">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-black cursor-pointer"
                                                    checked={selectedReadyOrders.includes(order.id)}
                                                    onChange={() => handleToggleReadySelection(order.id)}
                                                />
                                            </div>
                                            <div className={`flex-1 transition-transform ${selectedReadyOrders.includes(order.id) ? 'opacity-90 scale-[0.98]' : 'scale-100'}`}>
                                                <OrderCard order={order} onClick={() => handleToggleReadySelection(order.id)} />
                                            </div>
                                        </div>
                                    ))}
                                </AnimatePresence>
                                {printReadyOrders.length === 0 && (
                                    <div className="h-full flex items-center justify-center text-center px-4">
                                        <p className="text-gray-400 font-medium">
                                            {shopOrders.filter(o => ['IN_PRODUCTION'].includes(o.state)).length > 0 
                                                ? "No orders match your filters." 
                                                : "No orders in production."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 3: Completed */}
                        <div className="flex-1 min-w-[320px] max-w-md flex flex-col bg-gray-100 border border-gray-200 rounded-lg shadow-inner overflow-hidden">
                            <div className="p-4 bg-white border-b border-gray-200 shrink-0 flex justify-between items-center">
                                <h3 className="text-lg font-black text-gray-900">Completed</h3>
                                <span className="bg-gray-200 text-gray-700 font-bold px-2.5 py-0.5 rounded-full text-sm">{completedOrders.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 opacity-75">
                                <AnimatePresence>
                                    {completedOrders.map(order => (
                                        <OrderCard key={order.id} order={order} onClick={() => {}} />
                                    ))}
                                </AnimatePresence>
                                {completedOrders.length === 0 && (
                                    <div className="h-full flex items-center justify-center text-center px-4">
                                        <p className="text-gray-400 font-medium">
                                            {shopOrders.filter(o => ['READY_FOR_PICKUP', 'COMPLETED', 'PRINTED'].includes(o.state)).length > 0 
                                                ? "No orders match your filters." 
                                                : "No completed orders."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        </div>

                    </div>
                )}
            </main>

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
        </div>
    );
};
