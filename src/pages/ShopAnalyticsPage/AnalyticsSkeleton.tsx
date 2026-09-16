import React from 'react';
import { Calendar, ChartLine, Document, Layers, Activity } from '@carbon/icons-react';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-7xl" role="status" aria-label="Loading shop analytics">
      <span className="sr-only">Loading shop analytics</span>
      <div className="space-y-5 animate-pulse motion-reduce:animate-none sm:space-y-6" aria-hidden="true">
        {/* Page Header Skeleton */}
        <div className="border border-gray-300 bg-white shadow-[0_12px_32px_rgba(22,22,22,0.08)]">
          <div className="border-t-4 border-t-carbon-blue-60 bg-carbon-gray-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <div className="h-2 w-24 bg-carbon-blue-60/70" />
                <div className="h-6 w-40 bg-white/20 sm:w-56" />
                <div className="h-2.5 w-full max-w-lg bg-white/10" />
              </div>
              <div className="flex min-h-9 w-44 items-center gap-2 border border-white/20 bg-white/5 px-3">
                <Calendar className="h-3.5 w-3.5 text-carbon-blue-60/70" />
                <div className="h-2.5 w-24 bg-white/15" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls Skeleton */}
        <div className="border border-gray-300 bg-white p-4 shadow-[0_8px_24px_rgba(22,22,22,0.05)] sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-6 w-1 bg-carbon-blue-60/60" />
                <div className="space-y-2">
                  <div className="h-3 w-28 bg-gray-300" />
                  <div className="h-3 w-48 bg-gray-200" />
                </div>
              </div>
              <div className="inline-flex w-fit max-w-full flex-wrap border-l border-t border-gray-300 bg-white">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-11 flex-1 border-b border-r border-gray-300 bg-gray-100 sm:w-20 sm:flex-none" />
                ))}
              </div>
            </div>
            <div className="h-12 w-full bg-carbon-blue-60/40 xl:w-36" />
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[ChartLine, Layers, Document, Activity].map((Icon, i) => (
            <div key={i} className="min-w-0 border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-5 shadow-[0_8px_20px_rgba(22,22,22,0.05)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-carbon-gray-100/20">
                  <Icon className="h-5 w-5 text-gray-400" />
                </div>
                <div className="h-3 w-24 bg-gray-200" />
              </div>
              <div className="flex items-end gap-2">
                <div className="h-8 w-28 bg-gray-200" />
                <div className="h-3 w-16 bg-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Main Chart Skeleton */}
        <div className="border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]">
          <div className="flex flex-col gap-4 border-b border-gray-300 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-carbon-blue-60/30" />
              <div className="h-5 w-52 bg-gray-200" />
            </div>
            <div className="h-9 w-44 border border-gray-200 bg-gray-100" />
          </div>
          <div className="flex h-72 items-end justify-between gap-2 p-6 sm:h-80">
            {[30, 50, 40, 70, 60, 80, 45, 55, 90, 65, 35, 75].map((height, i) => (
              <div key={i} className="mx-auto w-full max-w-[30px] flex-1 bg-blue-100" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>

        {/* Distribution Skeletons */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]">
              <div className="space-y-2 border-b border-gray-300 px-5 py-4">
                <div className="h-3 w-24 bg-carbon-blue-60/30" />
                <div className="h-5 w-48 bg-gray-200" />
              </div>
              <div className="flex h-64 items-center justify-center">
                <div className="h-40 w-40 rounded-full border-[16px] border-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="overflow-hidden border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]">
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-4 sm:px-6">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-carbon-blue-60/30" />
              <div className="h-5 w-36 bg-gray-200" />
            </div>
            <div className="h-8 w-20 bg-gray-100" />
          </div>
          <div className="overflow-hidden">
            <div className="h-11 bg-carbon-gray-100" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid h-14 grid-cols-6 items-center gap-4 border-b border-gray-200 px-6">
                <div className="h-3 bg-gray-200" />
                <div className="h-3 bg-gray-100" />
                <div className="h-3 bg-gray-100" />
                <div className="h-3 bg-gray-200" />
                <div className="h-3 bg-gray-100" />
                <div className="h-6 bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

