const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Run the real form handlers/effects with controlled hooks and requests. Browser
// layout and focus behavior are checked separately; this needs no DOM dependency.
function formFixture(saved = null, overrides = {}, props = {}) {
  const calls = { upload: [], remove: 0, read: 0, created: [], revoked: [] };
  let savedUrl = saved;
  const service = {
    getGcashQr: async () => { calls.read++; return { gcash_qr_url: savedUrl }; },
    uploadGcashQr: async file => { calls.upload.push(file); savedUrl = 'https://example.test/new-qr'; return { gcash_qr_url: savedUrl }; },
    removeGcashQr: async () => { calls.remove++; savedUrl = null; return { gcash_qr_url: null }; },
    ...overrides,
  };
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: { current: initial } };
      return hooks[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile('components/settings/ShopGcashQrForm.tsx'), {
    exports, Error,
    URL: {
      createObjectURL: file => { const url = `blob:qr-${calls.created.length}`; calls.created.push({ file, url }); return url; },
      revokeObjectURL: url => calls.revoked.push(url),
    },
    require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === '../../services/shopService') return { shopService: service };
      if (name === '../maps/Maps.module.css') return { default: { primaryButton: 'primary', secondaryButton: 'secondary' } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const render = () => {
    cursor = 0; effects = [];
    tree = exports.ShopGcashQrForm(props);
    effects.forEach(effect => effect());
    return tree;
  };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === 'button' && node.props.children === label);
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  const select = file => {
    const event = { target: { files: [file], value: 'selected' } };
    find(node => node.type === 'input').props.onChange(event);
    render();
    assert.equal(event.target.value, '', 'selection resets so the same file can be chosen again');
  };
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const unmount = () => hooks.forEach(hook => hook.cleanup?.());
  render();
  return { calls, service, render, flush, find, button, select, submit, unmount };
}

const image = (type = 'image/png', size = 100) => ({ name: 'qr.png', type, size });

test('signals readiness only after the saved preview loads or fails', async () => {
  for (const event of ['onLoad', 'onError']) {
    let ready = false;
    const request = deferred();
    const f = formFixture(null, { getGcashQr: () => request.promise }, { onReady: () => { ready = true; } });
    assert.equal(ready, false);
    request.resolve({ gcash_qr_url: 'https://example.test/saved-qr' });
    await f.flush();
    assert.equal(ready, false);
    f.find(node => node.type === 'img').props[event](); f.render();
    assert.equal(ready, true);
    f.unmount();
  }
});

test('empty QR and load failures finish loading without waiting for an image', async () => {
  for (const service of [{}, { getGcashQr: () => Promise.reject(new Error('offline')) }]) {
    let ready = false;
    const f = formFixture(null, service, { onReady: () => { ready = true; } });
    await f.flush();
    assert.equal(ready, true);
    f.unmount();
  }
});

