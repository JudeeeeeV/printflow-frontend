import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shopService } from '../../services/shopService';
import { orderService } from '../../services/orderService';
import { OrderCard } from '../../components/dashboard/OrderCard';
import { PaymentReviewPanel } from '../../components/dashboard/PaymentReviewPanel';
import { AnimatePresence } from 'framer-motion';

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

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        navigate('/auth');
    };

    const handleUploadPermit = async () => {
        if (!permitFile) return;
        setIsUploading(true);
        setUploadError(null);
        try {
            await shopService.verifyPermit(permitFile);
            loadShopData();
        } catch (err: any) {
            setUploadError(err.message || 'Failed to submit business permit.');
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

    const handleBatchComplete = async () => {
        if (selectedReadyOrders.length === 0) return;
        if (!window.confirm(`Are you sure you want to mark ${selectedReadyOrders.length} orders as Completed?`)) return;

        setIsBatchProcessing(true);
        try {
            // Note: In a real app we'd want a batch API endpoint.
            // For now, we simulate a fast loop.
            await Promise.all(selectedReadyOrders.map(() => 
                 // Assuming we don't have an endpoint, we just mock update in UI
                 // Actually, we don't have update state endpoint for clerk yet in orderService?
                 // Wait, we don't have a transition endpoint. Let's just alert for now.
                 new Promise(resolve => setTimeout(resolve, 500))
            ));
            alert('Batch processing complete! (Mocked)');
            setSelectedReadyOrders([]);
            loadShopData();
        } catch (err: any) {
            alert('Batch error: ' + err.message);
        } finally {
            setIsBatchProcessing(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center font-sans">Loading dashboard...</div>;
    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="text-red-500 mb-4 text-xl font-bold">Error</div>
            <p className="mb-4 text-gray-700">{error}</p>
            <button onClick={handleLogout} className="px-6 py-2 bg-black text-white font-bold">Logout</button>
        </div>
    );

    const { name, verification_status } = shopData;

    // Derived Kanban Data
    // New Orders: Pending review, approved proof, awaiting payment, or just open inquiry
    const newOrders = shopOrders
        .filter(o => ['OPEN_INQUIRY', 'PROOF_APPROVED', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION'].includes(o.state))
        .sort((a, b) => {
            // Put AWAITING_PAYMENT_VERIFICATION at the very top
            if (a.state === 'AWAITING_PAYMENT_VERIFICATION' && b.state !== 'AWAITING_PAYMENT_VERIFICATION') return -1;
            if (b.state === 'AWAITING_PAYMENT_VERIFICATION' && a.state !== 'AWAITING_PAYMENT_VERIFICATION') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    const printReadyOrders = shopOrders
        .filter(o => ['IN_PRODUCTION'].includes(o.state))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const completedOrders = shopOrders
        .filter(o => ['READY_FOR_PICKUP', 'COMPLETED'].includes(o.state))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


    return (
        <div className="h-screen bg-gray-50 font-sans flex flex-col overflow-hidden">
            <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center shrink-0 z-10 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-black">Print Shop Dashboard</h1>
                    <p className="text-sm font-medium text-gray-500">{name}</p>
                </div>
                <button onClick={handleLogout} className="border-2 border-black text-black px-4 py-2 font-bold hover:bg-gray-100 transition-colors">
                    Logout
                </button>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden">
                {verification_status !== 'VERIFIED' && verification_status !== 'OPEN' ? (
                    // Unverified State (Unchanged structure, placed in center)
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white border border-gray-200 p-8 flex flex-col items-center justify-center mt-10 rounded-sm shadow-sm max-w-2xl mx-auto w-full">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Shop Verification Required</h2>
                            <p className="text-gray-600 max-w-md text-center mb-8">
                                Your shop is currently unverified. Please submit your official business permit.
                            </p>
                            <div className="w-full bg-gray-50 border border-gray-200 p-6 rounded-sm mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Upload Business Permit (Image/PDF)</label>
                                <input
                                    type="file" accept="image/*,application/pdf"
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 mb-4"
                                    onChange={(e) => setPermitFile(e.target.files?.[0] || null)}
                                    disabled={isUploading}
                                />
                                {uploadError && <p className="text-red-500 font-bold text-sm mb-4">{uploadError}</p>}
                                <button onClick={handleUploadPermit} disabled={!permitFile || isUploading} className={`w-full py-3 font-bold text-white transition-colors ${!permitFile || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}>
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
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
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
                                            onClick={() => order.state === 'AWAITING_PAYMENT_VERIFICATION' ? setSelectedPaymentOrder(order) : null} 
                                        />
                                    ))}
                                </AnimatePresence>
                                {newOrders.length === 0 && (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-gray-400 font-medium">No new orders.</p>
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
                                <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm z-10">
                                    <label className="flex items-center text-sm font-bold text-gray-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="mr-2 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            checked={selectedReadyOrders.length === printReadyOrders.length && printReadyOrders.length > 0}
                                            onChange={handleSelectAllReady}
                                        />
                                        Select All
                                    </label>
                                    <button 
                                        onClick={handleBatchComplete}
                                        disabled={selectedReadyOrders.length === 0 || isBatchProcessing}
                                        className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        Batch Complete ({selectedReadyOrders.length})
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <AnimatePresence>
                                    {printReadyOrders.map(order => (
                                        <div key={order.id} className="relative group">
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    checked={selectedReadyOrders.includes(order.id)}
                                                    onChange={() => handleToggleReadySelection(order.id)}
                                                />
                                            </div>
                                            <div className={`transition-transform ${selectedReadyOrders.includes(order.id) ? 'pl-8 opacity-90 scale-[0.98]' : 'group-hover:pl-8'}`}>
                                                <OrderCard order={order} onClick={() => handleToggleReadySelection(order.id)} />
                                            </div>
                                        </div>
                                    ))}
                                </AnimatePresence>
                                {printReadyOrders.length === 0 && (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-gray-400 font-medium">No orders in production.</p>
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
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-gray-400 font-medium">No completed orders.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        </div>

                    </div>
                )}
            </main>

            {/* Render Slide-Over Panel */}
            <PaymentReviewPanel
                isOpen={!!selectedPaymentOrder}
                order={selectedPaymentOrder}
                onClose={() => setSelectedPaymentOrder(null)}
                onVerify={handleVerifyPayment}
                isVerifying={isVerifying}
            />
        </div>
    );
};
