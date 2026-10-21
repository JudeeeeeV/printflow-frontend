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
  vm.runInNewContext(compiled, {
    exports,
    Headers,
    FormData,
    ...mocks.globals,
    require: name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
  };
}

test('apiClient automatically attaches Authorization Bearer token when present', async () => {
  const localStorage = createMockStorage({ pf_access_token: 'test-jwt-token-123' });
  const capturedRequests = [];

  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: {
      localStorage,
      fetch: async (url, options) => {
        capturedRequests.push({ url, options });
        return new Response(JSON.stringify({ data: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  const res = await apiClient('/orders');
  assert.deepEqual(res, { data: 'ok' });
  assert.equal(capturedRequests.length, 1);
  assert.equal(capturedRequests[0].options.headers.get('Authorization'), 'Bearer test-jwt-token-123');
  assert.equal(capturedRequests[0].options.credentials, 'include');
});

test('apiClient does not attach Authorization header when no token is in storage', async () => {
  const localStorage = createMockStorage({});
  const capturedRequests = [];

  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: {
      localStorage,
      fetch: async (url, options) => {
        capturedRequests.push({ url, options });
        return new Response(JSON.stringify({ shops: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  await apiClient('/shops');
  assert.equal(capturedRequests.length, 1);
  assert.equal(capturedRequests[0].options.headers.has('Authorization'), false);
});

test('apiClient refreshes session with refreshToken body and retries request with new token on 401', async () => {
  const localStorage = createMockStorage({
    pf_access_token: 'old-access-token',
    pf_refresh_token: 'valid-refresh-token',
  });
  const requests = [];

  const { apiClient } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: {
      localStorage,
      fetch: async (url, options) => {
        requests.push({ url, options });
        if (requests.length === 1) {
          // First request to /orders returns 401
          return new Response(JSON.stringify({ message: 'Expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requests.length === 2) {
          // Second request is to /auth/refresh
          assert.equal(url, 'https://api.example.test/auth/refresh');
          const body = JSON.parse(options.body);
          assert.equal(body.refreshToken, 'valid-refresh-token');
          return new Response(
            JSON.stringify({
              user: { id: 'u1' },
              token: 'new-access-token',
              refreshToken: 'new-refresh-token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Third request is retried /orders with new token
        return new Response(JSON.stringify({ data: 'success-orders' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  const data = await apiClient('/orders');
  assert.deepEqual(data, { data: 'success-orders' });
  assert.equal(requests.length, 3);
  assert.equal(requests[2].options.headers.get('Authorization'), 'Bearer new-access-token');
  assert.equal(localStorage.getItem('pf_access_token'), 'new-access-token');
  assert.equal(localStorage.getItem('pf_refresh_token'), 'new-refresh-token');
});

test('setAuthTokens and clearAuthTokens manage storage properly', () => {
  const localStorage = createMockStorage();
  const { setAuthTokens, clearAuthTokens, getAccessToken, getRefreshToken } = loadModule('apiClient.ts', {
    '../config/runtime': { API_URL: 'https://api.example.test' },
    globals: { localStorage },
  });

  setAuthTokens('token-1', 'refresh-1');
  assert.equal(getAccessToken(), 'token-1');
  assert.equal(getRefreshToken(), 'refresh-1');

  clearAuthTokens();
  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
});
