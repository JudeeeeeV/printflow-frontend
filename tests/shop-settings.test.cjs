const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSettingsFixture, hookFixture, image, deferred, nodes } = require('./shop-settings-fixture.cjs');

const select = (f, section, file = image()) => { f[section]().onSelect(file); f.render(); };

test('only blocks leaving settings when a section has pending edits', async () => {
  const clean = createSettingsFixture(); await clean.flush(); clean.navigate('/shop-dashboard/analytics');
  assert.equal(clean.navigationModal(), undefined); assert.equal(clean.path(), '/shop-dashboard/analytics'); clean.unmount();
  for (const section of ['details', 'pickup', 'availability', 'photo', 'qr']) {
    const f = createSettingsFixture(); await f.flush();
    if (section === 'details') f.edit('settings-shop-name', 'Changed');
    else if (section === 'pickup') f.pin(15, 122);
    else if (section === 'availability') f.switch();
    else select(f, section);
    f.navigate('/shop-dashboard/settings'); assert.equal(f.navigationModal(), undefined);
    f.navigate('/shop-dashboard/analytics'); assert.ok(f.navigationModal()); assert.equal(f.path(), '/shop-dashboard/settings');
    f.navigationModal().onLeave(); f.render();
    assert.equal(f.path(), '/shop-dashboard/analytics'); assert.equal(f.proceeded(), 1); assert.equal(f.calls.length, 0);
    f.unmount(); assert.deepEqual(f.revoked, f.created.map(item => item.url));
  }
});

test('dismissing confirmation keeps edits and browser history navigation can be retried', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges();
  f.navigate('/shop-dashboard', 'POP'); f.navigationModal().onDismiss(); f.render();
  assert.equal(f.navigationModal(), undefined); assert.equal(f.path(), '/shop-dashboard/settings'); assert.equal(f.resets(), 1);
  assert.equal(f.field('settings-shop-name').props.value, 'Updated Shop'); assert.ok(f.qr().selectedFile);
  f.navigate('/shop-dashboard/printer-agent', 'POP'); f.navigationModal().onLeave();
  assert.equal(f.path(), '/shop-dashboard/printer-agent'); assert.equal(f.calls.length, 0); f.unmount();
});

test('Save Changes waits for every pending section before continuing navigation', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); const hold = deferred(); f.holds.qr = hold;
  f.navigate('/shop-dashboard/analytics'); const saving = f.navigationModal().onSave(); f.render();
  assert.equal(f.navigationModal().busy, true); assert.equal(f.path(), '/shop-dashboard/settings');
  f.navigationModal().onLeave(); f.navigationModal().onDismiss(); await f.navigationModal().onSave(); f.render();
  assert.equal(f.proceeded(), 0); assert.equal(f.resets(), 0); assert.equal(f.calls.length, 5);
  hold.resolve(); await saving; f.render();
  assert.equal(f.path(), '/shop-dashboard/analytics'); assert.equal(f.proceeded(), 1);
  assert.equal(f.qr().selectedFile, null); assert.equal(f.photo().selectedFile, null); f.unmount();
});

test('navigation save failures remain in the modal and retry only failed edits', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); f.failures.qr = 'QR upload offline';
  f.navigate('/shop-dashboard/analytics'); await f.navigationModal().onSave(); f.render();
  assert.equal(f.path(), '/shop-dashboard/settings'); assert.equal(f.proceeded(), 0); assert.equal(f.navigationModal().busy, false);
  assert.match(f.navigationModal().feedback, /Saved: Shop details/); assert.match(f.navigationModal().feedback, /GCash QR code: QR upload offline/);
  assert.equal(f.qr().localUrl, 'blob:settings-1'); assert.equal(f.photo().selectedFile, null);
  delete f.failures.qr; await f.navigationModal().onSave(); f.render();
  assert.equal(f.path(), '/shop-dashboard/analytics'); assert.deepEqual(f.calls.slice(5).map(call => call.section), ['qr']); f.unmount();
});

test('invalid settings keep navigation blocked until the user repairs or discards them', async () => {
  const f = createSettingsFixture(); await f.flush(); f.edit('settings-shop-name', ' '); f.navigate('/shop-dashboard');
  await f.navigationModal().onSave(); f.render();
  assert.match(f.navigationModal().feedback, /Enter a shop name/); assert.equal(f.calls.length, 0); assert.equal(f.proceeded(), 0);
  f.navigationModal().onDismiss(); f.render(); f.edit('settings-shop-name', 'Repaired'); f.navigate('/shop-dashboard');
  await f.navigationModal().onSave(); assert.equal(f.path(), '/shop-dashboard'); assert.equal(f.calls.length, 1); f.unmount();
});

