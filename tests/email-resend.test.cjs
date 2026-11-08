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
vm.runInNewContext(compile('hooks/useRetryCountdown.ts'), {
  exports: hookExports, Error, require: () => ({ useEffect() {}, useState() {} }),
});

const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = node => node == null || node === false ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);

function mount(file, exportName, service, props) {
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
    exports, Error,
    require(name) {
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

function forgotPassword() {
  const service = { sends: [], async sendPasswordReset(email) { service.sends.push(email); return { message: 'ok' }; } };
  const form = mount('components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx', 'ForgotPasswordForm', service, { onBackToLogin() {} });
  form.find(node => node.type === 'EmailInput').props.onChange('customer@example.test', true);
  return { form, service };
}
const event = { preventDefault() {} };

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
  await form.resendButton().props.onClick();
  const contents = text(form.render());
  assert.match(contents, /If an account exists for this email, a new code has been sent\./);
  assert.equal(contents.includes('A new code has been sent to your email'), false);
});

test('forgot password can resend after the timer ends and restarts it', async () => {
  const { form, service } = forgotPassword();
  await form.find(node => node.type === 'form').props.onSubmit(event);
  form.countdown.seconds = 0;
  assert.equal(form.resendButton().props.disabled, false);
  await form.resendButton().props.onClick();
  assert.equal(service.sends.length, 2);
  assert.deepEqual(form.countdown.starts, [60, 60]);
  assert.equal(text(form.resendButton()), 'Resend in 60s');
});

function signup(resendCode) {
  const service = { calls: 0, async resendCode(email) { service.calls += 1; return resendCode(email); } };
  const form = mount('components/auth/RegistrationForm/EmailVerification.tsx', 'EmailVerification', service, {
    registration: { email: 'customer@example.test' }, onBack() {}, onSignIn() {}, onVerified() {},
  });
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

test('email send errors keep other messages and use the fallback when needed', () => {
  assert.equal(hookExports.EMAIL_RESEND_SECONDS, 60);
  assert.equal(hookExports.getEmailSendError(new Error('Signups not allowed'), 'Fallback'), 'Signups not allowed');
  assert.equal(hookExports.getEmailSendError(new Error(''), 'Fallback'), 'Fallback');
  assert.equal(hookExports.getEmailSendError('nope', 'Fallback'), 'Fallback');
});
