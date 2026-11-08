const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/components/dashboard/printFulfillment.ts'), 'utf8');
const moduleExports = {};
// Same realm as the assertions, so arrays compare structurally.
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText)(moduleExports);
const f = moduleExports;
const NOW = Date.parse('2026-11-08T12:00:00Z');
const attempt = (overrides = {}) => ({
  attemptId: 'a1',
  orderId: 'o1',
  attemptNumber: 1,
  kind: 'INITIAL',
  mode: 'AGENT',
  status: 'QUEUED',
  deviceId: 'd1',
  printerName: 'Desk',
  resolvedAt: null,
  updatedAt: new Date(NOW - 1000).toISOString(),
  ...overrides,
});
const order = (state, current_attempt = null, extra = {}) => ({ id: 'o1', state, current_attempt, ...extra });

test('queued, processing, failed and uncertain work stays in Print Ready; submitted and manual work moves to Pickup', () => {
  for (const status of ['QUEUED', 'RECEIVED', 'DOWNLOADING', 'SUBMITTING', 'FAILED_PRE_SUBMISSION', 'OUTCOME_UNKNOWN'])
    assert.equal(f.queueFor(order('IN_PRODUCTION', attempt({ status }))), 'ready', status);
  for (const status of ['SUBMITTED', 'MANUAL_STARTED'])
    assert.equal(f.queueFor(order('IN_PRODUCTION', attempt({ status }))), 'pickup', status);
  assert.equal(f.queueFor(order('IN_PRODUCTION')), 'ready');
  assert.equal(f.queueFor(order('PRINTED')), 'pickup', 'legacy PRINTED awaits an output check');
  assert.equal(f.queueFor(order('READY_FOR_PICKUP')), 'pickup');
  assert.equal(f.queueFor(order('COMPLETED')), 'completed');
  assert.equal(f.queueFor(order('AWAITING_PAYMENT_VERIFICATION')), 'new');
  assert.equal(f.queueFor(order('EXPIRED')), null);
});

test('only orders without an unresolved attempt can be selected for a new batch', () => {
  assert.equal(f.canSelectForPrint(order('IN_PRODUCTION')), true);
  assert.equal(f.canSelectForPrint(order('IN_PRODUCTION', attempt({ status: 'FAILED_PRE_SUBMISSION' }))), false);
  assert.equal(f.canSelectForPrint(order('IN_PRODUCTION', attempt({ resolvedAt: '2026-11-08T00:00:00Z' }))), true);
  assert.equal(f.canSelectForPrint(order('PRINTED')), false);
});

test('actions follow the attempt state and never skip output confirmation', () => {
  const actions = (o) => f.availableActions(o, o.current_attempt, NOW);
  assert.deepEqual(actions(order('IN_PRODUCTION', attempt({ status: 'FAILED_PRE_SUBMISSION' }))), ['retry']);
  assert.deepEqual(actions(order('IN_PRODUCTION', attempt({ status: 'OUTCOME_UNKNOWN' }))), ['resolve']);
  assert.deepEqual(actions(order('IN_PRODUCTION', attempt({ status: 'DOWNLOADING' }))), []);
  assert.deepEqual(
    actions(order('IN_PRODUCTION', attempt({ status: 'DOWNLOADING', updatedAt: new Date(NOW - 11 * 60_000).toISOString() }))),
    ['resolve'],
    'stale work is reconciled, never silently retried',
  );
  assert.deepEqual(actions(order('IN_PRODUCTION', attempt({ status: 'SUBMITTED' }))), ['confirm', 'reprint']);
  assert.deepEqual(actions(order('READY_FOR_PICKUP', null, { output_confirmed_at: 'x' })), ['handover', 'reprint']);
  assert.deepEqual(actions(order('READY_FOR_PICKUP')), ['confirm'], 'legacy ready orders need a fresh check');
  assert.deepEqual(actions(order('READY_FOR_PICKUP', null, { output_confirmed_at: 'x', handed_over_at: 'y' })), []);
  assert.deepEqual(actions(order('COMPLETED')), []);
});

test('confirmation needs a reconciliation reason unless a submission was reported', () => {
  assert.equal(f.needsReconciliationReason(attempt({ status: 'SUBMITTED' })), false);
  assert.equal(f.needsReconciliationReason(attempt({ status: 'MANUAL_STARTED' })), false);
  assert.equal(f.needsReconciliationReason(attempt({ status: 'OUTCOME_UNKNOWN' })), true);
  assert.equal(f.needsReconciliationReason(null), true);
});

