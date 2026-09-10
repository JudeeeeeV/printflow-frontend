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
 expiresAt?: string;
 shopRejectionReason?: string;
 orderState?: string;
 paymentReceipts?: any[];
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({ orderId, amount, gcashNumber, gcashQrUrl, createdAt, expiresAt, shopRejectionReason, orderState, paymentReceipts }) => {
 const [receiptFile, setReceiptFile] = useState<File | null>(null);
 const [referenceNumber, setReferenceNumber] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [isCancelling, setIsCancelling] = useState(false);
 const [showDisputeModal, setShowDisputeModal] = useState(false);
 const [disputeReason, setDisputeReason] = useState('');
 const [isDisputing, setIsDisputing] = useState(false);
 const [showSuccessModal, setShowSuccessModal] = useState(false);
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [timeLeft, setTimeLeft] = useState<string>('');
 const [isExpired, setIsExpired] = useState(false);
 const navigate = useNavigate();

 useEffect(() => {
 const updateTimer = () => {
 let expiryTime = 0;
 if (orderState === 'AWAITING_PAYMENT' && expiresAt) {
 expiryTime = new Date(expiresAt).getTime();
 } else if (createdAt && orderState === 'OPEN_INQUIRY') {
 expiryTime = new Date(createdAt).getTime() + 15 * 60000;
 } else {
 setTimeLeft('');
 setIsExpired(false);
 return;
 }

 const now = Date.now();
 const diff = expiryTime - now;

 if (diff <= 0) {
 setTimeLeft('00:00');
 setIsExpired(true);
 } else {
 const mins = Math.floor(diff / 60000);
 const secs = Math.floor((diff % 60000) / 1000);
 
 if (orderState === 'AWAITING_PAYMENT') {
 const hours = Math.floor(mins / 60);
 const remainingMins = mins % 60;
 if (hours > 0) {
 setTimeLeft(`${hours}h ${remainingMins.toString().padStart(2, '0')}m`);
 } else {
 setTimeLeft(`${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
 }
 } else {
 setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
 }
 }
 };

 updateTimer();
 const intervalId = setInterval(updateTimer, 1000);

 return () => clearInterval(intervalId);
 }, [createdAt, expiresAt, orderState]);

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
 
 setShowSuccessModal(true);
 } catch (err: unknown) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to upload receipt. Please try again.';
 setError(errorMessage);
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleCancel = async () => {
 setIsCancelling(true);
 setError(null);
 try {
 await orderService.cancelOrder(orderId);
 setShowCancelModal(false);
 navigate('/new-order');
 } catch (err: unknown) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order.';
 setError(errorMessage);
 setIsCancelling(false);
 }
 };

 const handleDispute = async () => {
 if (!disputeReason.trim()) {
 alert('Please provide a reason for the dispute.');
 return;
 }

 setIsDisputing(true);
 try {
 await orderService.disputePayment(orderId, disputeReason);
 alert('Payment dispute escalated to administration.');
 navigate('/new-order');
 } catch (err: unknown) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to escalate dispute.';
 setError(errorMessage);
 setIsDisputing(false);
 }
 };

 return (
 <div className="bg-white p-8 border border-gray-100 max-w-2xl mx-auto w-full relative overflow-hidden">
 {showDisputeModal && (
 <div className="fixed inset-0 bg-carbon-blue-60 hover:bg-carbon-blue-70/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white p-6 max-w-md w-full ">
 <h3 className="text-xl font-black mb-2">Dispute Rejection</h3>
 <p className="text-sm text-gray-600 mb-4">Please explain why you believe the payment is valid. Platform administration will review your receipt and explanation.</p>
 <textarea
 value={disputeReason}
 onChange={(e) => setDisputeReason(e.target.value)}
 placeholder="I transferred the exact amount to the number provided..."
 className="w-full h-32 p-3 border border-[#8d8d8d] focus:outline-none focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 mb-4 resize-none"
 ></textarea>
 <div className="flex justify-end space-x-3">
 <button
 onClick={() => setShowDisputeModal(false)}
 className="px-4 py-2 font-bold text-gray-600 hover:text-carbon-gray-100"
 >
 Cancel
 </button>
 <button
 onClick={handleDispute}
 disabled={isDisputing}
 className="px-4 py-2 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white font-bold transition-colors disabled:opacity-50"
 >
 {isDisputing ? 'Submitting...' : 'Submit Dispute'}
 </button>
 </div>
 </div>
 </div>
 )}

 {isExpired && (
 <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
 <p className="text-xl font-black text-carbon-gray-100">Order Expired</p>
 </div>
 )}
 
 <div className="flex justify-between items-center mb-6">
 <div>
 <h2 className="text-2xl font-black text-carbon-gray-100">Checkout & Payment</h2>
 {timeLeft && orderState !== 'AWAITING_PAYMENT_VERIFICATION' && (
 <p className="text-sm font-semibold text-carbon-gray-100 mt-1">
 Expires in: {timeLeft}
 </p>
 )}
 </div>
 
 <div className="flex items-center space-x-4">
 <button
 onClick={() => navigate('/new-order')}
 className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-[#e0e0e0] hover:bg-carbon-gray-10 hover:border-[#8d8d8d] transition-all active:scale-95 "
 title="Return to Dashboard"
 >
 Return to Dashboard
 </button>
 <button
 onClick={() => setShowCancelModal(true)}
 disabled={isCancelling}
 className="px-4 py-2 text-sm font-bold text-carbon-gray-100 bg-gray-100 border border-gray-300 hover:bg-gray-200 hover:border-gray-300 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center "
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
 <div className="bg-gray-100 border-l-4 border-carbon-gray-100 p-4">
 <p className="text-carbon-gray-100 text-sm font-semibold">{error}</p>
 </div>
 )}

 {orderState === 'AWAITING_PAYMENT' && paymentReceipts && paymentReceipts.length > 0 && (
 <div className="bg-gray-100 border-l-4 border-carbon-gray-100 p-4 mb-4">
 <p className="text-carbon-gray-100 text-sm font-bold">Payment Denied</p>
 <p className="text-carbon-gray-100 text-sm mb-2">Your previous payment submission was rejected.</p>
 {shopRejectionReason && (
 <p className="text-carbon-gray-100 text-sm font-medium bg-gray-200 p-2 mb-3">
 <strong>Reason:</strong> {shopRejectionReason}
 </p>
 )}
 <p className="text-carbon-gray-100 text-sm font-semibold mb-3">Please upload a valid receipt, or this order will be cancelled when the timer expires.</p>
 <button
 onClick={() => setShowDisputeModal(true)}
 className="text-sm font-bold text-carbon-gray-100 underline hover:text-gray-700"
 >
 Dispute Rejection
 </button>
 </div>
 )}

 {orderState === 'ESCALATED_DISPUTE' ? (
 <div className="bg-blue-50 border border-blue-200 p-8 text-center flex flex-col items-center justify-center ">
 <svg className="w-16 h-16 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
 </svg>
 <h3 className="text-xl font-bold text-blue-800 mb-2">Dispute Under Review</h3>
 <p className="text-blue-700">Platform administration is currently reviewing your payment dispute. You will be notified of their decision.</p>
 </div>
 ) : orderState === 'AWAITING_PAYMENT_VERIFICATION' ? (
 <div className="bg-yellow-50 border border-yellow-200 p-8 text-center flex flex-col items-center justify-center ">
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
 className="w-full px-4 py-3 bg-carbon-gray-10 border border-[#e0e0e0] focus:outline-none focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 transition-all"
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
 
 {/* Custom Success Modal */}
 {showSuccessModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <div className="bg-white p-6 max-w-md w-full shadow-xl">
 <h3 className="text-xl font-bold text-carbon-gray-100 mb-2">Upload Successful</h3>
 <p className="text-sm text-gray-600 mb-6">Receipt uploaded successfully. Awaiting clerk verification.</p>
 <div className="flex justify-end">
 <button 
 onClick={() => {
 setShowSuccessModal(false);
 navigate('/new-order');
 }}
 className="px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors"
 >
 Continue
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Cancel Confirmation Modal */}
 {showCancelModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <div className="bg-white p-6 max-w-md w-full shadow-xl">
 <h3 className="text-xl font-bold text-carbon-gray-100 mb-2">Cancel Order?</h3>
 <p className="text-sm text-gray-600 mb-6">Are you sure you want to cancel this order? This cannot be undone.</p>
 <div className="flex justify-end gap-3">
 <button 
 onClick={() => setShowCancelModal(false)}
 className="px-4 py-2 text-carbon-gray-100 font-bold hover:bg-carbon-gray-10 transition-colors"
 >
 No, Keep Order
 </button>
 <button 
 onClick={handleCancel}
 disabled={isCancelling}
 className="px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
 >
 {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
