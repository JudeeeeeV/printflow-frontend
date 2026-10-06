const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const component = () => null;
const { OrderSummary } = load('components/orders/OrderSummary/OrderSummary.tsx', { react: {}, 'react/jsx-runtime': runtime });
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat().flatMap(nodes)]; }
function text(node) { return Array.isArray(node) ? Array.from(node, text).join('') : node && typeof node === 'object' ? text(node.props.children) : node == null ? '' : String(node); }
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label);
const shop = { id: 'shop', pricing_matrix: { paper_sizes: { A4: 3 }, color_mode_multipliers: { COLOR: 3, BLACK_AND_WHITE: 0 } } };

function fixture(kind = 'new', busy = false) {
  const hooks = []; let cursor = 0, effects = [], dirty = false, tree;
  const calls = [], navigation = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { value: { current: initial } }; return hooks[index].value; },
    useMemo(callback) { cursor++; return callback(); },
    useEffect(callback, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value,i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const services = { submitOrder: async (...args) => { calls.push(['submit', ...args]); if (busy) await new Promise(() => {}); return { orderId: 'created' }; },
    saveDraft: async (...args) => calls.push(['save', ...args]), updateDraftWithoutFile: async (...args) => calls.push(['update', ...args]),
    submitDraft: async (...args) => calls.push(['submitDraft', ...args]), deleteDraft: async (...args) => calls.push(['delete', ...args]) };
  const markers = { ShopSelector: () => null, FileUploadZone: () => null };
  const mocks = { react, 'react/jsx-runtime': runtime, '@carbon/icons-react': { ArrowLeft: component, Document: component },
    '../../services/orderService': { orderService: services }, '../../services/shopService': { shopService: { getShops: async () => [shop] } },
    '../../services/apiClient': { apiClient: async () => ({}) },
    'react-router-dom': { useNavigate: () => target => navigation.push(target), useSearchParams: () => [new URLSearchParams(), () => {}] },
    '../../components/orders/ShopSelector/ShopSelector': markers, '../orders/ShopSelector/ShopSelector': markers,
    '../../components/orders/FileUploadZone/FileUploadZone': markers, '../orders/FileUploadZone/FileUploadZone': markers,
    '../../components/orders/OrderSummary/OrderSummary': { OrderSummary }, '../orders/OrderSummary/OrderSummary': { OrderSummary },
    '../../components/dashboard/MyOrdersList': { MyOrdersList: component }, '../../components/dashboard/MyDraftsList': { MyDraftsList: component },
    '../../components/dashboard/EditDraftPanel': { EditDraftPanel: component },
    '../../components/common/AlertModal': { AlertModal: component }, '../common/AlertModal': { AlertModal: component },
    '../../components/auth/ChangePasswordModal': { ChangePasswordModal: component },
    '../../assets/printflow-logo-dark.png': { default: 'logo.png' }, './NewOrderPage.module.css': { default: {} },
    'pdf-lib': { PDFDocument: { load: async () => ({ getPageCount: () => 4, getPage: () => ({ getSize: () => ({ width:400,height:800 }) }) }) } },
  };
  const draft = { id: 'draft', shopId: 'shop', fileUrl: 'stored.pdf', fileName: 'four.pdf', paperSize: 'A4', printColorMode: 'COLOR', pageCount: 4, orderName: 'Saved', orientation: 'LANDSCAPE', copies: 2 };
  const globals = { URLSearchParams, console, setTimeout: callback => { queueMicrotask(callback); return 1; }, URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} } };
  const module = kind === 'new' ? load('pages/NewOrderPage/NewOrderPage.tsx', mocks, globals) : load('components/dashboard/EditDraftPanel.tsx', mocks, globals);
  const render = () => {
    for (let i=0; i<10; i++) {
      dirty = false; cursor = 0; effects = [];
      tree = kind === 'new' ? module.NewOrderPage({}) : module.EditDraftPanel({ draft, shops: [shop], onCancel() {}, onSuccess: id => navigation.push(id) });
      effects.forEach(effect => effect()); if (!dirty) return;
    }
    throw new Error('Render did not settle');
  };
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  const summary = () => nodes(tree).find(node => node.type === OrderSummary).props;
  render();
  return { calls, navigation, render, flush, summary, tree: () => tree,
    selectShop() { nodes(tree).find(node => node.type === markers.ShopSelector).props.onSelect('shop'); render(); },
    async selectFile() { await nodes(tree).find(node => node.type === markers.FileUploadZone).props.onFileSelect({ name:'four.pdf',type:'application/pdf',arrayBuffer:async()=>new ArrayBuffer(1) }); render(); },
  };
}

test('orientation exposes its group label, selection state, keyboard focus, and busy state', () => {
  for (const orientation of ['PORTRAIT','LANDSCAPE']) for (const isSubmitting of [false,true]) {
    let selected;
    const tree = OrderSummary({ orientation, isSubmitting, copies:1, setOrientation:value=>selected=value });
    const group = nodes(tree).find(node=>node.props.role==='group');
    assert.equal(group.props['aria-labelledby'],'print-orientation-label');
    assert.ok(nodes(tree).some(node=>node.props.id===group.props['aria-labelledby'] && text(node)==='Orientation'));
    for (const [label,value] of [['Portrait','PORTRAIT'],['Landscape','LANDSCAPE']]) {
      const control = button(tree,label);
      assert.equal(control.props['aria-pressed'],orientation===value);
      assert.equal(control.props.disabled,isSubmitting);
      assert.equal(control.props.type,'button');
      assert.match(control.props.className,/focus-visible:outline/);
      control.props.onClick(); assert.equal(selected,value);
    }
    assert.equal(nodes(tree).find(node=>node.props.id==='print-copies').props.disabled,isSubmitting);
  }
});

