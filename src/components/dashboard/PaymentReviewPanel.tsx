import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Checkmark, Close } from '@carbon/icons-react';
import buttonStyles from '../maps/Maps.module.css';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { useProtectedFile } from '../common/useProtectedFile';
import { ShopOrderActions } from './ShopOrderActions';
import type { OrderDecisionResponse } from '../../services/orderService';

export interface PaymentReviewOrder {
 output_confirmed_at?: string | null;
 current_attempt?: { resolvedAt?: string | null } | null;
 id: string;
 fingerprint?: string;
 state: string;
 total?: number | string | null;
 payment_status?: string;
 acceptance_status?: string;
 payment_method?: string;
 acceptance_reason?: string;
 is_unclaimed?: boolean;
 order_name?: string | null;
 paper_size?: string | null;
 print_color_mode?: string | null;
 orientation?: string | null;
 page_count?: number | null;
 copies?: number | null;
 assets?: { file_url?: string | null; original_filename?: string | null }[];
 current_receipt_id?: string | null;
 payment_receipts?: { id: string | number; reference_number?: string | null; receipt_url?: string | null }[] | null;
}

interface PaymentReviewPanelProps {
 isOpen: boolean;
 order: PaymentReviewOrder | null;
 onClose: () => void;
 onVerify: (orderId: string, action: 'APPROVE' | 'REJECT', reason: string | undefined, receiptId: string, confirmed: boolean) => Promise<void>;
 isVerifying: boolean;
 decisionsDisabled?: boolean;
 fulfillmentActions?: React.ReactNode;
 onUpdated?: (order: OrderDecisionResponse['order']) => void;
}

const previewButtonClassName = 'inline-flex min-h-11 items-center text-sm font-semibold text-carbon-blue-60 underline hover:text-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60';

const ReceiptPreview: React.FC<{ url: string }> = ({ url }) => {
 const file = useProtectedFile(url);
 const [imageBroken, setImageBroken] = useState(false);
 const failed = imageBroken || file.status === 'failed' || (file.status === 'ready' && file.kind !== 'image');
 return (
 <div className="relative flex h-[min(240px,30dvh)] items-center justify-center overflow-hidden border border-gray-300 bg-carbon-gray-10" aria-busy={file.status === 'loading'}>
 {file.status === 'loading' && <p role="status" className="absolute px-3 text-sm text-gray-600">Loading receipt…</p>}
 {failed ? (
 <p role="status" className="px-3 text-center text-sm text-gray-600">Receipt preview could not be loaded. Refresh the order and try again.</p>
 ) : file.status === 'ready' && (
 <img src={file.objectUrl} alt="Payment receipt" onError={() => setImageBroken(true)} className="h-full w-full object-contain" />
 )}
 </div>
 );
};

