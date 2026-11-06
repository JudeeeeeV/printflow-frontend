const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, ...globals, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports;
}

const layoutHelpers = load('components/dashboard/liveQueueLayout.ts');
const { getLiveQueueLayout, getQueuePage } = layoutHelpers;
const plain = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat().flatMap(nodes)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}

test('responsive capacities use exact width and desktop fit boundaries', () => {
  for (const width of [375, 667, 767]) assert.deepEqual(plain(getLiveQueueLayout(width, 900)), { pageSize: 3, rows: 3, contained: false });
  for (const width of [768, 820, 1024, 1180, 1279]) assert.deepEqual(plain(getLiveQueueLayout(width, 900)), { pageSize: 4, rows: 2, contained: false });
  assert.deepEqual(plain(getLiveQueueLayout(1280, 716)), { pageSize: 6, rows: 2, contained: true });
  assert.deepEqual(plain(getLiveQueueLayout(1440, 715.99)), { pageSize: 3, rows: 1, contained: true });
  assert.equal(getLiveQueueLayout(1280, 352).contained, true);
  assert.equal(getLiveQueueLayout(1280, 351.99).contained, false);
  assert.equal(getLiveQueueLayout(1920, -10).pageSize, 3);
});

test('larger text scales the minimum row and gap before choosing a capacity', () => {
  assert.equal(getLiveQueueLayout(1440, 716, 440, 15).pageSize, 3);
  assert.equal(getLiveQueueLayout(1440, 895, 440, 15).pageSize, 6);
  assert.equal(getLiveQueueLayout(1440, 439, 440, 15).contained, false);
});

test('loading shows six compact desktop placeholders, four on tablets, and three on phones', () => {
  const { DashboardSkeleton } = load('components/dashboard/skeletons/DashboardSkeleton.tsx', {
    react: {},
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../liveQueueLayout': layoutHelpers,
  });
  const gridRef = () => {};
  for (const [width, height, count] of [[1440, 716, 6], [1366, 400, 6], [1280, 0, 6], [1024, 768, 4], [375, 812, 3]]) {
    const layout = getLiveQueueLayout(width, height);
    const tree = DashboardSkeleton({ layout, gridRef });
    const grid = nodes(tree).find(node => node.props?.['data-queue'] === 'new');
    assert.equal(grid.props.children.length, count);
    assert.equal(grid.props.ref, gridRef);
    assert.equal(tree.props.role, 'status');
    if (layout.contained) {
      assert.equal(grid.props.style.gridTemplateRows, 'repeat(2, minmax(7rem, 1fr))');
    } else {
      assert.equal(grid.props.style, undefined);
    }
  }
});

test('capacity changes keep the first visible order in the resulting page and clamp totals', () => {
  assert.equal(getQueuePage(3, 6, 3, 30), 5);
  assert.equal(getQueuePage(3, 3, 6, 30), 2);
  assert.equal(getQueuePage(2, 6, 4, 30), 2);
  assert.equal(getQueuePage(4, 4, 6, 30), 3);
  assert.equal(getQueuePage(5, 6, 3, 7), 3);
  assert.equal(getQueuePage(5, 6, 6, 0), 1);
});

test('pagination renders correct ranges, controls, and a stable desktop footer', () => {
  const { QueuePagination } = load('components/dashboard/QueuePagination.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@carbon/icons-react': { ChevronLeft: 'left', ChevronRight: 'right' },
  });
  let next;
  const tree = QueuePagination({ label: 'New Orders', controlsId: 'orders', page: 2, pageSize: 6, total: 13, onPageChange: page => { next = page; } });
  assert.match(text(tree), /Showing 7–12 of 13/);
  assert.match(tree.props.className, /xl:h-\[57px\]/);
  const buttons = nodes(tree).filter(node => node.type === 'button');
  buttons[0].props.onClick(); assert.equal(next, 1);
  buttons[1].props.onClick(); assert.equal(next, 3);
  assert.ok(buttons.every(button => button.props['aria-controls'] === 'orders'));
  for (const total of [0, 1, 6]) {
    const single = QueuePagination({ label: 'Completed', controlsId: 'orders', page: 1, pageSize: 6, total, onPageChange() {} });
    assert.equal(nodes(single).filter(node => node.type === 'button').length, 0);
    assert.match(single.props.className, /xl:h-\[57px\]/);
  }
});

