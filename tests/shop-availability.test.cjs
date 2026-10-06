const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/services/shopAvailability.ts'),
  'utf8',
);
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText,
  { exports: exportsObject },
);

const { isShopOpen, sortByShopAvailability } = exportsObject;
const shop = {
  status: 'OPEN',
  availability_override: false,
  opens_at: '08:00',
  closes_at: '20:00',
  timezone: 'Asia/Manila',
};

test('scheduled shops close automatically at 8 PM Philippine time', () => {
  assert.equal(isShopOpen(shop, new Date('2026-10-06T11:59:00Z')), true);
  assert.equal(isShopOpen(shop, new Date('2026-10-06T12:00:00Z')), false);
});

test('manual ON keeps a shop open after its closing time', () => {
  assert.equal(
    isShopOpen(
      { ...shop, availability_override: true },
      new Date('2026-10-06T14:00:00Z'),
    ),
    true,
  );
});

test('open shops sort above closed shops while preserving distance order', () => {
  const now = new Date('2026-10-06T14:00:00Z');
  const entries = [
    { shop: { ...shop, id: 'closed-near' }, distance: 10 },
    {
      shop: { ...shop, id: 'open-near', availability_override: true },
      distance: 20,
    },
    {
      shop: { ...shop, id: 'open-far', availability_override: true },
      distance: 30,
    },
    { shop: { ...shop, id: 'closed-far' }, distance: 40 },
  ];

  assert.deepEqual(
    Array.from(sortByShopAvailability(entries, now), ({ shop: entry }) => entry.id),
    ['open-near', 'open-far', 'closed-near', 'closed-far'],
  );
  assert.deepEqual(Array.from(entries, ({ shop: entry }) => entry.id), [
    'closed-near',
    'open-near',
    'open-far',
    'closed-far',
  ]);
});
