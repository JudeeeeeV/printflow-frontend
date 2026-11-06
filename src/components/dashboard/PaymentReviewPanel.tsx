import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Checkmark, Close } from '@carbon/icons-react';
import buttonStyles from '../maps/Maps.module.css';

interface PaymentReviewOrder {
 id: string;
 state: string;
 total?: number | string | null;
 payment_status?: string;
 acceptance_status?: string;
 current_receipt_id?: string | null;
 payment_receipts?: { id: string | number; reference_number?: string | null; receipt_url?: string | null }[] | null;
}

interface PaymentReviewPanelProps {
 isOpen: boolean;
 order: PaymentReviewOrder | null;
 onClose: () => void;
 onVerify: (orderId: string, action: 'APPROVE' | 'REJECT', reason: string | undefined, receiptId: string, confirmed: boolean) => Promise<void>;
 isVerifying: boolean;
}

const ReceiptPreview: React.FC<{ url: string }> = ({ url }) => {
 const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
 return (
 <div className="relative flex h-[min(240px,30dvh)] items-center justify-center overflow-hidden border border-gray-300 bg-carbon-gray-10" aria-busy={status === 'loading'}>
 {status === 'loading' && <p role="status" className="absolute px-3 text-sm text-gray-600">Loading receipt…</p>}
 {status === 'failed' ? (
 <p role="status" className="px-3 text-center text-sm text-gray-600">Receipt preview could not be loaded. Open the original receipt to inspect it.</p>
 ) : (
 <img src={url} alt="Payment receipt" onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')} className={`h-full w-full object-contain ${status === 'loading' ? 'opacity-0' : ''}`} />
 )}
 </div>
 );
};

