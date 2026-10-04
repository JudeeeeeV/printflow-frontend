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
