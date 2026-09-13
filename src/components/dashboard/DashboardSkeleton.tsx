import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-full overflow-hidden font-sans w-full">
            {/* Top Bar Skeleton */}
            <div className="bg-white border-b border-[#e0e0e0] py-3 px-6 flex justify-between items-center shrink-0 z-10">
                <div className="flex items-center gap-6">
                    <div>
                        <div className="h-6 w-48 bg-gray-200 animate-pulse mb-1"></div>
                        <div className="h-3 w-24 bg-gray-100 animate-pulse"></div>
                    </div>
                    <div className="h-6 w-32 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                </div>
            </div>

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-100/50">
                    
                    {/* Top Bar 2 (Queue Active + GCash QR) Skeleton */}
                    <div className="bg-white border-b border-[#e0e0e0] p-4 shrink-0 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 bg-gray-200 animate-pulse rounded-full"></div>
                            <div className="h-4 w-24 bg-gray-200 animate-pulse"></div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="h-4 w-16 bg-gray-200 animate-pulse"></div>
                            <div className="h-8 w-48 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                            <div className="h-8 w-16 bg-gray-200 animate-pulse"></div>
                        </div>
                    </div>

                    {/* Filter Bar Skeleton (Matches KanbanFilterBar) */}
                    <div className="bg-white border-b border-[#e0e0e0] p-4 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 sticky top-0">
                        <div className="h-9 w-full md:max-w-md bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="h-3 w-16 bg-gray-200 animate-pulse"></div>
                                <div className="h-9 w-32 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="h-3 w-20 bg-gray-200 animate-pulse"></div>
                                <div className="h-9 w-32 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-x-auto p-4 lg:p-6 gap-6">
                        {[1, 2, 3].map((colIndex) => (
                            <div key={colIndex} className="flex-1 w-full lg:min-w-[320px] lg:max-w-md flex flex-col bg-gray-100 border border-[#e0e0e0] overflow-hidden shrink-0">
                                {/* Column Header Skeleton */}
                                <div className="p-4 bg-white border-b border-[#e0e0e0] flex justify-between items-center shrink-0">
                                    <div className="h-6 w-32 bg-gray-200 animate-pulse"></div>
                                    <div className="h-6 w-8 bg-gray-200 animate-pulse"></div>
                                </div>
                                
                                {/* Print Ready Batch Controls Skeleton */}
                                {colIndex === 2 && (
                                    <div className="p-3 bg-white border-b border-gray-100 flex flex-col gap-2 shrink-0 z-10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="h-4 w-20 bg-gray-200 animate-pulse"></div>
                                            <div className="h-3 w-16 bg-gray-100 animate-pulse"></div>
                                        </div>
                                        <div className="h-8 w-full bg-gray-100 animate-pulse border border-[#8d8d8d]"></div>
                                        <div className="h-10 w-full bg-gray-200 animate-pulse border border-[#8d8d8d]"></div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Render different number of skeleton cards per column for organic feel */}
                                    {Array.from({ length: colIndex === 2 ? 2 : colIndex === 3 ? 4 : 3 }).map((_, cardIndex) => (
                                        <div key={cardIndex} className="flex items-center gap-3">
                                            {colIndex === 2 && (
                                                <div className="shrink-0 pl-1">
                                                    <div className="w-4 h-4 bg-gray-200 animate-pulse border border-[#8d8d8d]"></div>
                                                </div>
                                            )}
                                            <div className="flex-1 bg-white border border-[#e0e0e0] p-4 animate-pulse">
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
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};
