const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);

function fixture(kind, props, service = {}) {
  const states = []; let cursor = 0, tree, effects = [], timerCount = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const [value] = react.useState({ current: initial }); return value; },
    useEffect(effect) { effects.push(effect); },
  };
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@carbon/icons-react': { ArrowLeft: 'icon', CheckmarkFilled: 'icon', Close: 'icon', Time: 'icon', WarningAlt: 'icon' },
    'react-router-dom': { useNavigate: () => () => {} },
    '../ProgressTimeline/ProgressTimeline': { ProgressTimeline: 'Timeline' },
    '../QRCodeDisplay/QRCodeDisplay': { QRCodeDisplay: 'QR' },
    '../ReceiptUploadZone/ReceiptUploadZone': { ReceiptUploadZone: 'Upload' },
    '../SubmitVerificationButton/SubmitVerificationButton': { SubmitVerificationButton: 'SubmitReceipt' },
    '../../../services/orderService': { orderService: service },
    '../../services/orderService': { orderService: service },
    '../../common/AlertModal': { AlertModal: 'Alert' },
    '../../orders/SubmissionStatus': { SubmissionStatus: 'SubmissionStatus' },
    '../../../hooks/useRecoverableSubmission': { useRecoverableSubmission: config => ({
      phase: 'idle', isBusy: false, hasUnresolved: false, needsFile: false, duplicateOrderId: null, storageAvailable: true, ready: false,
      saveFields() {}, retry() {}, check() {}, startOver() {}, submitAnyway() {}, dismissDuplicate() {},
      submit: async (action, fields, file) => {
        try { config.onSuccess(await config.send({ action, fields, file, key: 'test-key' }), action, fields); }
        catch (error) { config.onFailure(error, action, fields); }
      },
    }) },
    '../common/ConfirmModal': { ConfirmModal: 'Confirm' },
  };
  const file = kind === 'checkout' ? 'components/checkout/CheckoutCard/CheckoutCard.tsx' : 'components/dashboard/ShopOrderActions.tsx';
  const source = ts.transpileModule(readFileSync(path.join(__dirname,'../src',file),'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, console, Error, setInterval() { timerCount++; return 1; }, clearInterval() { timerCount--; }, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); } });
  const render = () => { cursor=0; effects=[]; tree=(kind === 'checkout' ? exports.CheckoutCard : exports.ShopOrderActions)(props); };
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === 'button' && text(node).trim() === label);
  render();
  return { render, find, button, startTimer:() => effects[0](), timerCount:() => timerCount, text:() => text(tree), flush:async() => { await new Promise(resolve=>setImmediate(resolve)); render(); } };
}

