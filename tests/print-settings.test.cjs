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
const { ApiError } = load('services/apiClient.ts', { '../config/runtime': { API_URL: '' } }, { Headers, FormData });
const noTimers = { setTimeout: () => 1, clearTimeout() {} };
const shop = { id: 'shop', pricing_matrix: { paper_sizes: { A4: 3 }, color_mode_multipliers: { COLOR: 3, BLACK_AND_WHITE: 0 } } };

function fixture(kind = 'new', busy = false, draftOverrides = {}, options = {}) {
  const hooks = []; let cursor = 0, effects = [], dirty = false, tree;
  const calls = [], navigation = []; let cacheInvalidations = 0, operationReads = 0;
  let operationStatus = () => ({ status: 'unknown', retryAllowed: true });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { value: { current: initial } }; return hooks[index].value; },
    useMemo(callback) { cursor++; return callback(); },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value,i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const services = { submitOrder: async (...args) => { calls.push(['submit', ...args]); if (busy) await new Promise(() => {}); return { orderId: 'created' }; },
    saveDraft: async (...args) => { calls.push(['save', ...args]); return { orderId: 'saved' }; },
    saveDraftChanges: async (...args) => { calls.push(['update', ...args]); return { orderId: 'draft' }; },
    submitDraftChanges: async (...args) => { calls.push(['submitDraft', ...args]); return { orderId: 'draft' }; },
    getOperation: async () => { operationReads++; return operationStatus(); }, deleteDraft: async (...args) => calls.push(['delete', ...args]) };
  const markers = { ShopSelector: () => null, FileUploadZone: () => null, SubmissionStatus: () => null, MobileActionBar: () => null };
  const mocks = { react, 'react/jsx-runtime': runtime, '@carbon/icons-react': { ArrowLeft: component, Document: component },
    '../../services/orderService': { orderService: services }, '../../services/shopService': { shopService: { getShops: async () => [shop] } },
    '../../services/apiClient': { apiClient: async () => ({}), invalidateApiCache: () => cacheInvalidations++, clearAuthTokens() {} },
    '../../components/orders/SubmissionStatus': markers, '../orders/SubmissionStatus': markers,
    '../../components/orders/MobileActionBar': markers, '../orders/MobileActionBar': markers,
    '../../hooks/useDataEvents': { useDataEvents: () => {} },
    'react-router-dom': { useNavigate: () => target => navigation.push(target), useSearchParams: () => [new URLSearchParams(), () => {}] },
    '../../components/orders/ShopSelector/ShopSelector': markers, '../orders/ShopSelector/ShopSelector': markers,
    '../../components/orders/FileUploadZone/FileUploadZone': markers, '../orders/FileUploadZone/FileUploadZone': markers,
    '../../components/orders/OrderSummary/OrderSummary': { OrderSummary }, '../orders/OrderSummary/OrderSummary': { OrderSummary },
    '../../components/dashboard/MyOrdersList': { MyOrdersList: component }, '../../components/dashboard/MyDraftsList': { MyDraftsList: component },
    '../../components/dashboard/EditDraftPanel': { EditDraftPanel: component },
    '../../components/common/AlertModal': { AlertModal: component }, '../common/AlertModal': { AlertModal: component },
    '../../components/auth/ChangePasswordModal': { ChangePasswordModal: component },
    '../../assets/printflow-logo-dark.png': { default: 'logo.png' }, './NewOrderPage.module.css': { default: {} },
    'pdf-lib': { EncryptedPDFError: class EncryptedPDFError extends Error {}, PDFDocument: { load: options.pdfLoad || (async () => ({ getPageCount: () => 4, getPage: () => ({ getSize: () => ({ width:400,height:800 }) }) })) } },
  };
  const draft = { id: 'draft', shopId: 'shop', fileUrl: 'stored.pdf', fileName: 'four.pdf', paperSize: 'A4', printColorMode: 'COLOR', pageCount: 4, orderName: 'Saved', orientation: 'LANDSCAPE', copies: 2, ...draftOverrides };
  const globals = { File, Error, URLSearchParams, console, setTimeout: callback => { queueMicrotask(callback); return 1; }, URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} } };
  const preparation = load('services/documentPreparation.ts', mocks, globals);
  mocks['../../services/documentPreparation'] = preparation;
  mocks['../../components/orders/FileFeedback'] = { FileFeedback: component };
  mocks['../orders/FileFeedback'] = { FileFeedback: component };
  const recovery = load('services/submissionRecovery.ts', { './apiClient': { getAccountId: () => 'student' } }, { crypto });
  mocks['../../services/submissionRecovery'] = recovery;
  const controller = load('services/submissionController.ts', { './apiClient': { ApiError }, './submissionRecovery': recovery }, noTimers);
  mocks['../../hooks/useRecoverableSubmission'] = load('hooks/useRecoverableSubmission.ts', {
    react, '../services/apiClient': mocks['../../services/apiClient'], '../services/submissionController': controller,
  }, { window: { addEventListener() {}, removeEventListener() {} } });
  const module = kind === 'new' ? load('pages/NewOrderPage/NewOrderPage.tsx', mocks, globals) : load('components/dashboard/EditDraftPanel.tsx', mocks, globals);
  const render = () => {
    for (let i=0; i<10; i++) {
      dirty = false; cursor = 0; effects = [];
      tree = kind === 'new' ? module.NewOrderPage({}) : module.EditDraftPanel({ draft, shops: [shop], onCancel: () => navigation.push('drafts'), onSuccess: id => navigation.push(id) });
      effects.forEach(effect => effect()); if (!dirty) return;
    }
    throw new Error('Render did not settle');
  };
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  const summary = () => nodes(tree).find(node => node.type === OrderSummary).props;
  render();
  return { calls, services, navigation, render, flush, summary, invalidations: () => cacheInvalidations, operationReads: () => operationReads,
    setOperationStatus: value => { operationStatus = () => value; },
    status: () => nodes(tree).find(node => node.type === markers.SubmissionStatus).props,
    feedback: () => nodes(tree).find(node => node.type === component && node.props.feedback)?.props,
    upload: () => nodes(tree).find(node => node.type === markers.FileUploadZone)?.props,
    unmount: () => hooks.forEach(hook => hook?.cleanup?.()),
    tree: () => tree,
    selectShop() { nodes(tree).find(node => node.type === markers.ShopSelector).props.onSelect('shop'); render(); },
    async selectFile(file = new File(['%PDF-fixture'], 'four.pdf', {type:'application/pdf'})) { await nodes(tree).find(node => node.type === markers.FileUploadZone).props.onFileSelect(file); render(); },
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
  assert.deepEqual(f.calls[0].slice(5,9),['New order','LANDSCAPE',3,'GCASH']);
  assert.deepEqual(f.navigation,['/checkout/created']);
  assert.ok(text(f.tree()).includes('Uploaded file preview'));
  assert.ok(text(f.tree()).includes('Printing uses the selected paper size and orientation.'));
});

