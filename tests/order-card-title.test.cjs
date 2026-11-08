const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/components/dashboard', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

const { getOrderCardTitleParts } = load('orderCardTitle.ts');
const order = overrides => ({
  id: '12345678-order', state: 'AWAITING_PAYMENT_VERIFICATION',
  assets: [{ original_filename: 'Test Paper.pdf', file_url: '/receipt.png' }],
  client_name: 'Aldrin Novabos', created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

test('formats the complete title and retains the original order data', () => {
  const value = order();
  const before = JSON.stringify(value);
  const title = getOrderCardTitleParts(value);
  assert.equal(title.filename, 'Test Paper');
  assert.equal(title.customer, 'Aldrin Novabos');
  assert.equal(title.date, '04/10/26');
  assert.equal(JSON.stringify(value), before);
});

test('uses the customer order name as the operator-facing title', () => {
  assert.equal(getOrderCardTitleParts(order({ order_name: '  Test Paper Bebedor  ' })).filename, 'Test Paper Bebedor');
});

test('removes only the final extension while preserving dots, spaces, and Unicode', () => {
  for (const [name, expected] of [
    ['Lesson.v2.final.docx', 'Lesson.v2.final'],
    ['  Résumé  学生 notes.PNG  ', 'Résumé  学生 notes'],
    ['Document without extension', 'Document without extension'],
    ['.hidden', '.hidden'],
  ]) {
    assert.equal(getOrderCardTitleParts(order({ assets: [{ original_filename: name }] })).filename, expected);
  }
});

test('uses only the first asset, matching the existing preview', () => {
  assert.equal(getOrderCardTitleParts(order({ assets: [
    { original_filename: 'First.pdf' }, { original_filename: 'Second.pdf' },
  ] })).filename, 'First');
  assert.equal(getOrderCardTitleParts(order({ assets: [null, { original_filename: 'Second.pdf' }] })).filename, 'Filename unavailable');
});

test('missing, empty, and malformed filenames use the explicit fallback', () => {
  for (const assets of [undefined, null, [], [null], [{}], [{ original_filename: null }],
    [{ original_filename: '   ' }], [{ original_filename: 123 }], 'invalid']) {
    assert.equal(getOrderCardTitleParts(order({ assets })).filename, 'Filename unavailable');
  }
});

test('missing names use the fallback and valid names retain their internal spaces', () => {
  for (const client_name of [undefined, null, '', '   ', 123]) {
    assert.equal(getOrderCardTitleParts(order({ client_name })).customer, 'Name unavailable');
  }
  assert.equal(getOrderCardTitleParts(order({ client_name: '  Ana María  Cruz  ' })).customer, 'Ana María  Cruz');
});

test('missing and invalid dates never display Invalid Date or the epoch', () => {
  for (const created_at of [undefined, null, '', '   ', 'not-a-date', '2026-99-99', 0, {}]) {
    assert.equal(getOrderCardTitleParts(order({ created_at })).date, 'Date unavailable');
  }
  assert.equal(getOrderCardTitleParts({}).filename, 'Filename unavailable');
  assert.equal(getOrderCardTitleParts({}).customer, 'Name unavailable');
  assert.equal(getOrderCardTitleParts({}).date, 'Date unavailable');
});

test('uses Manila day and year boundaries and zero-padded MM/DD/YY', () => {
  for (const [created_at, expected] of [
    ['2026-04-09T15:59:59Z', '04/09/26'],
    ['2026-04-09T16:00:00Z', '04/10/26'],
    ['2026-12-31T16:00:00Z', '01/01/27'],
    ['2026-10-04T00:00:00+08:00', '10/04/26'],
  ]) {
    assert.equal(getOrderCardTitleParts(order({ created_at })).date, expected);
  }
});

function renderCard(value, onClick, onToggleSelect, onReviewOrder = () => {}, stateChanges = [], isSelected = false) {
  const jsx = (type, props) => ({ type, props });
  const { OrderCard } = load('OrderCard.tsx', {
    react: { useState: initial => [initial, next => stateChanges.push(next)] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-dom': { createPortal: node => node },
    'framer-motion': { motion: { div: 'div' } },
    './orderCardTitle': { getOrderCardTitleParts },
    './OrderCardDetailsDialog': { OrderCardDetailsDialog: 'OrderCardDetailsDialog' },
  });
  return OrderCard({ order: value, onClick, onToggleSelect, onReviewOrder, isSelected });
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat().flatMap(nodes)];
}

function text(node) {
  if (Array.isArray(node)) return Array.from(node, text).join('');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' ? node : '';
}

test('all queue states render the new heading, supporting order ID, and status badge', () => {
  for (const state of ['AWAITING_PAYMENT_VERIFICATION', 'IN_PRODUCTION', 'COMPLETED']) {
    const elements = nodes(renderCard(order({ state })));
    const heading = elements.find(node => node.type === 'h4');
    assert.equal(text(heading), 'Test Paper');
    assert.ok(elements.some(node => /line-clamp-2/.test(node.props.className || '')));
    const customer = elements.find(node => node.type === 'p' && text(node) === 'Aldrin Novabos');
    const date = elements.find(node => node.type === 'p' && text(node) === '04/10/26');
    assert.ok(customer && date);
    assert.match(customer.props.className, /text-sm font-bold text-black/);
    assert.match(customer.props.className, /truncate/);
    assert.match(date.props.className, /text-sm font-bold text-black/);
    assert.ok(!elements.some(node => text(node) === '•'));
    assert.match(heading.props.className, /overflow-wrap:anywhere/);
    assert.ok(elements.some(node => node.type === 'p' && text(node) === 'Order #12345678'));
    assert.ok(elements.some(node => /shrink-0/.test(node.props.className || '')));
  }
});

test('rejected orders and rejected receipts show distinct red badges instead of awaiting payment', () => {
  for (const [state, payment_status, expected] of [
    ['REJECTED', 'REJECTED', 'Order Rejected'],
    ['REJECTED', 'REFUND_DUE', 'Order Rejected'],
    ['OPEN_INQUIRY', 'REJECTED', 'Receipt Rejected'],
    ['AWAITING_PAYMENT', 'REJECTED', 'Receipt Rejected'],
  ]) {
    const elements = nodes(renderCard(order({ state, payment_status, payment_method:'GCASH' })));
    const badge = elements.find(node => node.type === 'div' && text(node) === expected);
    assert.ok(badge);
    assert.match(badge.props.className, /bg-red-100 text-red-800/);
    assert.ok(!elements.some(node => /Awaiting payment/i.test(text(node))));
  }
  const replaced = nodes(renderCard(order({state:'OPEN_INQUIRY',payment_status:'PENDING_VERIFICATION',payment_method:'GCASH'})));
  assert.ok(replaced.some(node => node.type === 'div' && text(node) === 'Payment Review Pending'));
  for (const state of ['CANCELLED','EXPIRED','COMPLETED']) {
    const elements = nodes(renderCard(order({state,payment_status:'REJECTED',payment_method:'GCASH'})));
    assert.ok(!elements.some(node => node.type === 'div' && text(node) === 'Receipt Rejected'));
  }
});

test('card activation, ready selection, and preview remain available', () => {
  let activated = 0, selected;
  const tree = renderCard(order({ state: 'IN_PRODUCTION' }), () => activated++, id => { selected = id; });
  tree.props.onClick();
  assert.equal(activated, 1);
  const elements = nodes(tree);
  elements.find(node => node.type === 'input').props.onChange({ stopPropagation() {} });
  assert.equal(selected, '12345678-order');
  assert.ok(elements.some(node => node.type === 'button' && text(node) === 'Preview Document'));
  assert.ok(elements.some(node => node.type === 'button' && text(node) === 'Review Order'));
});

test('card and preview clicks do not activate payment review; only the review button invokes its callback', () => {
  let activated = 0, stopped = 0;
  const tree = renderCard(order(), undefined, undefined, () => activated++);
  assert.equal(tree.props.onClick, undefined);
  assert.equal(tree.props.whileHover, undefined);
  assert.match(tree.props.className, /cursor-default/);
  const elements = nodes(tree);
  const preview = elements.find(node => node.type === 'button' && text(node) === 'Preview Document');
  const review = elements.find(node => node.type === 'button' && text(node) === 'Review Order');
  preview.props.onClick({ stopPropagation() { stopped++; } });
  assert.equal(activated, 0);
  review.props.onClick({ stopPropagation() { stopped++; } });
  assert.equal(activated, 1);
  assert.equal(stopped, 2);
  assert.equal(review.props.type, 'button');
});

test('preview keeps the left slot even without a document and all states can open decisions', () => {
  for (const assets of [undefined, null, []]) {
    const buttons = nodes(renderCard(order({ assets }))).filter(node => node.type === 'button' && !node.props['aria-haspopup']);
    assert.deepEqual(buttons.map(text), ['Preview Document', 'Review Order']);
    assert.equal(buttons[0].props.disabled, true);
  }
  for (const state of ['AWAITING_PAYMENT', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'COMPLETED']) {
    const elements = nodes(renderCard(order({ state })));
    assert.ok(elements.some(node => node.type === 'button' && text(node) === 'Preview Document'));
    assert.ok(elements.some(node => node.type === 'button' && text(node) === 'Review Order'));
  }
});

test('the full-title disclosure opens independently of selection and payment review', () => {
  let selected = 0, reviewed = 0, stopped = 0;
  const changes = [];
  const tree = renderCard(order({ order_name: 'A long complete order title', client_name: 'A long complete customer name' }), () => selected++, undefined, () => reviewed++, changes);
  const button = nodes(tree).find(node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog');
  assert.equal(text(button), 'A long complete order title');
  assert.equal(button.props['aria-expanded'], false);
  button.props.onClick({ stopPropagation() { stopped++; } });
  assert.deepEqual(changes, [true]);
  assert.equal(stopped, 1);
  assert.equal(selected, 0);
  assert.equal(reviewed, 0);
});

test('compact cards preserve their bounds, selected borders, and responsive actions', () => {
  const normal = renderCard(order({ state: 'IN_PRODUCTION' }), () => {});
  const selected = renderCard(order({ state: 'IN_PRODUCTION' }), () => {}, () => {}, undefined, [], true);
  assert.match(normal.props.className, /border border-black p-3/);
  assert.match(selected.props.className, /border-4 border-carbon-blue-60 p-\[9px\]/);
  assert.equal(normal.props.whileHover, undefined);
  assert.match(normal.props.className, /xl:min-h-64/);
  const preview = nodes(normal).find(node => node.type === 'button' && text(node) === 'Preview Document');
  assert.match(preview.props.className, /h-11/);
  assert.match(preview.props.className, /xl:h-9/);
});

test('disputed orders retain explicit receipt review and the administration notice', () => {
  let reviewed = 0;
  const tree = renderCard(order({ state: 'ESCALATED_DISPUTE' }), undefined, undefined, () => reviewed++);
  assert.equal(tree.props.onClick, undefined);
  const elements = nodes(tree);
  assert.ok(elements.some(node => node.type === 'p' && text(node) === 'Administration Reviewing Payment'));
  assert.ok(elements.some(node => node.type === 'button' && text(node) === 'Preview Document'));
  elements.find(node => node.type === 'button' && text(node) === 'Review Order').props.onClick({ stopPropagation() {} });
  assert.equal(reviewed, 1);
});

test('cards retain the metadata date and total without a redundant Created row', () => {
  const elements = nodes(renderCard(order()));
  assert.ok(elements.some(node => node.type === 'p' && text(node) === '04/10/26'));
  assert.ok(elements.some(node => node.type === 'span' && text(node) === 'Total Amount:'));
  assert.ok(!elements.some(node => text(node) === 'Created:'));
});

test('cash and GCash cards end with exactly one two-button row', () => {
  for (const payment_method of ['CASH_ON_PICKUP', 'GCASH']) {
    const card = renderCard(order({ payment_method, state: 'OPEN_INQUIRY' }));
    const children = card.props.children.filter(child => child && typeof child === 'object');
    const row = children.at(-1);
    assert.match(row.props.className, /mt-auto grid grid-cols-2/);
    assert.deepEqual(nodes(row).filter(node => node.type === 'button').map(text), ['Preview Document', 'Review Order']);
    assert.equal(nodes(card).filter(node => node.type === 'button').length, 3); // Title disclosure plus the action row.
  }
});

test('paper-size tags use their requested colors across all queues', () => {
  for (const state of ['AWAITING_PAYMENT_VERIFICATION', 'IN_PRODUCTION', 'COMPLETED']) {
    for (const [paper_size, background] of [['SHORT', 'bg-red-500'], ['A4', 'bg-green-600'], ['LONG', 'bg-carbon-blue-60']]) {
      const tag = nodes(renderCard(order({ state, paper_size }))).find(node => node.type === 'span' && text(node) === paper_size);
      assert.ok(tag.props.className.includes(background));
      assert.match(tag.props.className, /text-white/);
    }
  }
});

test('missing paper sizes retain green A4 and unexpected sizes use neutral white-text tags', () => {
  for (const paper_size of [undefined, null, '']) {
    const tag = nodes(renderCard(order({ paper_size }))).find(node => node.type === 'span' && text(node) === 'A4');
    assert.match(tag.props.className, /bg-green-600/);
  }
  for (const paper_size of ['LETTER', 'toString', '__proto__']) {
    const tag = nodes(renderCard(order({ paper_size }))).find(node => node.type === 'span' && text(node) === paper_size);
    assert.match(tag.props.className, /bg-gray-600/);
    assert.match(tag.props.className, /text-white/);
  }
});

test('B&W has a visible white background and black label while COLOR uses an opaque white label over CMYK', () => {
  for (const print_color_mode of ['BW', undefined]) {
    const tag = nodes(renderCard(order({ print_color_mode }))).find(node => node.type === 'span' && text(node) === 'B&W');
    assert.match(tag.props.className, /bg-white text-black/);
    assert.match(tag.props.className, /border border-gray-300/);
  }
  const color = nodes(renderCard(order({ print_color_mode: 'COLOR' }))).find(node => node.type === 'span' && text(node) === 'COLOR');
  assert.match(color.props.className, /text-white/);
  assert.match(color.props.style.backgroundImage, /rgba\(0, 0, 0, 0\.35\)/);
  assert.match(color.props.style.backgroundImage, /#00ffff.*#ff00ff.*#ffff00.*#000000/);
  assert.equal(color.props.style.opacity, undefined);
});