function modalFixture() {
  const values = [];
  let cursor;
  let tree;
  const ProfileNameForm = () => {};
  const AccountSettingsSkeleton = () => {};
  const exports = {};
  vm.runInNewContext(compile('components/auth/ChangePasswordModal.tsx'), {
    exports, document: { body: {} },
    require: name => {
      if (name === 'react') return {
        useState(initial) {
          const index = cursor++;
          if (!(index in values)) values[index] = initial;
          return [values[index], value => { values[index] = value; }];
        },
        useEffect() {},
        useRef: value => ({ current: value }),
        useCallback: callback => callback,
      };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === './ProfileNameForm') return { ProfileNameForm };
      if (name === './AccountSettingsSkeleton') return { AccountSettingsSkeleton };
      if (name === './SubmitButton/SubmitButton') return { SubmitButton: () => {} };
      if (name === '../../services/authService') return { authService: {} };
      if (name === '@carbon/icons-react') return {};
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    tree = exports.ChangePasswordModal({ onClose() {} });
  };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const find = predicate => nodes(tree).find(predicate);
  render();
  return {
    loading: () => find(node => 'hidden' in (node.props || {})).props.hidden,
    hasSkeleton: () => Boolean(find(node => node.type === AccountSettingsSkeleton)),
    ready() {
      find(node => node.type === ProfileNameForm).props.onReady();
      render();
    },
  };
}

test('account settings finish loading after the profile is ready', () => {
  const f = modalFixture();
  assert.equal(f.loading(), true);
  f.ready();
  assert.equal(f.loading(), false);
  assert.equal(f.hasSkeleton(), false);
});

test('loads saved and empty QR states with saving initially disabled', async () => {
  for (const saved of [null, 'https://example.test/saved-qr']) {
    const f = formFixture(saved);
    assert.equal(f.find(node => node.props?.role === 'status').props.children, 'Loading your GCash QR code...');
    await f.flush();
    assert.equal(f.button('Save QR code').props.disabled, true);
    assert.equal(f.find(node => node.type === 'img')?.props.src, saved || undefined);
    assert.equal(Boolean(f.button('Remove')), Boolean(saved));
    f.unmount();
  }
});

test('replaces local previews, rejects invalid selections without losing the edit, and revokes URLs', async () => {
  const f = formFixture('https://example.test/saved-qr');
  await f.flush();
  const selected = image();
  f.select(selected);
  assert.equal(f.find(node => node.type === 'img').props.src, 'blob:qr-0');
  assert.equal(f.button('Save QR code').props.disabled, false);
  for (const invalid of [image('image/gif'), image('image/png', 0), image('image/png', 10 * 1024 * 1024 + 1)]) {
    f.select(invalid);
    assert.ok(f.find(node => node.props?.role === 'alert'));
    assert.equal(f.find(node => node.type === 'img').props.src, 'blob:qr-0');
  }
  f.select(selected);
  assert.deepEqual(f.calls.revoked, ['blob:qr-0']);
  assert.equal(f.find(node => node.type === 'img').props.src, 'blob:qr-1');
  f.unmount();
  assert.deepEqual(f.calls.revoked, ['blob:qr-0', 'blob:qr-1']);
  assert.equal(f.calls.upload.length, 0);
});

test('accepts all supported MIME types at the 10 MB boundary', async () => {
  const f = formFixture();
  await f.flush();
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    f.select(image(type, 10 * 1024 * 1024));
    assert.equal(f.button('Save QR code').props.disabled, false);
    assert.equal(f.find(node => node.props?.role === 'alert'), undefined);
  }
  f.unmount();
});

test('choosing then removing an image with no saved QR restores the unchanged state', async () => {
  const f = formFixture();
  await f.flush();
  f.select(image());
  f.button('Remove').props.onClick(); f.render();
  assert.equal(f.button('Save QR code').props.disabled, true);
  await f.submit();
  assert.equal(f.calls.remove, 0);
  assert.equal(f.calls.upload.length, 0);
  assert.deepEqual(f.calls.revoked, ['blob:qr-0']);
});

test('removal stays local until Save, then reopening reads the saved empty state', async () => {
  const f = formFixture('https://example.test/saved-qr');
  await f.flush();
  f.button('Remove').props.onClick(); f.render();
  assert.equal(f.calls.remove, 0);
  assert.equal(f.button('Save QR code').props.disabled, false);
  assert.equal(f.find(node => node.type === 'img'), undefined);
  await f.submit(); f.render();
  assert.equal(f.calls.remove, 1);
  assert.equal(f.button('Save QR code').props.disabled, true);
  f.unmount();
  const reopened = formFixture(null, f.service);
  await reopened.flush();
  assert.equal(reopened.find(node => node.type === 'img'), undefined);
  reopened.unmount();
});

test('choosing a replacement after removal saves the upload instead of deleting', async () => {
  const f = formFixture('https://example.test/saved-qr');
  await f.flush();
  f.button('Remove').props.onClick(); f.render();
  const selected = image();
  f.select(selected);
  await f.submit(); f.render();
  assert.deepEqual(f.calls.upload, [selected]);
  assert.equal(f.calls.remove, 0);
  assert.equal(f.find(node => node.type === 'img').props.src, 'https://example.test/new-qr');
  assert.equal(f.button('Save QR code').props.disabled, true);
  assert.deepEqual(f.calls.revoked, ['blob:qr-0']);
  f.unmount();
  const reopened = formFixture(null, f.service);
  await reopened.flush();
  assert.equal(reopened.find(node => node.type === 'img').props.src, 'https://example.test/new-qr');
  reopened.unmount();
});

