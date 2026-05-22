import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckoutCard } from '../../components/checkout/CheckoutCard/CheckoutCard';
import { orderService } from '../../services/orderService';

export const CheckoutPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch order details
    useEffect(() => {
        if (!orderId) return;

        const fetchOrder = () => {
            orderService.getOrder(orderId)
                .then(data => {
                    setOrder(data);
                    setIsLoading(false);
                })
                .catch(() => {
                    alert('Order not found or expired.');
                    navigate('/new-order');
                });
        };

        // Initial fetch
        fetchOrder();

        // Poll every 5 seconds
        const intervalId = setInterval(fetchOrder, 5000);

        return () => clearInterval(intervalId);
    }, [navigate, orderId]);

    if (!orderId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500 font-semibold">Invalid Order ID</p>
            </div>
        );
    }
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500 font-semibold animate-pulse">Loading order details...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <CheckoutCard 
                    orderId={orderId} 
                    amount={order?.total || 15.00}
                    gcashNumber="09123456789" // Mock shop GCash number
                    createdAt={order?.created_at}
                    orderState={order?.state}
                    paymentReceipts={order?.payment_receipts}
                />
            </div>
        </div>
    );
};
