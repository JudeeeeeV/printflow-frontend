import React from 'react';
import type { SubmissionPhase } from '../../services/submissionController';

interface SubmissionStatusProps {
  phase: SubmissionPhase;
  needsFile: boolean;
  hasFile: boolean;
  storageAvailable: boolean;
  duplicateOrderId: string | null;
  onRetry: () => void;
  onCheck: () => void;
  onStartOver: () => void;
  onSubmitAnyway: () => void;
  onDismissDuplicate: () => void;
  onViewOrder: (orderId: string) => void;
}

const MESSAGES: Partial<Record<SubmissionPhase, string>> = {
  checking: "We couldn't confirm the result. Checking submission status…",
  processing: 'Still processing. You can keep this page open while we finish.',
  unconfirmed: "We still can't confirm whether this went through. Your details are safe here, and we'll keep checking.",
  retry: "This submission didn't finish. You can safely try again; it won't create a duplicate.",
  needs_file: 'Choose the same file again to continue this submission.',
  file_mismatch: "That file doesn't match the original submission. Choose the same file, or start over.",
  offline: "You're offline. Your details are saved here. Reconnect, then try again.",
  rate_limited: 'Too many requests right now. Your details are saved here. Wait a moment, then try again.',
  duplicate: 'You recently submitted this file to this shop.',
};

const ALERT_PHASES: SubmissionPhase[] = ['retry', 'needs_file', 'file_mismatch', 'duplicate'];
const ESCAPABLE_PHASES: SubmissionPhase[] = ['processing', 'unconfirmed', 'retry', 'needs_file', 'file_mismatch'];

const primary = 'min-h-11 cursor-pointer bg-carbon-gray-100 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';
const secondary = 'min-h-11 cursor-pointer border border-carbon-gray-100 bg-white px-4 py-2 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none';

/** Persistent feedback for a submission whose outcome is not yet settled. */
export const SubmissionStatus: React.FC<SubmissionStatusProps> = ({
  phase,
  needsFile,
  hasFile,
  storageAvailable,
  duplicateOrderId,
  onRetry,
  onCheck,
  onStartOver,
  onSubmitAnyway,
  onDismissDuplicate,
  onViewOrder,
}) => {
  const message = MESSAGES[phase];
  if (!message) {
    if (storageAvailable) return null;
    return <p className="text-xs leading-relaxed text-gray-600">Refreshing this page may lose details you haven't submitted.</p>;
  }
  const canRetry = phase === 'retry' || phase === 'rate_limited' || phase === 'offline' || phase === 'needs_file' || phase === 'file_mismatch';
  const waitingForFile = needsFile && !hasFile;
  const canCheck = phase === 'processing' || phase === 'unconfirmed';
  const isAlert = ALERT_PHASES.includes(phase);

  return (
    <div className="border-l-4 border-amber-600 bg-amber-50 px-4 py-3" role={isAlert ? 'alert' : 'status'}>
      <p className="break-words text-sm font-bold text-amber-900">{message}</p>
      {phase === 'retry' && waitingForFile && <p className="mt-1 text-sm text-amber-900">Choose the same file again to retry.</p>}
      {phase === 'duplicate' && duplicateOrderId ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className={primary} onClick={() => onViewOrder(duplicateOrderId)}>View that order</button>
          <button type="button" className={secondary} onClick={onSubmitAnyway}>Submit again anyway</button>
          <button type="button" className={secondary} onClick={onDismissDuplicate}>Not now</button>
        </div>
      ) : (
        (canRetry || canCheck) && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canCheck && <button type="button" className={primary} onClick={onCheck}>Check status</button>}
            {canRetry && <button type="button" className={primary} disabled={waitingForFile} onClick={onRetry}>Retry</button>}
            {ESCAPABLE_PHASES.includes(phase) && <button type="button" className={secondary} onClick={onStartOver}>Start over</button>}
          </div>
        )
      )}
      {ESCAPABLE_PHASES.includes(phase) && (
        <p className="mt-2 text-xs leading-relaxed text-amber-900">If you start over, your earlier submission may still appear in your history.</p>
      )}
    </div>
  );
};
