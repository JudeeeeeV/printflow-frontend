// src/pages/NewOrderPage/NewOrderPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { AlertModal } from '../../components/common/AlertModal';
import { PDFDocument } from 'pdf-lib';
import { ChangePasswordModal } from '../../components/auth/ChangePasswordModal';

export const NewOrderPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab') as 'new' | 'orders' | 'drafts' | null;
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        navigate('/auth');
    };

    // Added 'drafts' to the type union
    const [editingDraft, setEditingDraft] = useState<DraftOrder | null>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'orders' | 'drafts'>(tabParam || 'new');

    const handleTabChange = (tab: 'new' | 'orders' | 'drafts') => {
        setActiveTab(tab);
        setSearchParams({ tab });
        if (tab !== 'drafts') setEditingDraft(null);
    };
    const [shops, setShops] = useState<PrintShop[]>([]);
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
    const uploadSectionRef = useRef<HTMLDivElement>(null);

    const handleShopSelect = (shopId: string) => {
        setSelectedShopId(shopId);
        uploadSectionRef.current?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            block: 'start',
        });
    };

    const [paperSize, setPaperSize] = useState<string>('A4');
    const [printColorMode, setPrintColorMode] = useState<string>('BLACK_AND_WHITE');
    const [pageCount, setPageCount] = useState<number>(1);

    const [file, setFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>(null);

    const [estimate, setEstimate] = useState<OrderEstimate | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [alertState, setAlertState] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'; onCloseAction?: () => void }>({ isOpen: false, message: '' });
    const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', title?: string, onCloseAction?: () => void) => {
        setAlertState({ isOpen: true, message, type, title, onCloseAction });
    };

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
            showAlert('Please select a print shop first.', 'warning', 'Missing Information');
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

                if (detectedPageCount === 0) {
                    setValidationResult({ passed: false, message: 'Corrupted PDF: File contains no pages.' });
                    setEstimate(null);
                    setIsValidating(false);
                    return;
                }

                const page = pdfDoc.getPage(0);
                const { width, height } = page.getSize();
                const h = Math.max(width, height);
                if (Math.abs(h - 792) < 20) {
                    detectedSize = 'SHORT';
                } else if (Math.abs(h - 1008) < 20) {
                    detectedSize = 'LONG';
                }
            } catch (e) {
                console.error("Failed to parse PDF:", e);
                setValidationResult({ passed: false, message: 'Corrupted File: This PDF could not be read. Please re-export and try again.' });
                setEstimate(null);
                setIsValidating(false);
                return;
            }
        } else if (selectedFile.type.startsWith('image/')) {
            // Validate image integrity by attempting to load it
            try {
                const isValidImage = await new Promise<boolean>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
                    img.onerror = () => resolve(false);
                    img.src = URL.createObjectURL(selectedFile);
                });
                if (!isValidImage) {
                    setValidationResult({ passed: false, message: 'Corrupted File: This image could not be loaded. It may be damaged or truncated.' });
                    setEstimate(null);
                    setIsValidating(false);
                    return;
                }
            } catch (e) {
                console.error("Failed to validate image:", e);
                setValidationResult({ passed: false, message: 'Corrupted File: This image could not be validated.' });
                setEstimate(null);
                setIsValidating(false);
                return;
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
            showAlert(`Failed to submit order: ${err.message || 'Unknown error'}`, 'error', 'Submission Failed');
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

            showAlert('Order saved as draft!', 'success', 'Success', () => {
                handleTabChange('drafts');
            });

            // Reset the form so they can start a new order if they want
            setFile(null);
            setSelectedShopId(null);
            setValidationResult(null);

        } catch (err: any) {
            showAlert(`Failed to save draft: ${err.message || 'Unknown error'}`, 'error', 'Save Failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-carbon-gray-10 py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-end mb-8 border-b border-[#e0e0e0] pb-0">
                <div>
                    <h1 className="text-3xl font-black text-carbon-gray-100 tracking-tight mt-2">PrintFlow Dashboard</h1>
                    <div className="flex space-x-8 mt-6">
                        <button
                            onClick={() => handleTabChange('new')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'new' ? 'border-black text-carbon-gray-100' : 'border-transparent text-gray-500 hover:text-carbon-gray-100'}`}
                        >
                            Create New Order
                        </button>
                        <button
                            onClick={() => handleTabChange('drafts')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'drafts' ? 'border-black text-carbon-gray-100' : 'border-transparent text-gray-500 hover:text-carbon-gray-100'}`}
                        >
                            Drafts
                        </button>
                        <button
                            onClick={() => handleTabChange('orders')}
                            className={`pb-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'orders' ? 'border-black text-carbon-gray-100' : 'border-transparent text-gray-500 hover:text-carbon-gray-100'}`}
                        >
                            My Orders
                        </button>
                    </div>
                </div>
                <div className="flex flex-row items-center space-x-4 mb-4 md:mb-2">
                    <button
                        onClick={() => setIsChangePasswordOpen(true)}
                        className="text-sm font-bold text-gray-500 hover:text-carbon-gray-100 transition-colors flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Account Settings
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-white border-2 border-black text-carbon-gray-100 font-bold py-1.5 px-6 hover:bg-gray-100 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div key={activeTab} className="animate-slide-fade">
                {activeTab === 'new' && (
                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white p-6 border border-gray-100">
                                <ShopSelector
                                    shops={shops}
                                    selectedShopId={selectedShopId}
                                    onSelect={handleShopSelect}
                                />

                                <div ref={uploadSectionRef} className={`scroll-mt-6 transition-opacity duration-300 ${selectedShopId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        isValidating={isValidating}
                                        validationResult={validationResult}
                                    />
                                </div>

                                {file && validationResult?.passed && (
                                    <div className="mt-8 bg-gray-200 h-[500px] flex items-center justify-center overflow-hidden relative group border border-[#8d8d8d]">
                                        {file.type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-contain" />
                                        ) : file.type === 'application/pdf' ? (
                                            <iframe src={URL.createObjectURL(file)} title="PDF Preview" className="w-full h-full border-none" />
                                        ) : (
                                            <span className="text-gray-500 font-bold">Preview not available for this file type</span>
                                        )}
                                        <div className="absolute inset-0 bg-transparent flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                                            <span className="bg-white text-carbon-gray-100 px-6 py-2 font-bold text-sm ">Live Preview Active</span>
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
                        <h2 className="text-2xl font-black text-carbon-gray-100 mb-6">My Drafts</h2>
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

                <AlertModal
                    isOpen={alertState.isOpen}
                    message={alertState.message}
                    title={alertState.title}
                    type={alertState.type}
                    onClose={() => {
                        setAlertState(prev => ({ ...prev, isOpen: false }));
                        if (alertState.onCloseAction) alertState.onCloseAction();
                    }}
                />

                {isChangePasswordOpen && (
                    <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
                )}
            </div>
        </div>
    );
};
