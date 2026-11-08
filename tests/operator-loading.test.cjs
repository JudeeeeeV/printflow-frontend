const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Headers, FormData, ...mocks.globals,
    require: name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('overlapping polls share one request', async () => {
  const { createRefreshQueue } = loadModule('refreshQueue.ts');
  const request = deferred();
  let calls = 0;
  const values = [];
  const refresh = createRefreshQueue(() => { calls++; return request.promise; }, value => values.push(value));
  const initial = refresh(false);
  assert.equal(refresh(false), initial);
  assert.equal(refresh(false), initial);
  request.resolve('orders');
  await initial;
  assert.equal(calls, 1);
  assert.deepEqual(values, ['orders']);
});

test('mutation bursts trigger one fresh read and discard the stale snapshot', async () => {
  const { createRefreshQueue } = loadModule('refreshQueue.ts');
  const request = deferred();
  let calls = 0;
  const values = [];
  const refresh = createRefreshQueue(() => ++calls === 1 ? request.promise : Promise.resolve('new orders'), value => values.push(value));
  const initial = refresh(false);
  refresh(); refresh(); refresh();
  request.resolve('stale orders');
  await initial;
  assert.equal(calls, 2);
  assert.deepEqual(values, ['new orders']);
});

test('a failed refresh does not block later retries', async () => {
  const { createRefreshQueue } = loadModule('refreshQueue.ts');
  let calls = 0;
  const values = [];
  const refresh = createRefreshQueue(() => ++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('recovered'), value => values.push(value));
  await assert.rejects(refresh(), /offline/);
  await refresh();
  assert.deepEqual(values, ['recovered']);
});

test('layout and dashboard share a shop request without keeping a stale result', async () => {
  const request = deferred();
  let calls = 0;
  const { shopService } = loadModule('shopService.ts', {
    './apiClient': { apiClient: () => { calls++; return request.promise; } },
  });
  const layout = shopService.getMyShop();
  assert.equal(shopService.getMyShop(), layout);
  request.resolve({ id: 'shop' });
  await layout;
  assert.equal(calls, 1);
  await shopService.getMyShop();
  assert.equal(calls, 2);
});

test('failed shop lookups can be retried', async () => {
  let calls = 0;
  const { shopService } = loadModule('shopService.ts', {
    './apiClient': { apiClient: () => ++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ id: 'shop' }) },
  });
  await assert.rejects(shopService.getMyShop(), /offline/);
  assert.equal((await shopService.getMyShop()).id, 'shop');
});

test('shop directory requests overlap and remain cached for only 30 seconds', async () => {
  let now = 1000, calls = 0;
  const pending = deferred();
  const shops = [{ id: 'shop-a', status: 'OPEN' }];
  const { shopService } = loadModule('shopService.ts', {
    './apiClient': { apiClient: () => { calls++; return pending.promise; } },
    globals: { Date: { now: () => now } },
  });
  const initial = shopService.getShops();
  assert.equal(shopService.getShops(), initial);
  pending.resolve(shops);
  await initial;
  now += 29_999;
  assert.equal(await shopService.getShops(), shops);
  assert.equal(calls, 1);
  now++;
  await shopService.getShops();
  assert.equal(calls, 2);
});

test('shop directory failures allow retries and empty lists are cached', async () => {
  let calls = 0;
  const { shopService } = loadModule('shopService.ts', {
    './apiClient': { apiClient: () => ++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve([]) },
  });
  const initial = shopService.getShops();
  assert.equal(shopService.getShops(), initial);
  await assert.rejects(initial, /offline/);
  assert.equal((await shopService.getShops()).length, 0);
  await shopService.getShops();
  assert.equal(calls, 2);
});

test('GET requests omit JSON headers while JSON writes and multipart uploads keep their required headers', async () => {
  const requests = [];
  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: { fetch: async (_url, options) => {
      requests.push(options);
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  await apiClient('/shops');
  await apiClient('/shops/me', { method: 'PATCH', body: JSON.stringify({ name: 'Shop' }) });
  await apiClient('/shops/me/photo', { method: 'POST', body: new FormData() });
  assert.equal(requests[0].headers.has('Content-Type'), false);
  assert.equal(requests[1].headers.get('Content-Type'), 'application/json');
  assert.equal(requests[2].headers.has('Content-Type'), false);
  assert.ok(requests.every(options => options.credentials === 'include'));
});

test('GET requests share in-flight work, use a short cache, and mutations invalidate it', async () => {
  let requests = 0;
  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: { fetch: async () => {
      requests++;
      return new Response(JSON.stringify({ request: requests }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  const [first, overlapping] = await Promise.all([apiClient('/orders'), apiClient('/orders')]);
  const cached = await apiClient('/orders');
  assert.equal(requests, 1);
  assert.equal(first.request, 1); assert.equal(overlapping.request, 1); assert.equal(cached.request, 1);
  await apiClient('/orders/one', { method: 'PATCH', body: '{}' });
  const refreshed = await apiClient('/orders');
  assert.equal(requests, 3); assert.equal(refreshed.request, 3);
});

test('no-store GETs always read fresh and leave the shared cache alone', async () => {
  let requests = 0;
  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: { fetch: async () => {
      requests++;
      return new Response(JSON.stringify({ request: requests }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  const cached = await apiClient('/orders');
  const live = await apiClient('/devices', { cache: 'no-store' });
  const liveAgain = await apiClient('/devices', { cache: 'no-store' });
  assert.equal(live.request, 2);
  assert.equal(liveAgain.request, 3);
  assert.equal((await apiClient('/orders')).request, cached.request, 'a live read does not invalidate cached data');
});

test('a response that started before an invalidation is not cached', async () => {
  const responses = [];
  const { apiClient, invalidateApiCache } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: { fetch: () => { const next = deferred(); responses.push(next); return next.promise; } },
  });
  const json = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  const stale = apiClient('/devices');
  await new Promise((resolve) => setImmediate(resolve));
  invalidateApiCache();
  responses[0].resolve(json({ printers: [] }));
  assert.deepEqual([...(await stale).printers], []);
  const fresh = apiClient('/devices');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responses.length, 2, 'the stale response must not satisfy the next read');
  responses[1].resolve(json({ printers: ['Desk'] }));
  assert.deepEqual([...(await fresh).printers], ['Desk']);
});

test('profile saves refresh an expired cookie session and retry the same PATCH', async () => {
  const requests = [];
  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: {
      fetch: async (url, options) => {
        requests.push({ url, options });
        return new Response(JSON.stringify({ firstName: 'Ana', lastName: 'Cruz' }), {
          status: requests.length === 1 ? 401 : 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  const body = JSON.stringify({ firstName: 'Ana', lastName: 'Cruz' });
  const profile = await apiClient('/auth/profile', { method: 'PATCH', body });
  assert.equal(profile.firstName, 'Ana');
  assert.equal(requests[1].url, 'https://api.example.test/auth/refresh');
  assert.equal(requests[2].options.method, 'PATCH');
  assert.equal(requests[2].options.body, body);
  assert.ok(requests.every(request => request.options.credentials === 'include'));
});
