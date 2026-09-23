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
import { apiClient } from '../../services/apiClient';
import printflowLogoDark from '../../assets/printflow-logo-dark.png';
import styles from './NewOrderPage.module.css';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const NewOrderPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab') as 'new' | 'orders' | 'drafts' | null;
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    const handleLogout = async () => {
        await apiClient('/auth/logout', { method: 'POST' }).catch(() => undefined);
        localStorage.removeItem('user_role');
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
    const uploadButtonRef = useRef<HTMLButtonElement>(null);
    const imagePreviewRef = useRef<HTMLImageElement>(null);
    const pdfPreviewRef = useRef<HTMLIFrameElement>(null);
    const shouldFocusUploadRef = useRef(false);

    const [paperSize, setPaperSize] = useState<string>('A4');
    const [printColorMode, setPrintColorMode] = useState<string>('BLACK_AND_WHITE');
    const [pageCount, setPageCount] = useState<number>(1);

    const [file, setFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>(null);
    const isFileValidated = validationResult?.passed === true;
    const canPreviewFile = !!file && isFileValidated && (file.type.startsWith('image/') || file.type === 'application/pdf');

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

    useEffect(() => {
        if (!file || !isFileValidated) return;

        const previewElement = file.type.startsWith('image/')
            ? imagePreviewRef.current
            : file.type === 'application/pdf'
                ? pdfPreviewRef.current
                : null;

        if (!previewElement) return;

        const objectUrl = URL.createObjectURL(file);
        previewElement.src = objectUrl;

        return () => {
            previewElement.removeAttribute('src');
            URL.revokeObjectURL(objectUrl);
        };
    }, [file, isFileValidated]);

    useEffect(() => {
        if (!file && shouldFocusUploadRef.current) {
            shouldFocusUploadRef.current = false;
            uploadButtonRef.current?.focus();
        }
    }, [file]);

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
            setValidationResult({
                passed: true,
                message: selectedFile.type === DOCX_MIME_TYPE
                    ? 'DOCX accepted. It will be converted, resized to the selected paper, and priced using its final page count.'
                    : 'Validation passed. The file will be resized to the selected paper and normalized to PDF.',
            });
            updateEstimate(selectedShopId, detectedSize, printColorMode, detectedPageCount);
        } catch (err) {
            setValidationResult({ passed: false, message: 'Validation Failed: Minimum 300 DPI required.' });
            setEstimate(null);
        } finally {
            setIsValidating(false);
        }
    };

    const handleRemoveFile = () => {
        if (isSubmitting) return;

        shouldFocusUploadRef.current = true;
        setFile(null);
        setValidationResult(null);
        setEstimate(null);
        setPageCount(1);
        setIsValidating(false);
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
        <div className="relative isolate min-h-screen overflow-x-clip bg-carbon-gray-10 font-sans text-carbon-gray-100">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[26rem] overflow-hidden sm:block">
                <div className="absolute inset-0 bg-gradient-to-b from-black to-carbon-gray-10" />
            </div>

            <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <header className="mb-6 border-x border-t border-gray-200 bg-white shadow-[0_12px_32px_rgba(22,22,22,0.08)] sm:mb-8">
                    <div className="relative isolate overflow-hidden bg-carbon-gray-100 px-5 py-6 text-white sm:px-8 sm:py-8">
                        <div aria-hidden="true" className={styles.ambientLayer}>
                            <span className={styles.glow} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleOne}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleTwo}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleThree}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleFour}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleFive}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleSix}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleSeven}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleEight}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleNine}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleTen}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleEleven}`} />
                            <span className={`${styles.floatingRectangle} ${styles.rectangleTwelve}`} />
                        </div>

                        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                            <div className="max-w-2xl">
                                <img
                                    src={printflowLogoDark}
                                    alt="PrintFlow Dashboard"
                                    width={1532}
                                    height={312}
                                    className="h-auto w-48 sm:w-56"
                                />
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
                                    Prepare your files, choose a print partner, and keep every order moving from one workspace.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <button
                                    onClick={() => setIsChangePasswordOpen(true)}
                                    className="flex min-h-11 items-center justify-center border border-white/30 bg-white/5 px-4 text-sm font-bold text-white transition-colors hover:border-white/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
                                >
                                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Account Settings
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="min-h-11 border-2 bg-carbon-blue-60 px-6 text-sm font-bold text-white transition-colors hover:border-white/70 hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>

                    <nav aria-label="Order workspace" className="overflow-x-auto border-b-4 border-carbon-blue-60 bg-white">
                        <div className="flex min-w-max">
                            <button
                                onClick={() => handleTabChange('new')}
                                className={`min-h-12 border-r border-gray-200 px-5 text-sm font-bold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60 sm:px-7 ${activeTab === 'new' ? 'bg-carbon-blue-60 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-carbon-gray-100'}`}
                            >
                                Create New Order
                            </button>
                            <button
                                onClick={() => handleTabChange('drafts')}
                                className={`min-h-12 border-r border-gray-200 px-5 text-sm font-bold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60 sm:px-7 ${activeTab === 'drafts' ? 'bg-carbon-blue-60 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-carbon-gray-100'}`}
                            >
                                Drafts
                            </button>
                            <button
                                onClick={() => handleTabChange('orders')}
                                className={`min-h-12 px-5 text-sm font-bold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60 sm:px-7 ${activeTab === 'orders' ? 'bg-carbon-blue-60 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-carbon-gray-100'}`}
                            >
                                My Orders
                            </button>
                        </div>
                    </nav>
                </header>

                <div key={activeTab} className="animate-slide-fade pb-10">
                {activeTab === 'new' && (
                    <div className="grid grid-cols-1 items-start gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <section className="min-w-0 border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
                            <div className="border-b border-gray-200 px-5 py-5 sm:px-7 lg:px-8">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-carbon-blue-60">Order builder</p>
                                    <h2 className="mt-1 text-2xl font-black tracking-tight text-carbon-gray-100">Create New Order</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                                        Select a shop first, then upload your print-ready work.
                                    </p>
                                </div>
                            </div>

                            <div className="p-5 sm:p-7 lg:p-8">
                                <div className="min-w-0">
                                    <div className="mb-5 flex items-center gap-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-carbon-blue-60 text-xs font-black text-white">01</span>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-black">Choose your print partner</p>
                                    </div>
                                    <div className="[&>div]:mb-0">
                                        <ShopSelector
                                            shops={shops}
                                            selectedShopId={selectedShopId}
                                            onSelect={setSelectedShopId}
                                        />
                                    </div>
                                </div>

                                <div
                                    className={`mt-8 scroll-mt-6 border-t border-gray-200 pt-8 transition-opacity duration-300 ${selectedShopId ? 'opacity-100' : 'pointer-events-none opacity-40'}`}
                                >
                                    <div className="mb-5 flex items-center gap-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-carbon-gray-100 text-xs font-black text-white">02</span>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-black">Upload your work</p>
                                    </div>
                                    <div className="[&>div]:mb-0">
                                        {file && isFileValidated ? (
                                            <div className="border border-[#8d8d8d] bg-carbon-gray-100 p-2 shadow-[0_8px_20px_rgba(22,22,22,0.12)] sm:p-3">
                                                <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/20 px-1 pb-3 text-white sm:px-2">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="h-2.5 w-2.5 shrink-0 bg-carbon-blue-60" />
                                                        <span className="truncate text-xs font-bold uppercase tracking-[0.16em]">File preview</span>
                                                    </div>
                                                    <span className="max-w-[55%] truncate text-xs text-gray-300" title={file.name}>{file.name}</span>
                                                </div>
                                                <div className="group relative mt-3 flex h-[340px] items-center justify-center overflow-hidden bg-gray-200 sm:h-[460px] lg:h-[560px]">
                                                    {file.type.startsWith('image/') ? (
                                                        <img ref={imagePreviewRef} alt={`Preview of ${file.name}`} className="h-full w-full object-contain" />
                                                    ) : file.type === 'application/pdf' ? (
                                                        <iframe ref={pdfPreviewRef} title={`Preview of ${file.name}`} className="h-full w-full border-none bg-white" />
                                                    ) : (
                                                        <span className="px-6 text-center font-bold text-gray-500">Preview not available for this file type</span>
                                                    )}
                                                    {canPreviewFile && (
                                                        <div className="pointer-events-none absolute right-3 top-3 opacity-100 transition-opacity group-hover:opacity-0 sm:right-4 sm:top-4">
                                                            <span className="border-l-4 border-carbon-blue-60 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-carbon-gray-100 shadow-md">Live Preview Active</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-3 border-t border-white/20 px-1 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                                                    <div className="flex min-w-0 items-start gap-2 text-xs font-semibold leading-relaxed text-gray-200" role="status">
                                                        <span className="mt-1 h-2 w-2 shrink-0 bg-green-500" />
                                                        <span>{validationResult.message}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveFile}
                                                        disabled={isSubmitting}
                                                        className="min-h-11 shrink-0 self-end bg-red-700 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:self-auto"
                                                    >
                                                        Remove file
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <FileUploadZone
                                                onFileSelect={handleFileSelect}
                                                isValidating={isValidating}
                                                validationResult={validationResult}
                                                uploadButtonRef={uploadButtonRef}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside className="min-w-0 self-stretch">
                            <div className="sticky top-6 border border-black">
                                <div className="border-b-4 border-carbon-blue-60 bg-carbon-gray-100 px-5 py-4 text-white">
                                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#87B0FE]">Final step</p>
                                    <p className="mt-1 text-sm text-gray-300">Review the details and submit when everything looks right.</p>
                                </div>
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
                        </aside>
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div className="mx-auto max-w-7xl">
                        <MyOrdersList />
                    </div>
                )}

                {activeTab === 'drafts' && !editingDraft && (
                    <div className="mx-auto max-w-7xl border border-black bg-white p-5 shadow-[0_8px_24px_rgba(22,22,22,0.06)] sm:p-7 lg:p-8">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-carbon-blue-60">Saved work</p>
                        <h2 className="mb-6 text-2xl font-black tracking-tight text-carbon-gray-100">My Drafts</h2>
                        <MyDraftsList onEditDraft={setEditingDraft} />
                    </div>
                )}

                {activeTab === 'drafts' && editingDraft && (
                    <div className="mx-auto max-w-7xl">
                        <EditDraftPanel
                            draft={editingDraft}
                            shops={shops}
                            onCancel={() => setEditingDraft(null)}
                            onSuccess={(orderId) => {
                                setEditingDraft(null);
                                navigate(`/checkout/${orderId}`);
                            }}
                        />
                    </div>
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
        </div>
    );
};
