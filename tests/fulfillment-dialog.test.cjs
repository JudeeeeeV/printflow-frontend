const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const jsx = (type, props, key) => ({ type, props, key });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);
const compile = file => ts.transpileModule(readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const attempt = overrides => ({
  attemptId: 'attempt-current', attemptNumber: 2, mode: 'AGENT', kind: 'INITIAL',
  status: 'SUBMITTED', resolvedAt: null, updatedAt: '2026-11-08T00:00:00Z', ...overrides,
});
const order = overrides => ({
  id: 'order', state: 'IN_PRODUCTION', payment_method: 'GCASH', payment_status: 'VERIFIED',
  acceptance_status: 'ACCEPTED', page_count: 2, copies: 3, paper_size: 'A4',
  print_color_mode: 'BLACK_AND_WHITE', orientation: 'PORTRAIT', ...overrides,
});

// Exercise the real dialog, pure fulfillment rules, and service serialization.
// Only React hooks, focus setup and the HTTP boundary are controlled here.
function fixture(overrides = {}, respond = async () => ({ message: 'Saved', state: 'READY_FOR_PICKUP', duplicate: false })) {
  const states = [], calls = [], done = [];
  let cursor = 0, tree;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef(initial) { return react.useState({ current: initial })[0]; },
    useId() { return 'fulfillment'; },
    useMemo(create) { return create(); },
  };
  const apiClient = async (url, init) => {
    const request = { url, method: init.method, body: JSON.parse(init.body) };
    calls.push(request);
    return respond(request);
  };
  const evaluate = (file, mocks) => {
    const exports = {};
    vm.runInNewContext(compile(file), { exports, Error, document: { body: {} }, require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    } });
    return exports;
  };
  const rules = evaluate('components/dashboard/printFulfillment.ts', {});
  const service = evaluate('services/printFulfillmentService.ts', { './apiClient': { apiClient } });
  const component = evaluate('components/dashboard/FulfillmentDialog.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-dom': { createPortal: node => node },
    '../common/useDialogFocus': { useDialogFocus() {} },
    './printFulfillment': rules,
    '../../services/printFulfillmentService': service,
  });
  const props = {
    mode: 'confirm', order: order(), attempt: attempt(), title: 'Student order',
    agentReady: true, printers: ['Desk'], defaultPrinter: 'Desk', onClose() {},
    onDone: message => done.push(message), ...overrides,
  };
  const render = () => { cursor = 0; tree = component.FulfillmentDialog(props); };
  const find = predicate => nodes(tree).find(predicate);
  const checkboxes = () => nodes(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox');
  const toggle = (index, checked = true) => { checkboxes()[index].props.onChange({ target: { checked } }); render(); };
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  render();
  return {
    calls, done, render, find, toggle, submit, checkboxes,
    button: () => find(node => node.type === 'button' && node.props.type === 'submit'),
    reason(value) { find(node => node.type === 'textarea').props.onChange({ target: { value } }); render(); },
    text: () => text(tree),
  };
}

test('cash and GCash output confirmation require every check and send the reviewed attempt', async () => {
  for (const payment_method of ['CASH_ON_PICKUP', 'GCASH']) {
    for (const status of ['SUBMITTED', 'MANUAL_STARTED']) {
      const f = fixture({ order: order({ payment_method, payment_status: payment_method === 'CASH_ON_PICKUP' ? 'DUE_AT_PICKUP' : 'VERIFIED' }), attempt: attempt({ status }) });
      assert.equal(f.checkboxes().length, 7);
      assert.equal(f.button().props.disabled, true);
      await f.submit(); assert.equal(f.calls.length, 0);
      for (let i = 0; i < 7; i++) {
        f.toggle(i);
        if (i < 6) { assert.equal(f.button().props.disabled, true); await f.submit(); assert.equal(f.calls.length, 0); }
      }
      assert.equal(f.button().props.disabled, false);
      // Each individual check is mandatory, rather than merely one checkbox.
      for (let i = 0; i < 7; i++) {
        f.toggle(i, false); await f.submit(); assert.equal(f.calls.length, 0); f.toggle(i);
      }
      await f.submit(); f.render();
      assert.deepEqual(f.calls, [{ url: '/orders/order/state', method: 'PATCH', body: {
        state: 'READY_FOR_PICKUP', expectedAttemptId: 'attempt-current', confirmed: true,
        checks: { document: true, revision: true, paper: true, color: true, orientation: true, pages: true, copies: true },
      } }]);
      assert.deepEqual(f.done, ['Saved']);
      assert.equal(f.button().props.disabled, true);
    }
  }
});

test('legacy output confirmation requires a reconciliation reason and preserves a null attempt', async () => {
  const f = fixture({ order: order({ state: 'PRINTED' }), attempt: null });
  for (let i = 0; i < 7; i++) f.toggle(i);
  await f.submit(); assert.equal(f.calls.length, 0);
  f.reason('  Inspected the complete legacy output  ');
  await f.submit();
  assert.equal(f.calls[0].body.expectedAttemptId, null);
  assert.equal(f.calls[0].body.reconciliationReason, 'Inspected the complete legacy output');
  assert.equal(Object.values(f.calls[0].body.checks).every(Boolean), true);
});

test('GCash handover requires confirmation and uses the output-confirmed attempt identity', async () => {
  const f = fixture({ mode: 'handover', order: order({ state: 'READY_FOR_PICKUP', output_confirmed_at: '2026-11-08T00:00:00Z', output_confirmed_attempt_id: 'inspected-attempt' }), attempt: attempt({ attemptId: 'resolved-history', resolvedAt: '2026-11-08T00:00:00Z' }) });
  await f.submit(); assert.equal(f.calls.length, 0);
  f.toggle(0); await f.submit();
  assert.deepEqual(f.calls, [{ url: '/orders/order/state', method: 'PATCH', body: {
    state: 'COMPLETED', expectedAttemptId: 'inspected-attempt', confirmed: true,
  } }]);
});

test('handover cannot proceed with unsettled payment even after checking the confirmation', async () => {
  const f = fixture({ mode: 'handover', order: order({ state: 'READY_FOR_PICKUP', payment_status: 'UNPAID', output_confirmed_at: '2026-11-08T00:00:00Z' }) });
  f.toggle(0); await f.submit();
  assert.equal(f.button().props.disabled, true);
  assert.equal(f.calls.length, 0);
  assert.match(f.text(), /Payment has not been recorded/);
});

test('a stale-attempt server rejection stays visible and preserves the output checklist for review', async () => {
  const f = fixture({}, async () => { throw new Error('Attempt changed; refresh the order.'); });
  for (let i = 0; i < 7; i++) f.toggle(i);
  await f.submit(); f.render();
  assert.deepEqual(f.done, []);
  assert.equal(f.find(node => node.props.role === 'alert').props.children, 'Attempt changed; refresh the order.');
  assert.equal(f.checkboxes().every(input => input.props.checked), true);
  assert.equal(f.button().props.disabled, false);
});
