const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

// Exercise the real frontend Supabase SDK without contacting a provider or
// creating accounts. All Auth HTTP requests terminate at this test fixture.
const compiled = ts.transpileModule(fs.readFileSync(
  path.join(__dirname, '../src/services/authService.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const payload = {
  firstName: ' María   Ana ', lastName: ' De la Cruz ',
  email: 'customer@example.test', passwordHash: 'ExamplePassword1!', role: 'Student',
};

function setup(handler) {
  const calls = [];
  const apiCalls = [];
  const loggedErrors = [];
  const user = {
    id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated',
    email: payload.email, role: 'authenticated', app_metadata: { provider: 'email' },
    user_metadata: {}, created_at: '2026-10-04T00:00:00Z',
  };
  const token = [
    { alg: 'HS256', typ: 'JWT' },
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' },
  ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.test-signature';
  const session = { access_token: token, refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer', user };
  const client = createClient('https://email-regression.invalid', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const request = {
        path: new URL(typeof input === 'string' ? input : input.url).pathname,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : undefined,
      };
      calls.push(request);
      const response = handler?.(request);
      if (response) return response;
      let body = {};
      if (request.path.endsWith('/signup')) body = user;
      else if (request.path.endsWith('/verify')) body = session;
      else if (request.path.endsWith('/user')) body = user;
      else if (!['/auth/v1/recover', '/auth/v1/resend', '/auth/v1/logout'].includes(request.path)) {
        throw new Error(`Unexpected Auth request ${request.path}`);
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    console: { error: (...args) => loggedErrors.push(args) },
    require: name => {
      if (name === '../lib/supabaseClient') return { supabase: client };
      if (name === './apiClient') return { apiClient: async (...args) => { apiCalls.push(args); return { firstName: 'Ana', lastName: 'Cruz' }; } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { service: exports.authService, calls, apiCalls, loggedErrors, client };
}

function authError(status, code, message) {
  return new Response(JSON.stringify({ code, msg: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

for (const role of ['Student', 'Print Shop']) {
  test(`${role} registration still requests a confirmation email with name metadata`, async () => {
    const f = setup();
    const result = await f.service.register({ ...payload, role, shopName: role === 'Print Shop' ? 'Example Print' : undefined });
    assert.equal(result.requiresEmailVerification, true);
    assert.equal(result.email, payload.email);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].path, '/auth/v1/signup');
    assert.equal(f.calls[0].body.email, payload.email);
    assert.equal(f.calls[0].body.password, payload.passwordHash);
    assert.equal(f.calls[0].body.data.first_name, 'María Ana');
    assert.equal(f.calls[0].body.data.last_name, 'De la Cruz');
    assert.equal(f.calls[0].body.data.role, role === 'Print Shop' ? 'CLERK' : 'STUDENT');
    assert.equal(f.calls[0].body.data.shop_name, role === 'Print Shop' ? 'Example Print' : undefined);
    assert.equal((await f.client.auth.getSession()).data.session, null);
  });
}

test('invalid names are rejected before an account or email is requested', async () => {
  const f = setup();
  for (const invalid of [{ firstName: '  ' }, { lastName: '  ' }, { firstName: 'a'.repeat(101) }]) {
    await assert.rejects(f.service.register({ ...payload, ...invalid }), /first and last name/);
  }
  assert.equal(f.calls.length, 0);
});

test('signup surfaces SMTP/provider failure instead of showing successful verification', async () => {
  const f = setup(() => authError(500, 'unexpected_failure', 'Error sending confirmation email'));
  await assert.rejects(f.service.register(payload), /Error sending confirmation email/);
});

test('resend preserves the signup email type and address', async () => {
  const f = setup();
  await f.service.resendCode(payload.email);
  assert.equal(f.calls[0].path, '/auth/v1/resend');
  assert.equal(f.calls[0].body.type, 'signup');
  assert.equal(f.calls[0].body.email, payload.email);
});

test('resend preserves rate-limit feedback for the UI countdown', async () => {
  const f = setup(() => authError(429, 'over_email_send_rate_limit', 'For security purposes, you can only request this after 43 seconds.'));
  await assert.rejects(f.service.resendCode(payload.email), /only request this after 43 seconds/);
});

test('signup verification still sends the complete eight-digit code', async () => {
  const f = setup();
  assert.equal((await f.service.verifyEmail(payload, '01234567')).verified, true);
  assert.equal(f.calls[0].path, '/auth/v1/verify');
  assert.equal(f.calls[0].body.type, 'signup');
  assert.equal(f.calls[0].body.token, '01234567');
  assert.equal(f.calls[0].body.email, payload.email);
});

test('expired verification codes remain failures', async () => {
  const f = setup(() => authError(403, 'otp_expired', 'Token has expired or is invalid'));
  await assert.rejects(f.service.verifyEmail(payload, '01234567'), /expired or is invalid/);
});

test('password reset still requests its email through the recovery endpoint', async () => {
  const f = setup();
  await f.service.sendPasswordReset(payload.email);
  assert.equal(f.calls[0].path, '/auth/v1/recover');
  assert.equal(f.calls[0].body.email, payload.email);
});

test('recovery mail errors retain the existing generic response without leaking accounts', async () => {
  const f = setup(() => authError(500, 'unexpected_failure', 'Error sending recovery email'));
  const result = await f.service.sendPasswordReset(payload.email);
  assert.equal(result.message, 'If an account exists, a reset code has been sent.');
  assert.equal(f.loggedErrors.length, 1);
});

test('reset verifies recovery OTP before changing the password, then signs out', async () => {
  const f = setup();
  await f.service.resetPassword({ email: payload.email, code: '01234567', passwordHash: 'NewPassword1!' });
  assert.deepEqual(f.calls.map(call => [call.method, call.path]), [
    ['POST', '/auth/v1/verify'], ['PUT', '/auth/v1/user'], ['POST', '/auth/v1/logout'],
  ]);
  assert.equal(f.calls[0].body.type, 'recovery');
  assert.equal(f.calls[1].body.password, 'NewPassword1!');
  assert.equal((await f.client.auth.getSession()).data.session, null);
});

test('invalid recovery OTP never changes the password', async () => {
  const f = setup(() => authError(403, 'otp_expired', 'Token has expired or is invalid'));
  await assert.rejects(f.service.resetPassword({ email: payload.email, code: '01234567', passwordHash: 'NewPassword1!' }), /expired/);
  assert.deepEqual(f.calls.map(call => call.path), ['/auth/v1/verify']);
});

test('editing a profile name does not send mail or change Auth credentials', async () => {
  const f = setup();
  await f.service.updateProfile('Ana', 'Cruz');
  assert.equal(f.calls.length, 0);
  assert.equal(f.apiCalls[0][0], '/auth/profile');
  assert.equal(f.apiCalls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(f.apiCalls[0][1].body), { firstName: 'Ana', lastName: 'Cruz' });
});