test('a navigation attempt during the floating Save waits without resubmitting', async () => {
  const f = createSettingsFixture(); await f.flush(); f.edit('settings-shop-name', 'Changed'); const hold = deferred(); f.holds.details = hold;
  const saving = f.save(); f.render(); f.navigate('/shop-dashboard');
  assert.equal(f.navigationModal().busy, true); f.navigationModal().onLeave(); assert.equal(f.proceeded(), 0);
  hold.resolve(); await saving; f.render(); await f.navigationModal().onSave();
  assert.equal(f.path(), '/shop-dashboard'); assert.equal(f.calls.length, 1); f.unmount();
});

test('logout confirmation saves before logout and does not end the session on failure or dismissal', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); let logouts = 0;
  const logout = () => { logouts++; f.navigate('/auth'); };
  f.requestLogout(logout); assert.equal(logouts, 0); f.navigationModal().onDismiss(); f.render(); assert.equal(logouts, 0);
  f.requestLogout(logout); f.failures.photo = 'Photo offline'; await f.navigationModal().onSave(); f.render();
  assert.equal(logouts, 0); assert.match(f.navigationModal().feedback, /Photo offline/);
  delete f.failures.photo; await f.navigationModal().onSave(); f.render(); assert.equal(logouts, 1); assert.equal(f.path(), '/auth');
  assert.deepEqual(f.calls.slice(5).map(call => call.section), ['photo']); f.unmount();
  const discard = createSettingsFixture(); await discard.flush(); discard.edit('settings-shop-name', 'Changed');
  discard.requestLogout(() => discard.navigate('/auth')); discard.navigationModal().onLeave();
  assert.equal(discard.path(), '/auth'); assert.equal(discard.calls.length, 0); discard.unmount();
});

test('browser unload protection follows pending edits and cleans up on unmount', async () => {
  const f = createSettingsFixture(); await f.flush(); assert.equal(f.listeners.has('beforeunload'), false);
  f.switch(); let prevented = false; const event = { preventDefault() { prevented = true; } };
  f.listeners.get('beforeunload')(event); assert.equal(prevented, true); assert.equal(event.returnValue, '');
  f.switch(); assert.equal(f.listeners.has('beforeunload'), false); select(f, 'qr');
  f.unmount(); assert.equal(f.listeners.has('beforeunload'), false);
});

test('confirmation has the requested labels and blocks dismissal during saving', () => {
  let busy = false, feedback = '', dismissals = 0, saves = 0, leaves = 0;
  const f = hookFixture('pages/ShopSettingsPage/UnsavedSettingsModal.tsx', 'UnsavedSettingsModal', {
    'react-dom': { createPortal: node => node },
  }, () => ({ busy, feedback, onDismiss: () => dismissals++, onLeave: () => leaves++, onSave: () => saves++ }), { document: { body: {} } });
  const dialog = () => f.find(node => node.type === 'dialog');
  assert.equal(dialog().props.role, 'alertdialog'); assert.equal(dialog().props['aria-modal'], 'true');
  f.button('Save Changes').props.onClick(); f.button('Leave without Saving').props.onClick(); assert.equal(saves, 1); assert.equal(leaves, 1);
  dialog().props.onCancel({ preventDefault() {} }); assert.equal(dismissals, 1);
  let prevented = false, stopped = false;
  const escape = { key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } };
  dialog().props.onKeyDown(escape); assert.equal(dismissals, 2); assert.equal(prevented, true); assert.equal(stopped, true);
  busy = true; f.render(); assert.equal(f.button('Save Changes').props.disabled, true); assert.equal(f.button('Leave without Saving').props.disabled, true);
  dialog().props.onKeyDown(escape); dialog().props.onCancel({ preventDefault() {} }); assert.equal(dismissals, 2); assert.equal(dialog().props['aria-busy'], true);
  busy = false; feedback = 'GCash QR code: offline'; f.render();
  assert.equal(f.find(node => node.props?.role === 'alert').props.children, feedback); f.unmount();
});