test('cash checkout shows amount and acceptance without QR, receipt controls, or GCash progress', () => {
  const f = fixture('checkout',{orderId:'cash-order',amount:45,paymentMethod:'CASH_ON_PICKUP',paymentStatus:'DUE_AT_PICKUP',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.match(f.text(),/Amount due at pickup: ₱45.00/);
  assert.match(f.text(),/PENDING/);
  for (const type of ['QR','Upload','SubmitReceipt','Timeline']) assert.equal(f.find(node=>node.type===type),undefined);
});

test('cash checkout ignores old payment deadlines and never starts a countdown', () => {
  for (const expiresAt of [undefined, '2020-01-01T00:15:00Z']) {
    const f = fixture('checkout', { orderId:'cash-order', amount:45, paymentMethod:'CASH_ON_PICKUP', paymentStatus:'DUE_AT_PICKUP', acceptanceStatus:'PENDING', orderState:'OPEN_INQUIRY', createdAt:'2020-01-01T00:00:00Z', expiresAt });
    assert.equal(f.startTimer(), undefined); f.render();
    assert.equal(f.timerCount(), 0);
    assert.equal(f.find(node => node.props?.role === 'timer'), undefined);
    assert.doesNotMatch(f.text(), /Expires in|Order expired/);
  }
});

test('GCash retains its countdown and switching to cash immediately hides a stale timer', () => {
  const props = { orderId:'order', amount:45, paymentMethod:'GCASH', paymentStatus:'UNPAID', orderState:'OPEN_INQUIRY', expiresAt:new Date(Date.now()+600000).toISOString() };
  const f = fixture('checkout', props);
  const cleanup = f.startTimer(); f.render();
  assert.equal(f.timerCount(), 1);
  assert.ok(f.find(node => node.props?.role === 'timer'));
  props.paymentMethod = 'CASH_ON_PICKUP'; props.paymentStatus = 'DUE_AT_PICKUP'; f.render();
  assert.equal(f.find(node => node.props?.role === 'timer'), undefined);
  cleanup(); f.startTimer(); f.render();
  assert.equal(f.timerCount(), 0);
});

test('an expired countdown waits for server confirmation before declaring the order expired', () => {
  const props = { orderId:'order', amount:45, paymentMethod:'GCASH', paymentStatus:'UNPAID', orderState:'OPEN_INQUIRY', expiresAt:new Date(Date.now()-1000).toISOString(), statusConfirmedAt:Date.now()-5000 };
  const f = fixture('checkout', props);
  f.startTimer(); f.render();
  assert.doesNotMatch(f.text(), /Order expired/);
  assert.match(f.text(), /Your receipt details are still here/);
  props.statusConfirmedAt = Date.now(); f.render();
  assert.match(f.text(), /Order expired/);
  assert.doesNotMatch(f.text(), /Your receipt details are still here/);
});

test('GCash receipt submission requires the reference and verified payments never reopen upload controls', () => {
  const f = fixture('checkout',{orderId:'gcash-order',amount:45,paymentMethod:'GCASH',paymentStatus:'UNPAID',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.ok(f.find(node=>node.type==='QR'));
  assert.equal(f.find(node=>node.type==='SubmitReceipt').props.disabled,true);
  const reference=f.find(node=>node.props.id==='gcash-reference-number');
  assert.equal(reference.props.required,true);
  const verified=fixture('checkout',{orderId:'gcash-order',amount:45,paymentMethod:'GCASH',paymentStatus:'VERIFIED',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.equal(verified.find(node=>node.type==='Upload'),undefined);
  assert.match(verified.text(),/Receipt verification authorizes production/);
  assert.doesNotMatch(verified.text(),/Shop acceptance/);
  assert.equal(verified.find(node=>node.type==='Timeline').props.currentStep,2);
});

test('refund and unclaimed notices explain the separate financial and pickup state', () => {
  const refund=fixture('checkout',{orderId:'refund',amount:45,paymentStatus:'REFUND_DUE',orderState:'CANCELLED'});
  assert.match(refund.text(),/full manual refund is due/);
  assert.equal(refund.button('Cancel Order'),undefined);
  assert.equal(refund.find(node=>node.type==='Upload'),undefined);
  const unclaimed=fixture('checkout',{orderId:'cash',amount:45,paymentMethod:'CASH_ON_PICKUP',paymentStatus:'DUE_AT_PICKUP',orderState:'READY_FOR_PICKUP',isUnclaimed:true,unclaimedReason:'Awaiting customer'});
  assert.match(unclaimed.text(),/remain available for pickup/);
  assert.match(unclaimed.text(),/Amount due at pickup/);
});

test('accept submits immediately for cash without an extra decision panel or duplicate writes', async () => {
  for (const payment_method of ['CASH_ON_PICKUP']) {
    const calls = [], updates = [];
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const order = { id:'order', state:'OPEN_INQUIRY', total:45, payment_method, payment_status:payment_method === 'GCASH' ? 'PENDING_VERIFICATION' : 'DUE_AT_PICKUP', acceptance_status:'PENDING', assets:[{file_url:'private/document.pdf'}] };
    const f = fixture('actions', {order, onUpdated:value => updates.push(value)}, {
      decideOrder:async (...args) => { calls.push(args); await pending; return {order:{...order, acceptance_status:'ACCEPTED'}}; },
    });
    // Switching from rejection must not send its unsaved reason with acceptance.
    f.button('Reject order').props.onClick(); f.render();
    f.find(node => node.type === 'textarea').props.onChange({target:{value:'Unsaved reason'}}); f.render();
    const accept = f.button('Accept order');
    accept.props.onClick(); accept.props.onClick(); f.render();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], 'ACCEPT');
    assert.equal(calls[0][2].reason, undefined);
    assert.equal(calls[0][2].confirmed, true);
    assert.equal(f.button('Review decision'), undefined);
    assert.equal(f.button('Cancel'), undefined);
    assert.equal(f.find(node => node.type === 'textarea'), undefined);
    assert.equal(f.find(node => node.type === 'Confirm').props.isOpen, false);
    assert.equal(f.button('Accept order').props.disabled, true);
    resolve(); await f.flush();
    assert.equal(updates[0].acceptance_status, 'ACCEPTED');
  }
});

test('GCash orders have no separate acceptance or order-rejection controls', () => {
  for (const payment_status of ['UNPAID', 'PENDING_VERIFICATION', 'REJECTED', 'DISPUTED', 'VERIFIED']) {
    const f = fixture('actions', {order:{id:'gcash',state:'OPEN_INQUIRY',total:45,payment_method:'GCASH',payment_status,acceptance_status:'PENDING',assets:[{file_url:'private/document.pdf'}]},onUpdated(){}},{});
    assert.equal(f.button('Accept order'),undefined);
    assert.equal(f.button('Reject order'),undefined);
    assert.doesNotMatch(f.text(),/Production requires shop acceptance/);
  }
});

test('rejection requires a reason and submits directly without review or cancel controls', async () => {
  const calls = [], updates = [];
  const order = {id:'order', state:'OPEN_INQUIRY', total:45, payment_method:'CASH_ON_PICKUP', payment_status:'DUE_AT_PICKUP', acceptance_status:'PENDING', assets:[{file_url:'private/document.pdf'}]};
  const f = fixture('actions', {order, onUpdated:value => updates.push(value)}, {
    decideOrder:async (...args) => { calls.push(args); return {order:{...order, state:'REJECTED'}}; },
  });
  f.button('Reject order').props.onClick(); f.render();
  assert.equal(calls.length, 0);
  assert.equal(f.button('Cancel'), undefined);
  assert.equal(f.button('Review decision'), undefined);
  assert.equal(f.button('Submit rejection').props.disabled, true);
  f.button('Submit rejection').props.onClick(); f.render();
  assert.equal(calls.length, 0);
  f.find(node => node.type === 'textarea').props.onChange({target:{value:'  Cannot print this paper size  '}}); f.render();
  assert.equal(f.button('Submit rejection').props.disabled, false);
  f.button('Submit rejection').props.onClick(); f.button('Submit rejection').props.onClick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'REJECT_ORDER');
  assert.equal(calls[0][2].reason, 'Cannot print this paper size');
  await f.flush();
  assert.equal(updates[0].state, 'REJECTED');
  assert.equal(f.find(node => node.type === 'Confirm').props.isOpen, false);
});

test('failed immediate acceptance remains retryable without a confirmation step', async () => {
  let attempts = 0;
  const order = {id:'order', state:'OPEN_INQUIRY', total:45, payment_method:'CASH_ON_PICKUP', payment_status:'DUE_AT_PICKUP', acceptance_status:'PENDING', assets:[{file_url:'private/document.pdf'}]};
  const f = fixture('actions', {order, onUpdated() {}}, {
    decideOrder:async () => { if (++attempts === 1) throw null; return {order:{...order, acceptance_status:'ACCEPTED'}}; },
  });
  f.button('Accept order').props.onClick(); await f.flush();
  assert.match(f.text(), /The decision could not be saved/);
  assert.equal(f.button('Accept order').props.disabled, false);
  assert.equal(f.button('Review decision'), undefined);
  f.button('Accept order').props.onClick(); await f.flush();
  assert.equal(attempts, 2);
  assert.equal(f.find(node => node.props?.role === 'alert'), undefined);
});

test('payment decisions never bypass the separate output inspection or GCash handover dialogs', () => {
  for (const payment_method of ['CASH_ON_PICKUP', 'GCASH']) {
    for (const state of ['IN_PRODUCTION', 'PRINTED', 'READY_FOR_PICKUP']) {
      const order = { id:'order', state, total:45, payment_method, payment_status:payment_method === 'CASH_ON_PICKUP' ? 'DUE_AT_PICKUP' : 'VERIFIED', acceptance_status:'ACCEPTED', assets:[{file_url:'private/document.pdf'}] };
      const f = fixture('actions', {order,onUpdated(){}}, {});
      assert.equal(f.button('Mark ready for pickup'), undefined);
      assert.equal(f.button('Confirm handover'), undefined);
    }
  }
});

test('cash collection opens confirmation directly and completes the order without separate handover', async () => {
  const calls=[], updates=[]; let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const order={id:'cash',state:'READY_FOR_PICKUP',output_confirmed_at:'2026-11-08T00:00:00Z',current_attempt:null,total:45,payment_method:'CASH_ON_PICKUP',payment_status:'DUE_AT_PICKUP',acceptance_status:'ACCEPTED',assets:[{file_url:'private/document.pdf'}]};
  const props={order,onUpdated(value){updates.push(value);props.order=value;}};
  const f=fixture('actions',props,{decideOrder:async(...args)=>{calls.push(args);await pending;return {order:{...order,payment_status:'COLLECTED',state:'COMPLETED',is_unclaimed:false}};}});
  assert.equal(f.button('Confirm handover'),undefined);
  f.button('Record cash collected').props.onClick();f.render();
  assert.equal(calls.length,0);
  assert.equal(f.button('Review decision'),undefined);
  assert.equal(f.find(node=>node.type==='div' && node.props.className?.includes('border-l-4')),undefined);
  let modal=f.find(node=>node.type==='Confirm');assert.equal(modal.props.isOpen,true);
  assert.equal(modal.props.title,'Record cash collected?');
  assert.match(modal.props.message,/Confirm you received the full ₱45\.00 in cash/);
  assert.match(modal.props.message,/also mark the order completed/);
  modal.props.onCancel();f.render();
  assert.equal(f.find(node=>node.type==='Confirm').props.isOpen,false);
  assert.equal(f.button('Review decision'),undefined);
  assert.equal(calls.length,0);
  f.button('Record cash collected').props.onClick();f.render();
  modal=f.find(node=>node.type==='Confirm');assert.equal(modal.props.isOpen,true);
  modal.props.onConfirm();modal.props.onConfirm();f.render();
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'COLLECT_CASH');assert.equal(calls[0][2].confirmed,true);
  assert.equal('amount' in calls[0][2],false);
  resolve();await f.flush();
  assert.equal(updates[0].payment_status,'COLLECTED');
  assert.equal(updates[0].state,'COMPLETED');
  assert.equal(f.button('Confirm handover'),undefined);
  assert.equal(f.button('Record cash collected'),undefined);
  assert.equal(f.button('Flag unclaimed'),undefined);
  const settled=fixture('actions',{order:{...order,payment_status:'COLLECTED'},onUpdated(){}},{});
  assert.equal(settled.button('Confirm handover'),undefined);
});

test('cash collection requires confirmed output and no unresolved print attempt', () => {
  const order = {id:'cash',state:'READY_FOR_PICKUP',total:45,payment_method:'CASH_ON_PICKUP',payment_status:'DUE_AT_PICKUP',acceptance_status:'ACCEPTED',assets:[{file_url:'document.pdf'}]};
  for (const changes of [
    {},
    {output_confirmed_at:'2026-11-08T00:00:00Z',current_attempt:{resolvedAt:null}},
    {output_confirmed_at:'2026-11-08T00:00:00Z',current_attempt:{}},
  ]) {
    const f=fixture('actions',{order:{...order,...changes},onUpdated(){}},{});
    assert.equal(f.button('Record cash collected'),undefined);
  }
  for (const current_attempt of [null,{resolvedAt:'2026-11-08T00:01:00Z'}]) {
    const f=fixture('actions',{order:{...order,output_confirmed_at:'2026-11-08T00:00:00Z',current_attempt},onUpdated(){}},{});
    assert.ok(f.button('Record cash collected'));
  }
});

test('completed cash checkout reports collection and completion without another payment prompt', () => {
  const f=fixture('checkout',{orderId:'cash',amount:45,paymentMethod:'CASH_ON_PICKUP',paymentStatus:'COLLECTED',acceptanceStatus:'ACCEPTED',orderState:'COMPLETED'});
  assert.match(f.text(),/recorded your cash payment and completed your order/);
  assert.doesNotMatch(f.text(),/Pay the full amount before handover/);
});

test('flag and clear unclaimed submit immediately without a reason, confirmation, or duplicate writes', async () => {
  for (const payment_method of ['CASH_ON_PICKUP', 'GCASH']) {
    for (const is_unclaimed of [false, true]) {
      const decision = is_unclaimed ? 'CLEAR_UNCLAIMED' : 'FLAG_UNCLAIMED';
      const label = is_unclaimed ? 'Clear unclaimed' : 'Flag unclaimed';
      const calls = [], updates = [];
      let resolve;
      const pending = new Promise(done => { resolve = done; });
      const order = {id:'pickup', state:'READY_FOR_PICKUP', output_confirmed_at:'2026-11-08T00:00:00Z', current_attempt:null, total:45, payment_method, payment_status:payment_method === 'CASH_ON_PICKUP' ? 'DUE_AT_PICKUP' : 'VERIFIED', acceptance_status:'ACCEPTED', is_unclaimed, assets:[{file_url:'private/document.pdf'}]};
      const props = {order, onUpdated(value) { updates.push(value); props.order = value; }};
      const f = fixture('actions', props, {
        decideOrder:async (...args) => { calls.push(args); await pending; return {order:{...order, is_unclaimed:!is_unclaimed}}; },
      });
      // Starting another action must not leave its inline section open.
      if (payment_method === 'CASH_ON_PICKUP') { f.button('Record cash collected').props.onClick(); f.render(); }
      const confirmation = f.find(node => node.type === 'Confirm');
      if (confirmation.props.isOpen) { confirmation.props.onCancel(); f.render(); }
      const flag = f.button(label);
      flag.props.onClick(); flag.props.onClick(); f.render();
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1], decision);
      assert.equal(calls[0][2].reason, undefined);
      assert.equal(f.find(node => node.type === 'textarea'), undefined);
      assert.equal(f.button('Review decision'), undefined);
      assert.equal(f.find(node => node.type === 'Confirm').props.isOpen, false);
      assert.equal(f.button(label).props.disabled, true);
      resolve(); await f.flush();
      assert.equal(updates[0].is_unclaimed, !is_unclaimed);
      assert.equal(updates[0].payment_status, order.payment_status);
      assert.ok(f.button(is_unclaimed ? 'Flag unclaimed' : 'Clear unclaimed'));
    }
  }
});

