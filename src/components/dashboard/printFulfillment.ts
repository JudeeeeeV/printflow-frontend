// Pure rules for print attempts and operator fulfillment. No React or imports,
// so they can be unit tested directly.

export type AttemptStatus =
  | 'QUEUED'
  | 'RECEIVED'
  | 'DOWNLOADING'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'FAILED_PRE_SUBMISSION'
  | 'OUTCOME_UNKNOWN'
  | 'MANUAL_STARTED';

/** The persisted attempt as returned by the backend and job_progress events. */
export interface AttemptProgress {
  attemptId: string;
  orderId: string;
  attemptNumber: number;
  kind: 'INITIAL' | 'RETRY' | 'REPRINT';
  mode: 'AGENT' | 'MANUAL';
  status: AttemptStatus | string;
  deviceId: string | null;
  printerName: string | null;
  failurePhase?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  reason?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
  isLegacy?: boolean;
  isStale?: boolean;
}

export interface FulfillmentOrder {
  id: string;
  state: string;
  current_attempt?: AttemptProgress | null;
  output_confirmed_at?: string | null;
  output_confirmed_attempt_id?: string | null;
  handed_over_at?: string | null;
  payment_receipts?: Array<{ verified?: boolean | null }>;
  fulfillment_stage?: string | null;
}

/** The order fields the output check and dialogs read. */
export interface PrintableOrder extends FulfillmentOrder {
  paper_size?: string;
  print_color_mode?: string;
  orientation?: string | null;
  page_count?: number | null;
  copies?: number | null;
  order_name?: string | null;
  client_name?: string | null;
  created_at?: string;
  assets?: Array<{ original_filename?: string | null }> | null;
}

export type QueueKey = 'new' | 'ready' | 'pickup' | 'completed';
export type OperatorAction = 'confirm' | 'retry' | 'resolve' | 'reprint' | 'handover';
export type Tone = 'neutral' | 'progress' | 'attention' | 'success';

const NEW_STATES = new Set([
  'OPEN_INQUIRY',
  'PROOF_APPROVED',
  'AWAITING_PAYMENT',
  'AWAITING_PAYMENT_VERIFICATION',
  'ESCALATED_DISPUTE',
]);
const IN_FLIGHT = new Set(['QUEUED', 'RECEIVED', 'DOWNLOADING', 'SUBMITTING']);
const AWAITING_OUTPUT = new Set(['SUBMITTED', 'MANUAL_STARTED']);

export const STALE_PROGRESS_MS = 10 * 60 * 1000;

/** Carbon-style badge colors per tone. */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border border-gray-300 bg-gray-100 text-gray-800',
  progress: 'border border-blue-200 bg-blue-50 text-carbon-blue-70',
  attention: 'border border-[#f1c21b] bg-[#fcf4d6] text-carbon-gray-100',
  success: 'border border-[#24a148] bg-[#defbe6] text-[#0e6027]',
};

const isOpen = (attempt?: AttemptProgress | null): attempt is AttemptProgress =>
  Boolean(attempt && !attempt.resolvedAt);

/**
 * Prefers a live socket update over the persisted read when it is the same
 * attempt with a later server timestamp, or a later attempt.
 */
export function mergeAttempt(
  persisted: AttemptProgress | null | undefined,
  live: AttemptProgress | undefined,
): AttemptProgress | null {
  if (!live) return persisted ?? null;
  if (!persisted) return live;
  if (live.attemptNumber > persisted.attemptNumber) return live;
  if (
    live.attemptId === persisted.attemptId &&
    Date.parse(live.updatedAt) > Date.parse(persisted.updatedAt)
  )
    return live;
  return persisted;
}

/** Stale = no progress or heartbeat for ten minutes; a warning, never a failure. */
export function isAttemptStale(attempt: AttemptProgress | null | undefined, now = Date.now()) {
  if (!isOpen(attempt) || !IN_FLIGHT.has(attempt.status)) return false;
  return Boolean(attempt.isStale) || now - Date.parse(attempt.updatedAt) >= STALE_PROGRESS_MS;
}

export function queueFor(order: FulfillmentOrder, attempt = order.current_attempt): QueueKey | null {
  if (NEW_STATES.has(order.state)) return 'new';
  if (order.state === 'COMPLETED') return 'completed';
  if (order.state === 'PRINTED' || order.state === 'READY_FOR_PICKUP') return 'pickup';
  if (order.state !== 'IN_PRODUCTION') return null;
  // Submission-reported and manual work waits for an output check in Pickup.
  return isOpen(attempt) && AWAITING_OUTPUT.has(attempt.status) ? 'pickup' : 'ready';
}