test('saving a new draft carries settings and resets orientation and copies', async () => {
  const f = fixture(); await f.flush(); f.selectShop(); await f.selectFile();
  f.summary().setOrderName('Draft'); f.summary().setOrientation('LANDSCAPE'); f.summary().setCopies(2); f.render();
  await f.summary().onSaveDraft(); f.render();
  assert.deepEqual(f.calls[0].slice(5,9),['Draft','LANDSCAPE',2,'GCASH']);
  assert.equal(f.summary().orientation,'PORTRAIT'); assert.equal(f.summary().copies,1);
});

test('draft editing retains settings, reprices, and updates before submission without replacing its file', async () => {
  const f = fixture('edit');
  assert.equal(f.summary().orientation,'LANDSCAPE'); assert.equal(f.summary().copies,2);
  assert.equal(f.summary().estimate.total,48);
  f.summary().setOrientation('PORTRAIT'); f.summary().setCopies(3); f.render();
  assert.equal(f.summary().estimate.total,72);
  await f.summary().onSaveDraft();
  assert.equal(f.calls[0][1],'draft');
  assert.deepEqual([f.calls[0][2].orderName,f.calls[0][2].orientation,f.calls[0][2].copies,f.calls[0][2].paymentMethod],['Saved','PORTRAIT',3,'GCASH']);
  assert.equal(f.calls[0][3],null,'No replacement file is sent');
  f.render(); await f.summary().onSubmit();
  assert.deepEqual(f.calls.map(call=>call[0]),['update','submitDraft'],'Saving and submitting are one request each');
  assert.ok(text(f.tree()).includes('Uploaded file preview'));
  assert.ok(text(f.tree()).includes('Printing uses the selected paper size and orientation.'));
});

test('submission disables the student print controls while its request remains pending', async () => {
  const f = fixture('new',true); await f.flush(); f.selectShop(); await f.selectFile();
  f.summary().setOrderName('Busy'); f.render(); void f.summary().onSubmit(); await f.flush();
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
  await orderService.submitOrder('shop',file,'LONG','COLOR',' Name ','LANDSCAPE',99,'GCASH','key');
  await orderService.saveDraft('shop',file,'A4','BLACK_AND_WHITE',' Draft ','PORTRAIT',2,'GCASH','key');
  await orderService.saveDraftChanges('draft',{shopId:'shop',paperSize:'SHORT',printColorMode:'COLOR',orderName:' Edited ',orientation:'LANDSCAPE',copies:3,paymentMethod:'GCASH'},null,undefined,'key');
  assert.equal(calls[0].body.get('orientation'),'LANDSCAPE'); assert.equal(calls[0].body.get('copies'),'99'); assert.equal(calls[0].body.get('orderName'),'Name');
  assert.equal(calls[1].body.get('orientation'),'PORTRAIT'); assert.equal(calls[1].body.get('copies'),'2'); assert.equal(calls[1].body.get('isDraft'),'true');
  assert.deepEqual(JSON.parse(calls[2].body),{shopId:'shop',paperSize:'SHORT',printColorMode:'COLOR',orderName:'Edited',orientation:'LANDSCAPE',copies:3,paymentMethod:'GCASH'});
});

