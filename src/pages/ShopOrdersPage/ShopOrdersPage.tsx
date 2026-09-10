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

export const ShopOrdersPage: React.FC = () => {
 const [orders, setOrders] = useState<Order[]>([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 const fetchOrders = async () => {
 const data = await orderService.getShopOrders();
 setOrders(data);
 setIsLoading(false);
 };
 fetchOrders();
 }, []);

 if (isLoading) return <TableSkeleton columns={5} rows={6} />;

 return (
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
 </tbody>
 </table>
 </div>
 </div>
 );
};
