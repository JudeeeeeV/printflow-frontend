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
    exports, Headers, FormData, AbortController, setTimeout, clearTimeout, ...globals,
    require: name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

function storage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function client(fetch, globals = {}) {
  const localStorage = storage({ pf_access_token: 'access', pf_refresh_token: 'refresh', user_role: 'Student' });
  const window = { location: { href: '/checkout/1' } };
  const exports = load('apiClient.ts', { '../config/runtime': { API_URL: 'https://api.test' } }, { fetch, localStorage, window, ...globals });
  return { ...exports, localStorage, window };
}

const expiredThenRefresh = refresh => async url => (url.endsWith('/auth/refresh') ? refresh() : json({ message: 'Expired' }, 401));

for (const [name, refresh] of [
  ['a network failure', async () => { throw new TypeError('Failed to fetch'); }],
  ['a server outage', async () => json({ message: 'down' }, 503)],
  ['a rate limit', async () => json({ message: 'slow' }, 429)],
]) {
  test(`${name} during session refresh keeps the student signed in`, async () => {
    const api = client(expiredThenRefresh(refresh));
    await assert.rejects(api.apiClient('/orders/1'), error => error.kind === 'connection' && error.status === 0);
    assert.equal(api.localStorage.getItem('pf_access_token'), 'access');
    assert.equal(api.localStorage.getItem('user_role'), 'Student');
    assert.equal(api.window.location.href, '/checkout/1');
  });
}

test('a refused refresh token ends the session', async () => {
  const api = client(expiredThenRefresh(async () => json({ message: 'Invalid' }, 401)));
  await assert.rejects(api.apiClient('/orders/1'), error => error.status === 401);
  assert.equal(api.localStorage.getItem('pf_access_token'), null);
  assert.equal(api.localStorage.getItem('user_role'), null);
  assert.equal(api.window.location.href, '/auth');
});

test('a timeout covers reading the response body', async () => {
  const api = client(async (_url, options) => {
    const response = json({ ok: true });
    response.json = () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    return response;
  });
  await assert.rejects(api.apiClient('/orders/1', { timeoutMs: 5 }), error => error.kind === 'timeout' && error.status === 0);
});

test('an authentication replay gets its own deadline', async () => {
  const signals = [];
  let orderCalls = 0;
  const api = client(async (url, options) => {
    if (url.endsWith('/auth/refresh')) return json({ token: 'new', refreshToken: 'newer' });
    signals.push(options.signal);
    return ++orderCalls === 1 ? json({}, 401) : json({ ok: true });
  });
  assert.deepEqual({ ...(await api.apiClient('/orders/1', { timeoutMs: 1000 })) }, { ok: true });
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
});

test('errors say what went wrong', async () => {
  const failure = async (fetch, globals, options) => client(fetch, globals).apiClient('/x', options).catch(error => error);
  const offline = await failure(async () => { throw new TypeError('x'); }, { navigator: { onLine: false } });
  assert.equal(offline.kind, 'offline');
  const dropped = await failure(async () => { throw new TypeError('x'); }, { navigator: { onLine: true } });
  assert.equal(dropped.kind, 'connection');
  const aborted = await failure(async () => { throw new DOMException('x', 'AbortError'); });
  assert.equal(aborted.kind, 'aborted');
  const invalid = await failure(async () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } }));
  assert.equal(invalid.kind, 'invalid_response');
  const limited = await failure(async () => json({ message: 'ThrottlerException' }, 429, { 'Retry-After': '12' }));
  assert.equal(limited.kind, 'rate_limited');
  assert.equal(limited.status, 429);
  assert.equal(limited.retryAfterMs, 12000);
  const missing = await failure(async () => json({ message: 'Order not found' }, 404));
  assert.equal(missing.kind, 'http');
  assert.equal(missing.status, 404);
});

test('no-store reads always reach the server', async () => {
  let calls = 0;
  const api = client(async () => json({ call: ++calls }));
  await api.apiClient('/orders/1', { cache: 'no-store' });
  await api.apiClient('/orders/1', { cache: 'no-store' });
  assert.equal(calls, 2);
});

test('a read started before sign-out cannot repopulate the cache', async () => {
  let release;
  let calls = 0;
  const api = client(async () => {
    calls += 1;
    if (calls === 1) await new Promise(resolve => { release = resolve; });
    return json({ call: calls });
  });
  const first = api.apiClient('/orders');
  await new Promise(resolve => setImmediate(resolve));
  api.clearAuthTokens();
  release();
  await first;
  await api.apiClient('/orders');
  assert.equal(calls, 2);
});

