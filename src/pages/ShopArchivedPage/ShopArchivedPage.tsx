import React, { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

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

    useEffect(() => {
        const fetchArchived = async () => {
            const data = await orderService.getShopOrders();
            // Filter for only completed/printed orders
            setOrders(data.filter(o => o.state === 'PRINTED'));
            setIsLoading(false);
        };
        fetchArchived();
    }, []);

    if (isLoading) return <LoadingSpinner message="Loading archived orders..." />;

    return (
        <div className="p-8 font-sans h-full flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Archived Orders</h1>
            <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b border-gray-200">
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
                            <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">#{order.id.slice(0, 8)}</td>
                                <td className="px-6 py-4">{order.student_id?.slice(0,8) || 'Unknown'}</td>
                                <td className="px-6 py-4">{new Date(order.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4">₱{order.total}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
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
