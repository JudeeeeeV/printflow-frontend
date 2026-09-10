import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-x-auto p-4 lg:p-6 gap-6 bg-transparent min-h-[calc(100vh-64px)]">
            {[1, 2, 3].map((colIndex) => (
                <div key={colIndex} className="flex-1 w-full lg:min-w-[320px] lg:max-w-md flex flex-col bg-gray-100 border border-[#e0e0e0] overflow-hidden shrink-0">
                    <div className="p-4 bg-white border-b border-[#e0e0e0] flex justify-between items-center shrink-0">
                        <div className="h-6 w-32 bg-gray-200 animate-pulse"></div>
                        <div className="h-6 w-8 bg-gray-200 animate-pulse"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Render different number of skeleton cards per column for organic feel */}
                        {Array.from({ length: colIndex === 2 ? 2 : colIndex === 3 ? 4 : 3 }).map((_, cardIndex) => (
                            <div key={cardIndex} className="bg-white border border-[#e0e0e0] p-4 animate-pulse">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="space-y-2">
                                        <div className="h-4 w-24 bg-gray-200"></div>
                                        <div className="h-3 w-16 bg-gray-100"></div>
                                    </div>
                                    <div className="h-5 w-20 bg-gray-200"></div>
                                </div>
                                <div className="flex gap-2 mb-4">
                                    <div className="h-4 w-8 bg-gray-200"></div>
                                    <div className="h-4 w-12 bg-gray-200"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <div className="h-3 w-20 bg-gray-100"></div>
                                        <div className="h-3 w-12 bg-gray-200"></div>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="h-3 w-16 bg-gray-100"></div>
                                        <div className="h-3 w-24 bg-gray-200"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