test('expected attempt IDs match what the backend checks', () => {
  assert.equal(f.expectedAttemptId(order('IN_PRODUCTION', attempt())), 'a1');
  assert.equal(f.expectedAttemptId(order('READY_FOR_PICKUP', attempt({ resolvedAt: 'x' }), { output_confirmed_attempt_id: 'a1' })), 'a1');
  assert.equal(f.expectedAttemptId(order('PRINTED')), null);
});

test('submission is labelled as unconfirmed, not completed', () => {
  assert.equal(f.attemptLabel(attempt({ status: 'SUBMITTED' }), NOW).text, 'Submission reported — check output');
  assert.equal(f.orderBadge(order('READY_FOR_PICKUP'), null, NOW).text, 'Output not yet checked');
  assert.equal(f.orderBadge(order('READY_FOR_PICKUP', null, { output_confirmed_at: 'x' }), null, NOW).text, 'Ready for pickup');
  assert.equal(f.orderBadge(order('COMPLETED'), null, NOW).text, 'Handed over');
  assert.match(f.attemptHelp(attempt({ errorCode: 'CHECKSUM_MISMATCH' })), /Nothing was printed/);
  assert.match(f.attemptHelp(attempt({ errorCode: 'AGENT_RESTARTED' })), /may have printed/);
});

test('live progress replaces persisted progress only when newer', () => {
  const persisted = attempt({ status: 'DOWNLOADING', updatedAt: '2026-11-08T10:00:00Z' });
  assert.equal(f.mergeAttempt(persisted, attempt({ status: 'SUBMITTED', updatedAt: '2026-11-08T10:01:00Z' })).status, 'SUBMITTED');
  assert.equal(f.mergeAttempt(persisted, attempt({ status: 'QUEUED', updatedAt: '2026-11-08T09:00:00Z' })).status, 'DOWNLOADING');
  assert.equal(f.mergeAttempt(persisted, attempt({ attemptId: 'a2', attemptNumber: 2, updatedAt: '2026-11-08T09:00:00Z' })).attemptId, 'a2');
  assert.equal(f.mergeAttempt(null, undefined), null);
});

test('progress is tracked per attempt, ignoring out-of-date updates', () => {
  let list = f.upsertProgress([], attempt({ updatedAt: '2026-11-08T10:00:00Z' }));
  list = f.upsertProgress(list, attempt({ attemptId: 'a2', orderId: 'o1', attemptNumber: 2, updatedAt: '2026-11-08T10:00:00Z' }));
  list = f.upsertProgress(list, attempt({ status: 'SUBMITTED', updatedAt: '2026-11-08T10:01:00Z' }));
  list = f.upsertProgress(list, attempt({ status: 'RECEIVED', updatedAt: '2026-11-08T09:59:00Z' }));
  assert.deepEqual(list.map((item) => [item.attemptId, item.status]), [['a1', 'SUBMITTED'], ['a2', 'QUEUED']]);
});

test('milestones show output, payment and handover separately', () => {
  assert.deepEqual(
    f.milestones(order('READY_FOR_PICKUP', null, { output_confirmed_at: 'x', payment_receipts: [{ verified: true }] })).map((m) => m.done),
    [true, true, false],
  );
});

test('output checks describe the approved settings', () => {
  const items = f.outputCheckItems({ paper_size: 'LONG', print_color_mode: 'COLOR', orientation: 'LANDSCAPE', page_count: 3, copies: 2 });
  assert.deepEqual(items.map((item) => item.key), ['document', 'revision', 'paper', 'color', 'orientation', 'pages', 'copies']);
  assert.ok(items.some((item) => item.label === 'All 3 pages are present and complete'));
  assert.ok(items.some((item) => item.label === '2 copies'));
});

test('students see coarse stages, with Completed reserved for handover', () => {
  assert.equal(f.studentStage(order('IN_PRODUCTION', null, { fulfillment_stage: 'PRINTING' })).label, 'Printing');
  assert.equal(f.studentStage(order('PRINTED')).label, 'Checking output');
  assert.equal(f.studentStage(order('READY_FOR_PICKUP')).label, 'Ready for pickup');
  assert.equal(f.studentStage(order('COMPLETED')).label, 'Completed');
  assert.equal(f.studentStage(order('AWAITING_PAYMENT')), null);
});