test('failed uploads and removals preserve pending edits for retry and disable controls while saving', async () => {
  for (const mutation of ['uploadGcashQr', 'removeGcashQr']) {
    const pending = deferred();
    let requests = 0;
    const f = formFixture('https://example.test/saved-qr', {
      [mutation]: () => ++requests === 1 ? pending.promise : Promise.resolve({ gcash_qr_url: mutation === 'uploadGcashQr' ? 'new-qr' : null }),
    });
    await f.flush();
    if (mutation === 'uploadGcashQr') f.select(image());
    else { f.button('Remove').props.onClick(); f.render(); }
    const saving = f.submit(); f.render();
    assert.equal(f.button('Saving...').props.disabled, true);
    assert.equal(f.button(mutation === 'uploadGcashQr' ? 'Change image' : 'Choose image').props.disabled, true);
    pending.reject(new Error('offline')); await saving; f.render();
    assert.equal(f.find(node => node.props?.role === 'alert').props.children, 'offline');
    assert.equal(f.button('Save QR code').props.disabled, false);
    if (mutation === 'uploadGcashQr') assert.equal(f.find(node => node.type === 'img').props.src, 'blob:qr-0');
    await f.submit(); f.render();
    assert.equal(requests, 2);
    assert.equal(f.button('Save QR code').props.disabled, true);
    f.unmount();
  }
});

test('a failed initial load offers retry and never enables mutations before loading succeeds', async () => {
  let reads = 0;
  const f = formFixture(null, { getGcashQr: async () => {
    if (++reads === 1) throw new Error('offline');
    return { gcash_qr_url: null };
  } });
  await f.flush();
  assert.equal(f.find(node => node.type === 'form'), undefined);
  f.button('Retry').props.onClick(); f.render();
  await f.flush();
  assert.equal(f.button('Save QR code').props.disabled, true);
  f.unmount();
});

test('failed images show an alert and keep replacement/removal available', async () => {
  const f = formFixture('https://example.test/saved-qr');
  await f.flush();
  f.find(node => node.type === 'img').props.onError(); f.render();
  assert.ok(f.find(node => node.props?.role === 'alert'));
  assert.ok(f.button('Remove'));
  f.select(image());
  assert.ok(f.find(node => node.type === 'img'));
  f.unmount();
});

test('closing discards unsaved replacements and removals; late loads cannot update an unmounted form', async () => {
  for (const edit of ['replace', 'remove']) {
    const f = formFixture('https://example.test/saved-qr');
    await f.flush();
    if (edit === 'replace') f.select(image());
    else { f.button('Remove').props.onClick(); f.render(); }
    f.unmount();
    const reopened = formFixture(null, f.service);
    await reopened.flush();
    assert.equal(reopened.find(node => node.type === 'img').props.src, 'https://example.test/saved-qr');
    assert.equal(reopened.button('Save QR code').props.disabled, true);
    reopened.unmount();
  }
  const pending = deferred();
  const f = formFixture(null, { getGcashQr: () => pending.promise });
  f.unmount();
  pending.resolve({ gcash_qr_url: 'late-qr' });
  await f.flush();
  assert.equal(f.find(node => node.type === 'form'), undefined);
});

test('shop QR service uses GET shops/me, multipart qrCode upload, and DELETE without a shop ID', async () => {
  const calls = [];
  const exports = {};
  vm.runInNewContext(compile('services/shopService.ts'), {
    exports, FormData,
    require: name => {
      if (name === './apiClient') return { apiClient: async (route, options) => {
        calls.push({ route, options });
        return { id: 'shop-a', gcash_qr_url: options?.method === 'DELETE' ? null : 'saved-qr' };
      } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.equal((await exports.shopService.getGcashQr()).gcash_qr_url, 'saved-qr');
  const file = new File(['image'], 'qr.png', { type: 'image/png' });
  await exports.shopService.uploadGcashQr(file);
  assert.equal(calls[1].route, '/shops/gcash-qr');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body.get('qrCode'), file);
  assert.equal((await exports.shopService.removeGcashQr()).gcash_qr_url, null);
  assert.equal(calls[0].route, '/shops/me');
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(calls[2].options.body, undefined);
});
