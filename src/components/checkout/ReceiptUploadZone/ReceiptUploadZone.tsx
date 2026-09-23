import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckmarkOutline, Document, Upload } from '@carbon/icons-react';

interface ReceiptUploadZoneProps {
 onReceiptSelect: (file: File) => void;
 selectedFile: File | null;
}

const formatFileSize = (bytes: number) => {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ReceiptUploadZone: React.FC<ReceiptUploadZoneProps> = ({ onReceiptSelect, selectedFile }) => {
 const [isDragging, setIsDragging] = useState(false);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const objectUrlRef = useRef<string | null>(null);
 const inputId = useId();

 useEffect(() => () => {
 if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
 }, []);

 const selectFirstFile = (files: FileList | null) => {
 const file = files?.[0];
 if (!file) return;
 if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
 const nextPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
 objectUrlRef.current = nextPreviewUrl;
 setPreviewUrl(nextPreviewUrl);
 onReceiptSelect(file);
 };

 const handleDrop = (event: React.DragEvent) => {
 event.preventDefault();
 setIsDragging(false);
 selectFirstFile(event.dataTransfer.files);
 };

 const openFilePicker = () => fileInputRef.current?.click();

 return (
 <section aria-labelledby="receipt-upload-heading" className="w-full">
 <div className="mb-4 flex items-end justify-between gap-4">
 <div>
 <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">Payment evidence</p>
 <h3 id="receipt-upload-heading" className="mt-1 text-lg font-black text-carbon-gray-100">Upload payment receipt</h3>
 </div>
 <span className="shrink-0 text-xs font-semibold text-gray-500">JPG, PNG, PDF</span>
 </div>

 <input
 id={inputId}
 type="file"
 accept="image/*,.pdf"
 className="sr-only"
 ref={fileInputRef}
 onChange={(event) => selectFirstFile(event.target.files)}
 />

 {selectedFile ? (
 <div className="border border-black bg-white shadow-[0_8px_20px_rgba(22,22,22,0.08)]">
 <div className="flex min-w-0 items-center justify-between gap-3 border-b border-gray-300 bg-carbon-gray-100 px-4 py-3 text-white">
 <div className="flex min-w-0 items-center gap-2">
 <CheckmarkOutline aria-hidden="true" className="h-5 w-5 shrink-0 text-green-400" />
 <span className="truncate text-sm font-bold">Receipt ready</span>
 </div>
 <span className="shrink-0 text-xs text-gray-300">{formatFileSize(selectedFile.size)}</span>
 </div>

 {previewUrl ? (
 <div className="flex aspect-[4/3] max-h-[22rem] items-center justify-center overflow-hidden bg-gray-200 p-3 sm:p-4">
 <img
 src={previewUrl}
 alt={`Preview of receipt ${selectedFile.name}`}
 className="h-full w-full object-contain shadow-[0_8px_24px_rgba(22,22,22,0.18)]"
 />
 </div>
 ) : (
 <div className="flex min-h-52 flex-col items-center justify-center bg-carbon-gray-10 px-6 py-10 text-center">
 <span className="flex h-16 w-16 items-center justify-center border border-gray-300 bg-white">
 <Document aria-hidden="true" className="h-8 w-8 text-carbon-blue-60" />
 </span>
 <p className="mt-4 text-sm font-black text-carbon-gray-100">PDF receipt selected</p>
 <p className="mt-1 text-xs leading-relaxed text-gray-600">Preview unavailable, but document will still be uploaded.</p>
 </div>
 )}

 <div className="flex flex-col gap-3 border-t border-gray-300 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="min-w-0">
 <p className="truncate text-sm font-bold text-carbon-gray-100" title={selectedFile.name}>{selectedFile.name}</p>
 <p className="mt-1 text-xs text-gray-500">Check receipt details before submitting.</p>
 </div>
 <button
 type="button"
 onClick={openFilePicker}
 className="min-h-11 shrink-0 cursor-pointer border border-black bg-white px-4 py-2 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
 >
 Change receipt
 </button>
 </div>
 </div>
 ) : (
 <div
 role="button"
 tabIndex={0}
 aria-describedby="receipt-upload-help"
 className={`flex min-h-64 cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none ${
 isDragging ? 'border-carbon-blue-60 bg-blue-50' : 'border-gray-500 bg-carbon-gray-10 hover:border-carbon-blue-60 hover:bg-blue-50'
 }`}
 onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
 onDragLeave={() => setIsDragging(false)}
 onDrop={handleDrop}
 onClick={openFilePicker}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ') {
 event.preventDefault();
 openFilePicker();
 }
 }}
 >
 <span className="flex h-14 w-14 items-center justify-center bg-carbon-blue-60 text-white shadow-[6px_6px_0_#161616]">
 <Upload aria-hidden="true" className="h-7 w-7" />
 </span>
 <p className="mt-5 text-base font-black text-carbon-gray-100">Drop receipt here</p>
 <p id="receipt-upload-help" className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">Drag an image or PDF, or select a file from your device.</p>
 <span className="mt-5 min-h-11 bg-carbon-gray-100 px-5 py-3 text-sm font-bold text-white">Choose receipt</span>
 </div>
 )}
 </section>
 );
};
