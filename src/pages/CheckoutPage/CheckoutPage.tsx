import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckoutCard } from '../../components/checkout/CheckoutCard/CheckoutCard';
import { orderService } from '../../services/orderService';
import { CheckoutSkeleton } from './CheckoutSkeleton';

export const CheckoutPage: React.FC = () => {
 const { orderId } = useParams<{ orderId: string }>();
 const navigate = useNavigate();
 const [order, setOrder] = useState<any>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [orderNotFound, setOrderNotFound] = useState(false);

 // Fetch order details
 useEffect(() => {
 if (!orderId) return;
 
 let isMounted = true;

 const fetchOrder = () => {
 orderService.getOrder(orderId)
 .then(data => {
 if (!isMounted) return;
 setOrder(data);
 setIsLoading(false);
 })
 .catch(() => {
 if (!isMounted) return;
 setOrderNotFound(true);
 setIsLoading(false);
 });
 };

 // Initial fetch
 fetchOrder();

 // Poll every 5 seconds
 const intervalId = setInterval(fetchOrder, 5000);

 return () => {
 isMounted = false;
 clearInterval(intervalId);
 };
 }, [orderId]);

 if (!orderId) {
 return (
 <div className="min-h-screen bg-carbon-gray-10 flex items-center justify-center">
 <p className="text-gray-500 font-semibold">Invalid Order ID</p>
 </div>
 );
 }
 
 if (orderNotFound) {
 return (
 <div className="min-h-screen bg-carbon-gray-10 flex flex-col items-center justify-center font-sans">
 <div className="bg-white p-8 max-w-md w-full shadow-xl text-center border border-[#e0e0e0]">
 <svg className="w-16 h-16 text-carbon-gray-100 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <h3 className="text-xl font-bold text-carbon-gray-100 mb-2">Order Not Found</h3>
 <p className="text-sm text-gray-600 mb-6">This order may have expired, been cancelled, or never existed.</p>
 <button 
 onClick={() => navigate('/new-order')}
 className="w-full px-6 py-3 bg-carbon-gray-100 text-white font-bold hover:bg-black transition-colors"
 >
 Return to Dashboard
 </button>
 </div>
 </div>
 );
 }

 if (isLoading) {
 return <CheckoutSkeleton />;
 }

 return (
 <div className="min-h-screen bg-carbon-gray-10 py-10 px-4 sm:px-6 lg:px-8 font-sans">
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
