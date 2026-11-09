const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
const text = n => n == null ? '' : typeof n !== 'object' ? String(n) : Array.isArray(n) ? n.map(text).join('') : text(n.props.children);
async function fixture(payment_status) {
  const hooks = [], calls = [];
  let cursor = 0, effects = [], tree, refresh;
  const server = { orders: [{ id: 'closed-order', state: 'CANCELLED', total: 45,
    created_at: '2026-11-08', payment_method: 'GCASH', payment_status,
    acceptance_status: 'PENDING', current_receipt_id: 'current',
    payment_receipts: [{ id: 'current', reference_number: 'ref', receipt_url: 'receipt.png' }] }] };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useEffect(fn, deps) {
      const i = cursor++, old = hooks[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) effects.push(() => {
        old?.cleanup?.(); hooks[i] = { deps, cleanup: fn() };
      });
    },
  };
  const service = {
    getShopOrders: async () => server.orders.map(o => ({ ...o })),
    verifyPayment: async (...args) => {
      calls.push(args);
      server.orders = server.orders.map(o => ({ ...o, payment_status: 'REFUND_DUE' }));
      return { order: server.orders[0], state: 'CANCELLED' };
    },
  };
  const jsx = (type, props) => ({ type, props }), exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/ShopOrdersPage/ShopOrdersPage.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name.endsWith('/PaymentReviewPanel')) return { PaymentReviewPanel: 'Review' };
    if (name.endsWith('/TableSkeleton')) return { TableSkeleton: 'Skeleton' };
    if (name.endsWith('/orderService')) return { orderService: service };
    if (name.endsWith('/useDataEvents')) return { useDataEvents: (_, fn) => { refresh = fn; } };
    throw new Error(name);
  } });
  const render = () => { cursor = 0; effects = []; tree = exports.ShopOrdersPage(); effects.forEach(fn => fn()); return tree; };
  const flush = async () => { render(); await new Promise(resolve => setImmediate(resolve)); render(); };
  const review = () => nodes(render()).find(n => n.type === 'Review').props;
  await flush();
  return { server, calls, render, flush, review,
    open() { nodes(render()).find(n => n.type === 'button' && text(n) === 'Review order').props.onClick(); render(); },
    async refresh() { refresh(); await flush(); },
  };
}

test('closed refunds stay reachable and review uses the latest order by ID', async () => {
  const f = await fixture('REFUND_DUE');
  f.open();
  assert.equal(f.review().isOpen, true);
  assert.equal(f.review().order.payment_status, 'REFUND_DUE');
  f.server.orders[0] = { ...f.server.orders[0], payment_status: 'REFUNDED' };
  f.review().onUpdated(f.server.orders[0]); await f.flush();
  assert.equal(f.review().order.payment_status, 'REFUNDED');
  assert.equal(f.review().order.state, 'CANCELLED');
  f.server.orders[0] = { ...f.server.orders[0], current_receipt_id: 'replacement' };
  await f.refresh();
  assert.equal(f.review().order.current_receipt_id, 'replacement');
});

test('closed pending receipts can be verified without reopening production', async () => {
  const f = await fixture('PENDING_VERIFICATION');
  f.open();
  await f.review().onVerify('closed-order', 'APPROVE', undefined, 'current', true);
  await f.flush();
  assert.deepEqual(f.calls, [['closed-order', 'APPROVE', undefined, 'current', true]]);
  assert.equal(f.review().isOpen, false);
  f.open();
  assert.equal(f.review().order.state, 'CANCELLED');
  assert.equal(f.review().order.payment_status, 'REFUND_DUE');
});
