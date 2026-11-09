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
const titleHelpers = load('components/dashboard/orderCardTitle.ts');
const selectionHelpers = load('services/shopQueueService.ts', { './apiClient': {} });
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

test('responsive pages use three phone cards, four tablet cards and three or six desktop cards', () => {
  for (const width of [375, 667, 767]) assert.deepEqual(plain(getLiveQueueLayout(width, 900)), { pageSize: 3, rows: 3, contained: false });
  for (const width of [768, 820, 1024, 1180, 1279]) assert.deepEqual(plain(getLiveQueueLayout(width, 900)), { pageSize: 4, rows: 2, contained: false });
  assert.deepEqual(plain(getLiveQueueLayout(1280, 428)), { pageSize: 6, rows: 2, contained: true });
  assert.deepEqual(plain(getLiveQueueLayout(1440, 427.99)), { pageSize: 3, rows: 1, contained: true });
  assert.equal(getLiveQueueLayout(1920, -10).pageSize, 3);
  assert.match(layoutHelpers.queueGridClassName, /md:grid-cols-2/);
  assert.match(layoutHelpers.queueGridClassName, /xl:grid-cols-3/);
});

test('larger text reduces desktop capacity and enables scrolling when one row cannot fit', () => {
  assert.equal(getLiveQueueLayout(1440, 654, 320, 15).pageSize, 3);
  assert.equal(getLiveQueueLayout(1440, 655, 320, 15).contained, true);
  assert.equal(getLiveQueueLayout(1440, 319, 320, 15).pageSize, 3);
  assert.equal(getLiveQueueLayout(1440, 319, 320, 15).contained, false);
});

