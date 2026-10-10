const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null ? '' : String(node);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const image = (type = 'image/png', size = 100, name = 'image.png') => ({ name, type, size });

function hookFixture(file, exportName, mocks = {}, props = () => ({}), globals = {}) {
  const hooks = []; let cursor = 0, effects = [], tree, dirty;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { value: { current: initial } }; return hooks[index].value; },
    useId() { return `fixture-id-${cursor++}`; },
    useEffect(callback, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) effects.push(() => {
        previous?.cleanup?.(); hooks[index] = { deps, cleanup: callback() };
      });
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@carbon/icons-react') return new Proxy({}, { get: (_, name) => `icon-${name}` });
    if (name.endsWith('.css')) return { __esModule: true, default: { primaryButton: 'primary', secondaryButton: 'secondary', page: 'page' } };
    throw new Error(`Unexpected import ${name}`);
  } });
  const render = () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; effects = []; dirty = false; tree = exports[exportName](props()); effects.forEach(effect => effect());
      if (!dirty) return tree;
    }
    throw new Error('Render did not settle');
  };
  render();
  return { render, tree: () => tree, find: predicate => nodes(tree).find(predicate), button: label => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label),
    flush: async () => { await new Promise(resolve => setImmediate(resolve)); render(); }, unmount: () => hooks.forEach(hook => hook.cleanup?.()) };
}

function createSettingsFixture(options = {}) {
  const state = options.state || { name: 'Campus Print Shop', gcash_number: '09171234567', location: 'Student Center', description: 'Ground floor', latitude: 14.6, longitude: 121,
    availability_override: false, opens_at: '08:00:00', closes_at: '20:00:00', status: 'OPEN', shop_photo_url: 'saved-photo', gcash_qr_url: 'saved-qr' };
  const calls = [], created = [], revoked = [], events = [];
  const failures = {}, holds = {};
  let reads = 0, logoutGuard, shouldBlock, currentPath = '/shop-dashboard/settings', pendingPath, proceeded = 0, resets = 0;
  const blocker = { state: 'unblocked',
    proceed() { currentPath = pendingPath; proceeded++; blocker.state = 'unblocked'; },
    reset() { resets++; blocker.state = 'unblocked'; },
  };
  const registerLogoutGuard = guard => { logoutGuard = guard; };
  const listeners = new Map();
  const mutate = async (section, payload, commit) => {
    calls.push({ section, payload });
    if (holds[section]) await holds[section].promise;
    if (failures[section]) throw new Error(failures[section]);
    return commit();
  };
  const service = {
    getMyShop: async () => { reads++; if (options.readPending) await options.readPending.promise; if (options.readError?.()) throw new Error('offline'); return { ...state }; },
    updateSettings: payload => mutate('name' in payload ? 'details' : 'latitude' in payload ? 'pickup' : 'gcash_number' in payload ? 'qr' : 'availability', payload, () => {
      Object.assign(state, payload);
      for (const key of ['name', 'location', 'description']) if (typeof state[key] === 'string') state[key] = state[key].trim();
      return { ...state };
    }),
    uploadShopPhoto: file => mutate('photo', file, () => { state.shop_photo_url = `saved-${file.name}`; return { shop_photo_url: state.shop_photo_url }; }),
    uploadGcashQr: file => mutate('qr', file, () => { state.gcash_qr_url = `saved-${file.name}`; return { gcash_qr_url: state.gcash_qr_url }; }),
    removeGcashQr: () => mutate('qr', 'remove', () => { state.gcash_qr_url = null; return { gcash_qr_url: null }; }),
  };
  const globals = { document: { activeElement: {} }, window: { dispatchEvent: event => events.push(event),
    addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, requestAnimationFrame: callback => { callback(); return 1; },
    URL: { createObjectURL: file => { const url = `blob:settings-${created.length}`; created.push({ file, url }); return url; }, revokeObjectURL: url => revoked.push(url) } };
  const f = hookFixture('pages/ShopSettingsPage/ShopSettingsPage.tsx', 'ShopSettingsPage', {
    'framer-motion': { AnimatePresence: 'presence', motion: { div: 'motion-div' }, useReducedMotion: () => false },
    'react-router-dom': { useBlocker: predicate => { shouldBlock = predicate; return blocker; }, useOutletContext: () => ({ registerLogoutGuard }) },
    '../../services/shopService': { shopService: service },
    '../../hooks/useDataEvents': { useDataEvents: () => {} },
    '../../components/maps/ShopPhotoUpload': { ShopPhotoUpload: 'photo-editor' },
    '../../components/settings/ShopGcashQrForm': { ShopGcashQrForm: 'qr-editor' },
    '../../components/maps/LocationMapModal': { LocationMapModal: 'map-dialog' },
    '../../components/maps/coordinates': { hasCoordinates: (lat, lng) => typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180 },
    './UnsavedSettingsModal': { UnsavedSettingsModal: 'navigation-modal' },
  }, undefined, globals);
  const field = id => f.find(node => node.props?.id === id);
  return { ...f, state, service, calls, created, revoked, events, failures, holds, reads: () => reads,
    blocker, listeners, path: () => currentPath, proceeded: () => proceeded, resets: () => resets,
    navigate(path, historyAction = 'PUSH') {
      if (shouldBlock({ currentLocation: { pathname: currentPath }, nextLocation: { pathname: path }, historyAction })) { pendingPath = path; blocker.state = 'blocked'; }
      else currentPath = path;
      f.render();
    },
    requestLogout(logout) { if (logoutGuard) logoutGuard(logout); else logout(); f.render(); },
    navigationModal: () => f.find(node => node.type === 'navigation-modal')?.props,
    save: () => f.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }),
    field, edit: (id, value) => { field(id).props.onChange({ target: { value } }); f.render(); },
    photo: () => f.find(node => node.type === 'photo-editor').props, qr: () => f.find(node => node.type === 'qr-editor').props,
    switch: () => { f.find(node => node.props?.role === 'switch').props.onClick(); f.render(); },
    pin: (latitude, longitude) => { f.button('Edit location')?.props.onClick() || f.button('Set location on map')?.props.onClick(); f.render();
      const map = f.find(node => node.type === 'map-dialog'); map.props.onConfirm(latitude, longitude); map.props.onClose(); f.render(); },
    allChanges() { this.edit('settings-shop-name', 'Updated Shop'); this.pin(14.7, 121.1); this.switch(); this.photo().onSelect(image('image/png', 100, 'photo.png')); this.qr().onSelect(image('image/png', 100, 'qr.png')); f.render(); },
    contents: () => text(f.tree()),
  };
}

module.exports = { hookFixture, createSettingsFixture, nodes, text, image, deferred };
