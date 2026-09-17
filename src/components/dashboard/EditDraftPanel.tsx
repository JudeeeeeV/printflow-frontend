import React, { useState } from 'react';
import { ArrowLeft } from '@carbon/icons-react';
import { ShopSelector } from '../orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../orders/OrderSummary/OrderSummary';
import { AlertModal } from '../common/AlertModal';
import { orderService } from '../../services/orderService';
import type { PrintShop, OrderEstimate } from '../../services/orderService';
import type { DraftOrder } from './MyDraftsList';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface EditDraftPanelProps {
 draft: DraftOrder;
 shops: PrintShop[];
 onCancel: () => void;
 onSuccess: (orderId: string) => void;
}

export const EditDraftPanel: React.FC<EditDraftPanelProps> = ({ draft, shops, onCancel, onSuccess }) => {
 const [selectedShopId, setSelectedShopId] = useState<string | null>(draft.shopId);
 const [newFile, setNewFile] = useState<File | null>(null);
 const [isValidating, setIsValidating] = useState(false);
 const [paperSize, setPaperSize] = useState<string>(draft.paperSize || 'A4');
 const [printColorMode, setPrintColorMode] = useState<string>(draft.printColorMode || 'BLACK_AND_WHITE');
 const [pageCount, setPageCount] = useState<number>(draft.pageCount || 1);

 // Pre-fill validation so they can submit immediately without uploading a new file
 const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>({
 passed: true, message: 'Valid file loaded from draft'
 });
 const [estimate, setEstimate] = useState<OrderEstimate | null>({
 total: draft.total, pageCount: draft.pageCount || 1, basePrice: draft.total, colorAdditive: 0
 });

 const [isSubmitting, setIsSubmitting] = useState(false);

 const [alertState, setAlertState] = useState<{isOpen: boolean; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'; onCloseAction?: () => void}>({ isOpen: false, message: '' });
 const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', title?: string, onCloseAction?: () => void) => {
 setAlertState({ isOpen: true, message, type, title, onCloseAction });
 };

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

 React.useEffect(() => {
 if (selectedShopId && validationResult?.passed) {
 updateEstimate(selectedShopId, paperSize, printColorMode, pageCount);
 }
 }, [paperSize, printColorMode, selectedShopId, validationResult?.passed, shops, pageCount]);

 const handleFileSelect = async (selectedFile: File) => {
 setNewFile(selectedFile);
 setIsValidating(true);
 setValidationResult(null);

 let detectedPageCount = 1;

 // Validate PDF integrity
 if (selectedFile.type === 'application/pdf') {
 try {
 const { PDFDocument } = await import('pdf-lib');
 const arrayBuffer = await selectedFile.arrayBuffer();
 const pdfDoc = await PDFDocument.load(arrayBuffer);
 detectedPageCount = pdfDoc.getPageCount();
 if (detectedPageCount === 0) {
 setValidationResult({ passed: false, message: 'Corrupted PDF: File contains no pages.' });
 setEstimate(null);
 setIsValidating(false);
 return;
 }
 } catch (e) {
 console.error("Failed to parse PDF:", e);
 setValidationResult({ passed: false, message: 'Corrupted File: This PDF could not be read. Please re-export and try again.' });
 setEstimate(null);
 setIsValidating(false);
 return;
 }
 } else if (selectedFile.type.startsWith('image/')) {
 try {
 const isValid = await new Promise<boolean>((resolve) => {
 const img = new Image();
 img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
 img.onerror = () => resolve(false);
 img.src = URL.createObjectURL(selectedFile);
 });
 if (!isValid) {
 setValidationResult({ passed: false, message: 'Corrupted File: This image could not be loaded. It may be damaged or truncated.' });
 setEstimate(null);
 setIsValidating(false);
 return;
 }
 } catch (e) {
 setValidationResult({ passed: false, message: 'Corrupted File: This image could not be validated.' });
 setEstimate(null);
 setIsValidating(false);
 return;
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
 // The useEffect will automatically update the estimate now when pageCount or validationResult changes
 } catch (err) {
 setValidationResult({ passed: false, message: 'Validation Failed: Minimum 300 DPI required.' });
 setEstimate(null);
 } finally {
 setIsValidating(false);
 }
 };

 const handleSubmitOrder = async () => {
 if (!selectedShopId || !validationResult?.passed) return;

 // SAFEGUARD: Prevent corrupted orders if they change shops but don't re-upload
 if (selectedShopId !== draft.shopId && !newFile) {
 showAlert('You changed the Print Shop. Please re-upload your design file to validate it against this shop.', 'warning', 'Re-upload Required');
 return;
 }

 setIsSubmitting(true);
 try {
 if (newFile) {
 // They uploaded a new file! Create a brand new order, delete the old draft.
 const response = await orderService.submitOrder(selectedShopId, newFile, paperSize, printColorMode);
 await orderService.deleteDraft(draft.id);
 onSuccess(response.orderId);
 } else {
 // They changed settings but didn't upload a new file, update draft first then submit.
 if (estimate) {
 await orderService.updateDraftWithoutFile(draft.id, selectedShopId, paperSize, printColorMode);
 }
 await orderService.submitDraft(draft.id);
 onSuccess(draft.id);
 }
 } catch (err: any) {
 showAlert(`Failed to submit: ${err.message || 'Unknown error'}`, 'error', 'Submission Failed');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleSaveDraftChanges = async () => {
 if (!selectedShopId || !validationResult?.passed) return;

 if (selectedShopId !== draft.shopId && !newFile) {
 showAlert('You changed the Print Shop. Please re-upload your design file to save.', 'warning', 'Re-upload Required');
 return;
 }

 setIsSubmitting(true);
 try {
 if (newFile) {
 await orderService.saveDraft(selectedShopId, newFile, paperSize, printColorMode);
 await orderService.deleteDraft(draft.id);
 showAlert('Draft updated successfully!', 'success', 'Success', () => onCancel());
 } else {
 if (estimate) {
 await orderService.updateDraftWithoutFile(draft.id, selectedShopId, paperSize, printColorMode);
 showAlert('Draft updated successfully!', 'success', 'Success', () => onCancel());
 } else {
 showAlert('No changes were made to the draft.', 'info', 'No Changes', () => onCancel());
 }
 }
 } catch (err: any) {
 showAlert(`Failed to save draft: ${err.message || 'Unknown error'}`, 'error', 'Save Failed');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="max-w-6xl mx-auto animate-slide-fade">
 <div className="flex items-center gap-4 mb-6">
 <button onClick={onCancel} className="text-gray-500 hover:text-carbon-gray-100 transition-colors">
 <ArrowLeft className="w-6 h-6" />
 </button>
 <h2 className="text-2xl font-black text-carbon-gray-100">Review & Edit Draft</h2>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
 <div className="bg-white p-6 border border-gray-100">
 <ShopSelector shops={shops} selectedShopId={selectedShopId} onSelect={setSelectedShopId} />

 <div className="mt-8">
 <h3 className="text-sm font-semibold text-gray-700 mb-3">Replace Design File (Optional)</h3>
 <FileUploadZone onFileSelect={handleFileSelect} isValidating={isValidating} validationResult={validationResult} />
 </div>

 {validationResult?.passed && (
 <div className="mt-8 bg-gray-200 h-[500px] flex items-center justify-center overflow-hidden relative group border border-[#8d8d8d]">
 {newFile ? (
 newFile.type.startsWith('image/') ? (
 <img src={URL.createObjectURL(newFile)} alt="Preview" className="w-full h-full object-contain" />
 ) : newFile.type === 'application/pdf' ? (
 <iframe src={URL.createObjectURL(newFile)} title="PDF Preview" className="w-full h-full border-none" />
 ) : (
 <span className="px-6 text-center font-bold text-gray-500">DOCX preview will be available after PDF conversion.</span>
 )
 ) : (
 <iframe src={draft.fileUrl} title="Draft Preview" className="w-full h-full border-none" />
 )}
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
 onSaveDraft={handleSaveDraftChanges}
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
 </div>
 );
};
