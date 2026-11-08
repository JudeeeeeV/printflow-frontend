const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function page() {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/ShopPrinterAgentPage/ShopPrinterAgentPage.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const effects = [];
  const reads = [];
  let printersListener;
  const jsx = (type, props) => ({ type, props });
  const window = { setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, addEventListener() {}, removeEventListener() {} };
  const mocks = {
    react: {
      useState: (initial) => [initial, () => {}],
      useCallback: (fn) => fn,
      useRef: (current) => ({ current }),
      useEffect: (effect) => effects.push(effect),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@carbon/icons-react': new Proxy({}, { get: (_, name) => String(name), has: () => true }),
    './PrinterAgentSkeleton': { PrinterAgentSkeleton: 'Skeleton' },
    '../../hooks/useDataEvents': { useDataEvents() {} },
    '../../services/daemonDeviceService': { daemonDeviceService: {
      listMine: () => new Promise((resolve) => reads.push(resolve)),
      latestRelease: () => new Promise(() => {}),
    } },
    '../../services/daemonSocketService': { daemonSocketService: {
      onPrintersList: (listener) => { printersListener = listener; return () => {}; },
    } },
  };
  vm.runInNewContext(compiled, {
    exports, window, document: { body: { style: {} } }, navigator: { userAgent: 'Windows' },
    require: (name) => { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); },
  });
  exports.ShopPrinterAgentPage();
  effects.forEach((effect) => effect());
  return { reads, push: (printers) => printersListener(printers) };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a re-inserted printer refreshes the page without a reload', async () => {
  const p = page();
  p.push([]);
  assert.equal(p.reads.length, 0, 'the initial list is not a change');
  p.push(['Desk']);
  assert.equal(p.reads.length, 1, 'plugging a printer back in reads the devices');
  p.reads[0]([]);
  await settle();
  p.push(['Desk']);
  assert.equal(p.reads.length, 1, 'the ten-second status reply with the same list reads nothing');
});

test('a change during a running read is read again afterwards', async () => {
  const p = page();
  p.push(['Desk']);
  p.push([]);
  assert.equal(p.reads.length, 1);
  p.push(['Desk']);
  assert.equal(p.reads.length, 1, 'only one read runs at a time');
  p.reads[0]([]);
  await settle();
  assert.equal(p.reads.length, 2, 'the change is not dropped');
  p.reads[1]([]);
  await settle();
  assert.equal(p.reads.length, 2, 'and it does not loop');
});
