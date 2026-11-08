const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const order = (overrides = {}) => ({
  current_receipt_id: 'receipt-current', payment_status: 'PENDING_VERIFICATION', acceptance_status: 'PENDING',
  id: 'order-12345678', state: 'AWAITING_PAYMENT_VERIFICATION', total: 50,
  payment_receipts: [{ id: 'receipt-current', reference_number: 'reference-123', receipt_url: 'https://example.test/receipt.png' }],
  ...overrides,
});

// Evaluate the real component handlers with controlled React hooks. Reconcile
// keyed children so closing/reopening and switching orders really unmount state.
// Layout, image rendering, and keyboard focus are verified in a real browser.
function fixture(overrides = {}, reducedMotion = false) {
  const instances = new Map();
  const listeners = new Map();
  const calls = [];
  const root = { inert: false };
  const trigger = { isConnected: true, getClientRects: () => [1], closest: () => null, focus: () => { trigger.focused = true; } };
  const tab = { focus: () => { tab.focused = true; } };
  const document = {
    body: { style: { overflow: 'auto' } }, activeElement: trigger,
    getElementById: () => root, querySelector: () => tab,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); },
  };
  let closed = 0, context, tree;
  const props = {
    isOpen: true, order: order(), isVerifying: false,
    onClose: () => { closed++; }, onVerify: async (...args) => { calls.push(args); }, ...overrides,
  };
  const react = {
    useState(initial) {
      const index = context.cursor++, instance = context;
      if (!instance.hooks[index]) instance.hooks[index] = { value: initial };
      return [instance.hooks[index].value, value => { instance.hooks[index].value = typeof value === 'function' ? value(instance.hooks[index].value) : value; }];
    },
    useRef(initial) {
      const index = context.cursor++;
      if (!context.hooks[index]) context.hooks[index] = { value: { current: initial } };
      return context.hooks[index].value;
    },
    useEffect(effect, deps) {
      const index = context.cursor++, instance = context, previous = instance.hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        instance.effects.push(() => {
          previous?.cleanup?.();
          instance.hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const exports = {};
  vm.runInNewContext(compile(read('components/dashboard/PaymentReviewPanel.tsx')), {
    exports, document, Error,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === 'framer-motion') return { motion: { div: 'div' }, useReducedMotion: () => reducedMotion };
      if (name === '@carbon/icons-react') return { Close: 'icon', Checkmark: 'icon' };
      if (name === './ShopOrderActions') return { ShopOrderActions: 'ShopOrderActions' };
      if (name === '../maps/Maps.module.css') return { default: { primaryButton: 'primary', secondaryButton: 'secondary' } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const render = () => {
    const seen = new Set();
    const expand = (node, nodePath) => {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map((child, i) => expand(child, `${nodePath}/${child?.key ?? i}`));
      if (typeof node.type === 'function') {
        const id = `${nodePath}/${node.type.name}/${node.key ?? ''}`;
        seen.add(id);
        if (!instances.has(id)) instances.set(id, { hooks: [] });
        context = instances.get(id); context.cursor = 0; context.effects = [];
        return expand(node.type(node.props), id);
      }
      return { ...node, props: { ...node.props, children: expand(node.props.children, `${nodePath}/children`) } };
    };
    tree = expand(jsx(exports.PaymentReviewPanel, props), 'root');
    for (const [id, instance] of instances) {
      if (!seen.has(id)) { instance.hooks.forEach(hook => hook?.cleanup?.()); instances.delete(id); }
    }
    for (const instance of instances.values()) instance.effects.forEach(effect => effect());
    return tree;
  };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props.children)];
  const find = predicate => nodes(tree).find(predicate);
  const text = node => !node ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node)
    ? node.map(text).join('') : text(node.props.children);
  const button = label => find(node => node.type === 'button' && (text(node).trim() === label || node.props['aria-label'] === label));
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  const update = changes => { Object.assign(props, changes); render(); };
  const reason = value => { find(node => node.type === 'input' && node.props.type === 'text').props.onChange({ target: { value } }); render(); };
  const escape = () => listeners.get('keydown')?.({ key: 'Escape', preventDefault() {} });
  render();
  return { confirm: () => { find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); render(); }, props, calls, root, trigger, tab, document, listeners, render, find, text, button, flush, update, reason, escape, closed: () => closed };
}

const approve = 'Verify payment';
const reject = 'Reject & Request New Receipt';

test('review targets the current receipt and rejects an empty rejection reason', async () => {
  const f = fixture();
  f.confirm(); f.button(approve).props.onClick(); await f.flush();
  f.reason('Wrong amount');
  f.button(reject).props.onClick(); await f.flush();
  f.reason('');
  f.button(reject).props.onClick(); await f.flush();
  assert.deepEqual(f.calls, [['order-12345678', 'APPROVE', undefined, 'receipt-current', true], ['order-12345678', 'REJECT', 'Wrong amount', 'receipt-current', true]]);
});

test('pending verification blocks duplicate submissions and all dismissal paths', async () => {
  const request = deferred(); let submissions = 0;
  const f = fixture({ onVerify: () => { submissions++; return request.promise; } });
  f.confirm(); f.button(approve).props.onClick();
  f.button(reject).props.onClick();
  f.render();
  assert.equal(submissions, 1);
  for (const label of [approve, reject, 'Close payment review']) assert.equal(f.button(label).props.disabled, true);
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'text').props.disabled, true);
  assert.equal(f.find(node => node.props.role === 'dialog').props['aria-busy'], true);
  assert.ok(f.find(node => node.props.role === 'status' && f.text(node).includes('Verifying payment')));
  f.escape(); f.button('Close payment review').props.onClick();
  const backdrop = f.find(node => node.type === 'div' && node.props.onClick);
  backdrop.props.onClick({ target: backdrop, currentTarget: backdrop });
  assert.equal(f.closed(), 0);
  request.resolve(); await f.flush();
  f.escape(); assert.equal(f.closed(), 1);
});

