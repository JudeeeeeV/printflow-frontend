import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div role="status" aria-label="Loading live queue" className="flex min-h-full w-full min-w-0 flex-col font-sans lg:h-full lg:min-h-0 lg:overflow-hidden motion-reduce:[&_.animate-pulse]:animate-none">
            <div className="flex flex-none flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <div className="flex flex-none flex-col bg-gray-100/50 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                    
                    <div aria-hidden="true" className="grid shrink-0 grid-cols-3 gap-1 border-b border-gray-300 bg-carbon-gray-10 p-1 sm:gap-2 sm:px-2">
                        {[1, 2, 3].map(tab => (
                            <div key={tab} className={`flex h-11 items-center justify-center gap-2 border border-black shadow-[0_2px_0_rgba(22,22,22,0.12)] lg:h-9 ${tab === 1 ? 'bg-blue-100' : 'bg-white'}`}>
                                <div className={`h-4 animate-pulse ${tab === 1 ? 'w-20 bg-blue-200' : 'w-16 bg-gray-200'}`} />
                                <div className="h-5 w-7 animate-pulse bg-black" />
                            </div>
                        ))}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch justify-between gap-1 border-b border-gray-300 bg-white px-2 py-1 lg:flex-row lg:items-center">
                        <div className="h-11 w-full animate-pulse border border-black bg-gray-100 lg:h-9 lg:max-w-md" />
                        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:gap-3">
                            <div className="space-y-1 lg:flex lg:items-center lg:gap-2 lg:space-y-0">
                                <div className="h-3 w-16 animate-pulse bg-gray-200" />
                                <div className="h-11 animate-pulse border border-black bg-gray-100 lg:h-9 lg:w-36" />
                            </div>
                            <div className="space-y-1 lg:flex lg:items-center lg:gap-2 lg:space-y-0">
                                <div className="h-3 w-20 animate-pulse bg-gray-200" />
                                <div className="h-11 animate-pulse border border-black bg-gray-100 lg:h-9 lg:w-36" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-none flex-col overflow-hidden p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:p-5">
                        <div className="flex w-full min-w-0 flex-col overflow-hidden border border-black bg-gray-100 lg:min-h-0 lg:flex-1">
                            <div className="grid grid-cols-1 items-start gap-3 overflow-hidden p-3 sm:p-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 xl:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, cardIndex) => (
                                    <div key={cardIndex} className="min-w-0 animate-pulse border border-black bg-white p-3 sm:p-4">
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-gray-200" />
                                                <div className="h-3 w-16 bg-gray-100" />
                                            </div>
                                            <div className="h-5 w-20 bg-gray-200" />
                                        </div>
                                        <div className="mb-4 flex gap-2">
                                            <div className="h-4 w-8 bg-gray-200" />
                                            <div className="h-4 w-12 bg-gray-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <div className="h-3 w-20 bg-gray-100" />
                                                <div className="h-3 w-12 bg-gray-200" />
                                            </div>
                                            <div className="flex justify-between">
                                                <div className="h-3 w-16 bg-gray-100" />
                                                <div className="h-3 w-24 bg-gray-200" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div aria-hidden="true" className="shrink-0 space-y-2 border-t border-gray-300 bg-white p-3">
                                <div className="h-5 w-32 animate-pulse bg-gray-100" />
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="h-11 w-24 animate-pulse border border-black bg-gray-100" />
                                    <div className="h-4 w-16 animate-pulse bg-gray-100" />
                                    <div className="h-11 w-20 animate-pulse border border-black bg-gray-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
