import React, { useState } from 'react';
import styles from './ShopSelector.module.css';

const SHOPS_PER_PAGE = 3;
type SlideDirection = 'next' | 'previous' | null;

interface ShopSelectorProps {
 shops: Array<{ id: string; name: string; rating: number; status: string }>;
 selectedShopId: string | null;
 onSelect: (id: string) => void;
}

export const ShopSelector: React.FC<ShopSelectorProps> = ({ shops, selectedShopId, onSelect }) => {
 const [currentPage, setCurrentPage] = useState(1);
 const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);
 const totalPages = Math.max(1, Math.ceil(shops.length / SHOPS_PER_PAGE));
 const displayedPage = Math.min(currentPage, totalPages);
 const firstShopIndex = (displayedPage - 1) * SHOPS_PER_PAGE;
 const visibleShops = shops.slice(firstShopIndex, firstShopIndex + SHOPS_PER_PAGE);

 const changePage = (page: number, direction: Exclude<SlideDirection, null>) => {
  setSlideDirection(direction);
  setCurrentPage(page);
 };

 return (
 <div className="mb-8">
 <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Print Shop</h3>
 <div className="overflow-hidden">
 <div
 key={displayedPage}
 className={`flex h-[264px] flex-col gap-3 ${slideDirection === 'next' ? styles.slideFromRight : slideDirection === 'previous' ? styles.slideFromLeft : ''}`}
 >
 {visibleShops.map((shop) => (
 <button
 key={shop.id}
 type="button"
 onClick={() => onSelect(shop.id)}
 disabled={shop.status !== 'OPEN'}
 className={`flex h-20 shrink-0 items-center p-4 text-left border-2 transition-all duration-200 ${
 selectedShopId === shop.id
 ? 'border-black bg-carbon-gray-10'
 : 'border-[#e0e0e0] hover:border-[#8d8d8d] bg-white'
 } ${shop.status !== 'OPEN' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
 >
 <div className="flex-shrink-0 w-12 h-12 bg-gray-100 flex items-center justify-center mr-4">
 <span className="font-bold text-gray-500">Shop</span>
 </div>
 <div className="min-w-0 flex-1">
 <h4 className="truncate font-bold text-carbon-gray-100 text-lg" title={shop.name}>{shop.name}</h4>
 <p className="truncate text-sm text-gray-500">
 ⭐ {shop.rating} <span className="mx-2">•</span>
 <span className={shop.status === 'OPEN' ? 'text-blue-600' : 'text-carbon-gray-100'}>
 {shop.status}
 </span>
 </p>
 </div>
 </button>
 ))}
 </div>
 </div>
 {totalPages > 1 && (
 <nav
 aria-label="Print shop pages"
 className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-gray-200 pt-4"
 >
 <button
 type="button"
 onClick={() => changePage(Math.max(1, displayedPage - 1), 'previous')}
 disabled={displayedPage === 1}
 className="inline-flex min-h-11 justify-self-start items-center justify-center border border-[#8d8d8d] bg-white px-4 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-white motion-reduce:transition-none"
 >
 Previous
 </button>

 <span
 aria-live="polite"
 aria-atomic="true"
 className="text-center text-xs font-bold uppercase tracking-[0.12em] text-gray-600 sm:text-sm"
 >
 Page {displayedPage} of {totalPages}
 </span>

 <button
 type="button"
 onClick={() => changePage(Math.min(totalPages, displayedPage + 1), 'next')}
 disabled={displayedPage === totalPages}
 className="inline-flex min-h-11 justify-self-end items-center justify-center border border-carbon-blue-60 bg-carbon-blue-60 px-4 text-sm font-bold text-white transition-colors hover:border-carbon-blue-70 hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 motion-reduce:transition-none"
 >
 Next
 </button>
 </nav>
 )}
 </div>
 );
};