/** Only orders without an unresolved attempt can start a new batch. */
export function canSelectForPrint(order: FulfillmentOrder, attempt = order.current_attempt) {
  return order.state === 'IN_PRODUCTION' && !isOpen(attempt);
}

export function availableActions(
  order: FulfillmentOrder,
  attempt = order.current_attempt,
  now = Date.now(),
): OperatorAction[] {
  if (order.handed_over_at) return [];
  if (order.state === 'READY_FOR_PICKUP')
    return order.output_confirmed_at ? ['handover', 'reprint'] : ['confirm'];
  if (order.state === 'PRINTED') return ['confirm', 'reprint'];
  if (order.state !== 'IN_PRODUCTION' || !isOpen(attempt)) return [];
  if (attempt.status === 'FAILED_PRE_SUBMISSION') return ['retry'];
  if (attempt.status === 'OUTCOME_UNKNOWN') return ['resolve'];
  if (AWAITING_OUTPUT.has(attempt.status)) return ['confirm', 'reprint'];
  return isAttemptStale(attempt, now) ? ['resolve'] : [];
}

/** Output confirmation without a reported submission needs a reason. */
export function needsReconciliationReason(attempt: AttemptProgress | null | undefined) {
  return !isOpen(attempt) || !AWAITING_OUTPUT.has(attempt.status);
}

/** The attempt ID the operator reviewed, as the backend expects it. */
export function expectedAttemptId(order: FulfillmentOrder, attempt = order.current_attempt) {
  if (order.state === 'READY_FOR_PICKUP') return order.output_confirmed_attempt_id ?? null;
  return isOpen(attempt) ? attempt.attemptId : null;
}

const STATUS_LABELS: Record<string, { text: string; tone: Tone }> = {
  QUEUED: { text: 'Queued for the agent', tone: 'progress' },
  RECEIVED: { text: 'Received by agent', tone: 'progress' },
  DOWNLOADING: { text: 'Downloading file', tone: 'progress' },
  SUBMITTING: { text: 'Sending to printer', tone: 'progress' },
  SUBMITTED: { text: 'Submission reported — check output', tone: 'attention' },
  MANUAL_STARTED: { text: 'Manual print — check output', tone: 'attention' },
  FAILED_PRE_SUBMISSION: { text: 'Failed before printing', tone: 'attention' },
  OUTCOME_UNKNOWN: { text: 'Outcome unknown — inspect printer', tone: 'attention' },
};

export function attemptLabel(attempt: AttemptProgress, now = Date.now()) {
  if (isAttemptStale(attempt, now))
    return { text: 'No progress for 10+ minutes', tone: 'attention' as Tone };
  return STATUS_LABELS[attempt.status] ?? { text: attempt.status, tone: 'neutral' as Tone };
}

/** Operator badge for an order card. */
export function orderBadge(order: FulfillmentOrder, attempt = order.current_attempt, now = Date.now()) {
  if (order.state === 'COMPLETED') return { text: 'Handed over', tone: 'neutral' as Tone };
  if (order.state === 'READY_FOR_PICKUP')
    return order.output_confirmed_at
      ? { text: 'Ready for pickup', tone: 'success' as Tone }
      : { text: 'Output not yet checked', tone: 'attention' as Tone };
  if (order.state === 'PRINTED') return { text: 'Awaiting output check', tone: 'attention' as Tone };
  if (order.state === 'IN_PRODUCTION') {
    if (isOpen(attempt)) return attemptLabel(attempt, now);
    return { text: 'Ready to print', tone: 'neutral' as Tone };
  }
  return null;
}

