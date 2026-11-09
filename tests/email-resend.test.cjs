const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const hookExports = {};
const saved = new Map();
let storageBlocked = false;
const localStorage = {
  getItem(key) { if (storageBlocked) throw new Error('blocked'); return saved.has(key) ? saved.get(key) : null; },
  setItem(key, value) { if (storageBlocked) throw new Error('blocked'); saved.set(key, value); },
  removeItem(key) { if (storageBlocked) throw new Error('blocked'); saved.delete(key); },
};
vm.runInNewContext(compile('hooks/useRetryCountdown.ts'), {
  exports: hookExports, Error, localStorage, require: () => ({ useEffect() {}, useState() {} }),
});

const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = node => node == null || node === false ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);

const readyCaptcha = (ready = true) => ({ ready, widgetKey: 0, setToken() {}, taken: 0, take() { this.taken += 1; return 'captcha-token'; } });

function mount(file, exportName, service, props, captcha = readyCaptcha()) {
  const countdown = { initial: [], starts: [], seconds: 0 };
  const hooks = [];
  let cursor = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
  };
  const jsx = (type, elementProps) => ({ type, props: elementProps });
  const exports = {};
  vm.runInNewContext(compile(file), {
    exports, Error, localStorage, navigator: { onLine: true },
    require(name) {
      if (name === 'react-router-dom') return { useNavigate: () => () => {} };
      if (name.endsWith('/apiClient')) return { ApiError: class ApiError extends Error {} };
      if (name.endsWith('/runtime')) return { API_URL: 'https://api.example.test' };
      if (name === 'react') return { useState, default: { useState } };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === '@carbon/icons-react') return { View: 'icon', ViewOff: 'icon', Checkmark: 'icon' };
      if (name.endsWith('/useRetryCountdown')) return {
        ...hookExports,
        useRetryCountdown(initial = 0) {
          countdown.initial.push(initial);
          if (countdown.initial.length === 1) countdown.seconds = initial;
          return { seconds: countdown.seconds, start(value) { countdown.starts.push(value); countdown.seconds = value; } };
        },
      };
      if (name.endsWith('/authService')) return { authService: service };
      if (name.endsWith('/AuthErrorMessage')) return { AuthErrorMessage: 'AuthError' };
      if (name.endsWith('/EmailInput')) return { EmailInput: 'EmailInput' };
      if (name.endsWith('/CaptchaWidget')) return { CaptchaWidget: 'Captcha' };
      if (name.endsWith('/useCaptcha')) return { useCaptcha: () => captcha };
      if (name.endsWith('/SubmitButton')) return { SubmitButton: 'Submit' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  let tree;
  const render = () => { cursor = 0; tree = exports[exportName](props); return tree; };
  render();
  const find = predicate => nodes(render()).find(predicate);
  return { countdown, render, find, resendButton: () => find(node => node.type === 'button' && /^Resend/.test(text(node))) };
}

function forgotPassword({ email = 'customer@example.test', afterReload = false, captcha } = {}) {
  if (!afterReload) { saved.clear(); storageBlocked = false; }
  const service = { sends: [], tokens: [], async sendPasswordReset(email, token) { service.sends.push(email); service.tokens.push(token); return { message: 'ok' }; } };
  const form = mount('components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx', 'ForgotPasswordForm', service, { onBackToLogin() {} }, captcha);
  form.find(node => node.type === 'EmailInput').props.onChange(email, true);
  return { form, service };
}
const event = { preventDefault() {} };
const expireSavedTimers = () => { for (const key of saved.keys()) saved.set(key, String(Date.now() - 1000)); };

test('forgot password starts the resend timer as soon as the first code is requested', async () => {
  const { form, service } = forgotPassword();
  await form.find(node => node.type === 'form').props.onSubmit(event);
  assert.deepEqual(service.sends, ['customer@example.test']);
  assert.deepEqual(form.countdown.starts, [60]);
  const resend = form.resendButton();
  assert.equal(resend.props.disabled, true);
  assert.equal(text(resend), 'Resend in 60s');
  await resend.props.onClick();
  assert.equal(service.sends.length, 1);
});

test('forgot password never confirms that an account exists', async () => {
  const { form } = forgotPassword();
  await form.find(node => node.type === 'form').props.onSubmit(event);
  assert.match(text(form.render()), /If an account exists for customer@example\.test, we sent an 8-digit reset code\./);
  form.countdown.seconds = 0;
  expireSavedTimers();
  await form.resendButton().props.onClick();
  const contents = text(form.render());
  assert.match(contents, /If an account exists for this email, a new code has been sent\./);
  assert.equal(contents.includes('A new code has been sent to your email'), false);
});

test('forgot password can resend after the timer ends and restarts it', async () => {
  const { form, service } = forgotPassword();
  await form.find(node => node.type === 'form').props.onSubmit(event);
  form.countdown.seconds = 0;
  expireSavedTimers();
  assert.equal(form.resendButton().props.disabled, false);
  await form.resendButton().props.onClick();
  assert.equal(service.sends.length, 2);
  assert.deepEqual(form.countdown.starts, [60, 60]);
  assert.equal(text(form.resendButton()), 'Resend in 60s');
});

test('reloading cannot request another reset code during the wait, and the code can still be entered', async () => {
  const first = forgotPassword();
  await first.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(first.service.sends.length, 1);

  const reloaded = forgotPassword({ afterReload: true });
  await reloaded.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(reloaded.service.sends.length, 0);
  const [wait] = reloaded.form.countdown.starts;
  assert.ok(wait > 0 && wait <= 60);
  const contents = text(reloaded.form.render());
  assert.match(contents, /A code was requested recently/);
  assert.ok(reloaded.form.find(node => node.props?.id === 'reset-code'));
});

test('the saved timer ignores letter case, is per email and does not store the address', async () => {
  const first = forgotPassword();
  await first.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal([...saved.keys()].join().includes('customer'), false);
  const sameEmail = forgotPassword({ email: 'Customer@Example.test', afterReload: true });
  await sameEmail.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(sameEmail.service.sends.length, 0);
  const otherEmail = forgotPassword({ email: 'other@example.test', afterReload: true });
  await otherEmail.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(otherEmail.service.sends.length, 1);
});

test('a new code can be requested once the saved timer has ended', async () => {
  const first = forgotPassword();
  await first.form.find(node => node.type === 'form').props.onSubmit(event);
  expireSavedTimers();
  const reloaded = forgotPassword({ afterReload: true });
  await reloaded.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(reloaded.service.sends.length, 1);
});

test('blocked browser storage does not break password reset', async () => {
  const { form, service } = forgotPassword();
  storageBlocked = true;
  await form.find(node => node.type === 'form').props.onSubmit(event);
  storageBlocked = false;
  assert.equal(service.sends.length, 1);
  assert.deepEqual(form.countdown.starts, [60]);
});

function signup(resendCode, captcha) {
  const service = { calls: 0, token: null, async resendCode(email, token) { service.calls += 1; service.token = token; return resendCode(email); } };
  const form = mount('components/auth/RegistrationForm/EmailVerification.tsx', 'EmailVerification', service, {
    registration: { email: 'customer@example.test' }, onBack() {}, onSignIn() {}, onVerified() {},
  }, captcha);
  return { form, service };
}

test('signup starts with the same resend timer and restarts it after a resend', async () => {
  const { form, service } = signup(async () => ({ message: 'A new verification code has been sent.' }));
  assert.equal(form.countdown.initial[0], 60);
  assert.equal(form.resendButton().props.disabled, true);
  form.countdown.seconds = 0;
  await form.resendButton().props.onClick();
  assert.equal(service.calls, 1);
  assert.deepEqual(form.countdown.starts, [60]);
  assert.match(text(form.render()), /A new verification code has been sent\./);
});

test('signup explains the hourly email limit and uses the wait Supabase gives', async () => {
  const hourly = signup(async () => { throw new Error('email rate limit exceeded'); });
  hourly.form.countdown.seconds = 0;
  await hourly.form.resendButton().props.onClick();
  assert.match(hourly.form.find(node => node.type === 'AuthError').props.message, /Too many emails have been sent recently/);

  const perEmail = signup(async () => { throw new Error('For security purposes, you can only request this after 43 seconds.'); });
  perEmail.form.countdown.seconds = 0;
  await perEmail.form.resendButton().props.onClick();
  assert.deepEqual(perEmail.form.countdown.starts, [43]);
  assert.equal(perEmail.form.find(node => node.type === 'AuthError').props.message, null);
});

test('password reset needs a completed security check and uses its token once', async () => {
  const blocked = forgotPassword({ captcha: readyCaptcha(false) });
  assert.equal(blocked.form.find(node => node.type === 'Submit').props.disabled, true);
  await blocked.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(blocked.service.sends.length, 0);

  const captcha = readyCaptcha();
  const allowed = forgotPassword({ captcha });
  await allowed.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.deepEqual(allowed.service.tokens, ['captcha-token']);
  assert.equal(captcha.taken, 1);
});

test('the resend security check appears only after the wait', async () => {
  const captcha = readyCaptcha();
  const { form, service } = forgotPassword({ captcha });
  await form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(form.find(node => node.type === 'Captcha'), undefined);
  form.countdown.seconds = 0;
  expireSavedTimers();
  assert.ok(form.find(node => node.type === 'Captcha'));
  captcha.ready = false;
  assert.equal(form.resendButton().props.disabled, true);
  await form.resendButton().props.onClick();
  assert.equal(service.sends.length, 1);
});

test('signup resend sends the security check token', async () => {
  const { form, service } = signup(async () => ({ message: 'sent' }));
  assert.equal(form.find(node => node.type === 'Captcha'), undefined);
  form.countdown.seconds = 0;
  assert.ok(form.find(node => node.type === 'Captcha'));
  await form.resendButton().props.onClick();
  assert.equal(service.token, 'captcha-token');
});

function captchaModule(siteKey) {
  const ref = { current: { clientWidth: 400 } };
  const effects = [];
  const turnstile = { options: null, render(_element, options) { this.options = options; return 'widget'; }, remove() {} };
  const hooks = [];
  let cursor = 0;
  const react = {
    useRef: () => ref, useEffect(effect) { effects.push(effect); },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
  };
  const hook = {};
  const load = (file, exports) => vm.runInNewContext(compile(file), {
    exports, window: { turnstile }, Promise,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === '@carbon/icons-react') return { CheckmarkOutline: 'CheckIcon', WarningAlt: 'WarningIcon' };
      if (name.endsWith('/runtime')) return { TURNSTILE_SITE_KEY: siteKey };
      if (name.endsWith('/useCaptcha')) return hook;
      throw new Error(name);
    },
  });
  load('components/auth/CaptchaWidget/useCaptcha.ts', hook);
  const widget = {};
  load('components/auth/CaptchaWidget/CaptchaWidget.tsx', widget);
  return {
    exports: { ...hook, ...widget }, turnstile,
    use() { cursor = 0; return hook.useCaptcha(); },
    widget(onToken) { cursor = 0; effects.length = 0; return widget.CaptchaWidget({ onToken }); },
    async start() { effects.forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); },
  };
}

