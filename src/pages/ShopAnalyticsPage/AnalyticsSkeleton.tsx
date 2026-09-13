import React from 'react';
import { Calendar, ChartLine, Document, Layers, Activity } from '@carbon/icons-react';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 w-full">
      
      {/* Date Range Controls & Export Button Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          {/* Preset Buttons Skeleton */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-3 py-1.5 h-7 w-20 border border-[#e0e0e0] bg-gray-100 animate-pulse">
            </div>
          ))}
        </div>
        
        {/* Export Button Skeleton */}
        <div className="flex items-center justify-center gap-2 bg-gray-200 h-9 w-32 animate-pulse border border-[#e0e0e0]">
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ChartLine, title: 'Total Revenue' },
          { icon: Layers, title: 'Avg Order Value' },
          { icon: Document, title: 'Total Pages Printed' },
          { icon: Activity, title: 'Active Queue' }
        ].map((_, i) => (
          <div key={i} className="bg-white border border-[#e0e0e0] p-5 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-gray-100 h-8 w-8 animate-pulse"></div>
              <div className="h-3 w-20 bg-gray-200 animate-pulse rounded-sm"></div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded-sm"></div>
              <div className="h-3 w-16 bg-gray-100 animate-pulse rounded-sm"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Combo Chart Skeleton */}
      <div className="bg-white border border-[#e0e0e0] p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-4 w-48 bg-gray-200 animate-pulse"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-gray-200 animate-pulse" />
              <div className="h-3 w-10 bg-gray-200 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-gray-200 animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="h-80 w-full bg-gray-50 flex items-end justify-between gap-2 p-4 pb-8 animate-pulse border border-gray-100">
           {/* fake bars */}
           {[30, 50, 40, 70, 60, 80, 45, 55, 90, 65, 35, 75].map((height, i) => (
             <div key={i} className="flex-1 bg-gray-200 w-full max-w-[30px] mx-auto rounded-t-sm" style={{ height: `${height}%` }}></div>
           ))}
        </div>
      </div>

      {/* Donut Charts Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: 'Color Mode Distribution' },
          { title: 'Paper Size Distribution' }
        ].map((_, i) => (
          <div key={i} className="bg-white border border-[#e0e0e0] p-6">
            <div className="h-4 w-48 bg-gray-200 animate-pulse mb-4"></div>
            <div className="h-56 w-full flex items-center justify-center animate-pulse">
               <div className="w-40 h-40 rounded-full border-[16px] border-gray-100"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white border border-[#e0e0e0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e0e0e0] flex justify-between items-center">
           <div className="h-4 w-32 bg-gray-200 animate-pulse"></div>
           <div className="h-3 w-16 bg-gray-200 animate-pulse"></div>
        </div>
        <div className="w-full">
           <table className="w-full text-sm">
             <thead>
               <tr className="bg-carbon-gray-10 border-b border-[#e0e0e0] h-10">
                 <th className="px-6"></th>
                 <th className="px-6"></th>
                 <th className="px-6"></th>
                 <th className="px-6"></th>
                 <th className="px-6"></th>
                 <th className="px-6"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {[1, 2, 3, 4, 5].map((i) => (
                 <tr key={i} className="animate-pulse">
                   <td className="px-6 py-4"><div className="h-3 w-20 bg-gray-200 rounded-sm"></div></td>
                   <td className="px-6 py-4"><div className="h-3 w-20 bg-gray-200 rounded-sm"></div></td>
                   <td className="px-6 py-4 flex justify-end"><div className="h-3 w-8 bg-gray-200 rounded-sm"></div></td>
                   <td className="px-6 py-4"><div className="h-3 w-16 bg-gray-200 rounded-sm ml-auto"></div></td>
                   <td className="px-6 py-4"><div className="h-3 w-24 bg-gray-200 rounded-sm"></div></td>
                   <td className="px-6 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full"></div></td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>

    </div>
  );
};

