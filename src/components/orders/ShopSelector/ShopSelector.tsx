import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from '@carbon/icons-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './ShopSelector.module.css';
import type { PrintShop } from '../../../services/orderService';
import { ShopLocation } from '../../maps/ShopLocation';
import { locateForDirections } from '../../../services/directionsService';
import { formatShopDistance, sortShopsByDistance, type ShopPosition } from '../../../services/shopDistance';
import { isShopOpen, sortByShopAvailability } from '../../../services/shopAvailability';

const SHOPS_PER_PAGE = 5;
type SlideDirection = 'next' | 'previous' | null;

interface ShopSelectorProps {
 shops: PrintShop[];
 selectedShopId: string | null;
 onSelect: (id: string | null) => void;
 isLoading?: boolean;
 error?: string;
 onRetry?: () => void;
}

function ShopThumbnail({ photoUrl }: { photoUrl?: string | null }) {
 const [failed, setFailed] = useState(false);
 return (
 <div aria-hidden="true" className="mr-4 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-gray-100">
 {photoUrl && !failed ? (
 <img
 src={photoUrl}
 alt=""
 width={48}
 height={48}
 loading="lazy"
 decoding="async"
 className="h-full w-full object-cover"
 onError={() => setFailed(true)}
 />
 ) : <span className="font-bold text-gray-500">Shop</span>}
 </div>
 );
}

