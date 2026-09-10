import React from 'react';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeaders?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  columns = 5, 
  rows = 5,
  showHeaders = true 
}) => {
  return (
    <div className="w-full bg-white border border-[#e0e0e0] overflow-hidden">
      {showHeaders && (
        <div className="flex border-b border-[#e0e0e0] bg-gray-50 p-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1 px-2">
              <div className="h-4 bg-gray-200 w-24 animate-pulse"></div>
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-[#e0e0e0]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex p-4 items-center">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1 px-2">
                <div 
                  className="h-4 bg-gray-100 animate-pulse" 
                  style={{ width: `${Math.max(40, Math.random() * 80 + 20)}%` }}
                ></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
