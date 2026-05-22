import React, { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { useNavigate } from 'react-router-dom';

export const MyOrdersList: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        orderService.getUserOrders()
            .then(data => {
                setOrders(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const formatState = (state: string, hasReceipts: boolean) => {
        switch (state) {
            case 'OPEN_INQUIRY': return { text: 'Pending Checkout', color: 'bg-yellow-100 text-yellow-800' };
            case 'AWAITING_PAYMENT': return hasReceipts 
                ? { text: 'Payment Denied', color: 'bg-red-100 text-red-800' }
                : { text: 'Awaiting Payment', color: 'bg-blue-100 text-blue-800' };
            case 'AWAITING_PAYMENT_VERIFICATION': return { text: 'Verifying Payment', color: 'bg-yellow-100 text-yellow-800' };
            case 'PROOF_APPROVED': return { text: 'Proof Approved', color: 'bg-indigo-100 text-indigo-800' };
            case 'IN_PRODUCTION': return { text: 'In Production', color: 'bg-purple-100 text-purple-800' };
            case 'READY_FOR_PICKUP': return { text: 'Ready', color: 'bg-green-100 text-green-800' };
            case 'COMPLETED': return { text: 'Completed', color: 'bg-gray-100 text-gray-800' };
            default: return { text: state, color: 'bg-gray-100 text-gray-800' };
        }
    };

    const getRemainingTime = (createdAt: string) => {
        const expiryTime = new Date(createdAt).getTime() + 15 * 60000;
        const diff = expiryTime - now;
        if (diff <= 0) return 'Expired';
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return <div className="text-center py-10 animate-pulse text-gray-500 font-semibold">Loading orders...</div>;
    }

    if (orders.length === 0) {
        return (
            <div className="bg-white p-12 text-center shadow-sm border border-gray-100 max-w-4xl mx-auto mt-10">
                <p className="text-gray-500 font-semibold mb-4 text-lg">You have no active or historical orders.</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 bg-black text-white font-bold py-2 px-6 hover:bg-gray-800 transition-colors"
                >
                    Create New Order
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white shadow-sm border border-gray-100 overflow-hidden max-w-6xl mx-auto mt-8">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                        {order.id.slice(0, 8)}...
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {order.shops?.name || 'Unknown Shop'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        ${order.total.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col items-start">
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${badge.color}`}>
                                                {badge.text}
                                            </span>
                                            {order.state === 'OPEN_INQUIRY' && (
                                                <span className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">
                                                    Expires in {getRemainingTime(order.created_at)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                                        {(order.state === 'OPEN_INQUIRY' || order.state === 'AWAITING_PAYMENT') && (
                                            <button 
                                                onClick={() => navigate(`/checkout/${order.id}`)}
                                                className={`text-white px-4 py-1.5 rounded transition-colors ${order.state === 'AWAITING_PAYMENT' ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-800'}`}
                                            >
                                                {order.state === 'AWAITING_PAYMENT' ? 'Re-upload Receipt' : 'Checkout'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
