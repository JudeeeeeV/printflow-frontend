import React, { useState, useRef } from 'react';
import { UploadCloud, AlertTriangle } from 'lucide-react';

const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface FileUploadZoneProps {
    onFileSelect: (file: File) => void;
    isValidating: boolean;
    validationResult: { passed: boolean; message: string } | null;
}

const getFileExtension = (name: string): string => {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
};

const isValidFile = (file: File): { valid: boolean; error: string } => {
    const ext = getFileExtension(file.name);

    // Check extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `Invalid file format "${ext}". Accepted: PDF, PNG, JPG, WEBP.` };
    }

    // Check MIME type (also catches renamed files in most cases)
    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
        return { valid: false, error: `Invalid file type "${file.type}". Accepted: PDF, PNG, JPG, WEBP.` };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB.` };
    }

    // Check empty/zero-byte files
    if (file.size === 0) {
        return { valid: false, error: 'File is empty (0 bytes). The file may be corrupted.' };
    }

    return { valid: true, error: '' };
};

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onFileSelect, isValidating, validationResult }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = (file: File) => {
        setFileError(null);
        const result = isValidFile(file);
        if (!result.valid) {
            setFileError(result.error);
            return;
        }
        onFileSelect(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Design File</h3>
            <div
                className={`border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-colors duration-200 ${
                    isDragging ? 'border-black bg-gray-50' : fileError ? 'border-red-300 bg-red-50/30' : 'border-gray-300 bg-white'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
                <p className="font-bold text-black mb-1">Upload PDF / Images</p>
                <p className="text-xs text-gray-500 mb-1">Accepted formats: PDF, PNG, JPG, WEBP</p>
                <p className="text-xs text-gray-500 mb-4">Maximum file size: 50MB</p>

                <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
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
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isValidating}
                    className="bg-black text-white px-6 py-2 font-bold hover:bg-gray-800 disabled:opacity-50"
                >
                    {isValidating ? 'Validating...' : 'Upload File'}
                </button>
            </div>

            {/* File format / size error */}
            {fileError && (
                <div className="mt-3 text-sm font-bold flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {fileError}
                </div>
            )}

            {/* Validation Feedback Component integrated here per SDD */}
            {!fileError && validationResult && (
                <div className={`mt-3 text-sm font-bold flex items-center gap-2 ${validationResult.passed ? 'text-green-600' : 'text-red-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${validationResult.passed ? 'bg-green-600' : 'bg-red-600'}`}></span>
                    {validationResult.message}
                </div>
            )}
        </div>
    );
};
