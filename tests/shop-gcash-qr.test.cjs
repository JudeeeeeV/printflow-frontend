const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { hookFixture, image } = require('./shop-settings-fixture.cjs');

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function qrFixture(savedUrl = null) {
  const calls = [];
  const props = { gcashNumber: '09171234567', savedUrl, selectedFile: null, localUrl: null, pendingRemoval: false, disabled: false, onNumberChange: value => calls.push(value), onSelect: file => calls.push(file), onRemove: () => calls.push('remove') };
  const f = hookFixture('components/settings/ShopGcashQrForm.tsx', 'ShopGcashQrForm', {}, () => props);
  return { ...f, props, calls };
}

test('renders controlled saved and empty QR previews without a separate Save form', () => {
  for (const saved of [null, 'saved-qr']) {
    const f = qrFixture(saved);
    assert.equal(f.find(node => node.type === 'form'), undefined); assert.equal(f.button('Save QR code'), undefined);
    assert.equal(f.find(node => node.type === 'img')?.props.src, saved || undefined);
    assert.equal(Boolean(f.button('Remove')), Boolean(saved));
    assert.equal(f.calls.length, 0); f.unmount();
  }
});

test('delegates image selection and resets the input without changing saved data', () => {
  const f = qrFixture('saved-qr'); const file = image();
  for (let attempt = 0; attempt < 2; attempt++) {
    const event = { target: { files: [file], value: 'selected' } };
    f.find(node => node.props?.id === 'shop-gcash-qr-image').props.onChange(event); assert.equal(event.target.value, ''); assert.equal(f.calls[attempt], file);
  }
  assert.equal(f.find(node => node.type === 'img').props.src, 'saved-qr');
  f.props.selectedFile = file; f.props.localUrl = 'blob:preview'; f.render();
  assert.equal(f.find(node => node.type === 'img').props.src, 'blob:preview'); f.unmount();
});

test('allows manual entry and normalizes the GCash number to eleven digits', () => {
  const f = qrFixture('saved-qr');
  const input = f.find(node => node.props?.id === 'shop-gcash-number');
  assert.equal(input.props.value, '09171234567');
  input.props.onChange({ target: { value: '0917 123-456789' } });
  assert.deepEqual(f.calls, ['09171234567']);
  f.unmount();
});

test('delegates removal and displays the pending-removal state', () => {
  const f = qrFixture('saved-qr'); f.button('Remove').props.onClick(); assert.deepEqual(f.calls, ['remove']);
  assert.equal(f.find(node => node.type === 'img').props.src, 'saved-qr');
  f.props.pendingRemoval = true; f.render(); assert.equal(f.find(node => node.type === 'img'), undefined);
  assert.ok(f.find(node => node.props?.role === 'status').props.children.includes('removed when you save'));
  f.props.selectedFile = image(); f.props.localUrl = 'blob:new'; f.props.pendingRemoval = false; f.render(); assert.equal(f.find(node => node.type === 'img').props.src, 'blob:new'); f.unmount();
});

test('disables all QR controls during a unified save', () => {
  const f = qrFixture('saved-qr'); f.props.disabled = true; f.render();
  assert.equal(f.button('Change image').props.disabled, true); assert.equal(f.button('Remove').props.disabled, true);
  assert.equal(f.find(node => node.props?.id === 'shop-gcash-number').props.disabled, true);
  const event = { target: { files: [image()], value: 'selected' } }; f.find(node => node.props?.id === 'shop-gcash-qr-image').props.onChange(event);
  assert.equal(event.target.value, ''); assert.equal(f.calls.length, 0); f.unmount();
});

test('failed QR images retain replacement and removal controls', () => {
  const f = qrFixture('saved-qr'); f.find(node => node.type === 'img').props.onError(); f.render();
  assert.ok(f.find(node => node.props?.role === 'alert')); assert.ok(f.button('Remove'));
  f.props.selectedFile = image(); f.props.localUrl = 'blob:replacement'; f.render();
  assert.equal(f.find(node => node.type === 'img').props.src, 'blob:replacement');
  f.props.error = 'Unable to save your QR code'; f.render(); assert.ok(f.find(node => node.props?.children === f.props.error)); f.unmount();
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

test('shop settings service sends partial settings and multipart photo uploads', async () => {
  const calls = [];
  const exports = {};
  vm.runInNewContext(compile('services/shopService.ts'), {
    exports, FormData,
    require: () => ({ apiClient: async (route, options) => {
      calls.push({ route, options });
      return { name: 'Shop', shop_photo_url: 'saved-photo' };
    } }),
  });
  const values = { availability_override: true, opens_at: '08:00', closes_at: '20:00' };
  await exports.shopService.updateSettings(values);
  assert.equal(calls[0].route, '/shops/me'); assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), values);
  const file = new File(['photo'], 'photo.png', { type: 'image/png' });
  assert.equal((await exports.shopService.uploadShopPhoto(file)).shop_photo_url, 'saved-photo');
  assert.equal(calls[1].route, '/shops/me/photo'); assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.body.get('photo'), file);
  assert.deepEqual([...calls[1].options.body.keys()], ['photo']);
});