test('without a site key the forms are not blocked and nothing renders', () => {
  const module = captchaModule('');
  assert.equal(module.exports.captchaEnabled, false);
  assert.equal(module.use().ready, true);
  assert.equal(module.exports.CaptchaWidget({ onToken() {} }), null);
});

test('with a site key a token is required and replaced after use', () => {
  const module = captchaModule('site-key');
  assert.equal(module.use().ready, false);
  module.use().setToken('one-time');
  assert.equal(module.use().ready, true);
  assert.equal(module.use().take(), 'one-time');
  const after = module.use();
  assert.equal(after.ready, false);
  assert.equal(after.widgetKey, 1);
});

test('the security check shows a clean badge and hides Cloudflare\'s box unless it is needed', async () => {
  const module = captchaModule('site-key');
  const tokens = [];
  const onToken = token => tokens.push(token);
  assert.match(text(module.widget(onToken)), /Verifying…/);
  await module.start();
  const { options } = module.turnstile;
  assert.equal(options.appearance, 'interaction-only');
  assert.equal(options.theme, 'light');

  options.callback('fresh-token');
  const verified = module.widget(onToken);
  assert.match(text(verified), /Verification successful/);
  assert.match(text(verified), /CloudflarePrivacy • Help$/);
  for (const link of nodes(verified).filter(node => node.type === 'a')) assert.equal(link.props.rel, 'noopener noreferrer');
  assert.ok(nodes(verified).some(node => node.type === 'CheckIcon'));
  assert.deepEqual(tokens, ['fresh-token']);

  options['before-interactive-callback']();
  assert.equal(nodes(module.widget(onToken)).some(node => node.props?.role === 'status'), false);

  options['expired-callback']();
  assert.equal(tokens.at(-1), null);
  assert.match(text(module.widget(onToken)), /Verifying…/);

  options['error-callback']();
  assert.match(text(module.widget(onToken)), /security check failed/);
});

