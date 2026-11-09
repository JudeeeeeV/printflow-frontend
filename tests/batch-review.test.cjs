const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree,...nodes(tree.props?.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
function load(file,mocks={},globals={}) {
  const exports={};
  const source=fs.readFileSync(path.join(__dirname,'../src',file),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,URLSearchParams,...globals,require:name=>{if(name in mocks)return mocks[name];throw new Error(name);}});
  return exports;
}
const titleHelpers=load('components/dashboard/orderCardTitle.ts');
class ApiError extends Error {constructor(message,status,data){super(message);this.status=status;this.data=data;}}
const pendingKey=shop=>'pf_pending_batch:'+shop;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=id=>({id,order_name:'Assignment '+id,client_name:'Ana Cruz',assets:[{original_filename:'Résumé 学生.docx'}],paper_size:'A4',print_color_mode:'COLOR',orientation:'LANDSCAPE',page_count:2,copies:3,fingerprint:'a'.repeat(32),blocking_reasons:[],payment_method:'CASH_ON_PICKUP',payment_status:'DUE_AT_PICKUP',acceptance_status:'ACCEPTED'});
function fixture(options={}) {
  const hooks=[],storage=new Map(),calls=[],accepted=[],removed=[],focus=[];
  let cursor=0,closed=0,reviews=0,refreshed=[];
  let review={orders:[row('hidden-one'),row('hidden-two')],blockers:[],reviewToken:'review-token',mode:options.mode||'AGENT',printerName:'Desk',orderCount:2,totalPrintedPages:12};
  let liveError=null;
  let execute=async()=>({requestId:'request-id',attempts:[{attemptId:'a',orderId:'hidden-two'}],acceptedOrderIds:['hidden-two']}),recover=async()=>({status:'PROCESSING'});
  const props={shopId:'shop',selection:review.orders.map(order=>({orderId:order.id,fingerprint:order.fingerprint,paperSize:'A4',label:order.order_name})),mode:review.mode,printerName:'Desk',printers:['Desk'],onPrinterChange:value=>{props.printerName=value;},onRemove:id=>removed.push(id),onRefreshSelection:rows=>{refreshed=rows;},onClose:()=>closed++,onAccepted:result=>accepted.push(result)};
  const {BatchReviewDialog}=load('components/dashboard/BatchReviewDialog.tsx',{
    react:{useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];},useRef(value){const i=cursor++;if(!(i in hooks))hooks[i]={current:value};return hooks[i];}},
    'react/jsx-runtime':{jsx,jsxs:jsx},'react-dom':{createPortal:tree=>tree},
    '../common/useDialogFocus':{useDialogFocus:(_ref,_open,_close,busy)=>focus.push(busy)},
    '../../hooks/useLiveResource':{useLiveResource:()=>({data:review,error:liveError,isLoading:false,refresh:async()=>reviews++})},
    '../../services/apiClient':{ApiError},
    '../../services/submissionRecovery':{newOperationKey:()=> 'request-id'},
    '../../services/batchReviewService':{pendingBatchKey:pendingKey,batchReviewService:{execute:async(...args)=>{calls.push(args);return execute(...args);},recover:async id=>recover(id)}},
    './orderCardTitle':titleHelpers,
  },{document:{body:{}},sessionStorage:{setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}});
  const render=()=>{cursor=0;return BatchReviewDialog(props);};
  const button=label=>nodes(render()).find(node=>node.type==='button'&&text(node)===label);
  return {props,render,button,calls,accepted,removed,storage,focus,closed:()=>closed,reviews:()=>reviews,refreshed:()=>refreshed,
    execute:fn=>{execute=fn;},recover:fn=>{recover=fn;},review:value=>{review=value;},getReview:()=>review,error:value=>{liveError=value;}};
}
test('review shows hidden orders, original identity, settings and printed-page totals',()=>{
  const f=fixture();const content=text(f.render());
  for(const value of ['hidden-one','hidden-two','Résumé 学生.docx','12 total printed pages','LANDSCAPE','3 COPIES','Printer: Desk'])assert.ok(content.includes(value),value);
  assert.equal(nodes(f.render()).filter(node=>node.type==='input').length,0);
  assert.equal(nodes(f.render()).filter(node=>/overflow-y-auto/.test(node.props?.className||'')).length,1);
});
test('closing and removing orders perform no production action',()=>{
  const f=fixture();f.button('Close').props.onClick();f.button('Remove from batch').props.onClick();
  assert.equal(f.closed(),1);assert.deepEqual(f.removed,['hidden-one']);assert.equal(f.calls.length,0);
});
test('one pending send persists its request before transmission and blocks repeated clicks or dismissal',async()=>{
  const f=fixture();let release;f.execute(async()=>{assert.ok(f.storage.has(pendingKey('shop')));return new Promise(resolve=>{release=resolve;});});
  f.button('Confirm and send').props.onClick();f.button('Sending…').props.onClick();f.button('Close').props.onClick();
  assert.equal(f.calls.length,1);assert.equal(f.closed(),0);assert.equal(f.button('Close').props.disabled,true);
  release({requestId:'request-id',attempts:[],acceptedOrderIds:['hidden-one','hidden-two']});await tick();
  assert.equal(f.accepted.length,1);assert.equal(f.storage.size,0);
});
test('an uncertain result requires outcome recovery and never automatically sends again',async()=>{
  const f=fixture();f.execute(async()=>{throw new ApiError('Offline',0);});
  f.button('Confirm and send').props.onClick();await tick();
  assert.equal(f.button('Confirm and send'),undefined);assert.equal(f.button('Close').props.disabled,true);assert.equal(f.calls.length,1);
  f.recover(async()=>({status:'ACCEPTED',result:{requestId:'request-id',attempts:[],acceptedOrderIds:['hidden-one','hidden-two']}}));
  f.button('Check recorded outcome').props.onClick();await tick();assert.equal(f.accepted.length,1);assert.equal(f.calls.length,1);
});
test('a missing recorded outcome permits only an explicit retry of the same request and selection',async()=>{
  const f=fixture();f.execute(async()=>{throw new ApiError('Lost response',0);});f.button('Confirm and send').props.onClick();await tick();
  f.recover(async()=>{throw new ApiError('Not recorded',404);});f.button('Check recorded outcome').props.onClick();await tick();
  assert.ok(f.button('Retry same request'));
  f.props.selection=[{orderId:'different',fingerprint:'b'.repeat(32),paperSize:'LONG',label:'Different'}];
  f.execute(async()=>({requestId:'request-id',attempts:[],acceptedOrderIds:['hidden-one','hidden-two']}));
  f.button('Retry same request').props.onClick();await tick();
  assert.equal(f.calls[1][2],f.calls[0][2]);assert.deepEqual(f.calls[1][0],f.calls[0][0]);
});
test('conflicts identify the affected row and require a deliberate renewed review',async()=>{
  const f=fixture();f.execute(async()=>{throw new ApiError('Changed',409,{conflicts:[{orderId:'hidden-two',message:'Payment changed for this order'}]});});
  f.button('Confirm and send').props.onClick();await tick();assert.match(text(f.render()),/Payment changed for this order/);
  assert.equal(f.button('Confirm and send').props.disabled,true);assert.equal(f.storage.size,0);
  f.button('Refresh and review again').props.onClick();assert.equal(f.refreshed().length,2);assert.equal(f.button('Confirm and send').props.disabled,false);
});
test('printer disappearance and failed refresh prevent confirmation without selecting a replacement',()=>{
  const f=fixture();f.props.printers=['Replacement'];assert.equal(f.button('Confirm and send').props.disabled,true);assert.equal(f.props.printerName,'Desk');
  const select=nodes(f.render()).find(node=>node.type==='select');assert.equal(select.props.value,'');
  select.props.onChange({target:{value:'Replacement'}});assert.equal(f.props.printerName,'Replacement');
  f.error(new Error('Refresh failed'));assert.equal(f.button('Confirm and send').props.disabled,true);
});
test('manual review is explicit and never offers an agent-send action',()=>{
  const f=fixture({mode:'MANUAL'});assert.ok(f.button('Confirm and download'));assert.equal(f.button('Confirm and send'),undefined);
  assert.match(text(f.render()),/records manual production and downloads/);
});

