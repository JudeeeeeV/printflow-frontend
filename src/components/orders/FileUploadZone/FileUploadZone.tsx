import React, { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadZoneProps {
    onFileSelect: (file: File) => void;
    isValidating: boolean;
    validationResult: { passed: boolean; message: string } | null;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onFileSelect, isValidating, validationResult }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Design File</h3>
            <div
                className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-colors duration-200 ${
                    isDragging ? 'border-black bg-gray-50' : 'border-gray-300 bg-white'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
                <p className="font-bold text-black mb-1">Drag & Drop PDF/PNG here</p>
                <p className="text-sm text-gray-500 mb-4">Maximum file size: 50MB</p>

                <input
                    type="file"
                    accept=".pdf,.png"
                    className="hidden"
                    ref={fileInputRef}
                    // Added click handler to reset the input value, allowing the exact same file to be selected twice if needed
                    onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                    }}
                    // Added length check to prevent passing undefined if the user cancels the dialog
                    onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                            onFileSelect(e.target.files[0]);
                        }
                    }}
                />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isValidating}
                    className="bg-black text-white px-6 py-2 font-bold hover:bg-gray-800 disabled:opacity-50"
                >
                    {isValidating ? 'Validating...' : 'Upload File'}
                </button>
            </div>

            {/* Validation Feedback Component integrated here per SDD */}
            {validationResult && (
                <div className={`mt-3 text-sm font-bold flex items-center gap-2 ${validationResult.passed ? 'text-green-600' : 'text-red-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${validationResult.passed ? 'bg-green-600' : 'bg-red-600'}`}></span>
                    {validationResult.message}
                </div>
            )}
        </div>
    );
};