import React from 'react';

interface LoadingSpinnerProps {
 message?: string;
 fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', fullPage = true }) => {
 return (
 <div className={`${fullPage ? 'min-h-screen' : 'h-64'} flex flex-col items-center justify-center font-sans w-full`}>
 <div className="flex space-x-2 mb-4">
 <div className="w-3 h-3 bg-black animate-pulse" style={{ animationDelay: '0ms' }}></div>
 <div className="w-3 h-3 bg-black animate-pulse" style={{ animationDelay: '150ms' }}></div>
 <div className="w-3 h-3 bg-black animate-pulse" style={{ animationDelay: '300ms' }}></div>
 </div>
 <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{message}</p>
 </div>
 );
};