const PaymentReviewDialog: React.FC<Omit<PaymentReviewPanelProps, 'isOpen' | 'order'> & { order: PaymentReviewOrder }> = ({ order, onClose, onVerify, isVerifying }) => {
 const [rejectReason, setRejectReason] = useState('');
 const [confirmed, setConfirmed] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const pendingRef = useRef(false);
 const dialogRef = useRef<HTMLDivElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 const errorRef = useRef<HTMLParagraphElement>(null);
 const latestRef = useRef({ onClose, isVerifying });
 const prefersReducedMotion = useReducedMotion();
 const busy = isVerifying || isSubmitting;
 const receipt = order.payment_receipts?.find(item => String(item.id) === order.current_receipt_id);
 const receiptUrl = receipt?.receipt_url;
 const escalated = order.payment_status === 'DISPUTED' || order.state === 'ESCALATED_DISPUTE';

 useEffect(() => { latestRef.current = { onClose, isVerifying }; }, [onClose, isVerifying]);
 useEffect(() => {
 const previousFocus = document.activeElement as HTMLElement | null;
 const previousOverflow = document.body.style.overflow;
 const appRoot = document.getElementById('root');
 const previouslyInert = appRoot?.inert;
 document.body.style.overflow = 'hidden';
 if (appRoot) appRoot.inert = true;
 closeRef.current?.focus();
 const onKeyDown = (event: KeyboardEvent) => {
 if (event.key === 'Escape') {
 event.preventDefault();
 if (!pendingRef.current && !latestRef.current.isVerifying) latestRef.current.onClose();
 return;
 }
 if (event.key !== 'Tab') return;
 const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]') || []).filter(control => control.getClientRects().length > 0);
 const first = controls[0];
 const last = controls[controls.length - 1];
 if (!first) {
 event.preventDefault();
 dialogRef.current?.focus();
 } else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
 event.preventDefault(); last.focus();
 } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
 event.preventDefault(); first.focus();
 }
 };
 document.addEventListener('keydown', onKeyDown);
 return () => {
 document.removeEventListener('keydown', onKeyDown);
 document.body.style.overflow = previousOverflow;
 if (appRoot) appRoot.inert = previouslyInert ?? false;
 const target = previousFocus?.isConnected && previousFocus.getClientRects().length && !previousFocus.closest('[inert]')
 ? previousFocus : document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
 target?.focus();
 };
 }, []);
 useEffect(() => {
 if (error) errorRef.current?.focus();
 }, [error]);

 const handleClose = () => {
 if (!pendingRef.current && !isVerifying) onClose();
 };
 const handleVerify = async (action: 'APPROVE' | 'REJECT') => {
 if (pendingRef.current || isVerifying || escalated) return;
 pendingRef.current = true;
 setIsSubmitting(true);
 setError(null);
 try {
 if (!receipt || !order.current_receipt_id) throw new Error('The current receipt is unavailable. Refresh the order before reviewing.');
 if (action === 'APPROVE' && !confirmed) throw new Error('Confirm the receipt, reference and amount against shop records first.');
 if (action === 'APPROVE' && (!receipt.reference_number?.trim() || !receipt.receipt_url)) throw new Error('A receipt image and reference are required. Request a replacement receipt.');
 if (action === 'REJECT' && !rejectReason.trim()) throw new Error('A rejection reason is required.');
 await onVerify(order.id, action, action === 'REJECT' ? rejectReason.trim() : undefined, order.current_receipt_id, confirmed);
 } catch (err: unknown) {
 setError(err instanceof Error && err.message ? err.message : 'Failed to verify payment. Please try again.');
 } finally {
 pendingRef.current = false;
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) handleClose(); }}>
 <motion.div
 ref={dialogRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="payment-review-title"
 aria-describedby="payment-review-order"
 aria-busy={busy}
 tabIndex={-1}
 initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: prefersReducedMotion ? 0 : 0.15, ease: 'easeOut' }}
 className="flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden border border-gray-300 bg-white text-carbon-gray-100 shadow-xl focus:outline-hidden"
 >
 <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
 <div className="min-w-0">
 <h2 id="payment-review-title" className="text-xl font-black">Review Payment</h2>
 <p id="payment-review-order" className="text-sm font-medium text-gray-600">Order #{order.id.slice(0, 8)}</p>
 </div>
 <button ref={closeRef} type="button" aria-label="Close payment review" onClick={handleClose} disabled={busy} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 transition-colors hover:bg-carbon-gray-10 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50">
 <Close size={24} aria-hidden="true" />
 </button>
 </header>

 <div className="min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
 <div className="flex items-center justify-between gap-3 border border-gray-300 bg-carbon-gray-10 p-3">
 <p className="text-sm font-bold text-gray-600">Order total</p>
 <p className="break-all text-xl font-black">₱{order.total || 0}</p>
 </div>
 <div>
 <p className="mb-1 text-sm font-bold">GCash Reference Number</p>
 <p className="break-all border border-[#8d8d8d] p-2 font-mono text-base">{receipt?.reference_number || 'Not provided'}</p>
 <p className="mt-2 text-xs text-gray-600">Shop acceptance: {order.acceptance_status || 'PENDING'}. Payment verification does not accept the order.</p>
 {['CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.state) && <p className="mt-2 text-sm font-bold text-amber-800">This order is closed. Verifying payment creates a manual refund obligation and does not reopen production.</p>}
 </div>
 <div>
 <p className="mb-1 text-sm font-bold">Uploaded Receipt</p>
 {receiptUrl ? (
 <>
 <ReceiptPreview key={receiptUrl} url={receiptUrl} />
 <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-carbon-blue-60 underline hover:text-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">Open original receipt</a>
 </>
 ) : (
 <p className="border border-dashed border-[#8d8d8d] bg-carbon-gray-10 p-4 text-center text-sm text-gray-600">No receipt image found.</p>
 )}
 </div>
 {error && <p ref={errorRef} role="alert" tabIndex={-1} className="break-words border border-red-200 bg-red-50 p-3 text-sm text-red-700 focus:outline focus:outline-2 focus:outline-carbon-blue-60">{error}</p>}
 </div>

 <footer className="shrink-0 border-t border-gray-300 bg-carbon-gray-10 p-4">
 {escalated ? (
 <p className="border border-blue-200 bg-blue-50 p-3 text-center text-sm font-bold text-blue-800">This payment is under review by Platform Administration.</p>
 ) : (
 <div className="space-y-2">
 <label className="flex min-h-11 items-start gap-2 text-sm font-medium"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60" /><span>I checked this receipt, reference and full amount against the shop’s transaction records.</span></label>
 <label htmlFor="payment-rejection-reason" className="block text-sm font-bold">Rejection reason (required when rejecting)</label>
 <input id="payment-rejection-reason" type="text" placeholder="e.g. Blurry, Wrong Amount" value={rejectReason} onChange={event => setRejectReason(event.target.value)} disabled={busy} className="min-h-11 w-full border border-[#8d8d8d] bg-white px-3 py-2 text-base focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 disabled:opacity-50 sm:text-sm" />
 <button type="button" onClick={() => void handleVerify('APPROVE')} disabled={busy} className={`${buttonStyles.primaryButton} w-full`}>
 <Checkmark size={16} aria-hidden="true" /> Verify payment
 </button>
 <button type="button" onClick={() => void handleVerify('REJECT')} disabled={busy} className={`${buttonStyles.secondaryButton} w-full`}>Reject &amp; Request New Receipt</button>
 <p role="status" className="sr-only">{busy ? 'Verifying payment. Please wait.' : ''}</p>
 </div>
 )}
 </footer>
 </motion.div>
 </div>
 );
};

export const PaymentReviewPanel: React.FC<PaymentReviewPanelProps> = ({ isOpen, order, ...props }) => {
 if (!isOpen || !order) return null;
 return createPortal(<PaymentReviewDialog key={`${order.id}:${order.current_receipt_id || 'missing'}`} order={order} {...props} />, document.body);
};