test('cash choice is retained in new orders, saved drafts and draft replacement files', async () => {
  for (const operation of ['onSubmit','onSaveDraft']) {
    const f = fixture(); await f.flush(); f.selectShop(); await f.selectFile();
    f.summary().setOrderName('Cash order'); f.summary().setPaymentMethod('CASH_ON_PICKUP'); f.render();
    await f.summary()[operation]();
    assert.equal(f.calls[0][8],'CASH_ON_PICKUP');
  }
  for (const replacement of [false,true]) {
    for (const operation of ['onSubmit','onSaveDraft']) {
      const f = fixture('edit', false, { paymentMethod:'CASH_ON_PICKUP' });
      assert.equal(f.summary().paymentMethod,'CASH_ON_PICKUP');
      if (replacement) { button(f.tree(),'Remove file').props.onClick(); f.render(); await f.selectFile(); }
      await f.summary()[operation]();
      assert.equal(f.calls[0][2].paymentMethod,'CASH_ON_PICKUP');
      assert.equal(f.calls[0][1],'draft','Replacing a file keeps the same draft');
    }
  }
});

test('order service serializes cash choice in multipart and draft JSON payloads', async () => {
  const calls = [];
  const {orderService} = load('services/orderService.ts', { './apiClient': { apiClient:async(endpoint,options)=>calls.push({endpoint,...options}) } }, {FormData});
  const file = new Blob(['%PDF-fixture'],{type:'application/pdf'});
  await orderService.submitOrder('shop',file,'A4','COLOR','Cash','PORTRAIT',1,'CASH_ON_PICKUP','key');
  await orderService.saveDraft('shop',file,'A4','COLOR','Cash','PORTRAIT',1,'CASH_ON_PICKUP','key');
  await orderService.saveDraftChanges('draft',{shopId:'shop',paperSize:'A4',printColorMode:'COLOR',orderName:'Cash',orientation:'PORTRAIT',copies:1,paymentMethod:'CASH_ON_PICKUP'},null,undefined,'key');
  assert.equal(calls[0].body.get('paymentMethod'),'CASH_ON_PICKUP');
  assert.equal(calls[1].body.get('paymentMethod'),'CASH_ON_PICKUP');
  assert.equal(JSON.parse(calls[2].body).paymentMethod,'CASH_ON_PICKUP');
});


