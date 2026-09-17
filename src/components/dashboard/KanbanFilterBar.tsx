import React, { useState, useEffect } from 'react';
import { Search, ChevronDown } from '@carbon/icons-react';

interface KanbanFilterBarProps {
 onSearch: (query: string) => void;
 paperSizeFilter: string;
 setPaperSizeFilter: (size: string) => void;
 colorModeFilter: string;
 setColorModeFilter: (mode: string) => void;
}

export const KanbanFilterBar: React.FC<KanbanFilterBarProps> = ({
 onSearch,
 paperSizeFilter,
 setPaperSizeFilter,
 colorModeFilter,
 setColorModeFilter,
}) => {
 const [localQuery, setLocalQuery] = useState('');

 // Debounce logic
 useEffect(() => {
 const handler = setTimeout(() => {
 onSearch(localQuery);
 }, 300);

 return () => {
 clearTimeout(handler);
 };
 }, [localQuery, onSearch]);

 return (
 <div className="flex shrink-0 flex-col flex-wrap items-stretch justify-between gap-3 border-b border-[#e0e0e0] bg-white p-3 sm:p-4 xl:flex-row xl:items-center">
 {/* Search Input */}
 <div className="relative w-full min-w-0 xl:max-w-md xl:flex-1">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Search className="h-4 w-4 text-gray-400" />
 </div>
 <input
 type="text"
 aria-label="Search by Order ID or Client ID"
 value={localQuery}
 onChange={(e) => setLocalQuery(e.target.value)}
 placeholder="Search by Order ID or Client ID..."
 className="block min-h-11 w-full border border-[#8d8d8d] bg-white py-2 pl-10 pr-3 text-base font-medium leading-5 text-carbon-gray-100 placeholder-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm"
 />
 </div>

 {/* Advanced Filters */}
 <div className="grid w-full min-w-0 grid-cols-2 gap-3 xl:w-auto">
 <div className="flex min-w-0 flex-col gap-2">
 <label htmlFor="queue-paper-size" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Paper Size</label>
 <div className="relative">
 <select
 id="queue-paper-size"
 value={paperSizeFilter}
 onChange={(e) => setPaperSizeFilter(e.target.value)}
 className="block min-h-11 w-full min-w-0 cursor-pointer appearance-none border border-[#8d8d8d] bg-carbon-gray-10 py-2 pl-3 pr-9 text-base font-medium text-carbon-gray-100 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm"
 >
 <option value="ALL">All Sizes</option>
 <option value="SHORT">Short</option>
 <option value="A4">A4</option>
 <option value="LONG">Long</option>
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
 </div>
 </div>

 <div className="flex min-w-0 flex-col gap-2">
 <label htmlFor="queue-color-mode" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color Mode</label>
 <div className="relative">
 <select
 id="queue-color-mode"
 value={colorModeFilter}
 onChange={(e) => setColorModeFilter(e.target.value)}
 className="block min-h-11 w-full min-w-0 cursor-pointer appearance-none border border-[#8d8d8d] bg-carbon-gray-10 py-2 pl-3 pr-9 text-base font-medium text-carbon-gray-100 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm"
 >
 <option value="ALL">All Modes</option>
 <option value="COLOR">Color</option>
 <option value="BLACK_AND_WHITE">B&W</option>
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
 </div>
 </div>
 </div>
 </div>
 );
};
