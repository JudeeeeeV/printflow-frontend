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
  const states = []; let cursor = 0, tree;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const [value] = react.useState({ current: initial }); return value; },
    useEffect() {},
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
    '../common/ConfirmModal': { ConfirmModal: 'Confirm' },
  };
  const file = kind === 'checkout' ? 'components/checkout/CheckoutCard/CheckoutCard.tsx' : 'components/dashboard/ShopOrderActions.tsx';
  const source = ts.transpileModule(readFileSync(path.join(__dirname,'../src',file),'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, console, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); } });
  const render = () => { cursor=0; tree=(kind === 'checkout' ? exports.CheckoutCard : exports.ShopOrderActions)(props); };
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === 'button' && text(node).trim() === label);
  render();
  return { render, find, button, text:() => text(tree), flush:async() => { await new Promise(resolve=>setImmediate(resolve)); render(); } };
}

test('cash checkout shows amount and acceptance without QR, receipt controls, or GCash progress', () => {
  const f = fixture('checkout',{orderId:'cash-order',amount:45,paymentMethod:'CASH_ON_PICKUP',paymentStatus:'DUE_AT_PICKUP',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.match(f.text(),/Amount due at pickup: ₱45.00/);
  assert.match(f.text(),/PENDING/);
  for (const type of ['QR','Upload','SubmitReceipt','Timeline']) assert.equal(f.find(node=>node.type===type),undefined);
});

test('GCash receipt submission requires the reference and verified payments never reopen upload controls', () => {
  const f = fixture('checkout',{orderId:'gcash-order',amount:45,paymentMethod:'GCASH',paymentStatus:'UNPAID',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.ok(f.find(node=>node.type==='QR'));
  assert.equal(f.find(node=>node.type==='SubmitReceipt').props.disabled,true);
  const reference=f.find(node=>node.props.id==='gcash-reference-number');
  assert.equal(reference.props.required,true);
  const verified=fixture('checkout',{orderId:'gcash-order',amount:45,paymentMethod:'GCASH',paymentStatus:'VERIFIED',acceptanceStatus:'PENDING',orderState:'OPEN_INQUIRY'});
  assert.equal(verified.find(node=>node.type==='Upload'),undefined);
  assert.match(verified.text(),/Shop acceptance and payment verification are separate/);
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

test('cash handover is unavailable until collection, and collection requires confirmation without duplicate writes', async () => {
  const calls=[], updates=[]; let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const order={id:'cash',state:'READY_FOR_PICKUP',total:45,payment_method:'CASH_ON_PICKUP',payment_status:'DUE_AT_PICKUP',acceptance_status:'ACCEPTED',assets:[{file_url:'private/document.pdf'}]};
  const f=fixture('actions',{order,onUpdated:value=>updates.push(value)},{decideOrder:async(...args)=>{calls.push(args);await pending;return {order:{...order,payment_status:'COLLECTED'}};}});
  assert.equal(f.button('Confirm handover'),undefined);
  f.button('Record cash collected').props.onClick();f.render();
  assert.equal(calls.length,0);
  f.button('Review decision').props.onClick();f.render();
  const modal=f.find(node=>node.type==='Confirm');assert.equal(modal.props.isOpen,true);
  modal.props.onConfirm();modal.props.onConfirm();f.render();
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'COLLECT_CASH');assert.equal(calls[0][2].confirmed,true);
  assert.equal('amount' in calls[0][2],false);
  resolve();await f.flush();
  assert.equal(updates[0].payment_status,'COLLECTED');
  const settled=fixture('actions',{order:{...order,payment_status:'COLLECTED'},onUpdated(){}},{});
  assert.ok(settled.button('Confirm handover'));
});

test('refund reference and unclaimed reason are required before a decision can be confirmed', () => {
  const refund=fixture('actions',{order:{id:'refund',state:'CANCELLED',total:45,payment_method:'GCASH',payment_status:'REFUND_DUE',acceptance_status:'PENDING'},onUpdated(){}},{});
  refund.button('Record manual refund').props.onClick();refund.render();
  assert.equal(refund.button('Review decision').props.disabled,true);
  refund.find(node=>node.type==='input').props.onChange({target:{value:'manual-reference'}});refund.render();
  assert.equal(refund.button('Review decision').props.disabled,false);
  assert.match(refund.text(),/does not transfer money/);
  const unclaimed=fixture('actions',{order:{id:'pickup',state:'READY_FOR_PICKUP',total:45,payment_method:'GCASH',payment_status:'VERIFIED',acceptance_status:'ACCEPTED'},onUpdated(){}},{});
  unclaimed.button('Flag unclaimed').props.onClick();unclaimed.render();
  assert.equal(unclaimed.button('Review decision').props.disabled,true);
});

test('financial confirmation keeps keyboard focus while busy and restores the queue tab when its card leaves', () => {
  const listeners = new Map(), refs = [];
  let cursor = 0, nextEffect, cleanup, tree, cancelled = 0;
  const document = { body:{style:{overflow:'auto'}}, activeElement:null,
    addEventListener:(name,callback)=>listeners.set(name,callback),
    removeEventListener:name=>listeners.delete(name), querySelector:()=>tab };
  const opener={isConnected:true,focus(){document.activeElement=opener;}};
  const tab={isConnected:true,focus(){document.activeElement=tab;}};
  const cancel={isConnected:true,focus(){document.activeElement=cancel;}};
  const dialog={isConnected:true,focus(){document.activeElement=dialog;},querySelectorAll:()=>props.isBusy?[]:[cancel]};
  document.activeElement=opener;
  const props={isOpen:true,isBusy:false,title:'Confirm cash collection',message:'Full amount received.',onConfirm(){},onCancel(){cancelled++;}};
  const react={useRef(initial){return refs[cursor++] ||= {current:initial};},useEffect(effect){nextEffect=effect;}};
  const exports={};
  const source=ts.transpileModule(readFileSync(path.join(__dirname,'../src/components/common/ConfirmModal.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports,document,require(name){
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='react-dom')return {createPortal:node=>node};
    throw new Error(`Unexpected import ${name}`);
  }});
  const render=()=>{
    cleanup?.();cursor=0;tree=exports.ConfirmModal(props);
    for(const node of nodes(tree))if(node.props.ref)node.props.ref.current=node.props.role==='alertdialog'?dialog:cancel;
    cleanup=nextEffect();
  };
  render();assert.equal(document.activeElement,cancel);
  props.isBusy=true;render();assert.equal(document.activeElement,dialog);
  let prevented=false;
  listeners.get('keydown')({key:'Tab',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(document.activeElement,dialog);
  listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(cancelled,0);
  opener.isConnected=false;props.isOpen=false;render();
  assert.equal(document.activeElement,tab);assert.equal(document.body.style.overflow,'auto');assert.equal(listeners.size,0);
});
