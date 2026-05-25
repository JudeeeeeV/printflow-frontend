import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckoutCard } from '../../components/checkout/CheckoutCard/CheckoutCard';
import { orderService } from '../../services/orderService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

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
        return <LoadingSpinner message="Loading order details..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <CheckoutCard 
                    orderId={orderId} 
                    amount={order?.total ?? 15.00}
                    gcashNumber={order?.shops?.gcash_number || "09123456789"}
                    gcashQrUrl={order?.shops?.gcash_qr_url}
                    createdAt={order?.created_at}
                    expiresAt={order?.expires_at}
                    shopRejectionReason={order?.shop_rejection_reason}
                    orderState={order?.state}
                    paymentReceipts={order?.payment_receipts}
                />
            </div>
        </div>
    );
};
