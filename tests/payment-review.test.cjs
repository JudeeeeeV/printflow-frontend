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
  id: 'order-12345678', state: 'AWAITING_PAYMENT_VERIFICATION', total: 50,
  payment_receipts: [{ reference_number: 'reference-123', receipt_url: 'https://example.test/receipt.png' }],
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
  const reason = value => { find(node => node.type === 'input').props.onChange({ target: { value } }); render(); };
  const escape = () => listeners.get('keydown')?.({ key: 'Escape', preventDefault() {} });
  render();
  return { props, calls, root, trigger, tab, document, listeners, render, find, text, button, flush, update, reason, escape, closed: () => closed };
}

const approve = 'Verify & Send to Production';
const reject = 'Reject & Request New Receipt';

test('approve and reject pass the selected order and optional reason unchanged', async () => {
  const f = fixture();
  f.button(approve).props.onClick(); await f.flush();
  f.reason('Wrong amount');
  f.button(reject).props.onClick(); await f.flush();
  f.reason('');
  f.button(reject).props.onClick(); await f.flush();
  assert.deepEqual(f.calls, [['order-12345678', 'APPROVE'], ['order-12345678', 'REJECT', 'Wrong amount'], ['order-12345678', 'REJECT', '']]);
});

test('pending verification blocks duplicate submissions and all dismissal paths', async () => {
  const request = deferred(); let submissions = 0;
  const f = fixture({ onVerify: () => { submissions++; return request.promise; } });
  f.button(approve).props.onClick();
  f.button(reject).props.onClick();
  f.render();
  assert.equal(submissions, 1);
  for (const label of [approve, reject, 'Close payment review']) assert.equal(f.button(label).props.disabled, true);
  assert.equal(f.find(node => node.type === 'input').props.disabled, true);
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
  f.button(approve).props.onClick(); f.escape();
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
  assert.equal(f.find(node => node.type === 'input').props.value, 'Blurry receipt');
  assert.equal(f.button(reject).props.disabled, false);
  assert.equal(f.closed(), 0);
  f.button(reject).props.onClick(); await f.flush();
  assert.equal(attempts, 2);
  assert.equal(f.find(node => node.props.role === 'alert'), undefined);
});

test('unknown failures show a useful retry message', async () => {
  const f = fixture({ onVerify: async () => { throw null; } });
  f.button(approve).props.onClick(); await f.flush();
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
  f.update({ order: order({ payment_receipts: [{ receipt_url: 'https://example.test/replacement.png' }] }) });
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
  assert.equal(f.find(node => node.type === 'input').props.value, '');
  assert.equal(f.find(node => node.props.role === 'alert'), undefined);
  assert.ok(f.find(node => node.type === 'img'));
  f.reason('Another unsaved reason');
  f.update({ order: order({ id: 'different-order' }) });
  assert.equal(f.find(node => node.type === 'input').props.value, '');
  assert.equal(f.document.body.style.overflow, 'hidden');
});

test('escalated disputes are read-only and still allow receipt inspection', () => {
  const f = fixture({ order: order({ state: 'ESCALATED_DISPUTE' }) });
  assert.ok(f.find(node => f.text(node).includes('under review by Platform Administration')));
  assert.equal(f.button(approve), undefined);
  assert.equal(f.button(reject), undefined);
  assert.equal(f.find(node => node.type === 'input'), undefined);
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

test('dashboard verification propagates failures and preserves successful queue updates', async () => {
  const source = read('pages/ShopDashboard/ShopDashboard.tsx');
  const handler = source.slice(source.indexOf(' const handleVerifyPayment ='), source.indexOf(' const handleToggleReadySelection ='));
  const state = { busy: [], selected: order(), orders: [order()], refreshed: 0 };
  let failure;
  const exports = {};
  vm.runInNewContext(compile(`${handler}\nexport { handleVerifyPayment };`), {
    exports,
    orderService: { verifyPayment: async () => { if (failure) throw failure; } },
    setIsVerifying: value => state.busy.push(value),
    setSelectedPaymentOrder: value => { state.selected = value; },
    setShopOrders: update => { state.orders = update(state.orders); },
    refreshOrdersAfterChange: () => { state.refreshed++; },
  });
  failure = new Error('Offline');
  await assert.rejects(exports.handleVerifyPayment('order-12345678', 'APPROVE'), /Offline/);
  assert.equal(state.selected.id, 'order-12345678');
  assert.equal(state.orders[0].state, 'AWAITING_PAYMENT_VERIFICATION');
  assert.equal(state.refreshed, 0);
  failure = null;
  for (const [action, expected] of [['APPROVE', 'IN_PRODUCTION'], ['REJECT', 'AWAITING_PAYMENT']]) {
    await exports.handleVerifyPayment('order-12345678', action);
    assert.equal(state.orders[0].state, expected);
    assert.equal(state.selected, null);
  }
  assert.equal(state.refreshed, 2);
  assert.deepEqual(state.busy, [true, false, true, false, true, false]);
});