test('copy input retains bounds and clamps invalid selections', () => {
  let copies;
  const input = nodes(OrderSummary({ copies:1,setCopies:value=>copies=value })).find(node=>node.props.id==='print-copies');
  assert.deepEqual([input.props.min,input.props.max,input.props.step],[1,99,1]);
  for (const [value,expected] of [['1',1],['2',2],['99',99],['0',1],['-1',1],['100',99],['1.5',1],['',1],['invalid',1]]) {
    input.props.onChange({target:{value}}); assert.equal(copies,expected);
  }
});

test('new-order estimate and submissions carry selected orientation and copies', async () => {
  const f = fixture(); await f.flush(); f.selectShop(); await f.selectFile();
  f.summary().setOrderName('New order'); f.summary().setOrientation('LANDSCAPE'); f.summary().setCopies(3); f.summary().setPrintColorMode('COLOR'); f.render();
  assert.equal(f.summary().estimate.total,72);
  assert.equal(f.summary().estimate.pageCount,4);
  assert.equal(f.summary().isReady,true);
  await f.summary().onSubmit();
  assert.deepEqual(f.calls[0].slice(-3),['New order','LANDSCAPE',3]);
  assert.deepEqual(f.navigation,['/checkout/created']);
  assert.ok(text(f.tree()).includes('Uploaded file preview'));
  assert.ok(text(f.tree()).includes('Printing uses the selected paper size and orientation.'));
});

test('saving a new draft carries settings and resets orientation and copies', async () => {
  const f = fixture(); await f.flush(); f.selectShop(); await f.selectFile();
  f.summary().setOrderName('Draft'); f.summary().setOrientation('LANDSCAPE'); f.summary().setCopies(2); f.render();
  await f.summary().onSaveDraft(); f.render();
  assert.deepEqual(f.calls[0].slice(-3),['Draft','LANDSCAPE',2]);
  assert.equal(f.summary().orientation,'PORTRAIT'); assert.equal(f.summary().copies,1);
});

test('draft editing retains settings, reprices, and updates before submission without replacing its file', async () => {
  const f = fixture('edit');
  assert.equal(f.summary().orientation,'LANDSCAPE'); assert.equal(f.summary().copies,2);
  assert.equal(f.summary().estimate.total,48);
  f.summary().setOrientation('PORTRAIT'); f.summary().setCopies(3); f.render();
  assert.equal(f.summary().estimate.total,72);
  await f.summary().onSaveDraft();
  assert.deepEqual(f.calls[0].slice(-3),['Saved','PORTRAIT',3]);
  await f.summary().onSubmit();
  assert.deepEqual(f.calls.map(call=>call[0]),['update','update','submitDraft']);
  assert.ok(text(f.tree()).includes('Uploaded file preview'));
  assert.ok(text(f.tree()).includes('Printing uses the selected paper size and orientation.'));
});

test('submission disables the student print controls while its request remains pending', async () => {
  const f = fixture('new',true); await f.flush(); f.selectShop(); await f.selectFile();
  f.summary().setOrderName('Busy'); f.render(); void f.summary().onSubmit(); f.render();
  assert.equal(f.summary().isSubmitting,true);
  const tree = OrderSummary(f.summary());
  assert.equal(button(tree,'Portrait').props.disabled,true);
  assert.equal(button(tree,'Landscape').props.disabled,true);
  assert.equal(nodes(tree).find(node=>node.props.id==='print-copies').props.disabled,true);
});

test('order service serializes orientation and copies in multipart and draft JSON requests', async () => {
  const calls = [];
  const {orderService} = load('services/orderService.ts', { './apiClient': { apiClient:async(endpoint,options)=>calls.push({endpoint,...options}) } }, {FormData});
  const file = new Blob(['%PDF-fixture'],{type:'application/pdf'});
  await orderService.submitOrder('shop',file,'LONG','COLOR',' Name ','LANDSCAPE',99);
  await orderService.saveDraft('shop',file,'A4','BLACK_AND_WHITE',' Draft ','PORTRAIT',2);
  await orderService.updateDraftWithoutFile('draft','shop','SHORT','COLOR',' Edited ','LANDSCAPE',3);
  assert.equal(calls[0].body.get('orientation'),'LANDSCAPE'); assert.equal(calls[0].body.get('copies'),'99'); assert.equal(calls[0].body.get('orderName'),'Name');
  assert.equal(calls[1].body.get('orientation'),'PORTRAIT'); assert.equal(calls[1].body.get('copies'),'2'); assert.equal(calls[1].body.get('isDraft'),'true');
  assert.deepEqual(JSON.parse(calls[2].body),{shopId:'shop',paperSize:'SHORT',printColorMode:'COLOR',orderName:'Edited',orientation:'LANDSCAPE',copies:3});
});
