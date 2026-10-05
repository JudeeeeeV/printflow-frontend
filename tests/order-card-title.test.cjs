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

function renderCard(value, onClick = () => {}, onToggleSelect) {
  const jsx = (type, props) => ({ type, props });
  const { OrderCard } = load('OrderCard.tsx', {
    react: { useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-dom': { createPortal: node => node },
    'framer-motion': { motion: { div: 'div' } },
    './orderCardTitle': { getOrderCardTitleParts },
  });
  return OrderCard({ order: value, onClick, onToggleSelect });
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat().flatMap(nodes)];
}

test('all queue states render the new heading, supporting order ID, and status badge', () => {
  for (const state of ['AWAITING_PAYMENT_VERIFICATION', 'IN_PRODUCTION', 'COMPLETED']) {
    const elements = nodes(renderCard(order({ state })));
    const heading = elements.find(node => node.type === 'h4');
    assert.equal(heading.props.children, 'Test Paper');
    const metadata = elements.find(node => node.type === 'p' && Array.isArray(node.props.children) && node.props.children[0]?.props?.children === 'Aldrin Novabos');
    assert.ok(metadata);
    assert.deepEqual(Array.from(metadata.props.children, node => node.props.children), ['Aldrin Novabos', '•', '04/10/26']);
    assert.match(metadata.props.className, /text-xs font-normal/);
    assert.match(heading.props.className, /overflow-wrap:anywhere/);
    assert.ok(elements.some(node => node.type === 'p' && node.props.children.join('') === 'Order #12345678'));
    assert.ok(elements.some(node => /shrink-0/.test(node.props.className || '')));
  }
});

test('card activation, ready selection, preview, and payment controls remain available', () => {
  let activated = 0, selected;
  const tree = renderCard(order(), () => activated++, id => { selected = id; });
  tree.props.onClick();
  assert.equal(activated, 1);
  const elements = nodes(tree);
  elements.find(node => node.type === 'input').props.onChange({ stopPropagation() {} });
  assert.equal(selected, '12345678-order');
  assert.ok(elements.some(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Preview Document')));
  assert.ok(elements.some(node => node.type === 'button' && node.props.children === 'Review Payment'));
});
