import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// A valódi komponensek látható műveleteit ellenőrizzük DB és böngésző nélkül.
globalThis.document = { documentElement: { lang: 'hu' } };
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
after(async () => { await server.close(); delete globalThis.document; });

const { I18nProvider } = await server.ssrLoadModule('/src/frontend/i18n/I18nProvider.tsx');
async function render(path, props) {
  const { default: Component } = await server.ssrLoadModule(`/src/frontend/${path}.tsx`);
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement(Component, props)));
}
function buttonLabels(html) {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, '').trim());
}
const noop = async () => {};
const session = {
  id: 7, title: 'Workflow test', date: '2099-04-10', end_date: '2099-04-10',
  start_time: '09:00', end_time: '10:00', room_id: 42, room_name: 'Conference room',
  speaker_id: 12, speaker_name: 'Test speaker', color: 'blue', status: 'scheduled',
};
const user = { id: 5, name: 'Test booker', email: 'test@example.com', role: 'booker', assigned_room_ids: [42] };
const shared = {
  user, rooms: [{ id: 42, name: 'Conference room' }], sessions: [session],
  sessionSaves: {}, backendMode: false,
  onRefreshSessionSaves: noop, onCreate: noop, onUpdate: noop, onDelete: noop,
  onSetStatus: noop, onBulkUpdate: noop,
};

for (const role of ['booker', 'admin']) {
  test(`${role}: one export control, with booking creation reserved for calendar days`, async () => {
    const html = await render('components/SessionWorkspace', { ...shared, user: { ...user, role } });
    const buttons = buttonLabels(html);
    assert.equal(buttons.filter((text) => text === '+ Új foglalás').length, 0);
    assert.equal(buttons.filter((text) => text === 'Naptár export').length, 1);
    assert.equal(buttons.filter((text) => text === 'Tömeges szerkesztés').length, 1);
    assert.doesNotMatch(html, /class="calendar-grid"/);
    assert.ok(!buttons.includes('Törlés'));
    assert.ok(!buttons.includes('Eltávolítás'));

    const details = buttonLabels(await render('components/SessionWorkspace', {
      ...shared, user: { ...user, role }, initialDetailId: session.id,
    }));
    assert.equal(details.filter((text) => text === 'Törlés').length, 1);
    assert.equal(details.filter((text) => text === 'Szerkesztés').length, 1);
    assert.equal(details.filter((text) => text === 'Lemondás').length, 1);
  });
}

test('booker opens the calendar inside its single program workspace', async () => {
  const html = await render('App', {
    ...shared, initialUser: user, loading: false, error: null,
    onSetSessionStatus: noop, onBulkUpdateSessions: noop, onLogout: noop,
  });
  const sidebar = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)[1];
  assert.deepEqual(buttonLabels(sidebar), ['📅Programkezelés', '📊Áttekintés']);
  assert.match(html, /class="calendar-grid"/);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Naptár<\/button>/);
  assert.equal(buttonLabels(html).filter((text) => text === '+ Új foglalás').length, 0);
});

test('agenda rows only open details, even if a legacy caller passes a delete handler', async () => {
  const buttons = buttonLabels(await render('components/AgendaView', {
    sessions: [session], onEventClick: noop, onDelete: noop,
  }));
  assert.ok(!buttons.includes('Törlés'));
  assert.ok(!buttons.includes('Eltávolítás'));
});

test('a prefiltered session remains visible with whitespace around the search term', async () => {
  const html = await render('components/SessionsView', {
    sessions: [session], searchTerm: ' Workflow ', onEventClick: noop,
  });
  assert.match(html, /Workflow test/);
});

test('attendee cards display saved state without duplicating save/remove controls', async () => {
  const html = await render('components/PublicEventsPage', {
    sessions: [session], savedSessions: [session], user: { ...user, role: 'attendee' },
    loading: false, error: null, scheduleError: null, scheduleBusyId: null,
    onSaveSession: noop, onRemoveSession: noop,
  });
  assert.match(html, /Mentve/);
  assert.ok(!buttonLabels(html).includes('Mentés'));
  assert.ok(!buttonLabels(html).includes('Eltávolítás'));
});

test('cancelled saved sessions can still be removed from the canonical detail dialog', async () => {
  const buttons = buttonLabels(await render('components/AttendeeDetailModal', {
    session: { ...session, status: 'cancelled' }, isSaved: true, busy: false,
    onClose: noop, onSave: noop, onRemove: noop,
  }));
  assert.equal(buttons.filter((text) => text === 'Eltávolítás').length, 1);
  assert.ok(!buttons.includes('Mentés'));
});

test('booking only offers catalog speakers, never a second speaker creation form', async () => {
  const html = await render('components/BookingModal', {
    speakers: [{ id: 12, name: 'Test speaker' }], rooms: shared.rooms, onSave: noop, onClose: noop,
  });
  assert.match(html, /Test speaker/);
  assert.doesNotMatch(html, /Új előadó…|Új előadó neve/);
});
