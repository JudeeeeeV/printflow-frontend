const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, globals = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, setTimeout, clearTimeout, DOMException, ...globals,
    require: name => load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), name.endsWith('.ts') ? name : `${name}.ts`)), globals),
  });
  return exports;
}

const { distanceToShop, sortShopsByDistance, formatShopDistance } = load('services/shopDistance.ts');
const origin = { latitude: 0, longitude: 0 };

test('computes known distances including zero and longitude wraparound', () => {
  assert.equal(distanceToShop(origin, origin), 0);
  assert.ok(Math.abs(distanceToShop(origin, { latitude: 0, longitude: 1 }) - 111194.9) < 0.1);
  assert.ok(Math.abs(distanceToShop({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }) - 22239) < 1);
  assert.ok(Number.isFinite(distanceToShop(origin, { latitude: 0, longitude: 180 })));
});

test('invalid or missing pins are unavailable, not treated as zero distance', () => {
  for (const pin of [{}, { latitude: null, longitude: null }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: '0', longitude: '0' }]) {
    assert.equal(distanceToShop(origin, pin), null);
  }
  assert.equal(distanceToShop({ latitude: NaN, longitude: 0 }, origin), null);
});

test('sorts the full list nearest-first before three-shop pagination without mutating it', () => {
  const shops = [7, 6, 5, 4, 3, 2, 1].map(n => ({ id: `shop-${n}`, latitude: 0, longitude: n / 1000 }));
  const before = JSON.stringify(shops);
  const sorted = sortShopsByDistance(shops, origin);
  assert.deepEqual(Array.from(sorted.slice(0, 3), entry => entry.shop.id), ['shop-1', 'shop-2', 'shop-3']);
  assert.deepEqual(Array.from(sorted.slice(3, 6), entry => entry.shop.id), ['shop-4', 'shop-5', 'shop-6']);
  assert.deepEqual(Array.from(sorted.slice(6, 9), entry => entry.shop.id), ['shop-7']);
  assert.equal(JSON.stringify(shops), before);
});

test('equal-distance shops retain order and shops without coordinates sort last', () => {
  const shops = [{ id: 'no-pin' }, { id: 'first', ...origin }, { id: 'second', ...origin }, { id: 'invalid', latitude: 95, longitude: 0 }];
  assert.deepEqual(Array.from(sortShopsByDistance(shops, origin), entry => entry.shop.id), ['first', 'second', 'no-pin', 'invalid']);
  const unavailable = sortShopsByDistance(shops, null);
  assert.deepEqual(Array.from(unavailable, entry => entry.shop.id), shops.map(shop => shop.id));
  assert.ok(unavailable.every(entry => entry.distance === null));
});

test('formats metres and kilometres with one decimal place', () => {
  for (const [value, expected] of [[0, '0.0 m'], [250.04, '250.0 m'], [999, '999.0 m'], [1000, '1.0 km'], [1250, '1.3 km']]) {
    assert.equal(formatShopDistance(value), expected);
  }
});

function locationFixture() {
  const timers = new Map();
  const cleared = [];
  let success, failure;
  const geolocation = {
    watchPosition: (yes, no) => { success = yes; failure = no; return 7; },
    clearWatch: id => cleared.push(id),
  };
  const { locateForDirections } = load('services/directionsService.ts', {
    setTimeout: callback => { timers.set(1, callback); return 1; },
    clearTimeout: id => timers.delete(id),
  });
  const controller = new AbortController();
  return { locateForDirections, controller, geolocation, timers, cleared,
    succeed: coords => success({ coords }), fail: code => failure({ code }),
  };
}

test('location lookup releases its watch after obtaining coordinates', async () => {
  const f = locationFixture();
  const pending = f.locateForDirections(f.controller.signal, f.geolocation, true);
  f.succeed({ latitude: 10.3, longitude: 123.8 });
  assert.equal((await pending).coords.latitude, 10.3);
  assert.deepEqual(f.cleared, [7]);
  assert.equal(f.timers.size, 0);
});

test('location denial, timeout, and cancellation release the watch', async () => {
  for (const failure of ['denied', 'timeout', 'aborted']) {
    const f = locationFixture();
    const pending = f.locateForDirections(f.controller.signal, f.geolocation, true);
    const rejected = assert.rejects(pending, failure === 'denied' ? /permission was denied/ : failure === 'timeout' ? /timed out/ : /cancelled/);
    if (failure === 'denied') f.fail(1);
    else if (failure === 'timeout') f.timers.get(1)();
    else f.controller.abort();
    await rejected;
    assert.deepEqual(f.cleared, [7]);
    assert.equal(f.timers.size, 0);
  }
});

test('unsupported and insecure browsers report a location error', async () => {
  const f = locationFixture();
  await assert.rejects(f.locateForDirections(f.controller.signal, undefined, true), /does not support/);
  await assert.rejects(f.locateForDirections(f.controller.signal, f.geolocation, false), /requires HTTPS/);
});
