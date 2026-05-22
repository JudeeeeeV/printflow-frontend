import React, { useState, useEffect } from 'react';
import { ProgressTimeline } from '../ProgressTimeline/ProgressTimeline';
import { QRCodeDisplay } from '../QRCodeDisplay/QRCodeDisplay';
import { ReceiptUploadZone } from '../ReceiptUploadZone/ReceiptUploadZone';
import { SubmitVerificationButton } from '../SubmitVerificationButton/SubmitVerificationButton';
import { orderService } from '../../../services/orderService';
import { useNavigate } from 'react-router-dom';

interface CheckoutCardProps {
    orderId: string;
    amount: number;
    gcashNumber: string;
    gcashQrUrl?: string;
    createdAt?: string;
    orderState?: string;
    paymentReceipts?: any[];
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({ orderId, amount, gcashNumber, gcashQrUrl, createdAt, orderState, paymentReceipts }) => {
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!createdAt) return;

        const updateTimer = () => {
            const expiryTime = new Date(createdAt).getTime() + 15 * 60000;
            const now = Date.now();
            const diff = expiryTime - now;

            if (orderState === 'AWAITING_PAYMENT_VERIFICATION' || orderState === 'IN_PRODUCTION' || orderState === 'COMPLETED' || orderState === 'AWAITING_PAYMENT') {
                setTimeLeft('');
                setIsExpired(false);
                return;
            }

            if (diff <= 0) {
                setTimeLeft('00:00');
                setIsExpired(true);
            } else {
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);

        return () => clearInterval(intervalId);
    }, [createdAt, orderState]);

    useEffect(() => {
        if (isExpired) {
            alert('Your order has expired. Redirecting to dashboard.');
            navigate('/new-order');
        }
    }, [isExpired, navigate]);

    const handleSubmit = async () => {
        if (!receiptFile) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await orderService.uploadReceipt(orderId, receiptFile, referenceNumber);
            
            alert('Receipt uploaded successfully. Awaiting clerk verification.');
            navigate('/new-order'); // Redirect to dashboard
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload receipt. Please try again.';
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel this order? This cannot be undone.')) {
            return;
        }

        setIsCancelling(true);
        setError(null);
        try {
            await orderService.cancelOrder(orderId);
            navigate('/new-order');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order.';
            setError(errorMessage);
            setIsCancelling(false);
        }
    };

    return (
        <div className="bg-white p-8 shadow-sm border border-gray-100 max-w-2xl mx-auto w-full relative overflow-hidden">
            {isExpired && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <p className="text-xl font-black text-red-600">Order Expired</p>
                </div>
            )}
            
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-black">Checkout & Payment</h2>
                    {timeLeft && orderState !== 'AWAITING_PAYMENT_VERIFICATION' && (
                        <p className="text-sm font-semibold text-red-500 mt-1">
                            Expires in: {timeLeft}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/new-order')}
                        className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-all active:scale-95 shadow-sm"
                        title="Return to Dashboard"
                    >
                        Return to Dashboard
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center shadow-sm"
                        title="Cancel Order"
                    >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        Cancel Order
                    </button>
                </div>
            </div>
            
            <ProgressTimeline currentStep={2} />

            <div className="mt-8 space-y-8">
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4">
                        <p className="text-red-700 text-sm font-semibold">{error}</p>
                    </div>
                )}

                {orderState === 'AWAITING_PAYMENT' && paymentReceipts && paymentReceipts.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                        <p className="text-red-700 text-sm font-bold">Payment Denied</p>
                        <p className="text-red-600 text-sm">Your previous payment submission was rejected. Please verify the amount and GCash number, and upload a new receipt.</p>
                    </div>
                )}

                {orderState === 'AWAITING_PAYMENT_VERIFICATION' ? (
                    <div className="bg-yellow-50 border border-yellow-200 p-8 text-center flex flex-col items-center justify-center rounded-sm">
                        <svg className="w-16 h-16 text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h3 className="text-xl font-bold text-yellow-800 mb-2">Verifying Payment...</h3>
                        <p className="text-yellow-700">The print shop is currently reviewing your uploaded receipt. We'll notify you once it's approved and production begins.</p>
                    </div>
                ) : (
                    <>
                        <QRCodeDisplay gcashNumber={gcashNumber} gcashQrUrl={gcashQrUrl} amount={amount} />
                        
                        <div className="border-t border-gray-100 pt-8">
                            <ReceiptUploadZone 
                                onReceiptSelect={setReceiptFile} 
                                selectedFile={receiptFile} 
                            />
                            
                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">GCash Reference Number (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1234567890123"
                                    value={referenceNumber}
                                    onChange={(e) => setReferenceNumber(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-2">Entering the reference number helps speed up the verification process.</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <SubmitVerificationButton 
                                onSubmit={handleSubmit} 
                                isSubmitting={isSubmitting} 
                                disabled={!receiptFile || isExpired} 
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
