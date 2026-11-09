const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Headers, FormData, ...globals,
    require: name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

const { ApiError } = load('apiClient.ts', { '../config/runtime': { API_URL: '' } });

function storage() {
  const store = new Map();
  return new Proxy({
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  }, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
}

function recoveryModule({ sessionStorage = storage(), account = () => 'student', cryptoApi = crypto } = {}) {
  return { sessionStorage, ...load('submissionRecovery.ts', { './apiClient': { getAccountId: account } }, { sessionStorage, crypto: cryptoApi }) };
}

const file = () => new File(['%PDF-'], 'thesis.pdf', { type: 'application/pdf', lastModified: 1 });
const fields = { orderName: 'Thesis' };
const dropped = () => new ApiError('lost', 0, undefined, 'connection');
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({ send = async () => ({ orderId: 'created' }), status = async () => ({ status: 'unknown', retryAllowed: true }), recovery = recoveryModule(), navigator } = {}) {
  const timers = [];
  const { SubmissionController } = load('submissionController.ts', { './apiClient': { ApiError }, './submissionRecovery': recovery }, {
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: id => { if (id && timers[id - 1]) timers[id - 1].callback = null; },
    ...(navigator ? { navigator } : {}),
  });
  const sent = [], successes = [], failures = [], phases = [];
  const config = {
    scope: 'new-order',
    send: async args => { sent.push(args); return send(args); },
    checkOperation: status,
    onSuccess: (result, action) => successes.push({ result, action }),
    onFailure: (error, action) => failures.push({ error, action }),
  };
  const make = () => new SubmissionController(config, snapshot => phases.push(snapshot.phase));
  return { controller: make(), make, sent, successes, failures, phases, timers, recovery };
}

test('a confirmed success clears recovery and reports once', async () => {
  const f = fixture();
  await f.controller.submit('submit', fields, file());
  assert.equal(f.sent.length, 1);
  assert.equal(f.successes[0].result.orderId, 'created');
  assert.equal(f.controller.snapshot.hasUnresolved, false);
  assert.equal(f.recovery.readRecovery('new-order'), null);
});

test('the key is stored before the request leaves', async () => {
  let storedDuringSend;
  const recovery = recoveryModule();
  const f = fixture({ recovery, send: async () => { storedDuringSend = recovery.readRecovery('new-order'); return { orderId: 'x' }; } });
  await f.controller.submit('submit', fields, file());
  assert.equal(storedDuringSend.operation.key, f.sent[0].key);
  assert.deepEqual({ ...storedDuringSend.fields }, fields);
});

test('recovery records never contain file contents or URLs', async () => {
  const recovery = recoveryModule();
  const f = fixture({ recovery, send: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  const raw = recovery.sessionStorage.getItem('pf_recovery:new-order');
  assert.doesNotMatch(raw, /%PDF|blob:|https?:|Bearer/);
  assert.deepEqual({ ...JSON.parse(raw).operation.file }, { name: 'thesis.pdf', size: 5, type: 'application/pdf', lastModified: 1 });
});

test('a lost response is checked automatically and never resent automatically', async () => {
  const f = fixture({ send: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  assert.equal(f.sent.length, 1);
  assert.equal(f.controller.snapshot.phase, 'retry');
  assert.equal(f.controller.snapshot.hasUnresolved, true);
});

test('a lost response that actually committed continues with the original result', async () => {
  const f = fixture({
    send: async () => { throw new ApiError('timeout', 0, undefined, 'timeout'); },
    status: async () => ({ status: 'succeeded', retryAllowed: false, result: { orderId: 'landed' } }),
  });
  await f.controller.submit('submit', fields, file());
  await flush();
  assert.equal(f.successes[0].result.orderId, 'landed');
  assert.equal(f.sent.length, 1);
});

test('Retry resends the same key and inputs', async () => {
  let attempts = 0;
  const f = fixture({ send: async () => { if (++attempts === 1) throw dropped(); return { orderId: 'second' }; } });
  const selected = file();
  await f.controller.submit('submit', fields, selected);
  await flush();
  await f.controller.retry(selected);
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1].key, f.sent[0].key);
  assert.equal(f.sent[1].file, selected);
  assert.equal(f.successes[0].result.orderId, 'second');
});

test('a server error is uncertain, because the commit may have landed', async () => {
  const f = fixture({ send: async () => { throw new ApiError('down', 503); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  assert.equal(f.failures.length, 0);
  assert.equal(f.controller.snapshot.phase, 'retry');
});

test('a confirmed rejection reports once and frees the form for a new key', async () => {
  let attempts = 0;
  const f = fixture({ send: async () => { if (++attempts === 1) throw new ApiError('Shop closed', 400); return { orderId: 'x' }; } });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.failures[0].error.message, 'Shop closed');
  assert.equal(f.controller.snapshot.hasUnresolved, false);
  await f.controller.submit('submit', fields, file());
  assert.notEqual(f.sent[1].key, f.sent[0].key);
});

test('a stored final failure from the status check is reported', async () => {
  const f = fixture({
    send: async () => { throw dropped(); },
    status: async () => ({ status: 'failed', retryAllowed: false, error: { status: 400, data: { message: 'Shop closed' } } }),
  });
  await f.controller.submit('submit', fields, file());
  await flush();
  assert.equal(f.failures[0].error.message, 'Shop closed');
  assert.equal(f.failures[0].error.status, 400);
});

test('processing keeps polling status without resubmitting', async () => {
  let reads = 0;
  const f = fixture({
    send: async () => ({ status: 'processing', retryAfterSeconds: 30 }),
    status: async () => (++reads === 1 ? { status: 'processing', retryAllowed: false, retryAfterSeconds: 2 } : { status: 'succeeded', retryAllowed: false, result: { orderId: 'done' } }),
  });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.controller.snapshot.phase, 'processing');
  assert.equal(f.timers.at(-1).delay, 5000, 'Waits are capped so students are not left idle');
  f.timers.at(-1).callback();
  await flush();
  assert.equal(f.timers.at(-1).delay, 2000);
  f.timers.at(-1).callback();
  await flush();
  assert.equal(f.successes[0].result.orderId, 'done');
  assert.equal(f.sent.length, 1);
});

test('an unavailable status check stays unconfirmed and keeps checking', async () => {
  const f = fixture({ send: async () => { throw dropped(); }, status: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  assert.equal(f.controller.snapshot.phase, 'unconfirmed');
  assert.equal(f.timers.at(-1).delay, 15000);
  assert.equal(f.sent.length, 1);
});

test('a changed submission cannot replace an unresolved one', async () => {
  const f = fixture({ send: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  await f.controller.submit('submit', { orderName: 'Changed' }, file());
  assert.equal(f.sent.length, 1);
  f.controller.saveFields({ orderName: 'Changed' });
  assert.equal(f.recovery.readRecovery('new-order').fields.orderName, 'Thesis');
});

test('offline before submission sends nothing and keeps the form', async () => {
  const f = fixture({ navigator: { onLine: false } });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.sent.length, 0);
  assert.equal(f.controller.snapshot.phase, 'offline');
  assert.equal(f.controller.snapshot.hasUnresolved, false);
  assert.equal(f.recovery.readRecovery('new-order').fields.orderName, 'Thesis');
});

test('a rate limit waits for the student and keeps the key', async () => {
  const f = fixture({ send: async () => { throw new ApiError('slow', 429, undefined, 'rate_limited', 5000); } });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.controller.snapshot.phase, 'rate_limited');
  assert.equal(f.failures.length, 0);
  assert.equal(f.controller.snapshot.hasUnresolved, true);
});

test('reload checks the operation before asking for the file', async () => {
  const recovery = recoveryModule();
  const f = fixture({ recovery, send: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  let reads = 0;
  const reloaded = fixture({ recovery, status: async () => { reads++; return { status: 'succeeded', retryAllowed: false, result: { orderId: 'landed' } }; } });
  const controller = reloaded.make();
  assert.equal(controller.restore().orderName, 'Thesis');
  await flush();
  assert.equal(reads, 1);
  assert.equal(reloaded.sent.length, 0);
  assert.equal(reloaded.successes[0].result.orderId, 'landed');
});

test('after reload a retry needs the file, then reuses the original key', async () => {
  const recovery = recoveryModule();
  const first = fixture({ recovery, send: async () => { throw dropped(); } });
  await first.controller.submit('submit', fields, file());
  await flush();
  const f = fixture({ recovery });
  const controller = f.make();
  controller.restore();
  await flush();
  assert.equal(controller.snapshot.needsFile, true);
  await controller.retry(null);
  assert.equal(controller.snapshot.phase, 'needs_file');
  assert.equal(f.sent.length, 0);
  await controller.retry(file());
  assert.equal(f.sent[0].key, first.sent[0].key);
});

test('a reselected file that differs is reported, not treated as a failure', async () => {
  const f = fixture({ send: async () => { throw new ApiError('changed', 409, { code: 'OPERATION_KEY_REUSED' }); } });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.controller.snapshot.phase, 'file_mismatch');
  assert.equal(f.controller.snapshot.hasUnresolved, true);
  assert.equal(f.failures.length, 0);
});

test('an unreadable file asks for reselection instead of sending', async () => {
  const f = fixture();
  const broken = { name: 'a.pdf', size: 1, type: 'application/pdf', lastModified: 1, slice: () => ({ arrayBuffer: async () => { throw new DOMException('gone', 'NotReadableError'); } }) };
  await f.controller.submit('submit', fields, broken);
  assert.equal(f.controller.snapshot.phase, 'needs_file');
  assert.equal(f.sent.length, 0);
});

test('a possible duplicate offers a deliberate new submission', async () => {
  let attempts = 0;
  const f = fixture({ send: async () => { if (++attempts === 1) throw new ApiError('Dup', 409, { code: 'POSSIBLE_DUPLICATE', orderId: 'earlier' }); return { orderId: 'new' }; } });
  await f.controller.submit('submit', fields, file());
  assert.equal(f.controller.snapshot.phase, 'duplicate');
  assert.equal(f.controller.snapshot.duplicateOrderId, 'earlier');
  assert.equal(f.controller.snapshot.hasUnresolved, false);
  await f.controller.submitAnyway();
  assert.equal(f.sent[1].confirmDuplicate, true);
  assert.notEqual(f.sent[1].key, f.sent[0].key);
  assert.equal(f.successes[0].result.orderId, 'new');
});

test('starting over releases the operation and keeps the fields', async () => {
  const f = fixture({ send: async () => { throw dropped(); } });
  await f.controller.submit('submit', fields, file());
  await flush();
  f.controller.startOver();
  assert.equal(f.controller.snapshot.hasUnresolved, false);
  const record = f.recovery.readRecovery('new-order');
  assert.equal(record.fields.orderName, 'Thesis');
  assert.equal(record.operation, undefined);
});

test('reconnecting rechecks an unconfirmed submission', async () => {
  let reachable = false;
  const f = fixture({
    send: async () => { throw dropped(); },
    status: async () => { if (!reachable) throw dropped(); return { status: 'succeeded', retryAllowed: false, result: { orderId: 'landed' } }; },
  });
  await f.controller.submit('submit', fields, file());
  await flush();
  reachable = true;
  f.controller.onReconnect();
  await flush();
  assert.equal(f.successes[0].result.orderId, 'landed');
});

test('a disposed form does not report, and its record survives for the next visit', async () => {
  let release;
  const f = fixture({ send: () => new Promise((_resolve, reject) => { release = () => reject(new ApiError('Bad', 400)); }) });
  const pending = f.controller.submit('submit', fields, file());
  await flush();
  f.controller.dispose();
  release();
  await pending;
  assert.equal(f.failures.length, 0);
});

test('recovery is scoped to the signed-in account', () => {
  let account = 'student-a';
  const recovery = recoveryModule({ account: () => account });
  recovery.writeRecovery('new-order', fields);
  assert.equal(recovery.readRecovery('new-order').fields.orderName, 'Thesis');
  account = 'student-b';
  assert.equal(recovery.readRecovery('new-order'), null);
  account = 'student-a';
  assert.equal(recovery.readRecovery('new-order').fields.orderName, 'Thesis');
});

test('logout clears every recovery record', () => {
  const recovery = recoveryModule();
  recovery.writeRecovery('new-order', fields);
  recovery.writeRecovery('receipt:1', fields);
  recovery.clearAllRecovery();
  assert.equal(recovery.readRecovery('new-order'), null);
  assert.equal(recovery.readRecovery('receipt:1'), null);
  assert.deepEqual(Object.keys(recovery.sessionStorage), []);
});

test('unavailable browser storage falls back to memory and says so', () => {
  const blocked = new Proxy({}, { get() { throw new DOMException('denied', 'SecurityError'); } });
  const recovery = recoveryModule({ sessionStorage: blocked });
  assert.equal(recovery.isRecoveryStorageAvailable(), false);
  recovery.writeRecovery('new-order', fields);
  assert.equal(recovery.readRecovery('new-order').fields.orderName, 'Thesis');
});

test('keys work without randomUUID, as on LAN HTTP and older iOS', () => {
  const { newOperationKey } = recoveryModule({ cryptoApi: { getRandomValues: bytes => crypto.getRandomValues(bytes) } });
  const key = newOperationKey();
  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(newOperationKey(), key);
});

test('order requests carry the key and explicit timeouts', async () => {
  const calls = [];
  const { orderService } = load('orderService.ts', { './apiClient': { apiClient: async (endpoint, options) => calls.push({ endpoint, ...options }) } }, { FormData });
  const blob = new Blob(['%PDF-']);
  await orderService.submitOrder('shop', blob, 'A4', 'COLOR', 'Name', 'PORTRAIT', 1, 'GCASH', 'key-1', true);
  await orderService.uploadReceipt('order', blob, 'REF', 'key-2');
  await orderService.saveDraftChanges('draft', { shopId: 'shop', paperSize: 'A4', printColorMode: 'COLOR', orderName: ' N ', orientation: 'PORTRAIT', copies: 2, paymentMethod: 'GCASH' }, null, 4, 'key-3');
  await orderService.submitDraftChanges('draft', { shopId: 'shop', paperSize: 'A4', printColorMode: 'COLOR', orderName: 'N', orientation: 'PORTRAIT', copies: 2, paymentMethod: 'GCASH' }, blob, 4, 'key-4');
  await orderService.getOperation('key-5');
  assert.equal(calls[0].headers['Idempotency-Key'], 'key-1');
  assert.equal(calls[0].timeoutMs, 300000);
  assert.equal(calls[0].body.get('confirmDuplicate'), 'true');
  assert.equal(calls[1].headers['Idempotency-Key'], 'key-2');
  assert.equal(calls[2].endpoint, '/orders/draft/update-draft');
  assert.equal(calls[2].timeoutMs, 30000);
  assert.deepEqual(JSON.parse(calls[2].body), { shopId: 'shop', paperSize: 'A4', printColorMode: 'COLOR', orderName: 'N', orientation: 'PORTRAIT', copies: 2, paymentMethod: 'GCASH', expectedVersion: 4 });
  assert.equal(calls[3].endpoint, '/orders/draft/submit');
  assert.equal(calls[3].timeoutMs, 300000);
  assert.equal(calls[3].body.get('expectedVersion'), '4');
  assert.equal(calls[4].endpoint, '/orders/operations/key-5');
  assert.equal(calls[4].cache, 'no-store');
});
