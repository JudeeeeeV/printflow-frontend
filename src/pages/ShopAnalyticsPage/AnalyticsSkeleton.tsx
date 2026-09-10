import React from 'react';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse"></div>
        <div className="h-10 w-32 bg-gray-200 animate-pulse"></div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#e0e0e0] p-6 shadow-sm">
            <div className="h-4 w-24 bg-gray-200 animate-pulse mb-4"></div>
            <div className="h-8 w-32 bg-gray-300 animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white border border-[#e0e0e0] p-6 shadow-sm">
          <div className="h-6 w-40 bg-gray-200 animate-pulse mb-6"></div>
          <div className="h-64 w-full bg-gray-100 animate-pulse"></div>
        </div>
        <div className="bg-white border border-[#e0e0e0] p-6 shadow-sm">
          <div className="h-6 w-40 bg-gray-200 animate-pulse mb-6"></div>
          <div className="h-64 w-full bg-gray-100 animate-pulse"></div>
        </div>
      </div>
      
      {/* Table Area */}
      <div className="bg-white border border-[#e0e0e0] p-6 shadow-sm">
         <div className="h-6 w-48 bg-gray-200 animate-pulse mb-6"></div>
         <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-50 animate-pulse border border-[#e0e0e0]"></div>
            ))}
         </div>
      </div>
    </div>
  );
};
