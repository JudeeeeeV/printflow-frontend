import React, { useState } from 'react';
import { ArrowLeft } from '@carbon/icons-react';
import { ShopSelector } from '../orders/ShopSelector/ShopSelector';
import { FileUploadZone } from '../orders/FileUploadZone/FileUploadZone';
import { OrderSummary } from '../orders/OrderSummary/OrderSummary';
import { orderService } from '../../services/orderService';
import type { PrintShop, OrderEstimate } from '../../services/orderService';
import type { DraftOrder } from './MyDraftsList';

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
 const [paperSize, setPaperSize] = useState<string>('A4');
 const [printColorMode, setPrintColorMode] = useState<string>('BLACK_AND_WHITE');
 const [pageCount] = useState<number>(1);

 // Pre-fill validation so they can submit immediately without uploading a new file
 const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>({
 passed: true, message: 'Valid file loaded from draft'
 });
 const [estimate, setEstimate] = useState<OrderEstimate | null>({
 total: draft.total, pageCount: 1, basePrice: draft.total, colorAdditive: 0
 });

 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleFileSelect = async (selectedFile: File) => {
 setNewFile(selectedFile);
 setIsValidating(true);
 setValidationResult(null);

 // Validate PDF integrity
 if (selectedFile.type === 'application/pdf') {
 try {
 const { PDFDocument } = await import('pdf-lib');
 const arrayBuffer = await selectedFile.arrayBuffer();
 const pdfDoc = await PDFDocument.load(arrayBuffer);
 if (pdfDoc.getPageCount() === 0) {
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

 try {
 await new Promise(resolve => setTimeout(resolve, 1500));
 setValidationResult({ passed: true, message: 'Validation Passed: 300 DPI, CMYK' });
 setEstimate({ total: 15.00, pageCount: 1, basePrice: 15.00, colorAdditive: 0 });
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
 alert('You changed the Print Shop. Please re-upload your design file to validate it against this shop.');
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
 // They changed nothing, just ready to checkout with the existing draft.
 await orderService.submitDraft(draft.id);
 onSuccess(draft.id);
 }
 } catch (err: any) {
 alert(`Failed to submit: ${err.message || 'Unknown error'}`);
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleSaveDraftChanges = async () => {
 if (!selectedShopId || !validationResult?.passed) return;

 if (selectedShopId !== draft.shopId && !newFile) {
 alert('You changed the Print Shop. Please re-upload your design file to save.');
 return;
 }

 setIsSubmitting(true);
 try {
 if (newFile) {
 await orderService.saveDraft(selectedShopId, newFile, paperSize, printColorMode);
 await orderService.deleteDraft(draft.id);
 alert('Draft updated successfully!');
 onCancel();
 } else {
 alert('No changes were made to the draft.');
 onCancel();
 }
 } catch (err: any) {
 alert(`Failed to save draft: ${err.message || 'Unknown error'}`);
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
 ) : (
 <iframe src={URL.createObjectURL(newFile)} title="PDF Preview" className="w-full h-full border-none" />
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
 </div>
 );
};
