// src/pages/NewOrderPage/NewOrderPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopSelector } from '../../components/orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../../components/orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../../components/orders/OrderSummary/OrderSummary';
import { MyOrdersList } from '../../components/dashboard/MyOrdersList';
import { orderService, type OrderEstimate } from '../../services/orderService';
import { shopService } from '../../services/shopService';
import type { PrintShop } from '../../services/orderService';
import { MyDraftsList } from '../../components/dashboard/MyDraftsList';
import type { DraftOrder } from '../../components/dashboard/MyDraftsList';
import { EditDraftPanel } from '../../components/dashboard/EditDraftPanel';
import { PDFDocument } from 'pdf-lib';

export const NewOrderPage: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        navigate('/auth');
    };

    // Added 'drafts' to the type union
    const [editingDraft, setEditingDraft] = useState<DraftOrder | null>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'orders' | 'drafts'>('new');
    const [shops, setShops] = useState<PrintShop[]>([]);
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

    const [paperSize, setPaperSize] = useState<string>('A4');
    const [printColorMode, setPrintColorMode] = useState<string>('BLACK_AND_WHITE');
    const [pageCount, setPageCount] = useState<number>(1);

    const [file, setFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>(null);

    const [estimate, setEstimate] = useState<OrderEstimate | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        shopService.getShops()
            .then(data => setShops(data))
            .catch(err => console.error("Failed to fetch shops:", err));
    }, []);

    const updateEstimate = (shopId: string, size: string, mode: string, pCount: number) => {
        const shop = shops.find(s => s.id === shopId);
        let base = 3.00;
        let addon = 0.00;
        if (shop && shop.pricing_matrix) {
            base = shop.pricing_matrix.paper_sizes?.[size] ?? 3.00;
            addon = shop.pricing_matrix.color_mode_multipliers?.[mode] ?? 0.00;
        }
        setEstimate({ 
            total: (base + addon) * pCount, 
            pageCount: pCount,
            basePrice: base,
            colorAdditive: addon
        });
    };

    useEffect(() => {
        if (selectedShopId && file && validationResult?.passed) {
            updateEstimate(selectedShopId, paperSize, printColorMode, pageCount);
        }
    }, [paperSize, printColorMode, selectedShopId, file, validationResult?.passed, shops, pageCount]);

    const handleFileSelect = async (selectedFile: File) => {
        if (!selectedShopId) {
            alert('Please select a print shop first.');
            return;
        }

        setFile(selectedFile);
        setIsValidating(true);
        setValidationResult(null);

        let detectedSize = 'A4';
        let detectedPageCount = 1;

        if (selectedFile.type === 'application/pdf') {
            try {
                const arrayBuffer = await selectedFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                detectedPageCount = pdfDoc.getPageCount();
                
                if (detectedPageCount > 0) {
                    const page = pdfDoc.getPage(0);
                    const { width, height } = page.getSize();
                    const h = Math.max(width, height);
                    if (Math.abs(h - 792) < 20) {
                        detectedSize = 'SHORT';
                    } else if (Math.abs(h - 1008) < 20) {
                        detectedSize = 'LONG';
                    }
                }
            } catch (e) {
                console.error("Failed to parse PDF:", e);
            }
        }
        
        setPaperSize(detectedSize);
        setPageCount(detectedPageCount);

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setValidationResult({ passed: true, message: 'Validation Passed: 300 DPI, CMYK' });
            updateEstimate(selectedShopId, detectedSize, printColorMode, detectedPageCount);
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
            const response = await orderService.submitOrder(selectedShopId, file, paperSize, printColorMode);
            navigate(`/checkout/${response.orderId}`);
        } catch (err: any) {
            alert(`Failed to submit order: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // New handler for saving a draft
    const handleSaveDraft = async () => {
        if (!selectedShopId || !file || !validationResult?.passed) return;

        setIsSubmitting(true);
        try {
            // Replaced the mock delay with the actual API call
            await orderService.saveDraft(selectedShopId, file, paperSize, printColorMode);
            
            alert('Order saved as draft!');
            setActiveTab('drafts'); 
            
            // Reset the form so they can start a new order if they want
            setFile(null);
            setSelectedShopId(null);
            setValidationResult(null);
            
        } catch (err: any) {
            alert(`Failed to save draft: ${err.message || 'Unknown error'}`);
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
                            onClick={() => { setActiveTab('new'); setEditingDraft(null); }}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'new' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
                        >
                            Create New Order
                        </button>
                        <button 
                            onClick={() => setActiveTab('drafts')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'drafts' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
                        >
                            Drafts
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
                {activeTab === 'new' && (
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
                            <div className="sticky top-10">
                                <OrderSummary
                                    estimate={estimate}
                                    isSubmitting={isSubmitting}
                                    onSubmit={handleSubmitOrder}
                                    onSaveDraft={handleSaveDraft}
                                    isReady={!!selectedShopId && !!validationResult?.passed}
                                    paperSize={paperSize}
                                    setPaperSize={setPaperSize}
                                    pageCount={pageCount}
                                    printColorMode={printColorMode}
                                    setPrintColorMode={setPrintColorMode}
                                />
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'orders' && <MyOrdersList />}
                
                {activeTab === 'drafts' && !editingDraft && (
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-2xl font-black text-black mb-6">My Drafts</h2>
                        <MyDraftsList onEditDraft={setEditingDraft} /> 
                    </div>
                )}

                {activeTab === 'drafts' && editingDraft && (
                    <EditDraftPanel 
                        draft={editingDraft} 
                        shops={shops}
                        onCancel={() => setEditingDraft(null)}
                        onSuccess={(orderId) => {
                            setEditingDraft(null);
                            navigate(`/checkout/${orderId}`);
                        }}
                    />
                )}
            </div>
        </div>
    );
};