test('externally busy state disables actions before any callback starts', () => {
  const f = fixture({ isVerifying: true });
  f.confirm(); f.button(approve).props.onClick(); f.escape();
  assert.equal(f.calls.length, 0);
  assert.equal(f.closed(), 0);
  assert.equal(f.button(reject).props.disabled, true);
});

test('failure stays inline, preserves the rejection reason, and permits retry', async () => {
  let attempts = 0;
  const f = fixture({ onVerify: async () => { if (++attempts === 1) throw new Error('Service unavailable'); } });
  f.reason('Blurry receipt');
  f.button(reject).props.onClick(); await f.flush();
  assert.equal(f.text(f.find(node => node.props.role === 'alert')), 'Service unavailable');
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'text').props.value, 'Blurry receipt');
  assert.equal(f.button(reject).props.disabled, false);
  assert.equal(f.closed(), 0);
  f.button(reject).props.onClick(); await f.flush();
  assert.equal(attempts, 2);
  assert.equal(f.find(node => node.props.role === 'alert'), undefined);
});

test('unknown failures show a useful retry message', async () => {
  const f = fixture({ onVerify: async () => { throw null; } });
  f.confirm(); f.button(approve).props.onClick(); await f.flush();
  assert.match(f.text(f.find(node => node.props.role === 'alert')), /Please try again/);
});

test('receipt loading, failure, success, replacement, and missing states are explicit', () => {
  const f = fixture();
  assert.ok(f.find(node => node.props.role === 'status' && f.text(node) === 'Loading receipt…'));
  const link = f.find(node => node.type === 'a');
  assert.equal(link.props.href, 'https://example.test/receipt.png');
  assert.equal(link.props.target, '_blank');
  assert.equal(link.props.rel, 'noopener noreferrer');
  f.find(node => node.type === 'img').props.onError(); f.render();
  assert.ok(f.find(node => node.props.role === 'status' && f.text(node).includes('could not be loaded')));
  assert.ok(f.find(node => node.type === 'a'));
  f.update({ order: order({ payment_receipts: [{ id: 'receipt-current', receipt_url: 'https://example.test/replacement.png' }] }) });
  assert.ok(f.find(node => node.props.role === 'status' && f.text(node) === 'Loading receipt…'));
  f.find(node => node.type === 'img').props.onLoad(); f.render();
  assert.equal(f.find(node => node.props.role === 'status' && f.text(node) === 'Loading receipt…'), undefined);
  f.update({ order: order({ payment_receipts: [] }) });
  assert.ok(f.find(node => f.text(node) === 'No receipt image found.'));
  assert.equal(f.find(node => node.type === 'a'), undefined);
  assert.ok(f.find(node => f.text(node) === 'Not provided'));
});

