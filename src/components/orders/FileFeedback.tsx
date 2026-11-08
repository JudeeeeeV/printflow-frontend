import { useEffect, useRef } from 'react';
import type { FileFeedback as Feedback } from '../../services/documentPreparation';

interface Props {
  feedback: Feedback | null;
  onRetry?: () => void;
  onCheckOrders?: () => void;
  checkLabel?: string;
  focusOnError?: boolean;
}

export const FileFeedback = ({
  feedback,
  onRetry,
  onCheckOrders,
  checkLabel = 'Check My Orders / Drafts',
  focusOnError = false,
}: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnError && feedback && !feedback.passed) panelRef.current?.focus();
  }, [feedback, focusOnError]);
  if (!feedback || feedback.passed) return null;
  const buttonClass =
    'min-h-11 border border-black bg-white px-3 text-sm font-bold text-black hover:border-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60';
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="alert"
      className="mt-3 break-words border-l-4 border-red-700 bg-red-50 p-3 text-sm text-red-800 focus:outline focus:outline-2 focus:outline-carbon-blue-60"
    >
      <p className="font-bold">{feedback.message}</p>
      {feedback.nextStep && <p className="mt-1 leading-relaxed">{feedback.nextStep}</p>}
      {((feedback.retryable && onRetry) || (feedback.uncertain && onCheckOrders)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {feedback.retryable && onRetry && (
            <button type="button" className={buttonClass} onClick={onRetry}>
              Try again
            </button>
          )}
          {feedback.uncertain && onCheckOrders && (
            <button type="button" className={buttonClass} onClick={onCheckOrders}>
              {checkLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