test('robots.txt keeps private areas out of search and the security policy allows the check', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(read('public/robots.txt'), /User-agent: \*\s+Allow: \/\$\s+Allow: \/auth\$\s+Disallow: \/\s*$/);
  const policy = read('render.yaml');
  assert.match(policy, /script-src 'self' https:\/\/challenges\.cloudflare\.com;/);
  assert.match(policy, /frame-src [^;]*https:\/\/challenges\.cloudflare\.com;/);
  assert.match(policy, /VITE_TURNSTILE_SITE_KEY/);
});

function loginForm(captcha) {
  const service = { calls: [], async login(payload) { service.calls.push(payload); return { user: { roleTag: 'Student' } }; } };
  const form = mount('components/auth/LoginForm/LoginForm.tsx', 'LoginForm', service, {}, captcha);
  form.find(node => node.type === 'EmailInput').props.onChange('customer@example.test', true);
  form.find(node => node.type === 'input' && node.props.placeholder === 'Enter your password').props.onChange({ target: { value: 'Password1!' } });
  return { form, service };
}

test('login needs a completed security check and sends its token once', async () => {
  const blocked = loginForm(readyCaptcha(false));
  assert.equal(blocked.form.find(node => node.type === 'Submit').props.disabled, true);
  await blocked.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(blocked.service.calls.length, 0);

  const captcha = readyCaptcha();
  const allowed = loginForm(captcha);
  assert.ok(allowed.form.find(node => node.type === 'Captcha'));
  await allowed.form.find(node => node.type === 'form').props.onSubmit(event);
  assert.equal(allowed.service.calls[0].captchaToken, 'captcha-token');
  assert.equal(captcha.taken, 1);
});

test('email send errors keep other messages and use the fallback when needed', () => {
  assert.equal(hookExports.EMAIL_RESEND_SECONDS, 60);
  assert.equal(hookExports.getEmailSendError(new Error('Signups not allowed'), 'Fallback'), 'Signups not allowed');
  assert.equal(hookExports.getEmailSendError(new Error(''), 'Fallback'), 'Fallback');
  assert.equal(hookExports.getEmailSendError('nope', 'Fallback'), 'Fallback');
});