const documentError = (code, status = 400) => new ApiError('File error', status, {code, field:'file', message:'Public problem', nextStep:'Public next step'});
async function preparedForm(kind, options = {}) {
  const f = fixture(kind, false, {}, options);
  await f.flush();
  if (kind === 'new') { f.selectShop(); await f.selectFile(); f.summary().setOrderName('Ready'); f.render(); }
  return f;
}
for (const kind of ['new', 'edit']) {
  test(`${kind}: a bad replacement invalidates readiness while preserving print settings`, async () => {
    const f = await preparedForm(kind);
    f.summary().setCopies(3); f.summary().setOrientation('LANDSCAPE'); f.render();
    button(f.tree(),'Remove file').props.onClick(); f.render();
    await f.selectFile(new File(['html'], 'bad.html', {type:'text/html'}));
    assert.equal(f.summary().isReady, false);
    assert.equal(f.upload().validationResult.code,'UNSUPPORTED_FILE');
    assert.equal(f.summary().copies,3); assert.equal(f.summary().orientation,'LANDSCAPE');
    await f.summary().onSubmit(); assert.equal(f.calls.length,0);
    await f.selectFile(); assert.equal(f.summary().isReady,true);
  });
  test(`${kind}: server file failures remain inline and prevent submission`, async () => {
    const f = await preparedForm(kind);
    const method = kind === 'new' ? 'submitOrder' : 'submitDraftChanges';
    f.services[method] = async () => { throw documentError('UNREADABLE_FILE'); };
    await f.summary().onSubmit(); f.render();
    assert.equal(f.upload().validationResult.code,'UNREADABLE_FILE');
    assert.equal(f.summary().isReady,false);
    assert.equal(f.calls.length,0);
  });
  test(`${kind}: temporary conversion failure retains the file and retries only on request`, async () => {
    const f = await preparedForm(kind);
    const method = kind === 'new' ? 'submitOrder' : 'submitDraftChanges';
    const keys = [];
    f.services[method] = async (...args) => { keys.push(kind === 'new' ? args[8] : args[4]); throw documentError('CONVERSION_UNAVAILABLE',503); };
    f.setOperationStatus({ status:'failed', retryAllowed:true, error:{ status:503, data:null } });
    f.summary().setCopies(7); f.render();
    await f.summary().onSubmit(); await f.flush();
    assert.equal(keys.length,1); assert.equal(f.summary().isReady,true); assert.equal(f.summary().copies,7);
    assert.equal(f.status().phase,'retry');
    f.status().onRetry(); await f.flush(); await f.flush();
    assert.equal(keys.length,2); assert.equal(keys[0],keys[1],'A retry reuses its key');
  });
  test(`${kind}: an interrupted submission checks its status without automatic replay`, async () => {
    const f = await preparedForm(kind);
    const method = kind === 'new' ? 'submitOrder' : 'submitDraftChanges';
    let attempts = 0;
    f.services[method] = async () => { attempts++; throw new ApiError('Network failed',0,undefined,'connection'); };
    await f.summary().onSubmit(); await f.flush();
    assert.equal(attempts,1); assert.equal(f.operationReads(),1);
    assert.equal(f.status().phase,'retry');
    assert.equal(f.summary().isReady,true);
    assert.equal(f.summary().isSubmitting,true,'The form stays locked until the outcome is settled');
    f.status().onCheck(); await f.flush();
    assert.equal(f.operationReads(),2);
    assert.equal(attempts,1);
  });
  test(`${kind}: removal ignores a late file-read result`, async () => {
    let resolve;
    const pdfLoad = () => new Promise(done => { resolve = done; });
    const f = fixture(kind, false, {}, {pdfLoad}); await f.flush();
    if (kind === 'new') { f.selectShop(); f.summary().setOrderName('Waiting'); f.render(); }
    else { button(f.tree(),'Remove file').props.onClick(); f.render(); }
    const pending = f.selectFile(); await f.flush();
    assert.equal(f.upload().isValidating,true); assert.equal(f.summary().isReady,false);
    f.upload().onRemoveFile(); f.render();
    resolve({getPageCount:()=>2,getPage:()=>({getSize:()=>({width:400,height:800})})});
    await pending;
    assert.equal(f.upload().isValidating,false); assert.equal(f.upload().validationResult,null);
    assert.equal(f.summary().isReady,false);
  });
  test(`${kind}: rapid duplicate submission clicks issue only one pending request`, async () => {
    const f = await preparedForm(kind);
    let resolve, attempts=0;
    f.services[kind === 'new' ? 'submitOrder' : 'submitDraftChanges'] = () => { attempts++; return new Promise(done => { resolve=done; }); };
    const submit = f.summary().onSubmit;
    const pending = submit(); await submit(); await new Promise(done => setImmediate(done)); assert.equal(attempts,1);
    resolve({orderId:'created'}); await pending;
  });
}
for (const operation of ['onSubmit', 'onSaveDraft']) {
  test(`draft ${operation}: replacing a file changes the existing draft in one request`, async () => {
    const f = await preparedForm('edit');
    button(f.tree(),'Remove file').props.onClick(); f.render(); await f.selectFile();
    await f.summary()[operation](); await f.flush();
    assert.equal(f.calls.length,1);
    assert.equal(f.calls[0][0],operation === 'onSubmit' ? 'submitDraft' : 'update');
    assert.equal(f.calls[0][1],'draft');
    assert.equal(f.calls[0][3].name,'four.pdf');
  });
}

for (const kind of ['new','edit']) {
  test(`${kind}: newer selection wins when the older PDF read finishes last`, async () => {
    const waiting=[];
    const f=fixture(kind,false,{}, {pdfLoad:()=>new Promise(resolve=>waiting.push(resolve))}); await f.flush();
    if (kind==='new') { f.selectShop(); f.summary().setOrderName('Latest'); f.render(); }
    else { button(f.tree(),'Remove file').props.onClick(); f.render(); }
    const older=f.selectFile(new File(['older'],'older.pdf',{type:'application/pdf'})); await f.flush();
    const newer=f.selectFile(new File(['newer'],'newer.pdf',{type:'application/pdf'})); await f.flush();
    waiting[1]({getPageCount:()=>3,getPage:()=>({getSize:()=>({width:400,height:800})})}); await newer;
    waiting[0]({getPageCount:()=>9,getPage:()=>({getSize:()=>({width:400,height:800})})}); await older;
    assert.equal(f.summary().estimate.pageCount,3); assert.equal(f.summary().isReady,true);
    assert.ok(text(f.tree()).includes('newer.pdf')); assert.ok(!text(f.tree()).includes('older.pdf'));
  });
}
