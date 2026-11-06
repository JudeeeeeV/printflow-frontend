import React, { useCallback, useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { useNavigate } from 'react-router-dom';
import { TableSkeleton } from '../common/TableSkeleton';
import { ArrowDown, ArrowUp, Filter, ChevronDown } from '@carbon/icons-react';
import { Pagination } from '../common/Pagination';
import { useDataEvents } from '../../hooks/useDataEvents';

export const MyOrdersList: React.FC = () => {
 const [orders, setOrders] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [now, setNow] = useState(Date.now());
 const [sortByDate, setSortByDate] = useState<'asc' | 'desc'>('desc');
 const [statusFilter, setStatusFilter] = useState('All');
 const [currentPage, setCurrentPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const navigate = useNavigate();

 useEffect(() => {
 const timer = setInterval(() => setNow(Date.now()), 1000);
 return () => clearInterval(timer);
 }, []);

 const fetchOrders = useCallback(() => {
 setIsLoading(true);
 return orderService.getUserOrders(sortByDate, statusFilter, currentPage, 10)
 .then(res => {
 setOrders(res.data);
 setTotalPages(res.meta.totalPages);
 setIsLoading(false);
 })
 .catch(err => {
 console.error(err);
 setIsLoading(false);
 });
 }, [sortByDate, statusFilter, currentPage]);

 useEffect(() => {
 void fetchOrders();
 }, [fetchOrders]);

 useDataEvents(['orders', 'receipts'], () => void fetchOrders());

 const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 setStatusFilter(e.target.value);
 setCurrentPage(1);
 };

 const handleSortChange = () => {
 setSortByDate(sortByDate === 'desc' ? 'asc' : 'desc');
 setCurrentPage(1);
 };

 const formatState = (state: string, hasReceipts: boolean) => {
 switch (state) {
 case 'OPEN_INQUIRY': return { text: 'Awaiting shop / payment', color: 'bg-yellow-100 text-yellow-800' };
 case 'AWAITING_PAYMENT': return hasReceipts 
 ? { text: 'Payment Denied', color: 'bg-gray-200 text-carbon-gray-100' }
 : { text: 'Awaiting Payment', color: 'bg-blue-100 text-blue-800' };
 case 'AWAITING_PAYMENT_VERIFICATION': return { text: 'Verifying Payment', color: 'bg-yellow-100 text-yellow-800' };
 case 'PROOF_APPROVED': return { text: 'Proof Approved', color: 'bg-indigo-100 text-indigo-800' };
 case 'COMPLETED': return { text: 'Handed over', color: 'bg-gray-200 text-carbon-gray-100 font-bold' };
 case 'READY_FOR_PICKUP': return { text: 'Ready for pickup', color: 'bg-blue-100 text-blue-800' };
 case 'IN_PRODUCTION': return { text: 'In Production', color: 'bg-purple-100 text-purple-800' };
 case 'PRINTED': return { text: 'Printed; awaiting output confirmation', color: 'bg-gray-200 text-carbon-gray-100 font-bold' };
 case 'ESCALATED_DISPUTE': return { text: 'Dispute Under Review', color: 'bg-blue-100 text-blue-800' };
 default: return { text: state, color: 'bg-gray-100 text-gray-800' };
 }
 };

 const getRemainingTime = (targetTime: string, isFromNow: boolean) => {
 if (!targetTime) return 'Expired';
 const expiryTime = isFromNow ? new Date(targetTime).getTime() + 15 * 60000 : new Date(targetTime).getTime();
 const diff = expiryTime - now;
 if (diff <= 0) return 'Expired';
 
 const mins = Math.floor(diff / 60000);
 const secs = Math.floor((diff % 60000) / 1000);
 
 const hours = Math.floor(mins / 60);
 const remainingMins = mins % 60;
 
 if (hours > 0) {
 return `${hours}h ${remainingMins.toString().padStart(2, '0')}m`;
 }
 return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };

 return (
 <div className="bg-white border border-black overflow-hidden max-w-6xl mx-auto mt-8">
 <div className="p-4 border-b border-gray-100 bg-carbon-gray-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center space-x-2">
 <Filter className="w-4 h-4 text-gray-500" />
 <div className="relative">
 <select
 value={statusFilter}
 onChange={handleStatusChange}
 className="bg-white border border-[#8d8d8d] text-carbon-gray-100 text-sm focus:outline-carbon-blue-60 focus:border-black block w-48 py-2 pl-3 pr-8 font-medium appearance-none cursor-pointer"
 >
 <option value="All">All Statuses</option>
 <option value="OPEN_INQUIRY">Awaiting shop / payment</option>
 <option value="AWAITING_PAYMENT">Awaiting Payment</option>
 <option value="AWAITING_PAYMENT_VERIFICATION">Verifying Payment</option>
 <option value="IN_PRODUCTION">In Production</option>
 <option value="PRINTED">Printed; awaiting output confirmation</option>
 <option value="ESCALATED_DISPUTE">Dispute Under Review</option>
 <option value="READY_FOR_PICKUP">Ready for pickup</option>
 <option value="COMPLETED">Handed over</option>
 <option value="DUE_AT_PICKUP">Cash due at pickup</option>
 <option value="REFUND_DUE">Refund due</option>
 <option value="REFUNDED">Refund recorded</option>
 <option value="CANCELLED">Cancelled</option>
 <option value="REJECTED">Shop rejected</option>
 <option value="EXPIRED">Expired</option>
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
 </div>
 </div>
 <button
 onClick={handleSortChange}
 className="flex items-center space-x-2 bg-white border border-[#8d8d8d] px-3 py-2 text-sm font-medium text-gray-700 hover:bg-carbon-gray-10"
 >
 <span>Date: {sortByDate === 'desc' ? 'Newest First' : 'Oldest First'}</span>
 {sortByDate === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
 </button>
 </div>
 
 {isLoading ? (
 <div className="py-12">
        <TableSkeleton columns={5} rows={5} />
 </div>
 ) : orders.length === 0 ? (
 <div className="bg-white p-12 text-center">
 <p className="text-gray-500 font-semibold mb-4 text-lg">No orders found matching these criteria.</p>
 <button 
 onClick={() => window.location.reload()}
 className="mt-4 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white font-bold py-2 px-6 transition-colors"
 >
 Create New Order
 </button>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-carbon-gray-10">
 <tr>
 <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Order ID</th>
 <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Shop</th>
 <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
 <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Total</th>
 <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Actions</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {orders.map(order => {
 const hasReceipts = true; // In the DB, order might not return receipts here if not joined, but AWAITING_PAYMENT means it had receipts rejected because initial is OPEN_INQUIRY
 const badge = formatState(order.state, hasReceipts);
 return (
 <tr key={order.id} className="hover:bg-carbon-gray-10 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-carbon-gray-100">
 {order.id.slice(0, 8)}...
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
 {order.shops?.name || 'Unknown Shop'}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
 {new Date(order.created_at).toLocaleDateString()}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-carbon-gray-100">
 ₱{order.total.toFixed(2)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex flex-col items-start">
 <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold ${badge.color}`}>
 {badge.text}
 </span>
 <span className="mt-2 text-xs font-bold text-gray-800">{order.payment_method === 'CASH_ON_PICKUP' ? 'Cash on pickup' : 'GCash'} ? {order.payment_status?.replaceAll('_', ' ')}</span>
 <span className="mt-1 text-xs text-gray-600">Shop: {order.acceptance_status?.replaceAll('_', ' ')}</span>
 {order.acceptance_reason && <span className="mt-1 max-w-xs whitespace-normal text-xs text-red-700">{order.acceptance_reason}</span>}
 {order.payment_status === 'REFUND_DUE' && <span className="mt-1 max-w-xs whitespace-normal text-xs text-amber-800">Contact the shop for your full manual refund.</span>}
 {order.is_unclaimed && <span className="mt-1 max-w-xs whitespace-normal text-xs text-amber-800">Unclaimed: {order.unclaimed_reason}. Contact the shop to collect.</span>}
 {order.payment_method === 'GCASH' && order.payment_status === 'UNPAID' && order.expires_at && (
 <span className="text-[10px] text-carbon-gray-100 font-bold mt-1.5 ml-1">
 Expires in {getRemainingTime(order.expires_at, false)}
 </span>
 )}
 {order.payment_method === 'GCASH' && order.payment_status === 'REJECTED' && order.expires_at && (
 <span className="text-[10px] text-carbon-gray-100 font-bold mt-1.5 ml-1">
 Expires in {getRemainingTime(order.expires_at, false)}
 </span>
 )}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
 {(
 <button 
 onClick={() => navigate(`/checkout/${order.id}`)}
 className={`text-white px-4 py-1.5 transition-colors ${order.state === 'AWAITING_PAYMENT' ? 'bg-carbon-gray-100 hover:bg-carbon-gray-100' : 'bg-carbon-blue-60 hover:bg-carbon-blue-70 '}`}
 >
 View order
 </button>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 {!isLoading && orders.length > 0 && totalPages > 1 && (
 <div className="p-4 border-t border-gray-100 bg-carbon-gray-10 flex items-center justify-center">
 <Pagination 
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={(p) => {
 setCurrentPage(p);
 window.scrollTo(0, 0);
 }}
 />
 </div>
 )}
 </div>
 );
};