const ERROR_HELP: Record<string, string> = {
  AGENT_DISCONNECTED: 'The agent went offline before receiving the job. Nothing was printed.',
  DOWNLOAD_EXPIRED: 'The download link expired before printing. Retry to issue a new one.',
  DOWNLOAD_FAILED: 'The agent could not download the file. Check its internet connection.',
  CHECKSUM_MISMATCH: 'The downloaded file did not match the approved file. Nothing was printed.',
  SIZE_MISMATCH: 'The downloaded file did not match the approved file. Nothing was printed.',
  TOO_LARGE: 'The file is larger than the agent supports.',
  NOT_PDF: 'The agent received a file that is not a PDF.',
  PRINTER_UNAVAILABLE: 'The selected printer is no longer installed on the agent computer.',
  DEVICE_PAUSED: 'Printing is paused until an earlier uncertain attempt on this agent is resolved.',
  AUTHORIZATION_UNAVAILABLE: 'The agent could not confirm the job before printing. Nothing was printed.',
  JOURNAL_WRITE_FAILED: 'The agent could not save its print record. Nothing was printed.',
  INVOCATION_TIMEOUT: 'The print utility did not return. Check the printer and its Windows print queue.',
  PRINT_UTILITY_ERROR: 'The print utility reported an error after it started. Pages may have printed.',
  AGENT_RESTARTED: 'The agent stopped while printing. Pages may have printed.',
};

export function attemptHelp(attempt: AttemptProgress | null | undefined) {
  if (!attempt) return null;
  if (attempt.errorCode && ERROR_HELP[attempt.errorCode]) return ERROR_HELP[attempt.errorCode];
  return attempt.errorMessage || null;
}

export function milestones(order: FulfillmentOrder) {
  return [
    { key: 'output', label: 'Output confirmed', done: Boolean(order.output_confirmed_at) },
    {
      key: 'payment',
      label: 'Payment recorded',
      done: Boolean(order.payment_receipts?.some((receipt) => receipt.verified)),
    },
    { key: 'handover', label: 'Handed over', done: Boolean(order.handed_over_at) },
  ];
}

export const OUTPUT_CHECK_KEYS = [
  'document',
  'revision',
  'paper',
  'color',
  'orientation',
  'pages',
  'copies',
] as const;
export type OutputCheckKey = (typeof OUTPUT_CHECK_KEYS)[number];

export function outputCheckItems(order: {
  paper_size?: string;
  print_color_mode?: string;
  orientation?: string | null;
  page_count?: number | null;
  copies?: number | null;
}): Array<{ key: OutputCheckKey; label: string }> {
  const copies = order.copies && order.copies > 0 ? order.copies : 1;
  const pages = order.page_count && order.page_count > 0 ? order.page_count : null;
  return [
    { key: 'document', label: 'It is this customer’s document' },
    { key: 'revision', label: 'It matches the approved file shown in the preview' },
    { key: 'paper', label: `Paper size is ${order.paper_size || 'A4'}` },
    {
      key: 'color',
      label: order.print_color_mode === 'COLOR' ? 'Printed in color' : 'Printed in black and white',
    },
    { key: 'orientation', label: `Orientation is ${order.orientation === 'LANDSCAPE' ? 'landscape' : 'portrait'}` },
    { key: 'pages', label: pages ? `All ${pages} ${pages === 1 ? 'page is' : 'pages are'} present and complete` : 'Every page is present and complete' },
    { key: 'copies', label: `${copies} ${copies === 1 ? 'copy' : 'copies'}` },
  ];
}

/** Student-facing stages. Device errors are never shown to students. */
export const STUDENT_STAGES: Record<string, { label: string; step: number }> = {
  PREPARING: { label: 'Preparing', step: 3 },
  PRINTING: { label: 'Printing', step: 3 },
  CHECKING_OUTPUT: { label: 'Checking output', step: 3 },
  READY_FOR_PICKUP: { label: 'Ready for pickup', step: 4 },
  COMPLETED: { label: 'Completed', step: 5 },
};

export function studentStage(order: Pick<FulfillmentOrder, 'state' | 'fulfillment_stage'>) {
  if (order.fulfillment_stage && STUDENT_STAGES[order.fulfillment_stage])
    return STUDENT_STAGES[order.fulfillment_stage];
  if (order.state === 'COMPLETED') return STUDENT_STAGES.COMPLETED;
  if (order.state === 'READY_FOR_PICKUP') return STUDENT_STAGES.READY_FOR_PICKUP;
  if (order.state === 'PRINTED') return STUDENT_STAGES.CHECKING_OUTPUT;
  if (order.state === 'IN_PRODUCTION') return STUDENT_STAGES.PREPARING;
  return null;
}

/** Progress list for the batch modal, keyed by attempt rather than order. */
export function upsertProgress(list: AttemptProgress[], update: AttemptProgress) {
  const index = list.findIndex((item) => item.attemptId === update.attemptId);
  if (index === -1) return [...list, update];
  if (Date.parse(update.updatedAt) < Date.parse(list[index].updatedAt)) return list;
  const next = [...list];
  next[index] = update;
  return next;
}