test('failed immediate unclaimed flagging or clearing shows an error and allows retry', async () => {
  for (const is_unclaimed of [false, true]) {
    const label = is_unclaimed ? 'Clear unclaimed' : 'Flag unclaimed';
    let attempts = 0;
    const order = {id:'pickup', state:'READY_FOR_PICKUP', total:45, payment_method:'CASH_ON_PICKUP', payment_status:'DUE_AT_PICKUP', acceptance_status:'ACCEPTED', is_unclaimed};
    const f = fixture('actions', {order, onUpdated() {}}, {
      decideOrder:async () => { if (++attempts === 1) throw new Error('Could not update unclaimed flag'); return {order:{...order, is_unclaimed:!is_unclaimed}}; },
    });
    f.button(label).props.onClick(); await f.flush();
    assert.match(f.text(), /Could not update unclaimed flag/);
    assert.equal(f.button(label).props.disabled, false);
    assert.equal(f.button('Review decision'), undefined);
    f.button(label).props.onClick(); await f.flush();
    assert.equal(attempts, 2);
    assert.equal(f.find(node => node.props?.role === 'alert'), undefined);
  }
});

test('refund reference is required before a decision can be confirmed', () => {
  const refund=fixture('actions',{order:{id:'refund',state:'CANCELLED',total:45,payment_method:'GCASH',payment_status:'REFUND_DUE',acceptance_status:'PENDING'},onUpdated(){}},{});
  refund.button('Record manual refund').props.onClick();refund.render();
  assert.equal(refund.button('Review decision').props.disabled,true);
  refund.find(node=>node.type==='input').props.onChange({target:{value:'manual-reference'}});refund.render();
  assert.equal(refund.button('Review decision').props.disabled,false);
  assert.match(refund.text(),/does not transfer money/);
});

