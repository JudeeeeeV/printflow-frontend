import React from 'react';
import {
 attemptHelp,
 milestones,
 type AttemptProgress,
 type FulfillmentOrder,
 type OperatorAction,
} from './printFulfillment';

const ACTION_LABELS: Record<OperatorAction, string> = {
 confirm: 'Check output',
 handover: 'Record handover',
 retry: 'Retry',
 resolve: 'Resolve',
 reprint: 'Reprint',
};

interface FulfillmentFooterProps {
 order: FulfillmentOrder;
 attempt: AttemptProgress | null;
 actions: OperatorAction[];
 showMilestones?: boolean;
 orderLabel: string;
 onAction: (action: OperatorAction) => void;
}

const formatTime = (value?: string | null) => {
 if (!value) return null;
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? null : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const FulfillmentFooter: React.FC<FulfillmentFooterProps> = ({ order, attempt, actions, showMilestones, orderLabel, onAction }) => {
 const open = attempt && !attempt.resolvedAt ? attempt : null;
 const help = attemptHelp(open);
 return (
 <div className="flex flex-col gap-2 text-xs">
 {open && (
 <p className="text-gray-600">
 Attempt {open.attemptNumber}{open.kind === 'REPRINT' ? ' (reprint)' : open.kind === 'RETRY' ? ' (retry)' : ''} · {open.mode === 'MANUAL' ? 'manual' : open.printerName || 'default printer'}
 {formatTime(open.updatedAt) && <> · updated {formatTime(open.updatedAt)}</>}
 </p>
 )}
 {help && <p className="border-l-4 border-[#f1c21b] bg-carbon-gray-10 px-2 py-1 text-carbon-gray-100">{help}</p>}
 {showMilestones && (
 <ul aria-label="Fulfillment milestones" className="flex flex-wrap gap-x-3 gap-y-1">
 {milestones(order).map(item => (
 <li key={item.key} className={item.done ? 'font-bold text-carbon-gray-100' : 'text-gray-500'}>
 <span aria-hidden="true">{item.done ? '✓ ' : '○ '}</span>{item.label}<span className="sr-only">{item.done ? ': done' : ': not yet'}</span>
 </li>
 ))}
 </ul>
 )}
 {actions.length > 0 && (
 <div className="grid grid-cols-2 gap-2">
 {actions.map((action, index) => (
 <button
 key={action}
 type="button"
 onClick={() => onAction(action)}
 aria-label={`${ACTION_LABELS[action]}: ${orderLabel}`}
 className={`flex min-h-11 items-center justify-center px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 xl:min-h-9 motion-reduce:transition-none ${index === 0 ? 'bg-carbon-blue-60 text-white hover:bg-carbon-blue-70' : 'border border-black bg-white text-black hover:bg-[#e6e6e6]'} ${actions.length === 1 ? 'col-span-2' : ''}`}
 >
 {ACTION_LABELS[action]}
 </button>
 ))}
 </div>
 )}
 </div>
 );
};