test('a recovered rejection requires a fresh review and reload recovery never sends automatically',async()=>{
  const f=fixture();f.props.initialPending={requestId:'original-request',selection:f.props.selection,review:f.getReview()};
  assert.equal(f.button('Confirm and send'),undefined);assert.equal(f.calls.length,0);
  f.recover(async()=>({status:'FAILED',result:{body:{message:'Changed'}}}));
  f.button('Check recorded outcome').props.onClick();await tick();
  assert.equal(f.button('Confirm and send').props.disabled,true);
  f.button('Refresh and review again').props.onClick();assert.equal(f.button('Confirm and send').props.disabled,false);
  assert.equal(f.calls.length,0);
});

test('queue and recovery reads are uncached; review and execution retain fingerprints, order and request IDs',async()=>{
  const calls=[];const apiClient=async(...args)=>{calls.push(args);return {};};
  const {shopQueueService,initialFilters}=load('services/shopQueueService.ts',{'./apiClient':{apiClient}});
  await shopQueueService.query('ready',{...initialFilters(),searchQuery:'A&B',dateFrom:'2026-10-10'},2,3,{selectableOnly:true,excludeIds:['one']});
  await shopQueueService.details('one');await shopQueueService.selection(['one','two']);
  const {batchReviewService}=load('services/batchReviewService.ts',{'./apiClient':{apiClient}});
  const selected=[{orderId:'two',fingerprint:'f2'},{orderId:'one',fingerprint:'f1'}];
  await batchReviewService.preview(selected,'AGENT','Desk');await batchReviewService.execute(selected,{reviewToken:'token',mode:'AGENT',printerName:'Desk'},'request');await batchReviewService.recover('request');
  for(const index of [0,1,2,5])assert.equal(calls[index][1].cache,'no-store');
  assert.match(calls[0][0],/search=A%26B/);assert.deepEqual(JSON.parse(calls[3][1].body).orders,selected);
  assert.deepEqual(JSON.parse(calls[4][1].body),{orderIds:['two','one'],reviewToken:'token',requestId:'request',printerName:'Desk'});
});
