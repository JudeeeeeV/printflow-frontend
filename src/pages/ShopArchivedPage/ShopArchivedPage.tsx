import React, { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { TableSkeleton } from '../../components/common/TableSkeleton';

export interface Order {
 id: string;
 student_id: string;
 created_at: string;
 total: number;
 state: string;
}

export const ShopArchivedPage: React.FC = () => {
 const [orders, setOrders] = useState<Order[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [requestAttempt, setRequestAttempt] = useState(0);

 useEffect(() => {
 let isCurrent = true;
 const fetchArchived = async () => {
 try {
 const data = await orderService.getShopOrders();
 // Filter for only completed/printed orders
 if (isCurrent) setOrders(data.filter(o => o.state === 'PRINTED'));
 } catch (err: unknown) {
 if (isCurrent) {
 setError(err instanceof Error ? err.message : 'Unable to load archived orders. Please try again.');
 }
 } finally {
 if (isCurrent) setIsLoading(false);
 }
 };
 void fetchArchived();
 return () => {
 isCurrent = false;
 };
 }, [requestAttempt]);

 const handleRetry = () => {
 setError(null);
 setIsLoading(true);
 setRequestAttempt(attempt => attempt + 1);
 };

 if (isLoading) return <TableSkeleton columns={5} rows={6} />;

 if (error) return (
 <div className="p-4 font-sans sm:p-8">
 <h1 className="mb-6 text-2xl font-bold text-carbon-gray-100">Archived Orders</h1>
 <div className="border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-5 sm:p-6">
 <div role="alert">
 <h2 className="text-lg font-bold text-carbon-gray-100">Unable to load archived orders</h2>
 <p className="mt-2 text-sm text-gray-600">{error}</p>
 </div>
 <button
 type="button"
 onClick={handleRetry}
 className="mt-4 min-h-11 cursor-pointer bg-carbon-blue-60 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
 >
 Retry
 </button>
 </div>
 </div>
 );

 return (
 <div className="p-8 font-sans h-full flex flex-col">
 <h1 className="text-2xl font-bold text-carbon-gray-100 mb-6">Archived Orders</h1>
 <div className="flex-1 overflow-y-auto bg-white border border-[#e0e0e0] ">
 <table className="w-full text-left text-sm text-gray-600">
 <thead className="bg-carbon-gray-10 text-gray-700 uppercase font-semibold text-xs border-b border-[#e0e0e0]">
 <tr>
 <th className="px-6 py-4">Order ID</th>
 <th className="px-6 py-4">Customer</th>
 <th className="px-6 py-4">Date</th>
 <th className="px-6 py-4">Total</th>
 <th className="px-6 py-4">Status</th>
 </tr>
 </thead>
 <tbody>
 {orders.map(order => (
 <tr key={order.id} className="border-b border-gray-100 hover:bg-carbon-gray-10">
 <td className="px-6 py-4 font-medium text-carbon-gray-100">#{order.id.slice(0, 8)}</td>
 <td className="px-6 py-4">{order.student_id?.slice(0,8) || 'Unknown'}</td>
 <td className="px-6 py-4">{new Date(order.created_at).toLocaleDateString()}</td>
 <td className="px-6 py-4">₱{order.total}</td>
 <td className="px-6 py-4">
 <span className="bg-gray-100 text-gray-700 px-2 py-1 text-xs font-semibold">
 {order.state.replace(/_/g, ' ')}
 </span>
 </td>
 </tr>
 ))}
 {orders.length === 0 && (
 <tr>
 <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No archived orders found.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 );
};
