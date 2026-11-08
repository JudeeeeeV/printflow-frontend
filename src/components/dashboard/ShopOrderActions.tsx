import { useEffect, useRef, useState } from 'react';
import { orderService } from '../../services/orderService';
import type { OrderDecisionResponse, ShopDecision } from '../../services/orderService';
import { ConfirmModal } from '../common/ConfirmModal';

interface ActionOrder {
  id: string;
  state: string;
  total: number | string;
  payment_method: string;
  payment_status: string;
  acceptance_status: string;
  is_unclaimed?: boolean;
  assets?: { file_url?: string | null }[];
}
type Action = ShopDecision | 'READY_FOR_PICKUP' | 'COMPLETED';
const labels: Record<Action, string> = {
  ACCEPT: 'Accept order', REJECT_ORDER: 'Reject order', COLLECT_CASH: 'Record cash collected',
  RECORD_REFUND: 'Record manual refund', FLAG_UNCLAIMED: 'Flag unclaimed', CLEAR_UNCLAIMED: 'Clear unclaimed',
  READY_FOR_PICKUP: 'Mark ready for pickup', COMPLETED: 'Confirm handover',
};

export const ShopOrderActions = ({ order, onUpdated, disabled = false, onBusyChange }: {
  order: ActionOrder;
  onUpdated: (order: OrderDecisionResponse['order']) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) => {
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { onBusyChange?.(busy || confirmOpen); }, [busy, confirmOpen, onBusyChange]);
  const actions: Action[] = [];
  const needsReason = action === 'REJECT_ORDER';
  const needsReference = action === 'RECORD_REFUND';
  const cash = order.payment_method === 'CASH_ON_PICKUP';
  const hasAsset = Boolean(order.assets?.some(asset => asset.file_url));
  const paymentEligible = cash ? ['DUE_AT_PICKUP', 'COLLECTED'].includes(order.payment_status) : order.payment_status === 'VERIFIED';
  if (cash && order.state === 'OPEN_INQUIRY') {
    actions.push('REJECT_ORDER');
    if (hasAsset && order.acceptance_status === 'PENDING' && (cash || ['PENDING_VERIFICATION', 'VERIFIED'].includes(order.payment_status))) actions.push('ACCEPT');
  }
  if (hasAsset && ['IN_PRODUCTION', 'PRINTED'].includes(order.state) && order.acceptance_status === 'ACCEPTED' && paymentEligible) actions.push('READY_FOR_PICKUP');
  if (order.state === 'READY_FOR_PICKUP') {
    if (hasAsset && order.acceptance_status === 'ACCEPTED' && cash && order.payment_status === 'DUE_AT_PICKUP') actions.push('COLLECT_CASH');
    if (hasAsset && order.acceptance_status === 'ACCEPTED' && !cash && order.payment_status === 'VERIFIED') actions.push('COMPLETED');
    actions.push(order.is_unclaimed ? 'CLEAR_UNCLAIMED' : 'FLAG_UNCLAIMED');
  }
  if (order.payment_status === 'REFUND_DUE') actions.push('RECORD_REFUND');
  const blocked = !hasAsset ? 'A valid document is required before production or handover.'
    : order.payment_status === 'DISPUTED' ? 'The payment dispute is under platform administration review.'
    : order.payment_status === 'REVIEW_REQUIRED' ? 'Historical payment evidence needs review. The customer can submit replacement proof.'
    : !cash && order.payment_status === 'UNPAID' ? 'Waiting for the customer’s GCash receipt.'
    : cash && order.acceptance_status !== 'ACCEPTED'
    ? 'Production requires shop acceptance.'
    : !paymentEligible ? 'Production or handover is held until payment is resolved.' : null;
  const buttonClass = 'min-h-11 border border-black bg-white px-3 py-2 text-xs font-bold text-black transition-colors hover:border-carbon-blue-60 hover:text-carbon-blue-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50';
  const confirm = async (decision: Action | null = action) => {
    if (!decision || pending.current || disabled || !actions.includes(decision)) return;
    const decisionNeedsReason = decision === 'REJECT_ORDER';
    if (decisionNeedsReason && !reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (decision === 'RECORD_REFUND' && !reference.trim()) {
      setError('A manual refund reference is required.');
      return;
    }
    pending.current = true; setBusy(true); setError('');
    try {
      const result = decision === 'READY_FOR_PICKUP' || decision === 'COMPLETED'
        ? await orderService.updateOrderState(order.id, decision, true)
        : await orderService.decideOrder(order.id, decision, { reason: decisionNeedsReason ? reason.trim() : undefined, reference: decision === 'RECORD_REFUND' ? reference.trim() : undefined, confirmed: true });
      onUpdated(result.order);
      setAction(null); setConfirmOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The decision could not be saved.');
      setConfirmOpen(false);
    } finally { pending.current = false; setBusy(false); }
  };

  return (
    <fieldset disabled={disabled || busy} className="mt-3 min-w-0 space-y-2 border-t border-gray-200 pt-3" aria-label="Shop order decisions" aria-busy={busy} onClick={event => event.stopPropagation()}>
      {blocked && !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.state) && <p className="text-xs leading-relaxed text-gray-600">{blocked}</p>}
      {order.is_unclaimed && <p className="text-xs font-bold text-amber-800">Unclaimed — remains available for collection.</p>}
      <div className="flex flex-wrap justify-end gap-2">{actions.map(value => <button key={value} type="button" disabled={busy} className={buttonClass} onClick={() => {
        if (pending.current || disabled) return;
        setReason(''); setReference(''); setError('');
        if (value === 'ACCEPT' || value === 'FLAG_UNCLAIMED' || value === 'CLEAR_UNCLAIMED') {
          setAction(null);
          void confirm(value);
        } else {
          setAction(value);
          if (value === 'READY_FOR_PICKUP' || value === 'COLLECT_CASH') setConfirmOpen(true);
        }
      }}>{labels[value]}</button>)}</div>
      {action && action !== 'READY_FOR_PICKUP' && action !== 'COLLECT_CASH' && <div className="space-y-2 border-l-4 border-carbon-blue-60 bg-carbon-gray-10 p-3">
        <p className="text-sm font-bold">{labels[action]}</p>
        {needsReason && <label className="block text-xs font-bold">Reason (required)<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={busy} className="mt-1 min-h-20 w-full border border-gray-500 bg-white p-2 text-sm focus:outline-carbon-blue-60" /></label>}
        {needsReference && <label className="block text-xs font-bold">Manual refund reference (required)<input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} disabled={busy} className="mt-1 min-h-11 w-full border border-gray-500 bg-white p-2 text-sm focus:outline-carbon-blue-60" /><span className="mt-1 block font-normal">Record the full ₱{Number(order.total).toFixed(2)} refund after sending it outside PrintFlow. This action does not transfer money.</span></label>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy || (needsReason && !reason.trim()) || (needsReference && !reference.trim())} className={`${buttonClass} !bg-carbon-gray-100 !text-white hover:!bg-black`} onClick={() => action === 'REJECT_ORDER' ? void confirm() : setConfirmOpen(true)}>{action === 'REJECT_ORDER' ? 'Submit rejection' : 'Review decision'}</button></div>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {busy && <p role="status" className="text-xs text-gray-600">Saving decision…</p>}
      <ConfirmModal isOpen={confirmOpen} title={action ? `${labels[action]}?` : 'Confirm decision'}
        message={`${action ? labels[action] : 'Apply decision'} for order #${order.id.slice(0, 8)} (₱${Number(order.total).toFixed(2)}). ${reason || reference || (action === 'COLLECT_CASH' ? `Confirm you received the full ₱${Number(order.total).toFixed(2)} in cash. This will also mark the order completed.` : action === 'READY_FOR_PICKUP' ? 'Check the physical output, document, paper, copies and print quality before confirming.' : action === 'COMPLETED' ? 'Confirm payment is settled and the customer is receiving the correct prints.' : 'Confirm you have reviewed the order and the required evidence.')}`}
        confirmLabel="Confirm decision" isBusy={busy} onConfirm={() => void confirm()} onCancel={() => { if (!pending.current) { setConfirmOpen(false); if (action === 'READY_FOR_PICKUP' || action === 'COLLECT_CASH') setAction(null); } }} />
    </fieldset>
  );
};
