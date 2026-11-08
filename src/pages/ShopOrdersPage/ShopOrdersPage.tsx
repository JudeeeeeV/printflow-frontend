import React, { useEffect, useState } from 'react';
import { PaymentReviewPanel, type PaymentReviewOrder } from '../../components/dashboard/PaymentReviewPanel';
import type { OrderDecisionResponse } from '../../services/orderService';
import { orderService } from '../../services/orderService';
import { TableSkeleton } from '../../components/common/TableSkeleton';
import { useDataEvents } from '../../hooks/useDataEvents';

export interface Order extends PaymentReviewOrder {
 payment_method?: string;
 payment_status?: string;
 acceptance_status?: string;
 id: string;
 student_id: string;
 created_at: string;
 total: number;
 state: string;
}

export const ShopOrdersPage: React.FC = () => {
 const [orders, setOrders] = useState<Order[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [requestAttempt, setRequestAttempt] = useState(0);
 const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
 const [isVerifying, setIsVerifying] = useState(false);
 const selectedOrder = orders.find(order => order.id === selectedOrderId) ?? null;
 const onUpdated = (order: OrderDecisionResponse['order']) => {
   setOrders(previous => previous.map(existing => existing.id === order.id ? { ...existing, ...order } : existing));
   setRequestAttempt(attempt => attempt + 1);
 };
 const onVerify = async (orderId: string, action: 'APPROVE' | 'REJECT', reason: string | undefined, receiptId: string, confirmed: boolean) => {
   setIsVerifying(true);
   try {
     const response = await orderService.verifyPayment(orderId, action, reason, receiptId, confirmed);
     onUpdated(response.order);
     setSelectedOrderId(null);
   } finally { setIsVerifying(false); }
 };


 useEffect(() => {
 let isCurrent = true;
 const fetchOrders = async () => {
 try {
 const data = await orderService.getShopOrders();
 if (isCurrent) { setOrders(data); setError(null); }
 } catch (err: unknown) {
 if (isCurrent) {
 setError(err instanceof Error ? err.message : 'Unable to load orders. Please try again.');
 }
 } finally {
 if (isCurrent) setIsLoading(false);
 }
 };
 void fetchOrders();
 return () => {
 isCurrent = false;
 };
 }, [requestAttempt]);

 useDataEvents(['orders', 'receipts'], () => setRequestAttempt(attempt => attempt + 1));

 const handleRetry = () => {
 setError(null);
 setIsLoading(true);
 setRequestAttempt(attempt => attempt + 1);
 };

 if (isLoading) return <TableSkeleton columns={5} rows={6} />;

 if (error && orders.length === 0) return (
 <div className="p-4 font-sans sm:p-8">
 <h1 className="mb-6 text-2xl font-bold text-carbon-gray-100">All Orders</h1>
 <div className="border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-5 sm:p-6">
 <div role="alert">
 <h2 className="text-lg font-bold text-carbon-gray-100">Unable to load orders</h2>
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
 <>
 <div className="p-8 font-sans h-full flex flex-col">
 <h1 className="text-2xl font-bold text-carbon-gray-100 mb-6">All Orders</h1>
 <div className="flex-1 overflow-y-auto bg-white border border-[#e0e0e0] ">
 <table className="w-full text-left text-sm text-gray-600">
 <thead className="bg-carbon-gray-10 text-gray-700 uppercase font-semibold text-xs border-b border-[#e0e0e0]">
 <tr>
 <th className="px-6 py-4">Order ID</th>
 <th className="px-6 py-4">Customer</th>
 <th className="px-6 py-4">Date</th>
 <th className="px-6 py-4">Total</th>
 <th className="px-6 py-4">Status</th>
 <th className="px-6 py-4">Actions</th>
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
 {order.state === 'COMPLETED' ? 'HANDED OVER' : order.state === 'PRINTED' ? 'PRINTED; OUTPUT UNCONFIRMED' : order.state.replace(/_/g, ' ')}
 </span>
 <p className="mt-2 text-xs">{order.payment_method === 'CASH_ON_PICKUP' ? 'Cash on pickup' : 'GCash'} · {order.payment_status?.replaceAll('_', ' ')}</p>
 {order.payment_method === 'CASH_ON_PICKUP' && <p className="mt-1 text-xs">Shop: {order.acceptance_status?.replaceAll('_', ' ')}</p>}
 </td>
 <td className="px-6 py-4"><button type="button" onClick={() => { setSelectedOrderId(order.id); setRequestAttempt(attempt => attempt + 1); }} className="min-h-11 border border-black px-4 py-2 font-bold hover:bg-gray-100 focus-visible:outline-carbon-blue-60">Review order</button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 <PaymentReviewPanel isOpen={Boolean(selectedOrder)} order={selectedOrder}
   onClose={() => setSelectedOrderId(null)} onUpdated={onUpdated}
   onVerify={onVerify} isVerifying={isVerifying} />
 </>
 );
};
