import React, { useState, useRef } from 'react';
import { CloudUpload } from '@carbon/icons-react';
import { FileFeedback } from '../FileFeedback';
import type { FileFeedback as Feedback } from '../../../services/documentPreparation';

interface FileUploadZoneProps {
 onFileSelect: (file: File) => void;
 isValidating: boolean;
 validationResult: Feedback | null;
 uploadButtonRef?: React.Ref<HTMLButtonElement>;
 disabled?: boolean;
 onRemoveFile?: () => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onFileSelect, isValidating, validationResult, uploadButtonRef, disabled = false, onRemoveFile }) => {
 const [isDragging, setIsDragging] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const processFile = (file: File) => {
 if (!disabled) onFileSelect(file);
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
 processFile(e.dataTransfer.files[0]);
 }
 };

 return (
 <div className="mb-8" aria-busy={isValidating}>
 <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Design File</h3>
 <div
 className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-colors duration-200 ${
 isDragging ? 'border-black bg-carbon-gray-10' : validationResult?.passed === false ? 'border-gray-300 bg-gray-100/30' : 'border-[#8d8d8d] bg-white'
 }`}
 onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
 onDragLeave={() => setIsDragging(false)}
 onDrop={handleDrop}
 >
 <CloudUpload className="w-12 h-12 text-gray-400 mb-4" />
 <p className="font-bold text-carbon-gray-100 mb-1">Upload PDF, DOCX, or Images</p>
 <p className="text-xs text-gray-500 mb-1">Accepted formats: PDF, DOCX, PNG, JPG, WEBP</p>
 <p className="text-xs text-gray-500 mb-4">Maximum file size: 20MB</p>

 <input
 type="file"
 disabled={disabled}
 accept=".pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
 className="hidden"
 ref={fileInputRef}
 // Added click handler to reset the input value, allowing the exact same file to be selected twice if needed
 onClick={(e) => {
 (e.target as HTMLInputElement).value = '';
 }}
 // Added length check to prevent passing undefined if the user cancels the dialog
 onChange={(e) => {
 if (e.target.files && e.target.files.length > 0) {
 processFile(e.target.files[0]);
 }
 }}
 />

 <button
 ref={uploadButtonRef}
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={disabled}
 className="min-h-11 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white px-6 py-2 font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
 >
 {isValidating || validationResult?.passed === false ? 'Choose another file' : 'Upload File'}
 </button>
 </div>

 {isValidating && <p role="status" className="mt-3 text-sm text-gray-600">Checking the selected file...</p>}
 {isValidating && onRemoveFile && <button type="button" disabled={disabled} onClick={onRemoveFile} className="mt-3 min-h-11 bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Remove file</button>}
 <FileFeedback focusOnError feedback={validationResult} />
 </div>
 );
};