test('financial confirmation retains focus across callback replacement and polling, traps busy keys and restores focus', () => {
  const listeners = new Map(), hooks = [];
  let cursor = 0, effects = [], tree, cancelled = 0, refreshedCancel = 0;
  const document = { body:{style:{overflow:'auto'}}, activeElement:null,
    addEventListener:(name,callback)=>listeners.set(name,callback),
    removeEventListener:(name,callback)=>{if(listeners.get(name)===callback)listeners.delete(name);}, querySelector:()=>tab };
  const control = () => ({isConnected:true,focus(){document.activeElement=this;}});
  const opener=control(), tab=control(), cancel=control(), confirm=control();
  const dialog={...control(),querySelectorAll:()=>props.isBusy?[]:[cancel,confirm]};
  document.activeElement=opener;
  const props={isOpen:true,isBusy:false,title:'Confirm cash collection',message:'Full amount received.',onConfirm(){},onCancel(){cancelled++;}};
  const react={
    useRef(initial){const i=cursor++;return (hooks[i] ||= {current:initial});},
    useEffect(effect,deps){
      const i=cursor++,old=hooks[i];
      if(!old || deps.some((value,index)=>!Object.is(value,old.deps[index]))) {
        effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});
      }
    },
  };
  const exports={};
  const source=ts.transpileModule(readFileSync(path.join(__dirname,'../src/components/common/ConfirmModal.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports,document,require(name){
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='react-dom')return {createPortal:node=>node};
    throw new Error(`Unexpected import ${name}`);
  }});
  const render=()=>{
    cursor=0;effects=[];tree=exports.ConfirmModal(props);
    for(const node of nodes(tree))if(node.props.ref)node.props.ref.current=node.props.role==='alertdialog'?dialog:cancel;
    effects.forEach(effect=>effect());
  };
  render();assert.equal(document.activeElement,cancel);
  confirm.focus();const keydown=listeners.get('keydown');
  for(let poll=0;poll<3;poll++) {
    props.onCancel=()=>{refreshedCancel++;};props.message='Updated order totals';render();
    assert.equal(document.activeElement,confirm,'polling must not move focus off Confirm');
    assert.equal(listeners.get('keydown'),keydown,'polling must not reinstall focus effect');
  }
  listeners.get('keydown')({key:'Escape',preventDefault(){}});
  assert.equal(cancelled,0);assert.equal(refreshedCancel,1,'Escape uses latest callback');
  props.isBusy=true;render();assert.equal(document.activeElement,dialog);
  let prevented=false;
  listeners.get('keydown')({key:'Tab',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(document.activeElement,dialog);
  listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(refreshedCancel,1);
  opener.isConnected=false;props.isOpen=false;render();
  assert.equal(document.activeElement,tab);assert.equal(document.body.style.overflow,'auto');assert.equal(listeners.size,0);
});
