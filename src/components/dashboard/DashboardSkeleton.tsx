import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div role="status" aria-label="Loading live queue" className="flex min-h-full w-full min-w-0 flex-col font-sans lg:h-full lg:min-h-0 lg:overflow-hidden motion-reduce:[&_.animate-pulse]:animate-none">
            {/* Top Bar Skeleton */}
            <div className="bg-white border-b border-[#e0e0e0] py-3 px-6 flex justify-between items-center shrink-0 z-10">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <div className="h-6 w-48 bg-gray-200 animate-pulse mb-1"></div>
                        <div className="h-3 w-24 bg-gray-100 animate-pulse"></div>
                    </div>
                    <div className="h-6 w-32 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                </div>
            </div>

            <div className="flex flex-none flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <div className="flex flex-none flex-col bg-gray-100/50 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                    
                    {/* Top Bar 2 (Queue Active + GCash QR) Skeleton */}
                    <div className="bg-white border-b border-[#e0e0e0] p-4 shrink-0 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 bg-gray-200 animate-pulse rounded-full"></div>
                            <div className="h-4 w-24 bg-gray-200 animate-pulse"></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="h-4 w-16 bg-gray-200 animate-pulse"></div>
                            <div className="h-8 w-48 bg-gray-100 animate-pulse border border-[#e0e0e0]"></div>
                            <div className="h-8 w-16 bg-gray-200 animate-pulse"></div>
                        </div>
                    </div>

                    {/* Filter Bar Skeleton (Matches KanbanFilterBar) */}
                    <div className="bg-white border-b border-[#e0e0e0] p-4 shrink-0 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
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

                    <div className="flex flex-none flex-col gap-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-5 lg:overflow-x-auto lg:overflow-y-hidden lg:p-6">
                        {[1, 2, 3].map((colIndex) => (
                            <div key={colIndex} className="flex w-full min-w-0 flex-none flex-col bg-gray-100 border border-[#e0e0e0] lg:min-h-0 lg:min-w-[320px] lg:flex-1 lg:overflow-hidden">
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

                                <div className="p-3 space-y-4 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                                    {/* Render different number of skeleton cards per column for organic feel */}
                                    {Array.from({ length: colIndex === 2 ? 2 : colIndex === 3 ? 4 : 3 }).map((_, cardIndex) => (
                                        <div key={cardIndex} className="flex items-center gap-3">
                                            {colIndex === 2 && (
                                                <div className="shrink-0 pl-1">
                                                    <div className="w-4 h-4 bg-gray-200 animate-pulse border border-[#8d8d8d]"></div>
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1 bg-white border border-[#e0e0e0] p-3 animate-pulse sm:p-4">
                                                <div className="flex flex-wrap gap-2 justify-between items-start mb-3">
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
            </div>
        </div>
    );
};
