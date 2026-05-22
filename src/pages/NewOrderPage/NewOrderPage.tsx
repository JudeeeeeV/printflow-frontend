// src/pages/NewOrderPage/NewOrderPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopSelector } from '../../components/orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../../components/orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../../components/orders/OrderSummary/OrderSummary';
import { MyOrdersList } from '../../components/dashboard/MyOrdersList';
import { orderService, type PrintShop, type OrderEstimate } from '../../services/orderService';

export const NewOrderPage: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        navigate('/auth');
    };

    const [activeTab, setActiveTab] = useState<'new' | 'orders'>('new');
    const [shops, setShops] = useState<PrintShop[]>([]);
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>(null);

    const [estimate, setEstimate] = useState<OrderEstimate | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock initial fetch for print shops
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShops([
            { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'TLBH Print Co.', rating: 4.8, status: 'OPEN' },
            { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Campus Graphics', rating: 4.5, status: 'BUSY' },
        ]);
    }, []);

    const handleFileSelect = async (selectedFile: File) => {
        if (!selectedShopId) {
            alert('Please select a print shop first.');
            return;
        }

        setFile(selectedFile);
        setIsValidating(true);
        setValidationResult(null);

        try {
            // In production, this calls orderService.validateAsset()
            await new Promise(resolve => setTimeout(resolve, 1500));

            setValidationResult({ passed: true, message: 'Validation Passed: 300 DPI, CMYK' });
            setEstimate({ total: 15.00, rushFee: 3.00, estimatedDelivery: 'Tomorrow, 2PM' });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            setValidationResult({ passed: false, message: 'Validation Failed: Minimum 300 DPI required.' });
            setEstimate(null);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSubmitOrder = async () => {
        if (!selectedShopId || !file || !validationResult?.passed) return;

        setIsSubmitting(true);
        try {
            const response = await orderService.submitOrder(selectedShopId, 'https://mockstorage.com/temp-url.pdf');
            // navigate to checkout page with orderId
            navigate(`/checkout/${response.orderId}`);
        } catch (err: any) {
            alert(`Failed to submit order: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-end mb-8 border-b border-gray-200 pb-0">
                <div>
                    <h1 className="text-3xl font-black text-black tracking-tight mt-2">PrintFlow Dashboard</h1>
                    <div className="flex space-x-8 mt-6">
                        <button 
                            onClick={() => setActiveTab('new')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'new' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
                        >
                            Create New Order
                        </button>
                        <button 
                            onClick={() => setActiveTab('orders')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'orders' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
                        >
                            My Orders
                        </button>
                    </div>
                </div>
                <button 
                    onClick={handleLogout}
                    className="bg-white border-2 border-black text-black font-bold py-2 px-6 hover:bg-gray-100 transition-colors mb-4 md:mb-2"
                >
                    Logout
                </button>
            </div>
            
            <div key={activeTab} className="animate-slide-fade">
                {activeTab === 'new' ? (
                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 shadow-sm border border-gray-100">
                            <ShopSelector
                                shops={shops}
                                selectedShopId={selectedShopId}
                                onSelect={setSelectedShopId}
                            />

                            <div className={`transition-opacity duration-300 ${selectedShopId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <FileUploadZone
                                    onFileSelect={handleFileSelect}
                                    isValidating={isValidating}
                                    validationResult={validationResult}
                                />
                            </div>

                            {file && validationResult?.passed && (
                                <div className="mt-8 bg-gray-200 h-[500px] flex items-center justify-center overflow-hidden relative group border border-gray-300">
                                    {file.type.startsWith('image/') ? (
                                        <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-contain" />
                                    ) : file.type === 'application/pdf' ? (
                                        <iframe src={URL.createObjectURL(file)} title="PDF Preview" className="w-full h-full border-none" />
                                    ) : (
                                        <span className="text-gray-500 font-bold">Preview not available for this file type</span>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                                        <span className="bg-white text-black px-6 py-2 font-bold text-sm rounded">Live Preview Active</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-10 h-[500px]">
                            <OrderSummary
                                estimate={estimate}
                                isSubmitting={isSubmitting}
                                onSubmit={handleSubmitOrder}
                                isReady={!!selectedShopId && !!validationResult?.passed}
                            />
                        </div>
                    </div>

                </div>
                ) : (
                    <MyOrdersList />
                )}
            </div>
        </div>
    );
};