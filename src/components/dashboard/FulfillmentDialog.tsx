import React, { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../common/useDialogFocus';
import {
 attemptHelp,
 attemptLabel,
 expectedAttemptId,
 milestones,
 needsReconciliationReason,
 OUTPUT_CHECK_KEYS,
 outputCheckItems,
 type AttemptProgress,
 type OutputCheckKey,
 type PrintableOrder,
} from './printFulfillment';
import {
 downloadPinnedFile,
 printFulfillmentService,
 type ExecutionMode,
} from '../../services/printFulfillmentService';

export type FulfillmentMode = 'confirm' | 'handover' | 'retry' | 'resolve' | 'reprint';
type Resolution = 'correct' | 'absent' | 'uncertain';

interface FulfillmentDialogProps {
 mode: FulfillmentMode;
 order: PrintableOrder;
 attempt: AttemptProgress | null;
 title: string;
 agentReady: boolean;
 printers: string[];
 defaultPrinter: string;
 onClose: () => void;
 onDone: (message: string) => void;
}

const TITLES: Record<FulfillmentMode, string> = {
 confirm: 'Confirm output and mark ready',
 handover: 'Record handover',
 retry: 'Retry print attempt',
 resolve: 'Resolve uncertain outcome',
 reprint: 'Record a full reprint',
};

const fieldClass = 'block min-h-11 w-full border border-[#8d8d8d] bg-carbon-gray-10 px-3 py-2 text-sm text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60';
const checkClass = 'mt-0.5 h-5 w-5 shrink-0 cursor-pointer border-gray-500 text-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60';

export const FulfillmentDialog: React.FC<FulfillmentDialogProps> = ({
 mode, order, attempt, title, agentReady, printers, defaultPrinter, onClose, onDone,
}) => {
 const dialogRef = useRef<HTMLDivElement>(null);
 const ids = useId();
 const [isBusy, setIsBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [checks, setChecks] = useState<Record<OutputCheckKey, boolean>>(
 () => Object.fromEntries(OUTPUT_CHECK_KEYS.map(key => [key, false])) as Record<OutputCheckKey, boolean>,
 );
 const [reason, setReason] = useState('');
 const [handedOver, setHandedOver] = useState(false);
 const [fullJob, setFullJob] = useState(false);
 const [queueCleared, setQueueCleared] = useState(false);
 const [resolution, setResolution] = useState<Resolution | null>(null);
 const [executionMode, setExecutionMode] = useState<ExecutionMode>(agentReady ? 'AGENT' : 'MANUAL');
 const [printer, setPrinter] = useState(printers.includes(attempt?.printerName || '') ? attempt!.printerName! : defaultPrinter);
 useDialogFocus(dialogRef, true, onClose, isBusy);

 const items = useMemo(() => outputCheckItems(order), [order]);
 const copies = order.copies && order.copies > 0 ? order.copies : 1;
 const allChecked = OUTPUT_CHECK_KEYS.every(key => checks[key]);
 const trimmedReason = reason.trim();
 const confirmFlow = mode === 'confirm' || (mode === 'resolve' && resolution === 'correct');
 const retryFlow = mode === 'retry' || (mode === 'resolve' && resolution === 'absent');
 const reasonRequired =
 (confirmFlow && needsReconciliationReason(attempt))
 || (mode === 'retry' && attempt?.status !== 'FAILED_PRE_SUBMISSION')
 || (mode === 'resolve' && resolution !== null)
 || mode === 'reprint';
 const needsExecution = retryFlow || mode === 'reprint';
 const executionValid = executionMode === 'MANUAL' || (agentReady && printers.includes(printer));
 const payment = milestones(order).find(item => item.key === 'payment');

 const canSubmit = !isBusy && (!reasonRequired || trimmedReason.length >= 3) && (
 confirmFlow ? allChecked
 : mode === 'handover' ? handedOver && Boolean(payment?.done)
 : retryFlow ? executionValid && (mode === 'retry' && attempt?.status === 'FAILED_PRE_SUBMISSION' ? true : queueCleared)
 : mode === 'reprint' ? fullJob && executionValid
 : mode === 'resolve' && resolution === 'uncertain'
 );

 const submit = async (event: React.FormEvent) => {
 event.preventDefault();
 if (!canSubmit) return;
 setIsBusy(true);
 setError(null);
 try {
 let message: string;
 if (confirmFlow) {
 message = (await printFulfillmentService.confirmOutput(order.id, expectedAttemptId(order, attempt), checks, trimmedReason || undefined)).message;
 } else if (mode === 'handover') {
 message = (await printFulfillmentService.recordHandover(order.id, expectedAttemptId(order, attempt))).message;
 } else if (mode === 'resolve' && resolution === 'uncertain') {
 message = (await printFulfillmentService.recordStillUncertain(attempt!.attemptId, trimmedReason)).message;
 } else {
 const target = executionMode === 'AGENT' ? { printerName: printer } : {};
 const result = mode === 'reprint'
 ? await printFulfillmentService.reprint(order.id, {
 expectedAttemptId: expectedAttemptId(order, attempt), mode: executionMode, reason: trimmedReason, confirmFullJob: true, ...target,
 })
 : await printFulfillmentService.retry(attempt!.attemptId, {
 mode: executionMode,
 ...target,
 ...(trimmedReason ? { reason: trimmedReason } : {}),
 ...(attempt?.status === 'FAILED_PRE_SUBMISSION' ? {} : { queueCleared: true }),
 });
 if (result.download) await downloadPinnedFile(result.download.url, result.download.fileName);
 message = result.message;
 }
 onDone(message);
 } catch (caught) {
 setError(caught instanceof Error ? caught.message : 'The action could not be recorded.');
 setIsBusy(false);
 }
 };

 const label = attempt ? attemptLabel(attempt) : null;
 const help = attemptHelp(attempt);

 return createPortal(
 <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !isBusy) onClose(); }}>
 <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} aria-describedby={`${ids}-summary`} className="flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden border-t-4 border-carbon-blue-60 bg-white shadow-2xl">
 <form onSubmit={submit} className="flex min-h-0 flex-col">
 <div className="border-b border-gray-200 p-4 sm:p-6">
 <h2 id={`${ids}-title`} className="text-xl font-black tracking-tight text-carbon-gray-100">{TITLES[mode]}</h2>
 <p id={`${ids}-summary`} className="mt-1 text-sm text-gray-600 [overflow-wrap:anywhere]">
 {title} · Order #{String(order.id).slice(0, 8)}
 {attempt && <> · Attempt {attempt.attemptNumber}{attempt.printerName ? ` on ${attempt.printerName}` : attempt.mode === 'MANUAL' ? ' (manual)' : ''}</>}
 </p>
 {label && <p className="mt-2 text-xs font-bold text-carbon-gray-100">Status: {label.text}</p>}
 {help && <p className="mt-2 border-l-4 border-[#f1c21b] bg-carbon-gray-10 px-3 py-2 text-xs text-carbon-gray-100">{help}</p>}
 </div>

 <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
 {mode === 'resolve' && (
 <fieldset className="flex flex-col gap-2">
 <legend className="mb-2 text-sm font-bold text-carbon-gray-100">Inspect the printer output and its Windows print queue, then choose:</legend>
 {([
 ['correct', 'Output is correct', 'Record the inspection and mark the order ready.'],
 ['absent', 'Output is absent or unusable', 'The earlier submission is stopped or cleared; authorize another attempt.'],
 ['uncertain', 'Outcome is still uncertain', 'Record what you found and leave the order blocked.'],
 ] as const).map(([value, text, detail], index) => (
 <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 border border-gray-300 p-3 has-[:checked]:border-carbon-blue-60 has-[:checked]:bg-blue-50">
 <input type="radio" name={`${ids}-resolution`} value={value} checked={resolution === value} onChange={() => setResolution(value)} className={checkClass} {...(index === 0 ? { 'data-autofocus': true } : {})} />
 <span><span className="block text-sm font-bold text-carbon-gray-100">{text}</span><span className="block text-xs text-gray-600">{detail}</span></span>
 </label>
 ))}
 </fieldset>
 )}

 {confirmFlow && (
 <fieldset className="flex flex-col gap-2">
 <legend className="mb-2 text-sm font-bold text-carbon-gray-100">Check the printed output</legend>
 {items.map((item, index) => (
 <label key={item.key} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-carbon-gray-100">
 <input type="checkbox" checked={checks[item.key]} onChange={event => setChecks(previous => ({ ...previous, [item.key]: event.target.checked }))} className={checkClass} {...(index === 0 && mode === 'confirm' ? { 'data-autofocus': true } : {})} />
 <span>{item.label}</span>
 </label>
 ))}
 </fieldset>
 )}

 {mode === 'handover' && (
 <div className="flex flex-col gap-3">
 <ul className="flex flex-col gap-1 text-sm">
 {milestones(order).map(item => (
 <li key={item.key} className="flex items-center gap-2">
 <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center text-xs font-black ${item.done ? 'bg-carbon-gray-100 text-white' : 'border border-gray-400 text-gray-500'}`}>{item.done ? '✓' : ''}</span>
 <span className={item.done ? 'font-bold text-carbon-gray-100' : 'text-gray-600'}>{item.label}{item.key === 'handover' ? '' : item.done ? '' : ' — not recorded'}</span>
 </li>
 ))}
 </ul>
 {!payment?.done && <p role="alert" className="border-l-4 border-[#f1c21b] bg-carbon-gray-10 px-3 py-2 text-sm text-carbon-gray-100">Payment has not been recorded. Record payment before handing the order over.</p>}
 <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-carbon-gray-100">
 <input type="checkbox" data-autofocus checked={handedOver} onChange={event => setHandedOver(event.target.checked)} className={checkClass} />
 <span>The customer received the complete printed order.</span>
 </label>
 </div>
 )}

 {mode === 'reprint' && (
 <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-carbon-gray-100">
 <input type="checkbox" data-autofocus checked={fullJob} onChange={event => setFullJob(event.target.checked)} className={checkClass} />
 <span>The entire approved job will be printed again, including all {copies} {copies === 1 ? 'copy' : 'copies'}, with the same file and settings. The customer is not charged again. Pickup readiness is cleared until the new output is checked.</span>
 </label>
 )}

 {retryFlow && attempt?.status !== 'FAILED_PRE_SUBMISSION' && (
 <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-carbon-gray-100">
 <input type="checkbox" checked={queueCleared} onChange={event => setQueueCleared(event.target.checked)} className={checkClass} />
 <span>I confirmed the earlier submission is stopped or cleared from the Windows print queue, so it cannot print later.</span>
 </label>
 )}

 {needsExecution && (
 <fieldset className="flex flex-col gap-2">
 <legend className="mb-2 text-sm font-bold text-carbon-gray-100">How to print</legend>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <label className={`flex min-h-11 items-center gap-2 border p-3 text-sm ${agentReady ? 'cursor-pointer border-gray-300' : 'cursor-not-allowed border-gray-200 text-gray-400'} has-[:checked]:border-carbon-blue-60 has-[:checked]:bg-blue-50`}>
 <input type="radio" name={`${ids}-mode`} disabled={!agentReady} checked={executionMode === 'AGENT'} onChange={() => setExecutionMode('AGENT')} className={checkClass} />
 PrintFlow Agent
 </label>
 <label className="flex min-h-11 cursor-pointer items-center gap-2 border border-gray-300 p-3 text-sm has-[:checked]:border-carbon-blue-60 has-[:checked]:bg-blue-50">
 <input type="radio" name={`${ids}-mode`} checked={executionMode === 'MANUAL'} onChange={() => setExecutionMode('MANUAL')} className={checkClass} />
 Manual download
 </label>
 </div>
 {!agentReady && <p className="text-xs text-gray-600">The agent is offline or needs an update; manual production is available.</p>}
 {executionMode === 'AGENT' && agentReady && (
 <select aria-label="Printer" value={printer} onChange={event => setPrinter(event.target.value)} className={fieldClass}>
 {printers.map(name => <option key={name} value={name}>{name}</option>)}
 </select>
 )}
 </fieldset>
 )}

 {reasonRequired && (
 <label className="flex flex-col gap-1 text-sm font-bold text-carbon-gray-100">
 {confirmFlow ? 'Reconciliation reason' : mode === 'reprint' ? 'Reason for the reprint' : 'Reason'}
 <span className="text-xs font-normal text-gray-600">
 {confirmFlow ? 'No submission was reported for this attempt. Describe what you inspected.' : 'Recorded in the order history.'}
 </span>
 <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} required className={fieldClass} />
 </label>
 )}

 {error && <p role="alert" className="border-l-4 border-carbon-gray-100 bg-carbon-gray-10 px-3 py-2 text-sm font-bold text-carbon-gray-100">{error}</p>}
 </div>

 <div className="grid grid-cols-2 border-t border-gray-200">
 <button type="button" disabled={isBusy} onClick={onClose} className="min-h-12 border-r border-gray-200 bg-white px-4 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:text-gray-400 motion-reduce:transition-none">Cancel</button>
 <button type="submit" disabled={!canSubmit} className="min-h-12 bg-carbon-blue-60 px-4 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:bg-gray-400 motion-reduce:transition-none">
 {isBusy ? 'Recording…' : mode === 'handover' ? 'Record handover' : confirmFlow ? 'Mark ready for pickup' : mode === 'resolve' && resolution === 'uncertain' ? 'Record and keep blocked' : mode === 'reprint' ? 'Record reprint' : 'Authorize retry'}
 </button>
 </div>
 </form>
 </div>
 </div>,
 document.body,
 );
};
