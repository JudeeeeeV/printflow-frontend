import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown } from '@carbon/icons-react';

interface KanbanFilterBarProps {
 contextLabel: string;
 searchQuery: string;
 onSearch: (query: string) => void;
 paperSizeFilter: string;
 setPaperSizeFilter: (size: string) => void;
 colorModeFilter: string;
 setColorModeFilter: (mode: string) => void;
}

export const KanbanFilterBar: React.FC<KanbanFilterBarProps> = ({
 contextLabel,
 searchQuery,
 onSearch,
 paperSizeFilter,
 setPaperSizeFilter,
 colorModeFilter,
 setColorModeFilter,
}) => {
 const [localQuery, setLocalQuery] = useState(searchQuery);
 const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 return () => {
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 };
 }, []);

 const handleSearchChange = (value: string) => {
 setLocalQuery(value);
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 searchTimerRef.current = setTimeout(() => {
 onSearch(value);
 searchTimerRef.current = null;
 }, 300);
 };

 const flushPendingSearch = () => {
 if (!searchTimerRef.current) return;
 clearTimeout(searchTimerRef.current);
 searchTimerRef.current = null;
 onSearch(localQuery);
 };

 return (
 <div className="flex shrink-0 flex-col items-stretch justify-between gap-1 border-b border-gray-300 bg-white px-2 py-1 lg:flex-row lg:items-center">
 {/* Search Input */}
 <div className="relative w-full min-w-0 lg:max-w-md lg:flex-1">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Search aria-hidden="true" className="h-4 w-4 text-gray-400" />
 </div>
 <input
 type="text"
 aria-label={`Search ${contextLabel} by Order ID or Client Name`}
 value={localQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 onBlur={flushPendingSearch}
 placeholder={`Search ${contextLabel} by Order ID or Client Name...`}
 className="block h-11 w-full border border-black bg-white py-2 pl-10 pr-3 text-base font-medium leading-5 text-carbon-gray-100 placeholder-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm lg:h-9 lg:py-1.5"
 />
 </div>

 {/* Advanced Filters */}
 <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:w-auto lg:gap-3">
 <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-2">
 <label htmlFor="queue-paper-size" className="text-[10px] font-bold uppercase tracking-wider text-gray-500 lg:whitespace-nowrap">Paper Size</label>
 <div className="relative lg:w-36">
 <select
 id="queue-paper-size"
 value={paperSizeFilter}
 onChange={(e) => setPaperSizeFilter(e.target.value)}
 className="block h-11 w-full min-w-0 cursor-pointer appearance-none border border-black bg-carbon-gray-10 py-2 pl-3 pr-9 text-base font-medium text-carbon-gray-100 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm lg:h-9 lg:py-1.5"
 >
 <option value="ALL">All Sizes</option>
 <option value="SHORT">Short</option>
 <option value="A4">A4</option>
 <option value="LONG">Long</option>
 </select>
 <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
 </div>
 </div>

 <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-2">
 <label htmlFor="queue-color-mode" className="text-[10px] font-bold uppercase tracking-wider text-gray-500 lg:whitespace-nowrap">Color Mode</label>
 <div className="relative lg:w-36">
 <select
 id="queue-color-mode"
 value={colorModeFilter}
 onChange={(e) => setColorModeFilter(e.target.value)}
 className="block h-11 w-full min-w-0 cursor-pointer appearance-none border border-black bg-carbon-gray-10 py-2 pl-3 pr-9 text-base font-medium text-carbon-gray-100 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 sm:text-sm lg:h-9 lg:py-1.5"
 >
 <option value="ALL">All Modes</option>
 <option value="COLOR">Color</option>
 <option value="BLACK_AND_WHITE">B&W</option>
 </select>
 <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
 </div>
 </div>
 </div>
 </div>
 );
};