test('closing and changing order discard unsent reason, errors, and receipt state', async () => {
  const f = fixture({ onVerify: async () => { throw new Error('Failed'); } });
  f.reason('Unsaved reason'); f.button(reject).props.onClick(); await f.flush();
  f.find(node => node.type === 'img').props.onError(); f.render();
  f.update({ isOpen: false });
  assert.equal(f.document.body.style.overflow, 'auto');
  assert.equal(f.root.inert, false);
  assert.equal(f.trigger.focused, true);
  assert.equal(f.listeners.size, 0);
  f.update({ isOpen: true });
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'text').props.value, '');
  assert.equal(f.find(node => node.props.role === 'alert'), undefined);
  assert.ok(f.find(node => node.type === 'img'));
  f.reason('Another unsaved reason');
  f.update({ order: order({ id: 'different-order' }) });
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'text').props.value, '');
  assert.equal(f.document.body.style.overflow, 'hidden');
});

test('escalated disputes are read-only and still allow receipt inspection', () => {
  const f = fixture({ order: order({ state: 'ESCALATED_DISPUTE' }) });
  assert.ok(f.find(node => f.text(node).includes('under review by Platform Administration')));
  assert.equal(f.button(approve), undefined);
  assert.equal(f.button(reject), undefined);
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'text'), undefined);
  assert.ok(f.find(node => node.type === 'a'));
});

test('dismissal only handles backdrop clicks and restores a fallback queue tab', () => {
  const f = fixture();
  const backdrop = f.find(node => node.type === 'div' && node.props.onClick);
  backdrop.props.onClick({ target: {}, currentTarget: backdrop });
  assert.equal(f.closed(), 0);
  backdrop.props.onClick({ target: backdrop, currentTarget: backdrop });
  assert.equal(f.closed(), 1);
  f.trigger.isConnected = false;
  f.update({ isOpen: false });
  assert.equal(f.tab.focused, true);
});

test('reduced motion disables the entrance movement', () => {
  const f = fixture({}, true);
  const dialog = f.find(node => node.props.role === 'dialog');
  assert.equal(dialog.props.initial.y, 0);
  assert.equal(dialog.props.initial.opacity, 1);
  assert.equal(dialog.props.transition.duration, 0);
});

test('dashboard uses authoritative responses without inferring acceptance or production', async () => {
  const source = read('pages/ShopDashboard/ShopDashboard.tsx');
  const handler = source.slice(source.indexOf(' const handleOrderUpdated ='), source.indexOf(' const handleToggleReadySelection ='));
  const state = { busy: [], selected: order(), orders: [order()], refreshed: 0 };
  let failure;
  const exports = {};
  vm.runInNewContext(compile(`${handler}\nexport { handleVerifyPayment };`), {
    exports,
    orderService: { verifyPayment: async (_id, action) => {
      if (failure) throw failure;
      return { order: order({ state: action === 'APPROVE' ? 'IN_PRODUCTION' : 'OPEN_INQUIRY', payment_status: action === 'APPROVE' ? 'VERIFIED' : 'REJECTED', acceptance_status: action === 'APPROVE' ? 'ACCEPTED' : 'PENDING' }) };
    } },
    setIsVerifying: value => state.busy.push(value),
    setSelectedPaymentOrder: value => { state.selected = value; },
    setShopOrders: update => { state.orders = update(state.orders); },
    refreshOrdersAfterChange: () => { state.refreshed++; },
  });
  failure = new Error('Offline');
  await assert.rejects(exports.handleVerifyPayment('order-12345678', 'APPROVE', undefined, 'receipt-current', true), /Offline/);
  assert.equal(state.selected.id, 'order-12345678');
  assert.equal(state.refreshed, 0);
  failure = null;
  for (const [action, expected] of [['APPROVE', 'VERIFIED'], ['REJECT', 'REJECTED']]) {
    await exports.handleVerifyPayment('order-12345678', action, 'Reason', 'receipt-current', true);
    assert.equal(state.orders[0].state, action === 'APPROVE' ? 'IN_PRODUCTION' : 'OPEN_INQUIRY');
    assert.equal(state.orders[0].payment_status, expected);
    assert.equal(state.orders[0].acceptance_status, action === 'APPROVE' ? 'ACCEPTED' : 'PENDING');
    assert.equal(state.selected, null);
  }
  assert.equal(state.refreshed, 2);
  assert.deepEqual(state.busy, [true, false, true, false, true, false]);
});

