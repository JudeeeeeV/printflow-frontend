import React, { useRef, useState } from 'react';
import { ArrowLeft, Document } from '@carbon/icons-react';
import { ShopSelector } from '../orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../orders/OrderSummary/OrderSummary';
import { AlertModal } from '../common/AlertModal';
import { orderService } from '../../services/orderService';
import type { PrintShop, OrderEstimate } from '../../services/orderService';
import type { DraftOrder } from './MyDraftsList';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type PreviewKind = 'image' | 'pdf' | 'document';

const getPreviewKind = (fileName: string, mimeType = ''): PreviewKind => {
 const nameWithoutQuery = fileName.split(/[?#]/)[0];
 if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(nameWithoutQuery)) return 'image';
 if (mimeType === 'application/pdf' || /\.pdf$/i.test(nameWithoutQuery)) return 'pdf';
 return 'document';
};

interface EditDraftPanelProps {
 draft: DraftOrder;
 shops: PrintShop[];
 onCancel: () => void;
 onSuccess: (orderId: string) => void;
}

export const EditDraftPanel: React.FC<EditDraftPanelProps> = ({ draft, shops, onCancel, onSuccess }) => {
 const [selectedShopId, setSelectedShopId] = useState<string | null>(draft.shopId);
 const [newFile, setNewFile] = useState<File | null>(null);
 const [hasFile, setHasFile] = useState(true);
 const [isValidating, setIsValidating] = useState(false);
 const [paperSize, setPaperSize] = useState<string>(draft.paperSize || 'A4');
 const [printColorMode, setPrintColorMode] = useState<string>(draft.printColorMode || 'BLACK_AND_WHITE');
 const [pageCount, setPageCount] = useState<number>(draft.pageCount || 1);
 const [orderName, setOrderName] = useState(draft.orderName || '');
 const [orientation, setOrientation] = useState(draft.orientation || 'PORTRAIT');
 const [copies, setCopies] = useState(draft.copies || 1);

 // Pre-fill validation so they can submit immediately without uploading a new file
 const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>({
 passed: true, message: 'Valid file loaded from draft'
 });
 const [isSubmitting, setIsSubmitting] = useState(false);

 const uploadButtonRef = useRef<HTMLButtonElement>(null);
 const replacementImageRef = useRef<HTMLImageElement>(null);
 const replacementPdfRef = useRef<HTMLIFrameElement>(null);
 const shouldFocusUploadRef = useRef(false);

 const [alertState, setAlertState] = useState<{
 isOpen: boolean;
 title?: string;
 message: string;
 type?: 'info' | 'success' | 'error' | 'warning';
 onCloseAction?: () => void;
 }>({ isOpen: false, message: '' });
 const showAlert = (
 message: string,
 type: 'info' | 'success' | 'error' | 'warning' = 'info',
 title?: string,
 onCloseAction?: () => void,
 ) => {
 setAlertState({ isOpen: true, message, type, title, onCloseAction });
 };

 const estimate = React.useMemo<OrderEstimate | null>(() => {
 if (!selectedShopId || !hasFile || !validationResult?.passed) return null;

 const shop = shops.find(candidate => candidate.id === selectedShopId);
 let base = 3.00;
 let addon = 0.00;
 if (shop?.pricing_matrix) {
 base = shop.pricing_matrix.paper_sizes?.[paperSize] ?? 3.00;
 addon = shop.pricing_matrix.color_mode_multipliers?.[printColorMode] ?? 0.00;
 }

 return {
 total: (base + addon) * pageCount * copies,
 pageCount,
 basePrice: base,
 colorAdditive: addon,
 };
 }, [copies, hasFile, pageCount, paperSize, printColorMode, selectedShopId, shops, validationResult?.passed]);

 const replacementPreviewKind = newFile ? getPreviewKind(newFile.name, newFile.type) : 'document';
 const isFileValidated = hasFile && validationResult?.passed === true;
 const storedUrlPreviewKind = getPreviewKind(draft.fileUrl);
 const originalPreviewKind = storedUrlPreviewKind !== 'document' ? storedUrlPreviewKind : getPreviewKind(draft.fileName);
 const canPreviewFile = isFileValidated && (newFile ? replacementPreviewKind !== 'document' : originalPreviewKind !== 'document');
 const shopChangedWithoutReplacement = selectedShopId !== draft.shopId && !newFile;

 React.useEffect(() => {
 if (!newFile || !isFileValidated) return;

 const previewElement = replacementPreviewKind === 'image'
 ? replacementImageRef.current
 : replacementPreviewKind === 'pdf'
 ? replacementPdfRef.current
 : null;

 if (!previewElement) return;

 const objectUrl = URL.createObjectURL(newFile);
 previewElement.src = objectUrl;

 return () => {
 previewElement.removeAttribute('src');
 URL.revokeObjectURL(objectUrl);
 };
 }, [isFileValidated, newFile, replacementPreviewKind]);

 React.useEffect(() => {
 if (!hasFile && !newFile && shouldFocusUploadRef.current) {
 shouldFocusUploadRef.current = false;
 uploadButtonRef.current?.focus();
 }
 }, [hasFile, newFile]);

 const handleFileSelect = async (selectedFile: File) => {
 setNewFile(selectedFile);
 setHasFile(false);
 setIsValidating(true);
 setValidationResult(null);

 let detectedPageCount = 1;

 if (selectedFile.type === 'application/pdf') {
 try {
 const { PDFDocument } = await import('pdf-lib');
 const arrayBuffer = await selectedFile.arrayBuffer();
 const pdfDoc = await PDFDocument.load(arrayBuffer);
 detectedPageCount = pdfDoc.getPageCount();
 if (detectedPageCount === 0) {
 setValidationResult({ passed: false, message: 'Corrupted PDF: File contains no pages.' });
 setIsValidating(false);
 return;
 }
 } catch (error) {
 console.error('Failed to parse PDF:', error);
 setValidationResult({ passed: false, message: 'Corrupted File: This PDF could not be read. Please re-export and try again.' });
 setIsValidating(false);
 return;
 }
 } else if (selectedFile.type.startsWith('image/')) {
 const validationUrl = URL.createObjectURL(selectedFile);
 try {
 const isValid = await new Promise<boolean>((resolve) => {
 const image = new Image();
 image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
 image.onerror = () => resolve(false);
 image.src = validationUrl;
 });
 if (!isValid) {
 setValidationResult({ passed: false, message: 'Corrupted File: This image could not be loaded. It may be damaged or truncated.' });
 setIsValidating(false);
 return;
 }
 } catch {
 setValidationResult({ passed: false, message: 'Corrupted File: This image could not be validated.' });
 setIsValidating(false);
 return;
 } finally {
 URL.revokeObjectURL(validationUrl);
 }
 }

 setPageCount(detectedPageCount);

 try {
 await new Promise(resolve => setTimeout(resolve, 1500));
 setValidationResult({
 passed: true,
 message: selectedFile.type === DOCX_MIME_TYPE
 ? 'DOCX accepted. It will be converted, resized to the selected paper, and priced using its final page count.'
 : 'Validation passed. The file will be resized to the selected paper and normalized to PDF.',
 });
 setHasFile(true);
 } catch {
 setValidationResult({ passed: false, message: 'Validation Failed: Minimum 300 DPI required.' });
 } finally {
 setIsValidating(false);
 }
 };

 const handleRemoveFile = () => {
 if (isSubmitting) return;

 shouldFocusUploadRef.current = true;
 setNewFile(null);
 setHasFile(false);
 setPageCount(1);
 setValidationResult(null);
 setIsValidating(false);
 };

 const handleSubmitOrder = async () => {
 if (!selectedShopId || !isFileValidated || !orderName.trim()) return;

 // SAFEGUARD: Prevent corrupted orders if they change shops but don't re-upload
 if (selectedShopId !== draft.shopId && !newFile) {
 showAlert('You changed the Print Shop. Please re-upload your design file to validate it against this shop.', 'warning', 'Re-upload Required');
 return;
 }

 setIsSubmitting(true);
 try {
 if (newFile) {
 // They uploaded a new file! Create a brand new order, delete the old draft.
 const response = await orderService.submitOrder(selectedShopId, newFile, paperSize, printColorMode, orderName, orientation, copies);
 await orderService.deleteDraft(draft.id);
 onSuccess(response.orderId);
 } else {
 // They changed settings but didn't upload a new file, update draft first then submit.
 if (estimate) {
 await orderService.updateDraftWithoutFile(draft.id, selectedShopId, paperSize, printColorMode, orderName, orientation, copies);
 }
 await orderService.submitDraft(draft.id);
 onSuccess(draft.id);
 }
 } catch (error: unknown) {
 const message = error instanceof Error ? error.message : 'Unknown error';
 showAlert(`Failed to submit: ${message}`, 'error', 'Submission Failed');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleSaveDraftChanges = async () => {
 if (!selectedShopId || !isFileValidated || !orderName.trim()) return;

 if (selectedShopId !== draft.shopId && !newFile) {
 showAlert('You changed the Print Shop. Please re-upload your design file to save.', 'warning', 'Re-upload Required');
 return;
 }

 setIsSubmitting(true);
 try {
 if (newFile) {
 await orderService.saveDraft(selectedShopId, newFile, paperSize, printColorMode, orderName, orientation, copies);
 await orderService.deleteDraft(draft.id);
 showAlert('Draft updated successfully!', 'success', 'Success', () => onCancel());
 } else {
 if (estimate) {
 await orderService.updateDraftWithoutFile(draft.id, selectedShopId, paperSize, printColorMode, orderName, orientation, copies);
 showAlert('Draft updated successfully!', 'success', 'Success', () => onCancel());
 } else {
 showAlert('No changes were made to the draft.', 'info', 'No Changes', () => onCancel());
 }
 }
 } catch (error: unknown) {
 const message = error instanceof Error ? error.message : 'Unknown error';
 showAlert(`Failed to save draft: ${message}`, 'error', 'Save Failed');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="mx-auto max-w-7xl animate-slide-fade">
 <div className="mb-6">
 <button
 type="button"
 onClick={onCancel}
 className="inline-flex min-h-11 items-center justify-center gap-2 border border-carbon-gray-100 bg-carbon-gray-100 px-4 text-sm font-bold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
 >
 <ArrowLeft className="h-5 w-5" aria-hidden="true" />
 Back to drafts
 </button>
 </div>

 <div className="grid grid-cols-1 items-start gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
 <section className="min-w-0 border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
 <div className="border-b border-gray-200 px-5 py-5 sm:px-7 lg:px-8">
 <p className="text-xs font-bold uppercase tracking-[0.2em] text-carbon-blue-60">Draft details</p>
 <h3 className="mt-1 text-xl font-black tracking-tight text-carbon-gray-100">Update your order</h3>
 <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
 Your current choices remain selected until you replace or update them.
 </p>
 </div>

 <div className="p-5 sm:p-7 lg:p-8">
 <div className="mb-5 flex items-center gap-3">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-carbon-blue-60 text-xs font-black text-white">01</span>
 <p className="text-xs font-bold uppercase tracking-[0.18em] text-black">Confirm your print partner</p>
 </div>
 <div className="[&>div]:mb-0">
 <ShopSelector shops={shops} selectedShopId={selectedShopId} onSelect={setSelectedShopId} />
 </div>

 <div className="mt-8 border-t border-gray-200 pt-8">
 <div className="mb-5 flex items-center gap-3">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-carbon-gray-100 text-xs font-black text-white">02</span>
 <div>
 <p className="text-xs font-bold uppercase tracking-[0.18em] text-black">Review your design file</p>
 <p className="mt-1 text-sm text-gray-600">{hasFile ? 'Remove this file to upload another.' : 'Upload a design file to continue.'}</p>
 </div>
 </div>

 {!isFileValidated ? (
 <div className="[&>div]:mb-0">
 <FileUploadZone
 onFileSelect={handleFileSelect}
 isValidating={isValidating}
 validationResult={validationResult}
 uploadButtonRef={uploadButtonRef}
 />
 </div>
 ) : (
 <div className="border border-[#8d8d8d] bg-carbon-gray-100 p-2 shadow-[0_8px_20px_rgba(22,22,22,0.12)] sm:p-3">
 <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/20 px-1 pb-3 text-white sm:px-2">
 <div className="flex min-w-0 items-center gap-3">
 <span className="h-2.5 w-2.5 shrink-0 bg-carbon-blue-60" />
 <span className="text-xs font-bold uppercase tracking-[0.16em]">
 Uploaded file preview
 </span>
 </div>
 <span className="max-w-[55%] truncate text-xs text-gray-300" title={newFile?.name || draft.fileName}>
 {newFile?.name || draft.fileName}
 </span>
 </div>
 <p className="mt-2 px-1 text-xs text-gray-300 sm:px-2">Printing uses the selected paper size and orientation.</p>

 <div className="group relative mt-3 flex h-[340px] items-center justify-center overflow-hidden bg-gray-200 sm:h-[460px] lg:h-[560px]">
 {newFile ? (
 replacementPreviewKind === 'image' ? (
 <img ref={replacementImageRef} alt={`Preview of ${newFile.name}`} className="h-full w-full object-contain" />
 ) : replacementPreviewKind === 'pdf' ? (
 <iframe ref={replacementPdfRef} title={`Preview of ${newFile.name}`} className="h-full w-full border-none bg-white" />
 ) : (
 <div className="flex max-w-md flex-col items-center px-6 text-center text-gray-600">
 <Document className="mb-4 h-12 w-12 text-carbon-gray-70" aria-hidden="true" />
 <p className="font-bold text-carbon-gray-100">DOCX preview unavailable</p>
 <p className="mt-2 text-sm leading-relaxed">The document will be converted to PDF before printing.</p>
 </div>
 )
 ) : originalPreviewKind === 'image' ? (
 <img src={draft.fileUrl} alt={`Preview of ${draft.fileName}`} className="h-full w-full object-contain" />
 ) : originalPreviewKind === 'pdf' ? (
 <iframe src={draft.fileUrl} title={`Preview of ${draft.fileName}`} className="h-full w-full border-none bg-white" />
 ) : (
 <div className="flex max-w-md flex-col items-center px-6 text-center text-gray-600">
 <Document className="mb-4 h-12 w-12 text-carbon-gray-70" aria-hidden="true" />
 <p className="font-bold text-carbon-gray-100">Preview unavailable for this file type</p>
 <p className="mt-2 break-all text-sm leading-relaxed">{draft.fileName}</p>
 </div>
 )}

 {canPreviewFile && (
 <div className="pointer-events-none absolute right-3 top-3 transition-opacity group-hover:opacity-0 motion-reduce:transition-none sm:right-4 sm:top-4">
 <span className="border-l-4 border-carbon-blue-60 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-carbon-gray-100 shadow-md">
 Preview active
 </span>
 </div>
 )}
 </div>

 <div className="flex flex-col gap-4 border-t border-white/20 px-1 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-2">
 <div className="min-w-0 text-xs font-semibold leading-relaxed text-gray-200" role="status">
 <div className="flex items-start gap-2">
 <span className="mt-1 h-2 w-2 shrink-0 bg-green-500" />
 <span>{newFile ? validationResult?.message : 'Current draft file is ready.'}</span>
 </div>
 {shopChangedWithoutReplacement && (
 <p className="mt-2 border-l-2 border-yellow-400 pl-2 text-yellow-200">
 Replace this file before saving or submitting with the newly selected shop.
 </p>
 )}
 </div>

 <button
 type="button"
 onClick={handleRemoveFile}
 disabled={isSubmitting}
 className="min-h-11 shrink-0 cursor-pointer self-end bg-red-700 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:self-auto"
 >
 Remove file
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </section>

 <aside className="min-w-0 self-stretch">
 <div className="border border-black xl:sticky xl:top-6">
 <div className="border-b-4 border-carbon-blue-60 bg-carbon-gray-100 px-5 py-4 text-white">
 <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#87B0FE]">Final step</p>
 <p className="mt-1 text-sm text-gray-300">Review the updated details before saving or submitting.</p>
 </div>
 <OrderSummary
 estimate={estimate}
 isSubmitting={isSubmitting}
 onSubmit={handleSubmitOrder}
 onSaveDraft={handleSaveDraftChanges}
 isReady={!!selectedShopId && isFileValidated && !!orderName.trim()}
 paperSize={paperSize}
 setPaperSize={setPaperSize}
 pageCount={pageCount}
 printColorMode={printColorMode}
 setPrintColorMode={setPrintColorMode}
 orderName={orderName}
 setOrderName={setOrderName}
 orientation={orientation}
 setOrientation={setOrientation}
 copies={copies}
 setCopies={setCopies}
 />
 </div>
 </aside>
 </div>

 <AlertModal
 isOpen={alertState.isOpen}
 message={alertState.message}
 title={alertState.title}
 type={alertState.type}
 onClose={() => {
 setAlertState(previous => ({ ...previous, isOpen: false }));
 if (alertState.onCloseAction) alertState.onCloseAction();
 }}
 />
 </div>
 );
};
