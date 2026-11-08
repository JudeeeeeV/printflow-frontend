const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/daemonSocketService.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function setup() {
  const sockets = [];
  const intervals = new Map();
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  let now = 100_000;
  let timerId = 0;
  class MockSocket extends EventEmitter {
    connected = false;
    active = true;
    sent = [];
    reconnects = 0;
    emit(name, data) { this.sent.push({ name, data }); return true; }
    connect() { this.reconnects++; this.active = true; }
    disconnect() { this.connected = false; this.active = false; }
    receive(name, data) {
      if (name === 'connect') { this.connected = true; this.active = true; }
      if (name === 'disconnect') { this.connected = false; this.active = data !== 'io server disconnect'; }
      super.emit(name, data);
    }
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window, document,
    Date: { now: () => now },
    setInterval: (callback, delay) => { intervals.set(++timerId, { callback, delay }); return timerId; },
    clearInterval: (id) => intervals.delete(id),
    require: (name) => {
      if (name === '../config/runtime') return { API_URL: 'https://test.invalid' };
      if (name === 'socket.io-client') return { io: () => { const socket = new MockSocket(); sockets.push(socket); return socket; } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const service = exports.daemonSocketService;
  const statuses = [];
  const printerLists = [];
  service.onStatusChange((status) => statuses.push(status));
  service.onPrintersList((printers) => printerLists.push([...printers]));
  return {
    service, sockets, intervals, window, document, statuses, printerLists,
    tick: (milliseconds = 10_000) => { now += milliseconds; for (const { callback } of intervals.values()) callback(); },
  };
}

test('checks immediately, every ten seconds, and updates offline to online without reloading', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  socket.receive('daemon_status', { status: 'OFFLINE' });
  assert.equal(socket.sent.length, 1);
  assert.equal([...h.intervals.values()][0].delay, 10_000);
  h.tick();
  assert.equal(socket.sent.length, 2);
  assert.equal(socket.sent[1].name, 'check_daemon_status');
  socket.receive('daemon_status', { status: 'CONNECTED' });
  socket.receive('printers_list', ['Desk']);
  assert.equal(h.statuses.at(-1), 'CONNECTED');
  assert.deepEqual(h.printerLists.at(-1), ['Desk']);
});

test('clears printers on an offline update and on lost connectivity', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  socket.receive('daemon_status', { status: 'CONNECTED' });
  socket.receive('printers_list', ['Desk']);
  socket.receive('daemon_status', { status: 'OFFLINE' });
  assert.deepEqual(h.printerLists.at(-1), []);
  socket.receive('daemon_status', { status: 'CONNECTED' });
  socket.receive('printers_list', ['Desk']);
  socket.receive('disconnect', 'transport close');
  assert.equal(h.statuses.at(-1), 'RECONNECTING');
  assert.deepEqual(h.printerLists.at(-1), []);
});

test('retries a server disconnect without interrupting automatic transport retries', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('disconnect', 'transport close');
  h.tick();
  assert.equal(socket.reconnects, 0);
  socket.receive('disconnect', 'io server disconnect');
  h.tick();
  assert.equal(socket.reconnects, 1);
});

test('checks on focus, restored network, and returning to a visible tab', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  h.window.dispatchEvent(new Event('focus'));
  h.window.dispatchEvent(new Event('online'));
  h.document.visibilityState = 'hidden';
  h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(socket.sent.length, 3);
  h.document.visibilityState = 'visible';
  h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(socket.sent.length, 4);
});

test('clears stale online state when status replies stop', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  socket.receive('daemon_status', { status: 'CONNECTED' });
  socket.receive('printers_list', ['Desk']);
  h.tick(30_000);
  assert.equal(h.statuses.at(-1), 'RECONNECTING');
  assert.deepEqual(h.printerLists.at(-1), []);
});

test('late subscribers receive current state and printer removal updates', () => {
  const h = setup();
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  socket.receive('daemon_status', { status: 'CONNECTED' });
  socket.receive('printers_list', ['Desk']);
  let status;
  let printers;
  h.service.onStatusChange((value) => { status = value; });
  h.service.onPrintersList((value) => { printers = [...value]; });
  assert.equal(status, 'CONNECTED');
  assert.deepEqual(printers, ['Desk']);
  socket.receive('printers_list', []);
  assert.deepEqual(printers, []);
});

test('does not duplicate polling and removes timers and browser listeners on cleanup', () => {
  const h = setup();
  h.service.connect('shop-1');
  h.service.connect('shop-1');
  assert.equal(h.intervals.size, 1);
  assert.equal(h.sockets.length, 1);
  const socket = h.sockets[0];
  socket.receive('connect');
  const sent = socket.sent.length;
  h.service.disconnect();
  h.tick();
  h.window.dispatchEvent(new Event('focus'));
  h.window.dispatchEvent(new Event('online'));
  h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.intervals.size, 0);
  assert.equal(socket.sent.length, sent);
  assert.equal(socket.listenerCount('connect'), 0);
});

test('switches shops without keeping the old socket or printer list', () => {
  const h = setup();
  h.service.connect('shop-1');
  const old = h.sockets[0];
  old.receive('connect');
  old.receive('daemon_status', { status: 'CONNECTED' });
  old.receive('printers_list', ['Old shop']);
  h.service.connect('shop-2');
  const next = h.sockets[1];
  next.receive('connect');
  assert.equal(old.connected, false);
  assert.equal(h.intervals.size, 1);
  assert.deepEqual(h.printerLists.at(-1), []);
  assert.equal(next.sent[0].data.shopId, 'shop-2');
});

test('reports an older agent as update-required and clears it when offline or replaced', () => {
  const h = setup();
  const required = [];
  h.service.onUpdateRequired((value) => required.push(value));
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('connect');
  socket.receive('daemon_status', { status: 'CONNECTED', agentUpdateRequired: true });
  assert.equal(required.at(-1), true);
  assert.equal(h.statuses.at(-1), 'CONNECTED');
  socket.receive('daemon_status', { status: 'OFFLINE' });
  assert.equal(required.at(-1), false);
  socket.receive('daemon_status', { status: 'CONNECTED', agentUpdateRequired: true });
  socket.receive('daemon_status', { status: 'CONNECTED' });
  assert.equal(required.at(-1), false);
});

test('forwards only attempt-bound progress events', () => {
  const h = setup();
  const progress = [];
  h.service.onJobProgress((value) => progress.push(value));
  h.service.connect('shop-1');
  const socket = h.sockets[0];
  socket.receive('job_progress', { orderId: 'order', status: 'COMPLETED' });
  socket.receive('job_progress', { attemptId: 'attempt', orderId: 'order', status: 'SUBMITTED', attemptNumber: 1, updatedAt: '2026-11-08T00:00:00Z' });
  assert.deepEqual(progress.map((item) => item.attemptId), ['attempt']);
});
