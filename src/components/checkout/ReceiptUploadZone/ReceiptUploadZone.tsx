import React, { useState, useRef } from 'react';
import { Upload, CheckCircle } from 'lucide-react';

interface ReceiptUploadZoneProps {
    onReceiptSelect: (file: File) => void;
    selectedFile: File | null;
}

export const ReceiptUploadZone: React.FC<ReceiptUploadZoneProps> = ({ onReceiptSelect, selectedFile }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onReceiptSelect(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Payment Receipt</h3>
            
            {selectedFile ? (
                <div className="border-2 border-green-500 bg-green-50 p-6 rounded flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-green-500 w-6 h-6" />
                        <div>
                            <p className="font-bold text-green-900 text-sm">Receipt Uploaded</p>
                            <p className="text-xs text-green-700 truncate max-w-[200px]">{selectedFile.name}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-green-800 hover:text-green-900 underline"
                    >
                        Change
                    </button>
                    <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && onReceiptSelect(e.target.files[0])}
                    />
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed p-8 rounded flex flex-col items-center justify-center text-center transition-colors duration-200 ${
                        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="w-8 h-8 text-gray-400 mb-3" />
                    <p className="font-bold text-black text-sm mb-1">Click or drag receipt here</p>
                    <p className="text-xs text-gray-500">Supports JPG, PNG, PDF</p>

                    <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && onReceiptSelect(e.target.files[0])}
                    />
                </div>
            )}
        </div>
    );
};
