import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// A valódi komponensek látható műveleteit ellenőrizzük DB és böngésző nélkül.
globalThis.document = { documentElement: { lang: 'hu' } };
const server = await createServer({
  configFile: false,
  css: { modules: { generateScopedName: '[local]__[hash:base64:5]' } },
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
async function styles(path) {
  return (await server.ssrLoadModule(`/src/frontend/${path}.module.css`)).default;
}
function hasClass(html, className) {
  assert.ok(className, 'The CSS Module must define the requested class');
  const tokens = className.split(/\s+/);
  return [...html.matchAll(/\bclass="([^"]*)"/g)]
    .some((match) => tokens.every((token) => match[1].split(/\s+/).includes(token)));
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
    assert.equal(hasClass(html, (await styles('components/CalendarView'))['calendar-grid']), false);
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
  assert.ok(hasClass(html, (await styles('components/CalendarView'))['calendar-grid']));
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

test('both detail dialogs show the complete multi-day session and keep their own actions', async () => {
  const multiDay = {
    ...session, end_date: '2099-04-12', description: 'Detailed event notes', speaker_bio: 'Speaker biography',
  };
  const organiser = await render('components/DetailModal', {
    session: multiDay, onClose: noop, onEdit: noop, onDelete: noop, onSetStatus: noop,
  });
  const attendee = await render('components/AttendeeDetailModal', {
    session: multiDay, isSaved: false, busy: false, onClose: noop, onSave: noop, onRemove: noop,
  });
  const detailStyles = await styles('components/SessionDetails');
  for (const html of [organiser, attendee]) {
    for (const text of ['Workflow test', 'Conference room', 'Test speaker', 'Speaker biography', 'Detailed event notes']) {
      assert.ok(html.includes(text), text);
    }
    assert.ok(hasClass(html, detailStyles['detail-multiday-badge']));
    assert.ok(hasClass(html, detailStyles['detail-duration']));
    assert.match(html, /09:00/);
    assert.match(html, /10:00/);
    assert.match(html, /2099/);
  }
  assert.ok(buttonLabels(organiser).includes('Szerkesztés'));
  assert.ok(buttonLabels(organiser).includes('Törlés'));
  assert.ok(!buttonLabels(attendee).includes('Törlés'));
  assert.ok(buttonLabels(attendee).includes('Mentés'));
});

test('each modal owns its layout classes, so a local selector cannot reach another modal', async () => {
  const modals = [
    ['components/DetailModal', { session, onClose: noop, onDelete: noop }],
    ['components/AttendeeDetailModal', { session, isSaved: false, busy: false, onClose: noop, onSave: noop, onRemove: noop }],
    ['components/BookingModal', { speakers: [], rooms: shared.rooms, onSave: noop, onClose: noop }],
  ];
  const rendered = await Promise.all(modals.map(async ([path, props]) => ({
    path, css: await styles(path), html: await render(path, props),
  })));
  for (const owner of rendered) {
    for (const localName of ['modal', 'modal-backdrop']) {
      assert.ok(hasClass(owner.html, owner.css[localName]), `${owner.path}: ${localName}`);
      for (const other of rendered.filter((candidate) => candidate !== owner)) {
        assert.notEqual(owner.css[localName], other.css[localName]);
        assert.equal(hasClass(other.html, owner.css[localName]), false, `${owner.path} must not style ${other.path}`);
      }
    }
  }
});

test('organiser and admin shell selectors only match their own layout', async () => {
  const shellProps = {
    ...shared, initialUser: user, loading: true, error: null, onSetSessionStatus: noop, onLogout: noop,
  };
  const shells = await Promise.all(['App', 'components/admin/AdminApp'].map(async (path) => ({
    path, css: await styles(path), html: await render(path, shellProps),
  })));
  for (const owner of shells) {
    for (const localName of ['sidebar', 'topbar', 'main-area', 'content-area']) {
      assert.ok(hasClass(owner.html, owner.css[localName]), `${owner.path}: ${localName}`);
      for (const other of shells.filter((candidate) => candidate !== owner)) {
        assert.notEqual(owner.css[localName], other.css[localName]);
        assert.equal(hasClass(other.html, owner.css[localName]), false);
      }
    }
  }
});

test('calendar and session cards keep all color and state styles after scoping', async () => {
  const { SESSION_ACCENTS } = await server.ssrLoadModule('/src/frontend/lib/display.ts');
  const { localDateKey } = await server.ssrLoadModule('/src/frontend/lib/sessionFormat.ts');
  const today = new Date();
  const sessions = Object.keys(SESSION_ACCENTS).map((color, index) => ({
    ...session, id: session.id + index, color,
    date: localDateKey(new Date(today.getFullYear(), today.getMonth(), index + 1)),
    end_date: localDateKey(new Date(today.getFullYear(), today.getMonth(), index + 2)),
    status: index === 0 ? 'cancelled' : 'scheduled',
  }));
  const calendarCss = await styles('components/CalendarView');
  const cardsCss = await styles('components/SessionsView');
  const calendar = await render('components/CalendarView', {
    curMonth: today.getMonth(), curYear: today.getFullYear(), sessions,
    selectedDate: sessions[0].date, onSelectDay: noop, onEventClick: noop, onNavigate: noop, onToday: noop,
  });
  const cards = await render('components/SessionsView', {
    sessions, searchTerm: '', onEventClick: noop, selectable: true,
    selectedIds: new Set([sessions[0].id]), onToggleSelect: noop,
  });
  for (const color of Object.keys(SESSION_ACCENTS)) {
    assert.ok(calendarCss[color], `Calendar color: ${color}`);
    assert.ok(cardsCss[color], `Card color: ${color}`);
    assert.ok(hasClass(calendar, `${calendarCss['cal-event']} ${calendarCss[color]}`));
    assert.ok(hasClass(cards, `${cardsCss['session-duration']} ${cardsCss[color]}`));
  }
  for (const state of ['today', 'selected', 'multiday']) {
    assert.ok(hasClass(calendar, calendarCss[state]), `Calendar state: ${state}`);
  }
  for (const state of ['cancelled', 'selected', 'session-multiday-badge']) {
    assert.ok(hasClass(cards, cardsCss[state]), `Card state: ${state}`);
  }
});

const { ensureResponseOk } = await server.ssrLoadModule('/src/frontend/lib/api.ts');

test('request validation leaves successful response bodies available to the caller', async () => {
  const response = new Response(JSON.stringify({ id: 42 }));
  await ensureResponseOk(response, 'errors.saveError');
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(await response.json(), { id: 42 });
  await ensureResponseOk(new Response(null, { status: 204 }), 'errors.deleteError');
});

test('request validation preserves backend messages, fallbacks, and endpoint status overrides', async () => {
  const failure = (body, status = 400) => new Response(body, { status });
  await assert.rejects(ensureResponseOk(failure('{"message":"errors.roomBusy"}'), 'errors.saveError'), /errors.roomBusy/);
  await assert.rejects(ensureResponseOk(failure('not json'), 'errors.saveError'), /errors.saveError/);
  await assert.rejects(ensureResponseOk(failure('{}'), 'errors.deleteError'), /errors.deleteError/);
  await assert.rejects(ensureResponseOk(failure('{"message":"unknown"}', 404), 'errors.saveError', {
    404: 'errors.scheduleNotAvailable',
  }), /errors.scheduleNotAvailable/);
});

test('local calendar date keys preserve the day near midnight and at year boundaries', async () => {
  const { localDateKey, isTodayDateKey } = await server.ssrLoadModule('/src/frontend/lib/sessionFormat.ts');
  for (const [date, expected] of [
    [new Date(2026, 0, 1, 0, 1), '2026-01-01'],
    [new Date(2026, 11, 31, 23, 59), '2026-12-31'],
  ]) {
    assert.equal(localDateKey(date), expected);
  }
  assert.equal(isTodayDateKey(localDateKey()), true);
  assert.equal(isTodayDateKey('not-a-date'), false);
});