test('loads one settings baseline and keeps Save hidden until an edit', async () => {
  const pending = deferred();
  const f = createSettingsFixture({ readPending: pending });
  assert.equal(f.find(node => node.type === 'fieldset').props.disabled, true);
  assert.equal(f.button('Save Changes'), undefined);
  pending.resolve(); await f.flush();
  assert.equal(f.reads(), 1);
  assert.equal(f.field('shop-opens-at').props.value, '08:00');
  assert.equal(f.field('shop-closes-at').props.value, '20:00');
  assert.equal(f.button('Save Changes'), undefined);
  assert.equal(f.photo().photoUrl, 'saved-photo'); assert.equal(f.qr().savedUrl, 'saved-qr');
  f.unmount();
});

test('saves a manually typed GCash number without changing the QR image', async () => {
  const f = createSettingsFixture(); await f.flush();
  f.qr().onNumberChange('09987654321'); f.render();
  assert.ok(f.button('Save Changes'));
  await f.save(); f.render();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].section, 'qr');
  assert.deepEqual({ ...f.calls[0].payload }, { gcash_number: '09987654321' });
  assert.equal(f.qr().savedUrl, 'saved-qr');
  assert.equal(f.qr().gcashNumber, '09987654321');
  assert.equal(f.button('Save Changes'), undefined);
  f.unmount();
});

test('rejects an incomplete manually typed GCash number', async () => {
  const f = createSettingsFixture(); await f.flush();
  f.qr().onNumberChange('0917123'); f.render();
  await f.save(); f.render();
  assert.equal(f.calls.length, 0);
  assert.match(f.qr().error, /11-digit/);
  f.unmount();
});

test('tracks and reverts text, availability, and coordinate edits independently', async () => {
  const f = createSettingsFixture(); await f.flush();
  for (const [id, value] of [['settings-shop-name', 'Changed'], ['settings-location', 'New address'], ['settings-description', 'New description'], ['shop-opens-at', '09:00'], ['shop-closes-at', '21:00']]) {
    const original = f.field(id).props.value;
    f.edit(id, value); assert.ok(f.button('Save Changes'));
    f.edit(id, original); assert.equal(f.button('Save Changes'), undefined);
  }
  f.switch(); assert.ok(f.button('Save Changes')); f.switch(); assert.equal(f.button('Save Changes'), undefined);
  f.pin(15, 122); assert.ok(f.button('Save Changes')); f.pin(14.6, 121); assert.equal(f.button('Save Changes'), undefined);
  assert.equal(f.calls.length, 0); f.unmount();
});

test('stages all five sections and sends only their own fields when Save is clicked', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges();
  assert.equal(f.calls.length, 0);
  assert.equal(f.photo().localUrl, 'blob:settings-0'); assert.equal(f.qr().localUrl, 'blob:settings-1');
  await f.save(); f.render();
  assert.deepEqual(f.calls.map(call => call.section), ['details', 'pickup', 'availability', 'photo', 'qr']);
  assert.deepEqual({ ...f.calls[0].payload }, { name: 'Updated Shop', location: 'Student Center', description: 'Ground floor' });
  assert.deepEqual({ ...f.calls[1].payload }, { latitude: 14.7, longitude: 121.1 });
  assert.deepEqual({ ...f.calls[2].payload }, { availability_override: true, opens_at: '08:00', closes_at: '20:00' });
  assert.equal(f.photo().selectedFile, null); assert.equal(f.qr().selectedFile, null);
  assert.equal(f.photo().photoUrl, 'saved-photo.png'); assert.equal(f.qr().savedUrl, 'saved-qr.png');
  assert.equal(f.button('Save Changes'), undefined); assert.ok(f.contents().includes('Settings saved successfully!'));
  assert.equal(f.events.length, 1); assert.equal(f.events[0].type, 'shop-settings-updated'); assert.equal(f.events[0].detail.name, 'Updated Shop');
  assert.deepEqual(f.revoked, ['blob:settings-0', 'blob:settings-1']);
  f.edit('settings-shop-name', 'Updated Shop'); assert.equal(f.button('Save Changes'), undefined);
  f.unmount();
});

test('identifies each failed section, preserves its edits, and retries only that section', async () => {
  const labels = { details: 'Shop details', pickup: 'Pickup location', availability: 'Shop availability', photo: 'Shop photo', qr: 'GCash QR code' };
  for (const section of Object.keys(labels)) {
    const f = createSettingsFixture(); await f.flush(); f.allChanges(); f.failures[section] = 'offline';
    await f.save(); f.render();
    assert.ok(f.button('Save Changes')); assert.ok(f.contents().includes('Saved:'));
    const link = f.find(node => node.type === 'a' && node.props.href === `#settings-${section}`);
    assert.equal(link.props.children, labels[section]); assert.ok(f.contents().includes('offline'));
    if (section === 'photo') assert.equal(f.photo().localUrl, 'blob:settings-0');
    if (section === 'qr') assert.equal(f.qr().localUrl, 'blob:settings-1');
    delete f.failures[section]; await f.save(); f.render();
    assert.equal(f.calls.length, 6); assert.equal(f.calls[5].section, section); assert.equal(f.button('Save Changes'), undefined);
    f.unmount();
  }
});

