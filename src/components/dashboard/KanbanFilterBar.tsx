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
 <div className="bg-white border-b border-[#e0e0e0] p-4 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 sticky top-0">
 {/* Search Input */}
 <div className="relative w-full md:max-w-md">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Search className="h-4 w-4 text-gray-400" />
 </div>
 <input
 type="text"
 value={localQuery}
 onChange={(e) => setLocalQuery(e.target.value)}
 placeholder="Search by Order ID or Client ID..."
 className="block w-full pl-10 pr-3 py-2 border border-[#8d8d8d] leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:outline-carbon-blue-60 focus:border-black sm:text-sm font-medium text-carbon-gray-100 transition-colors"
 />
 </div>

 {/* Advanced Filters */}
 <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Paper Size</label>
 <div className="relative">
 <select
 value={paperSizeFilter}
 onChange={(e) => setPaperSizeFilter(e.target.value)}
 className="appearance-none bg-carbon-gray-10 border border-[#8d8d8d] text-carbon-gray-100 text-sm focus:outline-carbon-blue-60 focus:border-black block pl-3 pr-9 py-2 font-medium cursor-pointer transition-colors"
 >
 <option value="ALL">All Sizes</option>
 <option value="SHORT">Short</option>
 <option value="A4">A4</option>
 <option value="LONG">Long</option>
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color Mode</label>
 <div className="relative">
 <select
 value={colorModeFilter}
 onChange={(e) => setColorModeFilter(e.target.value)}
 className="appearance-none bg-carbon-gray-10 border border-[#8d8d8d] text-carbon-gray-100 text-sm focus:outline-carbon-blue-60 focus:border-black block pl-3 pr-9 py-2 font-medium cursor-pointer transition-colors"
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
