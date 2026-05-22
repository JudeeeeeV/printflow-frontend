// src/pages/NewOrderPage/NewOrderPage.tsx
import React, { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import { useNavigate } from 'react-router-dom';
import { ShopSelector } from '../../components/orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../../components/orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../../components/orders/OrderSummary/OrderSummary';
import { orderService, type PrintShop, type OrderEstimate } from '../../services/orderService';

export const NewOrderPage: React.FC = () => {
    const navigate = useNavigate();

    // Route Protection: Check for token on mount
    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            navigate('/auth');
        }
    }, [navigate]);

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
            { id: '1', name: 'TLBH Print Co.', rating: 4.8, status: 'OPEN' },
            { id: '2', name: 'Campus Graphics', rating: 4.5, status: 'BUSY' },
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
            await orderService.submitOrder(selectedShopId, 's3://temp-url');
            alert('Order placed successfully! State transitioned to OPEN_INQUIRY.');
            // Future: Redirect to a success page or dashboard
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            alert('Failed to submit order.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
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
                            <div className="mt-8 bg-gray-200 h-64 flex items-center justify-center overflow-hidden relative group">
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="bg-white text-black px-6 py-2 font-bold text-sm">Live Preview</button>
                                </div>
                                <span className="text-gray-500 font-bold">Document Preview Area</span>
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
        </div>
    );
};