const PrintJobDetails: React.FC<{ order: PaymentReviewOrder }> = ({ order }) => {
 // Order refreshes re-sign file URLs, so pin the URL to keep the preview from reloading.
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const asset = order.assets?.find(item => item.file_url);
 const documentUrl = asset?.file_url;
 const fileName = asset?.original_filename;
 const copies = Number.isInteger(order.copies) && Number(order.copies) > 0 ? Number(order.copies) : 1;
 const settings: [string, string][] = [
 ['Paper size', order.paper_size || 'Not set'],
 ['Color', order.print_color_mode === 'COLOR' ? 'Color' : 'B&W'],
 ['Orientation', order.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'],
 ['Pages', Number.isInteger(order.page_count) && Number(order.page_count) > 0 ? String(order.page_count) : 'Unavailable'],
 ['Copies', String(copies)],
 ];
 return (
 <section aria-label="Print job" className="space-y-2 border border-gray-300 p-3">
 <div className="min-w-0">
 <p className="text-sm font-bold">What to print</p>
 {order.order_name && <p className="break-words text-sm">{order.order_name}</p>}
 {fileName && <p className="break-words text-xs text-gray-600">{fileName}</p>}
 </div>
 <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
 {settings.map(([label, value]) => <div key={label}><dt className="text-xs text-gray-600">{label}</dt><dd className="font-bold">{value}</dd></div>)}
 </dl>
 {documentUrl ? (
 <button type="button" onClick={() => setPreviewUrl(documentUrl)} className={previewButtonClassName}>Preview document</button>
 ) : <p className="border border-dashed border-[#8d8d8d] bg-carbon-gray-10 p-3 text-center text-sm text-gray-600">The document could not be loaded. Refresh the order and try again.</p>}
 {previewUrl && <DocumentPreviewModal url={previewUrl} title={`Document for order ${order.id.slice(0, 8)}`} onClose={() => setPreviewUrl(null)} />}
 </section>
 );
};

const PaymentReviewDialog: React.FC<Omit<PaymentReviewPanelProps, 'isOpen' | 'order'> & { order: PaymentReviewOrder }> = ({ order, onClose, onVerify, isVerifying, decisionsDisabled = false, onUpdated, fulfillmentActions }) => {
 const [rejectReason, setRejectReason] = useState('');
 const [confirmed, setConfirmed] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [decisionBusy, setDecisionBusy] = useState(false);
 const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
 const pendingRef = useRef(false);
 const dialogRef = useRef<HTMLDivElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 const errorRef = useRef<HTMLParagraphElement>(null);
 const latestRef = useRef({ onClose, isVerifying, decisionBusy });
 const prefersReducedMotion = useReducedMotion();
 const busy = isVerifying || isSubmitting || decisionBusy;
 const isCash = order.payment_method === 'CASH_ON_PICKUP';
 const receipt = order.payment_receipts?.find(item => String(item.id) === order.current_receipt_id);
 const receiptUrl = receipt?.receipt_url;
 const escalated = order.payment_status === 'DISPUTED' || order.state === 'ESCALATED_DISPUTE';
 const canVerify = !isCash && !escalated && (order.payment_status === 'PENDING_VERIFICATION' || (!order.payment_status && order.state === 'AWAITING_PAYMENT_VERIFICATION'));
 const canResume = !isCash && order.state === 'OPEN_INQUIRY' && order.payment_status === 'VERIFIED' && order.acceptance_status === 'PENDING';
 const evidenceKey = JSON.stringify([order.state, order.payment_status, order.acceptance_status, order.total,
   receipt?.reference_number, order.paper_size, order.print_color_mode, order.orientation, order.page_count, order.copies, order.fingerprint]);
 const [confirmedEvidence, setConfirmedEvidence] = useState(evidenceKey);
 if (confirmedEvidence !== evidenceKey) {
 setConfirmedEvidence(evidenceKey);
 setConfirmed(false);
 }

 useEffect(() => { latestRef.current = { onClose, isVerifying, decisionBusy }; }, [onClose, isVerifying, decisionBusy]);
 useEffect(() => {
 const previousFocus = document.activeElement as HTMLElement | null;
 const previousOverflow = document.body.style.overflow;
 const appRoot = document.getElementById('root');
 const previouslyInert = appRoot?.inert;
 document.body.style.overflow = 'hidden';
 if (appRoot) appRoot.inert = true;
 closeRef.current?.focus();
 const onKeyDown = (event: KeyboardEvent) => {
 // Leave keyboard handling to a nested confirmation or file preview when it has focus.
 if ((event.target as HTMLElement | null)?.closest?.('[role="alertdialog"], [data-document-preview]')) return;
 if (event.key === 'Escape') {
 event.preventDefault();
 if (!pendingRef.current && !latestRef.current.isVerifying && !latestRef.current.decisionBusy) latestRef.current.onClose();
 return;
 }
 if (event.key !== 'Tab') return;
 const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]') || []).filter(control => control.getClientRects().length > 0);
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
 if (!pendingRef.current && !isVerifying && !decisionBusy) onClose();
 };
 const handleVerify = async (action: 'APPROVE' | 'REJECT') => {
 if (pendingRef.current || busy || decisionsDisabled || (!canVerify && !canResume) || (canResume && action !== 'APPROVE')) return;
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
 <h2 id="payment-review-title" className="text-xl font-black">{isCash ? 'Cash on Pickup Order' : 'GCash Order Review'}</h2>
 <p id="payment-review-order" className="text-sm font-medium text-gray-600">Order #{order.id.slice(0, 8)}</p>
 </div>
 <button ref={closeRef} type="button" aria-label="Close payment review" onClick={handleClose} disabled={busy} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 transition-colors hover:bg-carbon-gray-10 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50">
 <Close size={24} aria-hidden="true" />
 </button>
 </header>

 <div className="min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
 <div className="space-y-1 text-sm">
 <p className="font-bold">{isCash ? 'Cash on pickup' : 'GCash'} · {order.payment_status?.replaceAll('_', ' ')}</p>
 {isCash && <p>Shop acceptance: {order.acceptance_status || 'PENDING'}</p>}
 {order.acceptance_reason && <p className="break-words text-red-700">{order.acceptance_reason}</p>}
 </div>
 <div className="flex items-center justify-between gap-3 border border-gray-300 bg-carbon-gray-10 p-3">
 <p className="text-sm font-bold text-gray-600">Order total</p>
 <p className="break-all text-xl font-black">₱{order.total || 0}</p>
 </div>
 <PrintJobDetails order={order} />
 {isCash ? (
 <p className="border border-gray-300 bg-carbon-gray-10 p-3 text-sm leading-relaxed">
 {['CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.state) ? 'This order is closed. No pickup payment is due.' : order.payment_status === 'COLLECTED' ? order.state === 'COMPLETED' ? 'Cash payment has been collected. This order is complete.' : 'Cash payment has been collected.' : `Amount due at pickup: ₱${Number(order.total || 0).toFixed(2)}. Collect payment when the student arrives. Recording cash collection completes the order.`}
 </p>
 ) : <>
 <div>
 <p className="mb-1 text-sm font-bold">GCash Reference Number</p>
 <p className="break-all border border-[#8d8d8d] p-2 font-mono text-base">{receipt?.reference_number || 'Not provided'}</p>
 <p className="mt-2 text-xs text-gray-600">Verifying the receipt authorizes production when the document is valid. Check the document and print settings before verifying.</p>
 {canVerify && ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.state) && <p className="mt-2 text-sm font-bold text-amber-800">This order is closed. Verifying payment creates a manual refund obligation and does not reopen production.</p>}
 </div>
 <div>
 <p className="mb-1 text-sm font-bold">Uploaded Receipt</p>
 {receiptUrl ? (
 <>
 <ReceiptPreview key={receiptUrl} url={receiptUrl} />
 <button type="button" onClick={() => setReceiptPreviewUrl(receiptUrl)} className={`mt-2 ${previewButtonClassName}`}>View full receipt</button>
 {receiptPreviewUrl && <DocumentPreviewModal url={receiptPreviewUrl} title={`Receipt for order ${order.id.slice(0, 8)}`} onClose={() => setReceiptPreviewUrl(null)} />}
 </>
 ) : (
 <p className="border border-dashed border-[#8d8d8d] bg-carbon-gray-10 p-4 text-center text-sm text-gray-600">No receipt image found.</p>
 )}
 </div>
 </>}
 {error && <p ref={errorRef} role="alert" tabIndex={-1} className="break-words border border-red-200 bg-red-50 p-3 text-sm text-red-700 focus:outline focus:outline-2 focus:outline-carbon-blue-60">{error}</p>}
 {(escalated || canVerify || canResume) && <fieldset disabled={decisionsDisabled} aria-label="GCash payment review" className="border-t border-gray-300 bg-carbon-gray-10 p-3">
 {escalated ? (
 <p className="border border-blue-200 bg-blue-50 p-3 text-center text-sm font-bold text-blue-800">This payment is under review by Platform Administration.</p>
 ) : (
 <div className="space-y-2">
 <label className="flex min-h-11 items-start gap-2 text-sm font-medium"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60" /><span>I checked this receipt, reference and full amount against the shop’s transaction records, and reviewed the document and print settings.</span></label>
 {!canResume && <><label htmlFor="payment-rejection-reason" className="block text-sm font-bold">Rejection reason (required when rejecting)</label>
 <input id="payment-rejection-reason" type="text" placeholder="e.g. Blurry, Wrong Amount" value={rejectReason} onChange={event => setRejectReason(event.target.value)} disabled={busy} className="min-h-11 w-full border border-[#8d8d8d] bg-white px-3 py-2 text-base focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 disabled:opacity-50 sm:text-sm" /></>}
 <button type="button" onClick={() => void handleVerify('APPROVE')} disabled={busy} className={`${buttonStyles.primaryButton} w-full`}>
 <Checkmark size={16} aria-hidden="true" /> {canResume ? 'Retry production authorization' : 'Verify payment'}
 </button>
 {!canResume && <button type="button" onClick={() => void handleVerify('REJECT')} disabled={busy} className={`${buttonStyles.secondaryButton} w-full`}>Reject &amp; Request New Receipt</button>}
 <p role="status" className="sr-only">{busy ? 'Verifying payment. Please wait.' : ''}</p>
 </div>
 )}
 </fieldset>}
 {canResume && <p role="status" className="text-sm text-amber-800">Payment is already verified. Restore the document and shop eligibility, then retry production authorization. This does not record payment again.</p>}
 {fulfillmentActions && <fieldset disabled={busy} className="border-t border-gray-300 pt-3" aria-label="Print fulfillment">{fulfillmentActions}</fieldset>}
 {onUpdated && <ShopOrderActions
 order={{ ...order, total: order.total ?? 0, payment_method: order.payment_method || 'GCASH', payment_status: order.payment_status || 'UNPAID', acceptance_status: order.acceptance_status || 'PENDING' }}
 onUpdated={onUpdated} disabled={isVerifying || isSubmitting || decisionsDisabled} onBusyChange={setDecisionBusy}
 />}
 </div>
 </motion.div>
 </div>
 );
};

export const PaymentReviewPanel: React.FC<PaymentReviewPanelProps> = ({ isOpen, order, ...props }) => {
 if (!isOpen || !order) return null;
 return createPortal(<PaymentReviewDialog key={`${order.id}:${order.current_receipt_id || 'missing'}`} order={order} {...props} />, document.body);
};