test('loading shows six placeholders with the same layout as loaded cards', () => {
  const { DashboardSkeleton } = load('components/dashboard/skeletons/DashboardSkeleton.tsx', {
    react: {},
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../liveQueueLayout': layoutHelpers,
  });
  const gridRef = () => {};
  for (const [width, height, count] of [[1440, 428, 6], [1366, 400, 3], [1280, 0, 3], [1024, 768, 4], [375, 812, 3]]) {
    const layout = getLiveQueueLayout(width, height);
    const tree = DashboardSkeleton({ layout, gridRef });
    const grid = nodes(tree).find(node => node.props?.['data-queue'] === 'new');
    assert.equal(grid.props.children.length, count);
    assert.equal(grid.props.ref, gridRef);
    assert.equal(tree.props.role, 'status');
    if (layout.contained) {
      assert.equal(grid.props.style.gridTemplateRows, 'repeat(' + layout.rows + ', minmax(13rem, 1fr))');
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

function queueHarness(options={}) {
  let cursor = 0, dirty = false, measured = 'new', layout = getLiveQueueLayout(1440, 600);
  const hooks = [], effects = [], requests = [];
  const orders = ['new','ready','pickup'].flatMap(section => Array.from({ length: 13 }, (_, index) => ({
    id: `${section}-${index}`, section, state: section === 'new' ? 'OPEN_INQUIRY' : section === 'ready' ? 'IN_PRODUCTION' : 'READY_FOR_PICKUP',
    selectable: section === 'ready', fingerprint: `${section}-${index}-fingerprint`, paper_size: 'A4', client_name: `Customer ${index}`,
    created_at: '2026-10-10T00:00:00Z', assets: [], available_actions: ['review'], blocking_reasons: [],
  })));
  const service = { ...selectionHelpers.shopQueueService,
    query(section, filters, page, size, extra = {}) {
      requests.push({ section, filters, page, size, extra });
      const found = orders.filter(order => order.section === section && (!filters.searchQuery || order.client_name === filters.searchQuery));
      const totalPages = Math.max(1,Math.ceil(found.length / size)), currentPage = Math.min(page,totalPages);
      return { data: found.slice((currentPage-1)*size,currentPage*size), meta: { currentPage, pageSize:size, totalItems:found.length,totalPages }, counts:{new:13,ready:13,pickup:13,history:0} };
    },
    selection: async ids => orders.filter(order => ids.includes(order.id)),
  };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { const next = typeof value === 'function' ? value(hooks[index]) : value; if (next !== hooks[index]) { hooks[index] = next; dirty=true; } }]; },
    useRef(value) { const index=cursor++; if (!(index in hooks)) hooks[index]={current:value}; return hooks[index]; },
    useEffect(fn,deps) { const index=cursor++; const old=hooks[index]; if (!old || deps.some((value,i)=>value!==old.deps[i])) { effects.push(fn); hooks[index]={deps}; } },
    useCallback(fn,deps) {const index=cursor++;const old=hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))hooks[index]={deps,fn};return hooks[index].fn;},
  };
  const { LiveShopQueue } = load('components/dashboard/LiveShopQueue.tsx', {
    react, 'react/jsx-runtime':{jsx,jsxs:jsx}, 'react-router-dom':{Link:'Link'},
    '../../hooks/useLiveResource':{useLiveResource:(_key,fn)=>({data:fn(),refresh:async()=>{},isLoading:false,error:null})},
    '../../hooks/useDataEvents':{useDataEvents(){}}, '../../services/shopQueueService':{...selectionHelpers,shopQueueService:service},
    '../../services/daemonSocketService':{daemonSocketService:{onStatusChange:()=>()=>{},onPrintersList:()=>()=>{},onUpdateRequired:()=>()=>{},onJobProgress:()=>()=>{}}},
    '../../services/printFulfillmentService':{downloadPinnedFile:async()=>true},
    './BatchReviewDialog':{BatchReviewDialog:'BatchReview'},
    '../../services/batchReviewService':{readPendingBatch:()=>options.pending||null,batchReviewService:options.batches||{}},
    './useLiveQueueLayout':{useLiveQueueLayout:()=>({layout:{...layout,queueKey:measured},gridRef(){}})},
    './liveQueueLayout':layoutHelpers,'./KanbanFilterBar':{KanbanFilterBar:'Filters'},'./QueuePagination':{QueuePagination:'Pagination'},
    './OrderCard':{OrderCard:'Card'},'./OrderReviewDialog':{OrderReviewDialog:'OrderReview'},'./FulfillmentDialog':{FulfillmentDialog:'Fulfillment'},
    './PrintJobProgressModal':{PrintJobProgressModal:'Progress'},'./printFulfillment':{orderBadge:()=>null,mergeAttempt:(_,attempt)=>attempt,TONE_CLASSES:{}},
    './orderCardTitle':titleHelpers,
  }, {document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{setInterval:()=>0,addEventListener(){},removeEventListener(){}},clearInterval(){}});
  const render=()=>{ let tree; for(let i=0;i<15;i++){cursor=0;dirty=false;tree=LiveShopQueue({shopId:'shop'});while(effects.length)effects.shift()();if(!dirty)return tree;}throw new Error('Render failed to settle'); };
  return { render,orders,requests,
    find:type=>nodes(render()).find(node=>node.type===type),
    cards:()=>nodes(render()).filter(node=>node.type==='Card'),
    tab(section){nodes(render()).find(node=>node.props?.id===`queue-tab-${section}`).props.onClick();render();measured=section;},
    resize(width,height){layout=getLiveQueueLayout(width,height);},
  };
}

test('three live tabs use backend summaries and responsive pages while History has its own link', () => {
  const app=queueHarness();
  assert.equal(nodes(app.render()).filter(node=>node.props?.role==='tab').length,3);
  assert.ok(nodes(app.render()).some(node=>node.props?.to==='/shop-dashboard/archived'));
  assert.equal(app.cards().length,6);
  app.find('Pagination').props.onPageChange(2); const first=app.cards()[0].props.order.id;
  app.resize(1440,300);assert.equal(app.cards().length,3);assert.equal(app.cards()[0].props.order.id,first);
  app.resize(1024,800);assert.equal(app.cards().length,4);
  app.resize(375,800);assert.equal(app.cards().length,3);
});