test('reports multiple failed media sections alongside successful metadata saves', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); f.failures.photo = 'Photo upload failed'; f.failures.qr = 'QR rate limit reached';
  await f.save(); f.render();
  assert.ok(f.contents().includes('Saved: Shop details, Pickup location, Shop availability.'));
  assert.ok(f.contents().includes('Photo upload failed')); assert.ok(f.contents().includes('QR rate limit reached'));
  assert.equal(f.photo().selectedFile.name, 'photo.png'); assert.equal(f.qr().selectedFile.name, 'qr.png');
  delete f.failures.photo; delete f.failures.qr; await f.save(); f.render();
  assert.deepEqual(f.calls.slice(5).map(call => call.section), ['photo', 'qr']); assert.equal(f.button('Save Changes'), undefined); f.unmount();
});

test('rejects invalid settings before any section sends a request', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); f.edit('settings-shop-name', '   '); f.edit('shop-closes-at', '08:00'); f.pin(91, 121);
  await f.save(); f.render(); assert.equal(f.calls.length, 0);
  for (const section of ['details', 'availability', 'pickup']) assert.ok(f.find(node => node.type === 'a' && node.props.href === `#settings-${section}`));
  f.edit('settings-shop-name', 'Fixed'); f.edit('shop-closes-at', '20:00'); f.pin(null, null);
  await f.save(); f.render(); assert.equal(f.calls.length, 5); assert.equal(f.state.latitude, null); assert.equal(f.state.longitude, null); f.unmount();
});

test('validates photo and QR selections without replacing previous pending previews', async () => {
  const f = createSettingsFixture(); await f.flush();
  for (const [section, max] of [['photo', 5], ['qr', 10]]) {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) select(f, section, image(type, max * 1024 * 1024));
    const previous = f[section]().localUrl;
    for (const bad of [image('image/gif'), image('image/png', 0), image('image/png', max * 1024 * 1024 + 1)]) {
      select(f, section, bad); assert.equal(f[section]().localUrl, previous); assert.ok(f[section]().error.includes(`${max} MB`));
    }
  }
  assert.equal(f.calls.length, 0); f.unmount(); assert.equal(f.revoked.length, f.created.length);
});

test('cancels photo replacements and releases their URLs without publishing', async () => {
  const f = createSettingsFixture(); await f.flush(); select(f, 'photo'); select(f, 'photo');
  assert.deepEqual(f.revoked, ['blob:settings-0']);
  f.photo().onCancel(); f.render(); assert.equal(f.photo().selectedFile, null); assert.equal(f.photo().photoUrl, 'saved-photo');
  assert.equal(f.button('Save Changes'), undefined); assert.deepEqual(f.revoked, ['blob:settings-0', 'blob:settings-1']); assert.equal(f.calls.length, 0); f.unmount();
});

test('keeps QR removals local and handles empty and replacement states', async () => {
  const empty = createSettingsFixture({ state: { name: 'Empty shop', gcash_qr_url: null } }); await empty.flush(); select(empty, 'qr');
  empty.qr().onRemove(); empty.render(); assert.equal(empty.button('Save Changes'), undefined); assert.equal(empty.calls.length, 0); empty.unmount();
  const f = createSettingsFixture(); await f.flush(); f.qr().onRemove(); f.render(); assert.equal(f.qr().pendingRemoval, true); assert.equal(f.calls.length, 0);
  f.failures.qr = 'offline'; await f.save(); f.render(); assert.equal(f.qr().pendingRemoval, true); assert.equal(f.qr().savedUrl, 'saved-qr');
  delete f.failures.qr; select(f, 'qr', image('image/png', 100, 'replacement.png')); assert.equal(f.qr().pendingRemoval, false);
  await f.save(); f.render(); assert.equal(f.calls[1].payload.name, 'replacement.png'); assert.equal(f.qr().savedUrl, 'saved-replacement.png');
  f.qr().onRemove(); f.render(); await f.save(); f.render(); assert.equal(f.state.gcash_qr_url, null); assert.equal(f.button('Save Changes'), undefined); f.unmount();
});