function dashboardHarness() {
  let cursor, dirty, layout = getLiveQueueLayout(1440, 716);
  let measuredQueue = 'new';
  const states = [];
  const componentMocks = {
    '../../components/dashboard/skeletons/DashboardSkeleton': { DashboardSkeleton: 'Skeleton' },
    '../../components/dashboard/OrderCard': { OrderCard: 'Card' },
    '../../components/dashboard/ShopOrderActions': { ShopOrderActions: 'ShopOrderActions' },
    '../../components/dashboard/PaymentReviewPanel': { PaymentReviewPanel: 'PaymentReview' },
    '../../components/dashboard/QueuePagination': { QueuePagination: 'Pagination' },
    '../../components/dashboard/PrintJobProgressModal': { PrintJobProgressModal: 'Progress' },
    '../../components/dashboard/KanbanFilterBar': { KanbanFilterBar: 'Filters' },
    '../../components/common/AlertModal': { AlertModal: 'Alert' },
  };
  const { ShopDashboard } = load('pages/ShopDashboard/ShopDashboard.tsx', {
    ...componentMocks,
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update; dirty = true; }];
      },
      useMemo: fn => fn(), useCallback: fn => fn, useRef: value => ({ current: value }), useEffect() {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { useNavigate: () => () => {} },
    'framer-motion': { AnimatePresence: 'AnimatePresence', motion: { section: 'section' }, useReducedMotion: () => true },
    '@carbon/icons-react': { ChevronRight: 'right' },
    '../../services/shopService': { shopService: {} },
    '../../services/orderService': { orderService: {} },
    '../../services/daemonSocketService': { daemonSocketService: {} },
    '../../services/apiClient': { apiClient() {} },
    '../../services/refreshQueue': { createRefreshQueue: () => () => Promise.resolve() },
    '../../hooks/useDataEvents': { useDataEvents() {} },
    '../../components/dashboard/liveQueueLayout': layoutHelpers,
    '../../components/dashboard/useLiveQueueLayout': { useLiveQueueLayout: () => ({ layout: { ...layout, queueKey: measuredQueue }, gridRef() {} }) },
  }, { requestAnimationFrame() {}, console });
  function render() {
    let tree;
    for (let i = 0; i < 10; i++) {
      cursor = 0; dirty = false; tree = ShopDashboard();
      if (!dirty) return tree;
    }
    throw new Error('Dashboard state did not settle');
  }
  render();
  const orders = ['AWAITING_PAYMENT_VERIFICATION', 'IN_PRODUCTION', 'COMPLETED'].flatMap((state, queue) => Array.from({ length: 13 }, (_, index) => ({
    id: `queue-${queue}-${index}`, state, acceptance_status: queue === 0 ? 'PENDING' : 'ACCEPTED', payment_method: 'GCASH', payment_status: queue === 0 ? 'PENDING_VERIFICATION' : 'VERIFIED', assets: [{ file_url: 'private/document.pdf' }], client_name: `Customer ${index}`, created_at: '2026-04-10T00:00:00Z', paper_size: 'A4', print_color_mode: 'COLOR',
  })));
  states[0] = { verification_status: 'VERIFIED' }; states[1] = false; states[7] = orders;
  return {
    render,
    resize(width, height) { layout = getLiveQueueLayout(width, height); measuredQueue = states[17]; },
    measure(height) { layout = getLiveQueueLayout(1440, height); measuredQueue = states[17]; },
    poll(orders) { states[7] = orders; },
    orders,
    select(ids) { states[10] = ids; },
    find(type) { return nodes(render()).find(node => node.type === type); },
    pendingTab(queue) { nodes(render()).find(node => node.props?.id === `queue-tab-${queue}`).props.onClick(); },
    tab(queue) {
      nodes(render()).find(node => node.props?.id === `queue-tab-${queue}`).props.onClick();
      render();
      measuredQueue = queue;
    },
    cards() { return nodes(render()).filter(node => node.type === 'Card'); },
  };
}

test('all queues use the responsive capacity and keep independent anchored pages', () => {
  const app = dashboardHarness();
  assert.equal(app.cards().length, 6);
  app.find('Pagination').props.onPageChange(2);
  const first = app.cards()[0].props.order.id;
  app.resize(1366, 400);
  assert.equal(app.find('Pagination').props.page, 3);
  assert.equal(app.cards().length, 3);
  assert.equal(app.cards()[0].props.order.id, first);
  app.tab('ready'); assert.equal(app.cards().length, 3);
  app.find('Pagination').props.onPageChange(2);
  app.tab('completed'); assert.equal(app.cards().length, 3);
  app.resize(1024, 900); assert.equal(app.cards().length, 4);
  app.tab('new');
  assert.equal(app.find('Pagination').props.page, 2);
  assert.ok(app.cards().some(card => card.props.order.id === first));
  app.resize(375, 812); assert.equal(app.cards().length, 3);
});

test('filters reset pagination and polling clamps are stored across later refreshes', () => {
  const app = dashboardHarness();
  app.find('Pagination').props.onPageChange(3);
  app.find('Filters').props.onSearch('Customer 0');
  assert.equal(app.find('Pagination').props.page, 1);
  assert.equal(app.find('Pagination').props.total, 1);
  app.find('Filters').props.onSearch('');
  app.find('Pagination').props.onPageChange(3);
  app.poll(app.orders.filter(order => order.state !== 'AWAITING_PAYMENT_VERIFICATION' || order.id === 'queue-0-0'));
  assert.equal(app.find('Pagination').props.page, 1);
  app.poll(app.orders);
  assert.equal(app.find('Pagination').props.page, 1);
});

test('switching queues does not re-anchor a saved page using the outgoing grid capacity', () => {
  const app = dashboardHarness();
  app.resize(1366, 400); app.tab('ready');
  app.find('Pagination').props.onPageChange(2);
  const first = app.cards()[0].props.order.id;
  app.tab('new'); app.resize(1440, 716);
  assert.equal(app.find('Pagination').props.pageSize, 6);
  app.pendingTab('ready');
  assert.equal(app.find('Pagination').props.pageSize, 3);
  assert.equal(app.cards()[0].props.order.id, first);
  app.measure(400);
  assert.equal(app.find('Pagination').props.page, 2);
  assert.equal(app.cards()[0].props.order.id, first);
});

test('ready selections persist across pagination, resizing, and queues', () => {
  const app = dashboardHarness();
  app.tab('ready');
  app.select(['queue-1-0', 'queue-1-12']);
  assert.equal(app.cards()[0].props.isSelected, true);
  app.find('Pagination').props.onPageChange(3);
  assert.equal(app.cards()[0].props.order.id, 'queue-1-12');
  assert.equal(app.cards()[0].props.isSelected, true);
  app.resize(375, 812);
  assert.equal(app.cards()[0].props.isSelected, true);
  app.tab('completed'); app.tab('ready');
  assert.equal(app.cards()[0].props.isSelected, true);
  assert.match(text(app.render()), /1 not on this page/);
});