test('filters, sort and pages are independent by tab and clearing preserves sort', () => {
  const app=queueHarness();app.find('Pagination').props.onPageChange(2);
  app.find('Filters').props.onFilterChange('sort','customer');assert.equal(app.find('Pagination').props.page,1);
  app.find('Filters').props.onSearch('Customer 12');assert.equal(app.cards().length,1);
  const outgoing=app.find('Filters').props;app.tab('ready');outgoing.onSearch('Customer 5');
  assert.equal(app.find('Filters').props.searchQuery,'');app.tab('new');
  assert.equal(app.find('Filters').props.searchQuery,'Customer 5');
  app.find('Filters').props.onClear();assert.equal(app.find('Filters').props.filters.sort,'customer');assert.equal(app.find('Pagination').props.total,13);
});

test('selected hidden orders survive pages and tab changes; review includes all selected IDs', () => {
  const app=queueHarness();app.tab('ready');app.cards()[0].props.onToggleSelect();
  app.find('Pagination').props.onPageChange(3);app.cards()[0].props.onToggleSelect();
  app.tab('new');app.tab('ready');
  assert.match(text(app.render()),/2\/25 selected/);
  nodes(app.render()).find(node=>node.type==='button' && text(node)==='Review manual batch').props.onClick();
  const review=app.find('BatchReview');assert.equal(review.props.selection.length,2);
  assert.deepEqual(plain(review.props.selection.map(item=>item.orderId)),['ready-0','ready-12']);
  review.props.onClose();assert.equal(app.find('BatchReview'),undefined);assert.match(text(app.render()),/2\/25 selected/);
});

test('selection rules enforce one paper size, eligibility and 25-order limits without dropping hidden IDs', () => {
  const {addSelection,reconcileSelection}=selectionHelpers;
  const order=index=>({id:String(index),fingerprint:'same',paper_size:'A4',selectable:true,assets:[]});
  let selected=[];for(let i=0;i<25;i++)selected=addSelection(selected,order(i)).selected;
  assert.equal(addSelection(selected,order(26)).selected.length,25);
  assert.match(addSelection(selected,order(26)).notice,/25/);
  assert.match(addSelection(selected.slice(0,1),{...order(27),paper_size:'LONG'}).notice,/A4/);
  assert.match(addSelection([],{...order(1),selectable:false}).notice,/cannot/);
  const result=reconcileSelection(selected,[order(0),{...order(1),fingerprint:'changed'}],['0','1']);
  assert.equal(result.selected.length,24);assert.equal(result.removed[0].orderId,'1');assert.ok(result.selected.some(item=>item.orderId==='24'));
});

test('a bulk response preserves selections made while it was loading',()=>{
  const order=index=>({id:String(index),fingerprint:'same',paper_size:'A4',selectable:true,assets:[]});
  const already=selectionHelpers.addSelection([],order(0)).selected;
  const merged=selectionHelpers.mergeMatchingSelection(already,[order(0),order(1)]);
  assert.deepEqual(plain(merged.map(item=>item.orderId)),['0','1']);
  const full=Array.from({length:25},(_,index)=>({orderId:String(index),fingerprint:'same',paperSize:'A4',label:String(index)}));
  assert.equal(selectionHelpers.mergeMatchingSelection(full,[order(26)]).length,25);
  assert.deepEqual(plain(selectionHelpers.mergeMatchingSelection(already,[{...order(2),paper_size:'LONG'}])),plain(already));
});

test('closing resolved recovery clears the parent request before reopening review',()=>{
  const pending={requestId:'old',selection:[{orderId:'ready-0',fingerprint:'ready-0-fingerprint',paperSize:'A4',label:'Order'}],review:{mode:'MANUAL'}};
  const app=queueHarness({pending});
  const recovered=app.find('BatchReview');assert.equal(recovered.props.initialPending.requestId,'old');
  recovered.props.onClose();
  nodes(app.render()).find(node=>node.type==='button'&&text(node)==='Review manual batch').props.onClick();
  assert.equal(app.find('BatchReview').props.initialPending,null);
});

