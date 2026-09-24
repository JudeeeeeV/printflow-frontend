import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { getWalkingRoute, locateForDirections, parseWalkingRoute } from '../src/services/directionsService.ts';

const origin = [123.88, 10.295];
const destination = [123.89, 10.3];
const payload = { code: 'Ok', routes: [{ distance: 800, duration: 600, geometry: { type: 'LineString', coordinates: [origin, destination] } }] };
let now = Date.now();
beforeEach(() => { now += 2000; mock.method(Date, 'now', () => now); });
afterEach(() => mock.restoreAll());

test('parses a genuine path and preserves start and destination', () => {
  assert.deepEqual(parseWalkingRoute(payload, origin, destination), { ...payload.routes[0], origin, destination });
});
for (const code of ['NoRoute', 'NoSegment']) {
  test(`reports ${code} without inventing a straight-line route`, () => assert.throws(() => parseWalkingRoute({ code }, origin, destination), /No walking route/));
}
for (const bad of [null, {}, { code: 'Ok', routes: [] }, { code: 'Ok', routes: [{ ...payload.routes[0], duration: NaN }] }, { code: 'Ok', routes: [{ ...payload.routes[0], geometry: { type: 'LineString', coordinates: [[999, 0], [0, 0]] } }] }]) {
  test(`rejects malformed route response ${JSON.stringify(bad)}`, () => assert.throws(() => parseWalkingRoute(bad, origin, destination), /invalid route/));
}
test('requests a GeoJSON walking path without credentials', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(payload)));
  const route = await getWalkingRoute(origin, destination, new AbortController().signal);
  assert.equal(route.distance, 800);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url.origin, 'https://routing.openstreetmap.de');
  assert.ok(url.pathname.startsWith('/routed-foot/route/v1/driving/'));
  assert.equal(url.searchParams.get('geometries'), 'geojson');
  assert.equal(url.searchParams.get('radiuses'), '200;200');
  assert.equal(options.credentials, 'omit');
});
test('blocks repeated route requests within the provider rate limit', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(payload)));
  await getWalkingRoute(origin, destination, new AbortController().signal);
  await assert.rejects(getWalkingRoute(origin, destination, new AbortController().signal), /wait a moment/);
  assert.equal(fetch.mock.callCount(), 1);
});
test('handles provider downtime', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(getWalkingRoute(origin, destination, new AbortController().signal), /service is unavailable/);
});
test('cancels an in-flight route when the modal is closed', async () => {
  mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  const controller = new AbortController();
  const promise = getWalkingRoute(origin, destination, controller.signal);
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
});
test('requires secure context before asking for location', async () => {
  const watchPosition = mock.fn();
  await assert.rejects(locateForDirections(new AbortController().signal, { watchPosition }, false), /requires HTTPS/);
  assert.equal(watchPosition.mock.callCount(), 0);
});
test('stops the location watch after obtaining the origin', async () => {
  let success;
  const clearWatch = mock.fn();
  const promise = locateForDirections(new AbortController().signal, { watchPosition: callback => { success = callback; return 42; }, clearWatch }, true);
  const position = { coords: { latitude: origin[1], longitude: origin[0], accuracy: 10 } };
  success(position);
  assert.equal(await promise, position);
  assert.deepEqual(clearWatch.mock.calls[0].arguments, [42]);
});
for (const [code, message] of [[1, /permission was denied/], [2, /location is unavailable/], [3, /timed out/]]) {
  test(`handles geolocation error ${code} and stops watching`, async () => {
    let fail;
    const clearWatch = mock.fn();
    const promise = locateForDirections(new AbortController().signal, { watchPosition: (_success, error) => { fail = error; return 42; }, clearWatch }, true);
    fail({ code });
    await assert.rejects(promise, message);
    assert.equal(clearWatch.mock.callCount(), 1);
  });
}
test('cancels pending location and ignores late position callbacks', async () => {
  let success;
  const clearWatch = mock.fn();
  const controller = new AbortController();
  const promise = locateForDirections(controller.signal, { watchPosition: callback => { success = callback; return 42; }, clearWatch }, true);
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  success({ coords: { latitude: 0, longitude: 0 } });
  assert.equal(clearWatch.mock.callCount(), 1);
});
