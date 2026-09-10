import React from 'react';
import { ChevronLeft, ChevronRight } from '@carbon/icons-react';

interface PaginationProps {
 currentPage: number;
 totalPages: number;
 onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
 const getPageNumbers = () => {
 if (totalPages <= 5) {
 return Array.from({ length: totalPages }, (_, i) => i + 1);
 }
 if (currentPage <= 3) {
 return [1, 2, 3, '...', totalPages];
 }
 if (currentPage >= totalPages - 2) {
 return [1, '...', totalPages - 2, totalPages - 1, totalPages];
 }
 return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
 };

 const pages = getPageNumbers();

 return (
 <div className="flex items-center justify-center space-x-2 py-4">
 <button
 onClick={() => onPageChange(currentPage - 1)}
 disabled={currentPage === 1}
 className="p-2 border border-[#8d8d8d] bg-white text-gray-500 disabled:opacity-50 hover:bg-gray-100 transition-colors"
 aria-label="Previous page"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 
 {pages.map((page, index) => (
 <React.Fragment key={index}>
 {page === '...' ? (
 <span className="px-3 py-2 text-gray-500 font-medium">...</span>
 ) : (
 <button
 onClick={() => onPageChange(page as number)}
 className={`px-4 py-2 border text-sm font-medium transition-colors ${
 currentPage === page
 ? 'bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white border-black'
 : 'bg-white border-[#8d8d8d] text-gray-700 hover:bg-gray-100'
 }`}
 >
 {page}
 </button>
 )}
 </React.Fragment>
 ))}

 <button
 onClick={() => onPageChange(currentPage + 1)}
 disabled={currentPage === totalPages}
 className="p-2 border border-[#8d8d8d] bg-white text-gray-500 disabled:opacity-50 hover:bg-gray-100 transition-colors"
 aria-label="Next page"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 );
};