test('manual download recovery fetches the accepted outcome without submitting production',async()=>{
  const recovered=[];
  const app=queueHarness({batches:{recover:async id=>{recovered.push(id);return {status:'ACCEPTED',result:{requestId:id,attempts:[],acceptedOrderIds:['ready-0'],downloads:[]}};}}});
  app.tab('ready');app.cards()[0].props.onToggleSelect();
  nodes(app.render()).find(node=>node.type==='button'&&text(node)==='Review manual batch').props.onClick();
  app.find('BatchReview').props.onAccepted({requestId:'accepted',attempts:[],acceptedOrderIds:['ready-0'],downloadErrors:[{orderId:'ready-0'}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(text(app.render()),/Batch accepted, but 1 manual file downloads are unavailable/);
  nodes(app.render()).find(node=>node.type==='button'&&text(node)==='Retry manual downloads').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(recovered,['accepted']);assert.equal(app.find('BatchReview'),undefined);
  assert.match(text(app.render()),/0\/25 selected/);
});

test('switching tabs remeasures the same grid without requiring a resize event',()=>{
  const hooks=[],effects=[];let cursor=0;
  const react={
    useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];},
    useLayoutEffect(fn,deps){const i=cursor++;if(!hooks[i]||deps.some((value,n)=>value!==hooks[i][n])){hooks[i]=deps;effects.push(fn);}},
  };
  const grid={dataset:{queue:'new'},closest:()=>null,parentElement:null,getBoundingClientRect:()=>({top:0})};
  const {useLiveQueueLayout}=load('components/dashboard/useLiveQueueLayout.ts',{
    react,'./liveQueueLayout':layoutHelpers,
  },{window:{innerWidth:1440,innerHeight:900,addEventListener(){},removeEventListener(){}},document:{documentElement:{}},
    getComputedStyle:()=>({fontSize:'16',paddingTop:'0',paddingBottom:'0',rowGap:'12'}),
    ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});
  const render=section=>{cursor=0;const result=useLiveQueueLayout(section);while(effects.length)effects.shift()();return result;};
  render('new').gridRef(grid);render('new');assert.equal(render('new').layout.queueKey,'new');
  grid.dataset.queue='ready';render('ready');assert.equal(render('ready').layout.queueKey,'ready');
});

test('a previous History detail request cannot clear a newer loading or error state',async()=>{
  const hooks=[],pending=new Map();let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];},useRef(value){const i=cursor++;if(!(i in hooks))hooks[i]={current:value};return hooks[i];}};
  const rows=['one','two'].map(id=>({id,order_name:id,state:'COMPLETED',created_at:'2026-11-09T00:00:00Z',assets:[]}));
  const {ShopArchivedPage}=load('pages/ShopArchivedPage/ShopArchivedPage.tsx',{
    react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-router-dom':{Link:'Link'},
    '../../hooks/useLiveResource':{useLiveResource:()=>({data:{data:rows,meta:{currentPage:1,totalItems:2}},error:null,isLoading:false})},
    '../../services/shopQueueService':{initialFilters:selectionHelpers.initialFilters,shopQueueService:{details:id=>new Promise((resolve,reject)=>pending.set(id,{resolve,reject}))}},
    '../../components/dashboard/KanbanFilterBar':{KanbanFilterBar:'Filters'},'../../components/dashboard/QueuePagination':{QueuePagination:'Pagination'},
    '../../components/dashboard/OrderCardDetailsDialog':{OrderCardDetailsDialog:'Details'},'../../components/dashboard/orderCardTitle':titleHelpers,
  });
  const render=()=>{cursor=0;return ShopArchivedPage();};
  const details=()=>nodes(render()).find(node=>node.type==='Details');
  const open=id=>nodes(render()).find(node=>node.type==='button'&&text(node)===id).props.onClick();
  open('one');details().props.onClose();open('two');
  pending.get('one').reject(new Error('Old request failed'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(details().props.order.id,'two');assert.equal(details().props.isLoading,true);assert.equal(details().props.loadError,'');
  pending.get('two').resolve({...rows[1],order_name:'fresh two'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(details().props.order.order_name,'fresh two');assert.equal(details().props.isLoading,false);
});
