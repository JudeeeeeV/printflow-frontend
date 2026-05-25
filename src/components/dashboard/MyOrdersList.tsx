import React, { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ArrowDown, ArrowUp, Filter, ChevronDown } from 'lucide-react';

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

    useEffect(() => {
        setIsLoading(true);
        orderService.getUserOrders(sortByDate, statusFilter, currentPage, 10)
            .then(res => {
                setOrders(res.data);
                setTotalPages(Math.max(1, Math.ceil(res.total / 10)));
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [sortByDate, statusFilter, currentPage]);

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
            case 'OPEN_INQUIRY': return { text: 'Pending Checkout', color: 'bg-yellow-100 text-yellow-800' };
            case 'AWAITING_PAYMENT': return hasReceipts 
                ? { text: 'Payment Denied', color: 'bg-red-100 text-red-800' }
                : { text: 'Awaiting Payment', color: 'bg-blue-100 text-blue-800' };
            case 'AWAITING_PAYMENT_VERIFICATION': return { text: 'Verifying Payment', color: 'bg-yellow-100 text-yellow-800' };
            case 'PROOF_APPROVED': return { text: 'Proof Approved', color: 'bg-indigo-100 text-indigo-800' };
            case 'IN_PRODUCTION': return { text: 'In Production', color: 'bg-purple-100 text-purple-800' };
            case 'READY_FOR_PICKUP': return { text: 'Ready', color: 'bg-green-100 text-green-800' };
            case 'COMPLETED': return { text: 'Completed', color: 'bg-gray-100 text-gray-800' };
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
        <div className="bg-white shadow-sm border border-gray-100 overflow-hidden max-w-6xl mx-auto mt-8">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={handleStatusChange}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-sm focus:ring-black focus:border-black block w-48 py-2 pl-3 pr-8 font-medium appearance-none cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="OPEN_INQUIRY">Pending Checkout</option>
                            <option value="AWAITING_PAYMENT">Awaiting Payment</option>
                            <option value="AWAITING_PAYMENT_VERIFICATION">Verifying Payment</option>
                            <option value="PROOF_APPROVED">Proof Approved</option>
                            <option value="IN_PRODUCTION">In Production</option>
                            <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="ESCALATED_DISPUTE">Dispute Under Review</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                </div>
                <button
                    onClick={handleSortChange}
                    className="flex items-center space-x-2 bg-white border border-gray-300 px-3 py-2 rounded-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <span>Date: {sortByDate === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                    {sortByDate === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </button>
            </div>
            
            {isLoading ? (
                <div className="py-12">
                    <LoadingSpinner message="Loading orders..." fullPage={false} />
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white p-12 text-center">
                    <p className="text-gray-500 font-semibold mb-4 text-lg">No orders found matching these criteria.</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 bg-black text-white font-bold py-2 px-6 hover:bg-gray-800 transition-colors"
                    >
                        Create New Order
                    </button>
                </div>
            ) : (
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
                                                        Expires in {getRemainingTime(order.created_at, true)}
                                                    </span>
                                                )}
                                                {order.state === 'AWAITING_PAYMENT' && order.expires_at && (
                                                    <span className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">
                                                        Expires in {getRemainingTime(order.expires_at, false)}
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
                                                    {order.state === 'AWAITING_PAYMENT' ? 'Review & Appeal' : 'Checkout'}
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
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 bg-white text-sm font-medium rounded-sm disabled:opacity-50 hover:bg-gray-100 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-600 font-medium">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 bg-white text-sm font-medium rounded-sm disabled:opacity-50 hover:bg-gray-100 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};
