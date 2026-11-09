import type { QueueFilters, QueueSection } from '../../services/shopQueueService';
const QUEUE_STATUSES: Record<QueueSection, string[]> = {
 new: ['OPEN_INQUIRY','PENDING_VERIFICATION','UNPAID','REJECTED','DISPUTED','REVIEW_REQUIRED','REFUND_DUE'],
 ready: ['IN_PRODUCTION','QUEUED','RECEIVED','DOWNLOADING','SUBMITTING','FAILED_PRE_SUBMISSION','OUTCOME_UNKNOWN'],
 pickup: ['PRINTED','READY_FOR_PICKUP','SUBMITTED','MANUAL_STARTED','UNCLAIMED'],
 history: ['COMPLETED','CANCELLED','REJECTED','EXPIRED','REFUNDED'],
};
const activeQueueFilterCount = (filters: QueueFilters) => Number(Boolean(filters.searchQuery.trim())) + ['paperSize','colorMode','paymentMethod','status'].filter(key => filters[key as keyof QueueFilters] !== 'ALL').length + Number(Boolean(filters.dateFrom)) + Number(Boolean(filters.dateTo));
import { displayOrderStatus } from './orderCardTitle';

interface KanbanFilterBarProps {
 contextLabel: string;
 queue: QueueSection;
 filters: QueueFilters;
 searchQuery: string;
 onSearch: (query: string) => void;
 paperSizeFilter: string;
 setPaperSizeFilter: (size: string) => void;
 colorModeFilter: string;
 setColorModeFilter: (mode: string) => void;
 onFilterChange: (field: keyof QueueFilters, value: string) => void;
 onClear: () => void;
}

const controlClass = 'block h-11 w-full min-w-0 border border-black bg-white px-3 text-base text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60 sm:text-sm lg:h-9';
export const KanbanFilterBar = ({ contextLabel, queue, filters, searchQuery, onSearch, paperSizeFilter, setPaperSizeFilter, colorModeFilter, setColorModeFilter, onFilterChange, onClear }: KanbanFilterBarProps) => {
 const activeCount = activeQueueFilterCount(filters);
 return (
 <div className="shrink-0 space-y-2 border-b border-gray-300 bg-white px-3 py-2">
   <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-[minmax(12rem,2fr)_1fr_1fr_1.3fr]">
     <label className="col-span-2 min-w-0 text-xs font-bold lg:col-span-1">Search {contextLabel}
       <input type="search" value={searchQuery} onChange={event => onSearch(event.target.value)} placeholder="Reference, title, filename or customer" className={controlClass} />
     </label>
     <label className="min-w-0 text-xs font-bold">Paper size
       <select value={paperSizeFilter} onChange={event => setPaperSizeFilter(event.target.value)} className={controlClass}>
         <option value="ALL">All sizes</option><option value="SHORT">Short</option><option value="A4">A4</option><option value="LONG">Long</option>
       </select>
     </label>
     <label className="min-w-0 text-xs font-bold">Color mode
       <select value={colorModeFilter} onChange={event => setColorModeFilter(event.target.value)} className={controlClass}>
         <option value="ALL">All modes</option><option value="COLOR">Color</option><option value="BLACK_AND_WHITE">B&W</option>
       </select>
     </label>
     <label className="col-span-2 min-w-0 text-xs font-bold lg:col-span-1">Sort by
       <select value={filters.sort} onChange={event => onFilterChange('sort', event.target.value)} className={controlClass}>
         <option value="default">{queue === 'new' ? 'Review first, oldest created' : queue === 'history' ? 'Recently closed' : 'Oldest created'} (default)</option>
         <option value="oldest">Oldest created</option><option value="newest">Newest created</option><option value="title">Order title A-Z</option><option value="customer">Customer name A-Z</option>
       </select>
     </label>
   </div>
   <div className="flex flex-wrap items-start gap-x-4">
     <details className="min-w-0 flex-1">
       <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Additional filters ({activeCount} active)</summary>
       <div className="grid min-w-0 gap-2 pb-2 sm:grid-cols-2 lg:grid-cols-4">
         <label className="min-w-0 text-xs font-bold">Payment method
           <select value={filters.paymentMethod} onChange={event => onFilterChange('paymentMethod', event.target.value)} className={controlClass}>
             <option value="ALL">All methods</option><option value="GCASH">GCash</option><option value="CASH_ON_PICKUP">Cash on pickup</option>
           </select>
         </label>
         <label className="min-w-0 text-xs font-bold">Status
           <select value={filters.status} onChange={event => onFilterChange('status', event.target.value)} className={controlClass}>
             <option value="ALL">All statuses</option>{QUEUE_STATUSES[queue].map(state => <option key={state} value={state}>{displayOrderStatus(state)}</option>)}
           </select>
         </label>
         <label className="min-w-0 text-xs font-bold">Created from (Manila)
           <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={event => onFilterChange('dateFrom', event.target.value)} className={controlClass} />
         </label>
         <label className="min-w-0 text-xs font-bold">Created through (Manila)
           <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={event => onFilterChange('dateTo', event.target.value)} className={controlClass} />
         </label>
       </div>
     </details>
     <button type="button" onClick={onClear} disabled={activeCount === 0} className="min-h-11 px-2 text-sm font-bold text-carbon-blue-70 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:opacity-50">Clear filters</button>
   </div>
 </div>
 );
};