export const ShopSelector: React.FC<ShopSelectorProps> = ({ shops, selectedShopId, onSelect, isLoading = false, error = '', onRetry }) => {
 const [currentPage, setCurrentPage] = useState(1);
 const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);
 const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
 const [userPosition, setUserPosition] = useState<ShopPosition | null>(null);
 const [locating, setLocating] = useState(true);
 const [locationError, setLocationError] = useState('');
 const [availabilityNow, setAvailabilityNow] = useState(() => new Date());
 const activeLocation = useRef<AbortController | null>(null);
 const requestLocation = useCallback(async () => {
  activeLocation.current?.abort();
  const controller = new AbortController();
  activeLocation.current = controller;
  setLocating(true);
  setLocationError('');
  try {
   const position = await locateForDirections(controller.signal);
   if (controller.signal.aborted) return;
   setUserPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
   setCurrentPage(1);
   setSlideDirection(null);
   setExpandedShopId(null);
  } catch (error) {
   if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : 'Your location is unavailable. Try again.');
  } finally {
   if (!controller.signal.aborted) setLocating(false);
   if (activeLocation.current === controller) activeLocation.current = null;
  }
 }, []);
 useEffect(() => {
  const frame = requestAnimationFrame(() => void requestLocation());
  return () => {
   cancelAnimationFrame(frame);
   activeLocation.current?.abort();
  };
 }, [requestLocation]);
 useEffect(() => {
  const timer = window.setInterval(() => setAvailabilityNow(new Date()), 30_000);
  return () => window.clearInterval(timer);
 }, []);
 useEffect(() => {
  if (selectedShopId) {
   const selected = shops.find((shop) => shop.id === selectedShopId);
   if (selected && !isShopOpen(selected, availabilityNow)) onSelect(null);
  }
 }, [availabilityNow, onSelect, selectedShopId, shops]);
 const selectorId = useId();
 const reduceMotion = useReducedMotion();
 const totalPages = Math.max(1, Math.ceil(shops.length / SHOPS_PER_PAGE));
 const displayedPage = Math.min(currentPage, totalPages);
 const firstShopIndex = (displayedPage - 1) * SHOPS_PER_PAGE;
 const sortedShops = useMemo(
  () => sortByShopAvailability(sortShopsByDistance(shops, userPosition), availabilityNow),
  [availabilityNow, shops, userPosition],
 );
 const closestShopId = sortedShops.find(({ shop, distance }) => isShopOpen(shop, availabilityNow) && distance !== null)?.shop.id ?? null;
 const visibleShops = sortedShops.slice(firstShopIndex, firstShopIndex + SHOPS_PER_PAGE);

 const changePage = (page: number, direction: Exclude<SlideDirection, null>) => {
  setSlideDirection(direction);
  setCurrentPage(page);
  setExpandedShopId(null);
 };

 return (
 <div className="mb-8">
 <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Print Shop</h3>
 {isLoading && (
 <div role="status" aria-label="Loading print shops" className="space-y-3">
 <span className="sr-only">Loading print shops…</span>
 {Array.from({ length: SHOPS_PER_PAGE }, (_, index) => (
 <div key={index} aria-hidden="true" className="flex min-h-24 items-center gap-4 border-2 border-gray-200 bg-white p-4 animate-pulse motion-reduce:animate-none">
 <div className="h-12 w-12 shrink-0 bg-gray-200" />
 <div className="flex-1 space-y-3"><div className="h-5 w-2/3 bg-gray-200" /><div className="h-3 w-1/3 bg-gray-100" /></div>
 </div>
 ))}
 </div>
 )}
 {error && (
 <div role="alert" className="mb-3 border border-gray-300 bg-carbon-gray-10 p-4 text-sm text-gray-700">
 <p>{error}</p>
 {onRetry && <button type="button" onClick={onRetry} className="mt-2 min-h-11 px-3 font-semibold text-carbon-blue-60 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Try again</button>}
 </div>
 )}
 {!isLoading && !error && shops.length === 0 && <p role="status" className="border border-gray-300 bg-carbon-gray-10 p-4 text-sm text-gray-600">No verified print shops are available yet. Please check again later.</p>}
 {!isLoading && shops.length > 0 && <>
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <p role="status" className="min-w-0 flex-1 text-xs text-gray-600">
 {locating ? 'Finding your location…' : locationError || (userPosition ? 'Nearest first · Approximate straight-line distances' : 'Allow location access to find the nearest shops.')}
 {locationError && <span className="block mt-1">{userPosition ? 'Distances still use your last location.' : 'You can still choose any shop.'}</span>}
 </p>
 <button type="button" disabled={locating} onClick={() => void requestLocation()}
 className="min-h-11 shrink-0 px-2 text-xs font-bold text-carbon-blue-60 hover:underline disabled:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
 {locating ? 'Locating…' : locationError ? 'Try location again' : 'Update location'}
 </button>
 </div>
 <div className="overflow-hidden">
 <div
 key={displayedPage}
 className={`flex min-h-[528px] flex-col gap-3 ${slideDirection === 'next' ? styles.slideFromRight : slideDirection === 'previous' ? styles.slideFromLeft : ''}`}
 >
 {visibleShops.map(({ shop, distance }) => {
 const open = isShopOpen(shop, availabilityNow);
 const isExpanded = expandedShopId === shop.id && selectedShopId === shop.id;
 const buttonId = `${selectorId}-${shop.id}-button`;
 const panelId = `${selectorId}-${shop.id}-details`;
 return (
 <div key={shop.id} className={`min-w-0 transition-colors duration-200 motion-reduce:transition-none ${
 selectedShopId === shop.id
 ? 'border-4 border-carbon-blue-60 bg-carbon-gray-10'
 : 'border-2 border-[#e0e0e0] hover:border-[#8d8d8d] bg-white'
 }`}>
 <button
 id={buttonId}
 type="button"
 onClick={() => {
 setExpandedShopId(isExpanded ? null : shop.id);
 if (selectedShopId !== shop.id) onSelect(shop.id);
 }}
 disabled={!open}
 aria-pressed={selectedShopId === shop.id}
 aria-expanded={isExpanded}
 aria-controls={isExpanded ? panelId : undefined}
 className={`flex min-h-24 w-full shrink-0 items-center p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60 ${!open ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
 >
 <ShopThumbnail key={shop.shop_photo_url || 'no-photo'} photoUrl={shop.shop_photo_url} />
 <div className="min-w-0 flex-1">
 <h4 className="truncate font-bold text-carbon-gray-100 text-lg" title={shop.name}>{shop.name}</h4>
 <p className="mt-1 text-xs font-medium leading-5 text-gray-600">
 <span className={open ? 'text-blue-600' : 'text-carbon-gray-100'}>
 {open ? 'OPEN' : 'CLOSED'}
 </span>
 <span aria-hidden="true" className="mx-1.5 text-gray-400">|</span>
 <span>{distance !== null ? `${formatShopDistance(distance)} from your location` : userPosition ? 'Distance unavailable' : 'Location needed for distance'}</span>
 </p>
 {shop.opens_at && shop.closes_at && (
 <p className="text-xs text-gray-500">
 Hours: {shop.opens_at.slice(0, 5)} - {shop.closes_at.slice(0, 5)} {shop.availability_override ? '| Open override ON' : '| Philippine time'}
 </p>
 )}
 </div>
 {shop.id === closestShopId && (
 <span className="ml-2 shrink-0 border border-green-500 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-500 sm:ml-3 sm:text-xs">
 CLOSEST
 </span>
 )}
 <ChevronDown size={20} aria-hidden="true" className={`ml-3 shrink-0 text-gray-600 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`} />
 </button>
 <AnimatePresence initial={false}>
 {isExpanded && <motion.div
 key={panelId}
 id={panelId}
 role="region"
 aria-labelledby={buttonId}
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <ShopLocation shop={shop} />
 </motion.div>}
 </AnimatePresence>
 </div>
 );
 })}
 </div>
 </div>
 {totalPages > 1 && (
 <nav
 aria-label="Print shop pages"
 className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-gray-200 pt-4"
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
 className="min-w-0 text-center text-xs font-bold uppercase tracking-[0.06em] text-gray-600 sm:text-sm"
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
 </>}
 </div>
 );
};