test('verification requires explicit evidence confirmation and never reviews an arbitrary historical receipt', async () => {
  const f = fixture();
  f.button(approve).props.onClick(); await f.flush();
  assert.equal(f.calls.length, 0);
  assert.match(f.text(f.find(node => node.props.role === 'alert')), /Confirm the receipt/);
  f.update({ order: order({ current_receipt_id: 'missing-current' }) });
  f.confirm(); f.button(approve).props.onClick(); await f.flush();
  assert.equal(f.calls.length, 0);
  assert.match(f.text(f.find(node => node.props.role === 'alert')), /current receipt is unavailable/);
});

test('cash modal shows pickup payment and shop decisions without GCash receipt controls', () => {
  const f = fixture({ order: order({ payment_method: 'CASH_ON_PICKUP', payment_status: 'DUE_AT_PICKUP', state: 'OPEN_INQUIRY' }), onUpdated() {} });
  assert.ok(f.find(node => f.text(node).includes('Amount due at pickup: ₱50.00')));
  assert.equal(f.find(node => node.type === 'img'), undefined);
  assert.equal(f.button(approve), undefined);
  assert.equal(f.button(reject), undefined);
  const actions = f.find(node => node.type === 'ShopOrderActions');
  assert.equal(actions.props.order.payment_method, 'CASH_ON_PICKUP');
  assert.equal(actions.props.order.payment_status, 'DUE_AT_PICKUP');
  assert.match(f.text(f.find(node => f.text(node).includes('Recording cash collection'))), /Recording cash collection completes the order/);
  f.update({ order: order({ payment_method:'CASH_ON_PICKUP', payment_status:'COLLECTED', state:'COMPLETED', acceptance_status:'ACCEPTED' }) });
  assert.ok(f.find(node => f.text(node).includes('Cash payment has been collected. This order is complete.')));
  assert.equal(f.find(node => f.text(node).includes('then confirm handover')), undefined);
});

test('settled GCash orders retain fulfillment actions and receipt inspection without repeat verification', () => {
  const f = fixture({ order: order({ payment_method: 'GCASH', payment_status: 'VERIFIED', state: 'OPEN_INQUIRY' }), onUpdated() {} });
  assert.ok(f.find(node => node.type === 'img'));
  assert.ok(f.find(node => node.type === 'ShopOrderActions'));
  assert.equal(f.button(approve), undefined);
  assert.equal(f.button(reject), undefined);
  assert.equal(f.find(node => f.text(node) === 'Shop acceptance: PENDING'), undefined);
  assert.ok(f.find(node => f.text(node).includes('Verifying the receipt authorizes production')));
});

test('shop confirmation owns dismissal and blocks concurrent receipt verification', () => {
  const f = fixture({ onUpdated() {} });
  const actions = f.find(node => node.type === 'ShopOrderActions');
  actions.props.onBusyChange(true); f.render();
  f.escape(); f.button('Close payment review').props.onClick();
  f.button(approve).props.onClick();
  assert.equal(f.closed(), 0);
  assert.equal(f.calls.length, 0);
  assert.equal(f.button(approve).props.disabled, true);
  let prevented = false;
  f.listeners.get('keydown')({ key:'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); // Immediate decisions keep focus in the parent dialog.
  prevented = false;
  f.listeners.get('keydown')({ key:'Tab', target:{closest:() => ({})}, preventDefault() { prevented = true; } });
  assert.equal(prevented, false); // Nested financial confirmations handle their own keys.
  actions.props.onBusyChange(false); f.render();
  f.escape();
  assert.equal(f.closed(), 1);
});


test('stranded verified GCash retries production authorization using the same receipt', async () => {
  const f = fixture({ order: order({ state: 'OPEN_INQUIRY', payment_method: 'GCASH', payment_status: 'VERIFIED', acceptance_status: 'PENDING' }) });
  assert.match(f.text(f.render()), /does not record payment again/);
  assert.equal(f.button('Reject & Request New Receipt'), undefined);
  f.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  f.render();
  f.button('Retry production authorization').props.onClick();
  await f.flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][1], 'APPROVE');
  assert.equal(f.calls[0][3], 'receipt-current');
  assert.equal(f.calls[0][4], true);
});

test('cancellation during review requires a fresh confirmation for the refund obligation', () => {
  const f = fixture({ order: order({ state: 'OPEN_INQUIRY' }) });
  f.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  f.render();
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true);
  f.update({ order: order({ state: 'CANCELLED' }) });
  f.render();
  assert.equal(f.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, false);
  assert.match(f.text(f.render()), /manual refund obligation/);
});
