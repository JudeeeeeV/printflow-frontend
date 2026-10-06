import { ChevronLeft, ChevronRight } from '@carbon/icons-react';

interface QueuePaginationProps {
    label: string;
    controlsId: string;
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
}

export const QueuePagination = ({ label, controlsId, page, pageSize, total, onPageChange }: QueuePaginationProps) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    const buttonClass = 'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 border border-black bg-white px-2 py-2 text-sm font-semibold text-carbon-gray-100 transition-colors duration-150 hover:border-carbon-blue-60 hover:bg-blue-50 hover:text-carbon-blue-70 active:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-carbon-gray-10 disabled:text-gray-400 motion-reduce:transition-none';

    return (
        <div className="shrink-0 space-y-2 border-t border-gray-300 bg-white p-3">
            <p className="text-sm tabular-nums text-gray-600">
                {total === 0 ? '0 orders' : <>Showing <span className="font-semibold text-carbon-gray-100">{start}–{end}</span> of {total}</>}
            </p>
            {totalPages > 1 && (
                <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" aria-label={`Previous page of ${label}`} aria-controls={controlsId} disabled={page === 1} onClick={() => onPageChange(page - 1)} className={buttonClass}>
                        <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Previous
                    </button>
                    <span className="text-center text-xs font-semibold tabular-nums text-carbon-blue-70">Page {page} of {totalPages}</span>
                    <button type="button" aria-label={`Next page of ${label}`} aria-controls={controlsId} disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className={buttonClass}>
                        Next
                        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </button>
                </nav>
            )}
        </div>
    );
};