test('blocks duplicate submissions and editing until every section finishes saving', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); const hold = deferred(); f.holds.photo = hold;
  const saving = f.save(); await f.save(); await f.flush();
  assert.equal(f.calls.length, 5); assert.equal(f.find(node => node.type === 'fieldset').props.disabled, true);
  assert.equal(f.photo().disabled, true); assert.equal(f.qr().disabled, true); assert.equal(f.button('Saving...').props.disabled, true);
  f.edit('settings-shop-name', 'Blocked'); select(f, 'qr'); assert.equal(f.field('settings-shop-name').props.value, 'Updated Shop'); assert.equal(f.created.length, 2);
  assert.ok(f.button('Saving...')); hold.resolve(); await saving; f.render(); assert.equal(f.button('Save Changes'), undefined); assert.equal(f.find(node => node.type === 'fieldset').props.disabled, false); f.unmount();
});

test('reopening retains saved changes and discards unsaved edits', async () => {
  const f = createSettingsFixture(); await f.flush(); f.allChanges(); await f.save(); f.render();
  f.edit('settings-shop-name', 'Unsent'); select(f, 'photo'); f.qr().onRemove(); f.render(); f.unmount();
  const reopened = createSettingsFixture({ state: f.state }); await reopened.flush();
  assert.equal(reopened.field('settings-shop-name').props.value, 'Updated Shop'); assert.equal(reopened.photo().photoUrl, 'saved-photo.png'); assert.equal(reopened.qr().savedUrl, 'saved-qr.png'); assert.equal(reopened.button('Save Changes'), undefined); reopened.unmount();
});

test('supports initial-load retry and ignores late loads after leaving', async () => {
  let offline = true; const f = createSettingsFixture({ readError: () => offline }); await f.flush();
  assert.equal(f.button('Save Changes'), undefined); assert.equal(f.find(node => node.type === 'fieldset').props.disabled, true); assert.ok(f.contents().includes('Could not load shop settings'));
  offline = false; f.button('Retry').props.onClick(); f.render(); await f.flush(); assert.equal(f.reads(), 2); assert.equal(f.find(node => node.type === 'fieldset').props.disabled, false); f.unmount();
  const pending = deferred(); const late = createSettingsFixture({ readPending: pending }); late.unmount(); pending.resolve(); await late.flush(); assert.equal(late.field('settings-shop-name').props.value, '');
});

test('photo editor delegates selection and cancellation without a separate upload button', () => {
  const calls = []; const props = { photoUrl: 'saved-photo', selectedFile: null, localUrl: null, disabled: false, onSelect: file => calls.push(file), onCancel() { calls.push('cancel'); } };
  const f = hookFixture('components/maps/ShopPhotoUpload.tsx', 'ShopPhotoUpload', {}, () => props);
  assert.equal(f.find(node => node.type === 'form'), undefined); assert.equal(f.button('Upload Photo'), undefined);
  const file = image(); const event = { target: { files: [file], value: 'selected' } }; f.find(node => node.type === 'input').props.onChange(event);
  assert.equal(event.target.value, ''); assert.equal(calls[0], file); assert.equal(f.find(node => node.type === 'img').props.src, 'saved-photo');
  props.selectedFile = file; props.localUrl = 'blob:selected'; f.render(); f.find(node => node.type === 'img').props.onError(); f.render(); assert.ok(f.find(node => node.props?.role === 'alert'));
  f.button('Cancel change').props.onClick(); assert.equal(calls[1], 'cancel');
  props.disabled = true; f.render(); assert.equal(f.button('Change photo').props.disabled, true); assert.equal(f.button('Cancel change').props.disabled, true);
  f.find(node => node.type === 'input').props.onChange({ target: { files: [file], value: 'selected' } }); assert.equal(calls.length, 2); f.unmount();
});

test('uses one outer form and orders grouped cards consistently', async () => {
  const f = createSettingsFixture(); await f.flush();
  assert.equal(nodes(f.tree()).filter(node => node.type === 'form').length, 1);
  assert.deepEqual(nodes(f.tree()).filter(node => node.type === 'section' || node.type === 'photo-editor' || node.type === 'qr-editor').map(node => node.props.id || node.type), ['settings-details', 'settings-pickup', 'photo-editor', 'settings-availability', 'qr-editor']);
  for (const card of nodes(f.tree()).filter(node => node.type === 'section')) assert.match(card.props.className, /border border-black/);
  f.unmount();
});
