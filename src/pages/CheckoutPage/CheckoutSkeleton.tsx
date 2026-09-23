import React from 'react';

const pulse = 'animate-pulse bg-gray-300 motion-reduce:animate-none';

export const CheckoutSkeleton: React.FC = () => {
 return (
 <div className="w-full overflow-hidden border border-black bg-white shadow-[0_20px_60px_rgba(0,0,0,0.36)]" aria-label="Loading checkout" role="status">
 <div className="h-1 bg-carbon-blue-60" />
 <div className="flex flex-col gap-5 border-b border-gray-300 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
 <div>
 <div className={`h-3 w-44 ${pulse}`} />
 <div className={`mt-3 h-8 w-64 max-w-full ${pulse}`} />
 <div className={`mt-3 h-7 w-40 ${pulse}`} />
 </div>
 <div className="grid w-full gap-2 min-[480px]:grid-cols-2 lg:w-auto">
 <div className={`h-11 w-full lg:w-44 ${pulse}`} />
 <div className={`h-11 w-full lg:w-36 ${pulse}`} />
 </div>
 </div>

 <div className="border-b border-gray-300 bg-carbon-gray-10 px-5 py-5 sm:px-7">
 <div className="flex justify-between">
 {[0, 1, 2, 3].map((step) => <div key={step} className={`h-8 w-8 ${pulse}`} />)}
 </div>
 <div className="mt-3 grid grid-cols-4 gap-3">
 {[0, 1, 2, 3].map((step) => <div key={step} className={`mx-auto h-3 w-16 max-w-full ${pulse}`} />)}
 </div>
 </div>

 <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:p-8">
 <div className="border border-gray-300 bg-carbon-gray-10 p-5 sm:p-6">
 <div className={`h-5 w-40 ${pulse}`} />
 <div className={`mt-3 h-3 w-64 max-w-full ${pulse}`} />
 <div className={`mx-auto mt-6 aspect-square w-full max-w-[17rem] ${pulse}`} />
 <div className={`mt-6 h-20 w-full ${pulse}`} />
 <div className={`mt-2 h-16 w-full ${pulse}`} />
 </div>
 <div className="border border-gray-300 bg-white p-5 sm:p-6">
 <div className={`h-5 w-44 ${pulse}`} />
 <div className={`mt-3 h-3 w-full max-w-sm ${pulse}`} />
 <div className={`mt-7 h-64 w-full ${pulse}`} />
 <div className={`mt-6 h-12 w-full ${pulse}`} />
 <div className={`mt-6 h-12 w-full ${pulse}`} />
 </div>
 </div>
 <span className="sr-only">Loading checkout details</span>
 </div>
 );
};
