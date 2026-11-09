import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useDialogFocus } from '../common/useDialogFocus';
import { attemptHelp, attemptLabel, TONE_CLASSES as toneClassName, type AttemptProgress } from './printFulfillment';

interface PrintJobProgressModalProps {
 isOpen: boolean;
 onClose: () => void;
 jobs: AttemptProgress[];
 /** Recognizable labels per order ID (title and customer). */
 orderLabels: Record<string, string>;
}

const formatTime = (value?: string) => {
 if (!value) return '';
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

export const PrintJobProgressModal: React.FC<PrintJobProgressModalProps> = ({ isOpen, onClose, jobs, orderLabels }) => {
 const dialogRef = useRef<HTMLDivElement>(null);
 const prefersReducedMotion = useReducedMotion();
 useDialogFocus(dialogRef, isOpen, onClose);
 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
 <motion.div
 ref={dialogRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="print-progress-title"
 aria-describedby="print-progress-note"
 initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
 className="flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden border-t-4 border-carbon-blue-60 bg-white shadow-2xl"
 >
 <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-carbon-gray-10 p-4 sm:p-6">
 <div className="min-w-0">
 <h3 id="print-progress-title" className="text-xl font-black text-carbon-gray-100">Print progress</h3>
 <p id="print-progress-note" className="mt-1 text-sm text-gray-600">A submission report means the job reached Windows. Check each printed output before marking it ready.</p>
 </div>
 <button type="button" onClick={onClose} aria-label="Close print progress" className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>

 <ul className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
 {jobs.length === 0 ? (
 <li className="text-center font-medium text-gray-500">No attempts in this batch.</li>
 ) : jobs.map(job => {
 const label = attemptLabel(job);
 const help = attemptHelp(job);
 return (
 <li key={job.attemptId} className="border border-[#e0e0e0] bg-white p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0">
 <p className="font-bold text-carbon-gray-100 [overflow-wrap:anywhere]">{orderLabels[job.orderId] || `Order #${job.orderId.slice(0, 8)}`}</p>
 <p className="text-xs text-gray-600">
 Attempt {job.attemptNumber}{job.kind === 'RETRY' ? ' · retry' : job.kind === 'REPRINT' ? ' · reprint' : ''} · {job.mode === 'MANUAL' ? 'manual' : job.printerName || 'default printer'}
 {formatTime(job.updatedAt) && <> · updated {formatTime(job.updatedAt)}</>}
 </p>
 </div>
 <span className={`shrink-0 px-2 py-1 text-xs font-bold ${toneClassName[label.tone]}`}>{label.text}</span>
 </div>
 {help && <p className="mt-2 border-l-4 border-[#f1c21b] bg-carbon-gray-10 px-3 py-2 text-xs text-carbon-gray-100">{help}</p>}
 </li>
 );
 })}
 </ul>

 <div className="border-t border-gray-200 bg-carbon-gray-10 p-4">
 <button type="button" onClick={onClose} className="min-h-11 w-full bg-gray-200 py-2.5 font-bold text-gray-800 transition-colors hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">
 Dismiss
 </button>
 </div>
 </motion.div>
 </div>,
 document.body,
 );
};