test('a failed read does not drop a refresh queued behind it', async () => {
  const { createRefreshQueue } = load('refreshQueue.ts');
  const applied = [];
  let release;
  let calls = 0;
  const refresh = createRefreshQueue(async () => {
    calls += 1;
    if (calls === 1) {
      await new Promise((_resolve, reject) => { release = () => reject(new Error('dropped')); });
    }
    return calls;
  }, value => applied.push(value));
  const pending = refresh();
  refresh();
  release();
  await pending;
  assert.deepEqual([...applied], [2]);
});

test('a failed read with nothing queued is reported', async () => {
  const { createRefreshQueue } = load('refreshQueue.ts');
  const refresh = createRefreshQueue(async () => { throw new Error('down'); }, () => assert.fail('nothing to apply'));
  await assert.rejects(refresh(), /down/);
});

test('polling slows with a live stream and backs off after failures', () => {
  const { nextPollDelayMs } = load('pollingSchedule.ts');
  assert.equal(nextPollDelayMs({ failures: 0, streamConnected: false }), 5000);
  assert.equal(nextPollDelayMs({ failures: 0, streamConnected: true }), 20000);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(failures => nextPollDelayMs({ failures, streamConnected: false })), [10000, 20000, 40000, 60000, 60000, 60000]);
  assert.equal(nextPollDelayMs({ failures: 1, retryAfterMs: 45000, streamConnected: true }), 45000);
  assert.equal(nextPollDelayMs({ failures: 3, retryAfterMs: 1000, streamConnected: true }), 40000);
});

function eventFixture({ token = () => 'token-1', fresh = async () => 'refreshed' } = {}) {
  const sources = [];
  const timers = [];
  class EventSource {
    constructor(url) { this.url = url; this.readyState = 1; this.closed = false; sources.push(this); }
    close() { this.closed = true; this.readyState = 2; }
  }
  const invalidated = [];
  const { dataEvents } = load('dataEvents.ts', {
    '../config/runtime': { API_URL: 'https://api.test' },
    './apiClient': { getAccessToken: token, ensureFreshSession: fresh, invalidateApiCache: () => invalidated.push(1) },
  }, {
    EventSource,
    window: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].callback = null; } },
  });
  const fireTimer = async () => { const timer = timers.shift(); timer.callback?.(); await new Promise(resolve => setImmediate(resolve)); return timer.delay; };
  return { dataEvents, sources, timers, fireTimer, invalidated };
}

test('data events report connection state and refresh listeners after a reconnect', () => {
  const f = eventFixture();
  let refreshes = 0;
  let changes = 0;
  f.dataEvents.subscribeConnection(() => { changes += 1; });
  f.dataEvents.subscribe(['orders'], () => { refreshes += 1; });
  assert.equal(f.dataEvents.isConnected(), false);
  f.sources[0].onopen();
  assert.equal(f.dataEvents.isConnected(), true);
  assert.equal(refreshes, 0);
  f.sources[0].readyState = 0;
  f.sources[0].onerror();
  assert.equal(f.dataEvents.isConnected(), false);
  assert.equal(f.sources.length, 1);
  f.sources[0].readyState = 1;
  f.sources[0].onopen();
  assert.equal(refreshes, 1);
  assert.equal(f.invalidated.length, 1);
  assert.equal(changes, 3);
});

test('a refused stream reconnects with backoff using the current token', async () => {
  let current = 'old-token';
  const f = eventFixture({ token: () => current, fresh: async () => { current = 'new-token'; return 'refreshed'; } });
  f.dataEvents.subscribe(['orders'], () => {});
  f.sources[0].readyState = 2;
  f.sources[0].onerror();
  assert.equal(f.sources[0].closed, true);
  assert.equal(await f.fireTimer(), 1000);
  assert.equal(f.sources.length, 2);
  assert.match(f.sources[1].url, /token=new-token/);
  f.sources[1].readyState = 2;
  f.sources[1].onerror();
  assert.equal(await f.fireTimer(), 2000);
});

test('stream reconnects keep trying during an outage and stop for a refused session', async () => {
  let outcome = 'unavailable';
  const f = eventFixture({ fresh: async () => outcome });
  f.dataEvents.subscribe(['orders'], () => {});
  f.sources[0].readyState = 2;
  f.sources[0].onerror();
  await f.fireTimer();
  assert.equal(f.sources.length, 1);
  assert.equal(f.timers.length, 1);
  outcome = 'rejected';
  await f.fireTimer();
  assert.equal(f.sources.length, 1);
  assert.equal(f.timers.length, 0);
});

test('unsubscribing cancels a pending reconnect', async () => {
  const f = eventFixture();
  const unsubscribe = f.dataEvents.subscribe(['orders'], () => {});
  f.sources[0].readyState = 2;
  f.sources[0].onerror();
  unsubscribe();
  await f.fireTimer();
  assert.equal(f.sources.length, 1);
});
