// src/components/auth/SubmitButton/SubmitButton.tsx
import React from 'react';

interface SubmitButtonProps {
 label: string;
 isLoading: boolean;
 disabled?: boolean;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
 label,
 isLoading,
 disabled = false,
}) => {
 return (
        <button
            type="submit"
            className={`w-full py-4 px-6 text-base font-bold transition-all duration-300 ease-out flex justify-center items-center ring-inset ring-2 ring-black ${
                isLoading 
                    ? 'bg-white text-carbon-gray-100' 
                    : 'bg-carbon-gray-100 text-white hover:bg-black hover:text-white active:scale-95'
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-carbon-gray-100 disabled:hover:text-white`}
            disabled={isLoading || disabled}
        >
 {isLoading ? (
 <span className="flex items-center justify-center gap-3 h-full">
 <span className="flex space-x-1.5">
 <div className="w-2 h-2 bg-black animate-pulse" style={{ animationDelay: '0ms' }}></div>
 <div className="w-2 h-2 bg-black animate-pulse" style={{ animationDelay: '150ms' }}></div>
 <div className="w-2 h-2 bg-black animate-pulse" style={{ animationDelay: '300ms' }}></div>
 </span>
 <span className="font-bold uppercase tracking-widest text-sm">Processing...</span>
 </span>
 ) : (
 label
 )}
 </button>
 );
};
