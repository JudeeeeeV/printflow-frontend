import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckmarkFilled, Close, Time, WarningAlt } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { ProgressTimeline } from '../ProgressTimeline/ProgressTimeline';
import { QRCodeDisplay } from '../QRCodeDisplay/QRCodeDisplay';
import { ReceiptUploadZone } from '../ReceiptUploadZone/ReceiptUploadZone';
import { SubmitVerificationButton } from '../SubmitVerificationButton/SubmitVerificationButton';
import { orderService } from '../../../services/orderService';
import { AlertModal } from '../../common/AlertModal';

interface PaymentReceipt {
 receipt_url?: string;
 reference_number?: string;
}

interface CheckoutCardProps {
 orderId: string;
 amount: number;
 gcashNumber: string;
 gcashQrUrl?: string;
 createdAt?: string;
 expiresAt?: string;
 shopRejectionReason?: string;
 orderState?: string;
 paymentReceipts?: PaymentReceipt[];
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({
 orderId,
 amount,
 gcashNumber,
 gcashQrUrl,
 createdAt,
 expiresAt,
 shopRejectionReason,
 orderState,
 paymentReceipts,
}) => {
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
 const [timeLeft, setTimeLeft] = useState('');
 const [isExpired, setIsExpired] = useState(false);
 const navigate = useNavigate();

 const [alertState, setAlertState] = useState<{
 isOpen: boolean;
 title?: string;
 message: string;
 type?: 'info' | 'success' | 'error' | 'warning';
 onCloseCallback?: () => void;
 }>({ isOpen: false, message: '' });

 const showAlert = (
 message: string,
 type: 'info' | 'success' | 'error' | 'warning' = 'info',
 title?: string,
 onCloseCallback?: () => void,
 ) => setAlertState({ isOpen: true, message, type, title, onCloseCallback });

 useEffect(() => {
 const updateTimer = () => {
 const expiryTime = orderState === 'AWAITING_PAYMENT' && expiresAt
 ? new Date(expiresAt).getTime()
 : createdAt && orderState === 'OPEN_INQUIRY'
 ? new Date(createdAt).getTime() + 15 * 60000
 : null;

 if (expiryTime === null) {
 setTimeLeft('');
 setIsExpired(false);
 return;
 }

 const diff = expiryTime - Date.now();
 if (diff <= 0) {
 setTimeLeft('00:00');
 setIsExpired(true);
 return;
 }

 const mins = Math.floor(diff / 60000);
 const secs = Math.floor((diff % 60000) / 1000);
 if (orderState === 'AWAITING_PAYMENT') {
 const hours = Math.floor(mins / 60);
 const remainingMins = mins % 60;
 setTimeLeft(hours > 0
 ? `${hours}h ${remainingMins.toString().padStart(2, '0')}m`
 : `${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
 } else {
 setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
 }
 };

 updateTimer();
 const intervalId = setInterval(updateTimer, 1000);
 return () => clearInterval(intervalId);
 }, [createdAt, expiresAt, orderState]);

 useEffect(() => {
 if (!isExpired) return;
 const alertTimer = window.setTimeout(() => setAlertState({
 isOpen: true,
 title: 'Order Expired',
 message: 'Your order has expired. Redirecting to dashboard.',
 type: 'warning',
 onCloseCallback: () => navigate('/new-order?tab=orders'),
 }), 0);
 return () => window.clearTimeout(alertTimer);
 }, [isExpired, navigate]);

 const handleSubmit = async () => {
 if (!receiptFile) return;
 setIsSubmitting(true);
 setError(null);
 try {
 await orderService.uploadReceipt(orderId, receiptFile, referenceNumber);
 setShowSuccessModal(true);
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Failed to upload receipt. Please try again.');
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
 navigate('/new-order?tab=orders');
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Failed to cancel order.');
 setIsCancelling(false);
 }
 };

 const handleDispute = async () => {
 if (!disputeReason.trim()) {
 showAlert('Please provide a reason for the dispute.', 'warning', 'Missing Information');
 return;
 }

 setIsDisputing(true);
 try {
 await orderService.disputePayment(orderId, disputeReason);
 showAlert('Payment dispute escalated to administration.', 'success', 'Dispute Submitted', () => {
 navigate('/new-order?tab=orders');
 });
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Failed to escalate dispute.');
 setIsDisputing(false);
 }
 };

 const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60';

 return (
 <article aria-busy={isSubmitting || isCancelling || isDisputing} className="relative w-full overflow-hidden border border-black bg-white shadow-[0_20px_60px_rgba(0,0,0,0.36)]">

 {isExpired && (
 <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/90 p-6 backdrop-blur-sm" role="status">
 <div className="border border-black bg-white px-8 py-7 text-center shadow-xl">
 <WarningAlt aria-hidden="true" className="mx-auto h-10 w-10 text-red-700" />
 <p className="mt-4 text-xl font-black text-carbon-gray-100">Order expired</p>
 <p className="mt-2 text-sm text-gray-600">Close the notice to return to your orders.</p>
 </div>
 </div>
 )}

 <header className="border-b border-gray-300 bg-white px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
 <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
 <div className="min-w-0">
 <h1 className="mt-1 text-2xl font-black tracking-tight text-carbon-gray-100 sm:text-3xl">Checkout &amp; Payment</h1>
 <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-600">
 <span className="border border-gray-300 bg-carbon-gray-10 px-2.5 py-1 font-mono">Order #{orderId.slice(0, 8)}</span>
 {timeLeft && orderState !== 'AWAITING_PAYMENT_VERIFICATION' && (
 <span className="flex items-center gap-1.5 border-l-4 border-carbon-blue-60 bg-blue-50 px-2.5 py-1 text-carbon-gray-100" role="timer" aria-live="off">
 <Time aria-hidden="true" className="h-4 w-4" />
 Expires in <span className="font-black tabular-nums">{timeLeft}</span>
 </span>
 )}
 </div>
 </div>

 <div className="grid w-full gap-2 min-[480px]:grid-cols-2 lg:w-auto">
 <button
 type="button"
 onClick={() => navigate('/new-order?tab=orders')}
 className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 bg-carbon-gray-100 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-black ${focusClass} motion-reduce:transition-none`}
 >
 <ArrowLeft aria-hidden="true" className="h-4 w-4" />
 Return to Dashboard
 </button>
 <button
 type="button"
 onClick={() => setShowCancelModal(true)}
 disabled={isCancelling}
 className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 bg-red-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 ${focusClass} disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none`}
 >
 <Close aria-hidden="true" className="h-4 w-4" />
 Cancel Order
 </button>
 </div>
 </div>
 </header>

 <ProgressTimeline currentStep={2} />

 <div className="space-y-5 p-4 sm:p-6 lg:p-8">
 {error && (
 <div className="border-l-4 border-red-700 bg-red-50 px-4 py-3" role="alert">
 <p className="text-sm font-bold text-red-800">{error}</p>
 </div>
 )}

 {orderState === 'AWAITING_PAYMENT' && paymentReceipts && paymentReceipts.length > 0 && (
 <section aria-labelledby="payment-denied-heading" className="border border-red-300 border-l-4 border-l-red-700 bg-red-50 p-4 sm:p-5">
 <div className="flex items-start gap-3">
 <WarningAlt aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
 <div className="min-w-0">
 <h2 id="payment-denied-heading" className="font-black text-red-900">Payment denied</h2>
 <p className="mt-1 text-sm leading-relaxed text-red-900">Previous payment submission was rejected. Upload a valid receipt before the timer expires.</p>
 {shopRejectionReason && (
 <div className="mt-3 border border-red-200 bg-white px-3 py-2 text-sm text-carbon-gray-100">
 <span className="font-black">Shop reason:</span> {shopRejectionReason}
 </div>
 )}
 <button
 type="button"
 onClick={() => setShowDisputeModal(true)}
 className={`mt-4 min-h-11 border border-red-700 bg-white px-4 py-2 text-sm font-bold text-red-800 transition-colors hover:bg-red-100 ${focusClass} motion-reduce:transition-none`}
 >
 Dispute rejection
 </button>
 </div>
 </div>
 </section>
 )}

 {orderState === 'ESCALATED_DISPUTE' ? (
 <section className="flex min-h-72 flex-col items-center justify-center border border-blue-300 bg-blue-50 px-6 py-10 text-center" role="status">
 <span className="flex h-16 w-16 items-center justify-center bg-carbon-blue-60 text-white">
 <WarningAlt aria-hidden="true" className="h-8 w-8" />
 </span>
 <h2 className="mt-5 text-xl font-black text-carbon-gray-100">Dispute under review</h2>
 <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-700">Platform administration is reviewing your payment dispute. You will be notified when a decision is available.</p>
 </section>
 ) : orderState === 'AWAITING_PAYMENT_VERIFICATION' ? (
 <section className="flex min-h-72 flex-col items-center justify-center border border-gray-300 bg-carbon-gray-10 px-6 py-10 text-center" role="status">
 <span className="flex h-16 w-16 items-center justify-center bg-carbon-gray-100 text-white">
 <Time aria-hidden="true" className="h-8 w-8" />
 </span>
 <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">Receipt submitted</p>
 <h2 className="mt-1 text-xl font-black text-carbon-gray-100">Verifying payment</h2>
 <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-700">Print shop is reviewing your receipt. You will be notified once payment is approved and production begins.</p>
 </section>
 ) : (
 <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6">
 <QRCodeDisplay gcashNumber={gcashNumber} gcashQrUrl={gcashQrUrl} amount={amount} />

 <section aria-labelledby="verification-heading" className="border border-black bg-white">
 <div className="border-b border-gray-300 px-5 py-4 sm:px-6">
 <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">Step 02</p>
 <h2 id="verification-heading" className="mt-1 text-xl font-black text-carbon-gray-100">Verify your payment</h2>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Upload your transaction receipt so the print shop can confirm payment.</p>
 </div>
 <div className="space-y-6 p-5 sm:p-6">
 <ReceiptUploadZone onReceiptSelect={setReceiptFile} selectedFile={receiptFile} />

 <div>
 <label htmlFor="gcash-reference-number" className="block text-sm font-bold text-carbon-gray-100">GCash reference number <span className="font-normal text-gray-500">(optional)</span></label>
 <input
 id="gcash-reference-number"
 type="text"
 inputMode="numeric"
 placeholder="e.g. 1234567890123"
 value={referenceNumber}
 onChange={(event) => setReferenceNumber(event.target.value)}
 aria-describedby="gcash-reference-help"
 className="mt-2 min-h-12 w-full border border-gray-500 bg-carbon-gray-10 px-4 py-3 text-base text-carbon-gray-100 transition-colors placeholder:text-gray-500 focus:border-carbon-blue-60 focus:outline-none focus:ring-2 focus:ring-carbon-blue-60 motion-reduce:transition-none"
 />
 <p id="gcash-reference-help" className="mt-2 text-xs leading-relaxed text-gray-600">Adding the reference number can speed up verification.</p>
 </div>

 <SubmitVerificationButton onSubmit={handleSubmit} isSubmitting={isSubmitting} disabled={!receiptFile || isExpired} />
 <div className="flex items-start gap-2 border-t border-gray-300 pt-4 text-xs leading-relaxed text-gray-600">
 <CheckmarkFilled aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
 Receipt is sent only to the print shop handling this order.
 </div>
 </div>
 </section>
 </div>
 )}
 </div>

 {showDisputeModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="dispute-title">
 <div className="w-full max-w-md border border-black bg-white shadow-2xl">
 <div className="border-t-4 border-carbon-blue-60 px-5 py-5 sm:px-6">
 <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">Payment review</p>
 <h2 id="dispute-title" className="mt-1 text-xl font-black text-carbon-gray-100">Dispute rejection</h2>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Explain why the payment is valid. Platform administration will review your receipt and explanation.</p>
 </div>
 <div className="border-t border-gray-300 p-5 sm:p-6">
 <label htmlFor="dispute-reason" className="block text-sm font-bold text-carbon-gray-100">Reason for dispute</label>
 <textarea
 id="dispute-reason"
 autoFocus
 value={disputeReason}
 onChange={(event) => setDisputeReason(event.target.value)}
 placeholder="I transferred the exact amount to the number provided..."
 className="mt-2 h-32 w-full resize-none border border-gray-500 p-3 text-base focus:outline-none focus:ring-2 focus:ring-carbon-blue-60"
 />
 <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <button type="button" onClick={() => setShowDisputeModal(false)} className={`min-h-11 border border-black bg-white px-4 py-2 text-sm font-bold text-carbon-gray-100 hover:bg-carbon-gray-10 ${focusClass}`}>Cancel</button>
 <button type="button" onClick={handleDispute} disabled={isDisputing} className={`min-h-11 bg-carbon-blue-60 px-5 py-2 text-sm font-bold text-white hover:bg-carbon-blue-70 ${focusClass} disabled:cursor-not-allowed disabled:opacity-50`}>
 {isDisputing ? 'Submitting...' : 'Submit dispute'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {showSuccessModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="success-title">
 <div className="w-full max-w-md border border-black bg-white shadow-2xl">
 <div className="border-t-4 border-green-600 p-6 text-center">
 <CheckmarkFilled aria-hidden="true" className="mx-auto h-10 w-10 text-green-600" />
 <h2 id="success-title" className="mt-4 text-xl font-black text-carbon-gray-100">Upload successful</h2>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Receipt uploaded successfully and is awaiting clerk verification.</p>
 <button
 type="button"
 autoFocus
 onClick={() => {
 setShowSuccessModal(false);
 navigate('/new-order?tab=orders');
 }}
 className={`mt-6 min-h-11 w-full bg-carbon-gray-100 px-6 py-2 text-sm font-bold text-white hover:bg-black ${focusClass}`}
 >
 Continue to dashboard
 </button>
 </div>
 </div>
 </div>
 )}

 {showCancelModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
 <div className="w-full max-w-md border border-black bg-white shadow-2xl">
 <div className="px-5 py-5 sm:px-6">
 <h2 id="cancel-order-title" className="mt-1 text-xl font-black text-carbon-gray-100">Cancel order?</h2>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">This action cannot be undone. Your order and payment window will be cancelled.</p>
 </div>
 <div className="flex flex-col-reverse gap-2 border-t border-gray-300 p-5 sm:flex-row sm:justify-end sm:p-6">
 <button type="button" autoFocus onClick={() => setShowCancelModal(false)} className={`min-h-11 border border-black bg-white px-4 py-2 text-sm font-bold text-carbon-gray-100 hover:bg-carbon-gray-10 ${focusClass}`}>No, keep order</button>
 <button type="button" onClick={handleCancel} disabled={isCancelling} className={`min-h-11 bg-red-700 px-5 py-2 text-sm font-bold text-white hover:bg-red-600 ${focusClass} disabled:cursor-not-allowed disabled:opacity-50`}>
 {isCancelling ? 'Cancelling...' : 'Yes, cancel order'}
 </button>
 </div>
 </div>
 </div>
 )}

 <AlertModal
 isOpen={alertState.isOpen}
 message={alertState.message}
 title={alertState.title}
 type={alertState.type}
 onClose={() => {
 setAlertState((previous) => ({ ...previous, isOpen: false }));
 if (alertState.onCloseCallback) alertState.onCloseCallback();
 }}
 />
 </article>
 );
};
