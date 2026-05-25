import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', fullPage = true }) => {
    return (
        <div className={`${fullPage ? 'min-h-screen' : 'h-64'} flex flex-col items-center justify-center font-sans w-full`}>
            <div className="relative">
                <div className="w-12 h-12 border-4 border-gray-100 rounded-full"></div>
                <div className="w-12 h-12 border-4 border-black rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="mt-4 text-sm font-bold text-gray-500 animate-pulse">{message}</p>
        </div>
    );
};
