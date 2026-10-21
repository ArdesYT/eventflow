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
const { ThemeProvider } = await server.ssrLoadModule('/src/frontend/theme/ThemeProvider.tsx');
async function render(path, props) {
  const { default: Component } = await server.ssrLoadModule(`/src/frontend/${path}.tsx`);
  return renderToStaticMarkup(createElement(I18nProvider, null,
    createElement(ThemeProvider, null, createElement(Component, props))));
}
async function withPreferences(values, callback) {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalLanguage = document.documentElement.lang;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => values[key] ?? null },
  });
  try {
    await callback();
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    document.documentElement.lang = originalLanguage;
  }
}
function buttonLabels(html) {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, '').trim());
}
function buttons(html) {
  return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
}
function assertNoNestedButtons(html) {
  let depth = 0;
  for (const [tag] of html.matchAll(/<\/?button\b[^>]*>/g)) {
    depth += tag.startsWith('</') ? -1 : 1;
    assert.ok(depth >= 0 && depth <= 1, 'Native buttons must remain separate keyboard targets');
  }
  assert.equal(depth, 0);
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

test('theme controls use the saved theme and keep the toggle beside the language controls in every locale', async () => {
  for (const [locale, darkLabel, lightLabel] of [
    ['hu', 'Váltás sötét témára', 'Váltás világos témára'],
    ['en', 'Switch to dark theme', 'Switch to light theme'],
    ['de', 'Zum dunklen Design wechseln', 'Zum hellen Design wechseln'],
  ]) {
    for (const theme of ['light', 'dark']) {
      await withPreferences({ eventflow_locale: locale, eventflow_theme: theme }, async () => {
        const html = await render('components/DisplayControls');
        const expectedLabel = theme === 'dark' ? lightLabel : darkLabel;
        const toggle = buttons(html).filter((button) => button.includes(`aria-label="${expectedLabel}"`));
        assert.equal(toggle.length, 1);
        assert.match(toggle[0], /type="button"/);
        assert.ok(toggle[0].includes(`title="${expectedLabel}"`));
        assert.ok(toggle[0].includes(`aria-pressed="${theme === 'dark'}"`));
        assert.match(toggle[0], /<svg\b[^>]*aria-hidden="true"/);
        assert.match(html, new RegExp(`</div><button[^>]*aria-label="${expectedLabel}"`));
        assertNoNestedButtons(html);
      });
    }
  }
});

test('theme defaults to light when no valid preference is saved or storage cannot be read', async () => {
  for (const values of [{}, { eventflow_theme: 'unsupported' }]) {
    await withPreferences(values, async () => {
      const toggle = await render('components/ThemeToggle');
      assert.match(toggle, /aria-label="Váltás sötét témára"/);
      assert.match(toggle, /aria-pressed="false"/);
    });
  }
  await withPreferences({}, async () => {
    globalThis.localStorage.getItem = () => { throw new Error('Storage is unavailable'); };
    const toggle = await render('components/ThemeToggle');
    assert.match(toggle, /aria-label="Váltás sötét témára"/);
    assert.match(toggle, /aria-pressed="false"/);
  });
});

test('login, booker, admin, and public pages expose one shared language and theme control', async () => {
  const shellProps = {
    ...shared, initialUser: user, loading: true, error: null,
    onSetSessionStatus: noop, onLogout: noop,
  };
  const displayStyles = await styles('components/DisplayControls');
  for (const [path, props] of [
    ['components/LoginPage', { offlineMode: true, onLogin: noop, onRegister: noop }],
    ['App', shellProps],
    ['components/admin/AdminApp', shellProps],
    ['components/PublicEventsPage', {
      sessions: [session], savedSessions: [], guestMode: true, user: null,
      loading: false, error: null, scheduleError: null, scheduleBusyId: null,
      onSaveSession: noop, onRemoveSession: noop,
    }],
  ]) {
    const html = await render(path, props);
    assert.ok(hasClass(html, displayStyles['display-controls']), path);
    assert.equal(buttons(html).filter((button) => button.includes('aria-label="Váltás sötét témára"')).length, 1, path);
    assert.equal([...html.matchAll(/role="group" aria-label="Nyelv"/g)].length, 1, path);
    assertNoNestedButtons(html);
  }
});

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
  const navigation = sidebar.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.deepEqual(buttonLabels(navigation), ['📅Programkezelés', '📊Áttekintés']);
  assert.ok(hasClass(html, (await styles('components/CalendarView'))['calendar-grid']));
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Naptár<\/button>/);
  assert.equal(buttonLabels(html).filter((text) => text === '+ Új foglalás').length, 0);
});

test('the team calendar belongs to the booker workspace; admin and default consumers keep their layout', async () => {
  const calendarCss = await styles('components/CalendarView');
  const calendarProps = {
    curMonth: 3, curYear: 2026, sessions: [session], selectedDate: null,
    onSelectDay: noop, onEventClick: noop, onNavigate: noop, onToday: noop,
  };
  const [booker, admin, defaultCalendar, publicPage] = await Promise.all([
    render('components/SessionWorkspace', { ...shared, initialViewMode: 'calendar' }),
    render('components/SessionWorkspace', { ...shared, user: { ...user, role: 'admin' }, initialViewMode: 'calendar' }),
    render('components/CalendarView', calendarProps),
    render('components/PublicEventsPage', {
      sessions: [session], savedSessions: [], user: { ...user, role: 'attendee' },
      loading: false, error: null, scheduleError: null, scheduleBusyId: null,
      onSaveSession: noop, onRemoveSession: noop,
    }),
  ]);
  assert.ok(hasClass(booker, calendarCss['team-calendar']));
  for (const html of [admin, defaultCalendar, publicPage]) {
    assert.equal(hasClass(html, calendarCss['team-calendar']), false);
  }
  for (const html of [booker, admin, defaultCalendar]) {
    assert.ok(hasClass(html, calendarCss['calendar-grid']));
  }
  const publicListButton = buttons(publicPage).find((button) => buttonLabels(button)[0] === 'Lista');
  assert.ok(hasClass(publicListButton, (await styles('components/PublicEventsPage')).active));
  assert.match(publicPage, /Workflow test/);
});

test('team calendar includes multi-day sessions in the adjacent month cells with usable date and event targets', async () => {
  const html = await render('components/CalendarView', {
    curMonth: 3, curYear: 2026, appearance: 'team', selectedDate: '2026-03-31',
    sessions: [
      { ...session, title: 'Carry in', date: '2026-03-31', end_date: '2026-04-02' },
      { ...session, id: 8, title: 'Carry out', date: '2026-04-30', end_date: '2026-05-02' },
    ],
    onSelectDay: noop, onEventClick: noop, onNavigate: noop, onToday: noop,
  });
  const targets = buttons(html);
  for (const title of ['Carry in', 'Carry out']) {
    const events = targets.filter((button) => button.includes(`aria-label="${title} ·`));
    assert.equal(events.length, 3, `${title} must appear on every visible day of its span`);
    assert.equal(events.filter((button) => /folytatódik/.test(button)).length, 2);
    for (const event of events) {
      assert.match(event, /aria-label="[^"]*09:00 – 10:00[^"]*Conference room/);
      assert.match(event, />09:00<\/span>/);
    }
  }
  const bookingDays = targets.filter((button) => button.includes('aria-label="Új foglalás:'));
  assert.equal(bookingDays.length, 35, 'Every date in the April grid remains bookable, including adjacent months');
  assert.equal(bookingDays.filter((button) => /aria-pressed="true"/.test(button)).length, 1);
  assert.match(bookingDays.find((button) => /aria-pressed="true"/.test(button)), /2026[^<]*március[^<]*31/);
  assert.ok(targets.some((button) => button.includes('aria-label="Előző hónap"')));
  assert.ok(targets.some((button) => button.includes('aria-label="Következő hónap"')));
  assert.ok(buttonLabels(html).includes('Ma'));
  assertNoNestedButtons(html);
});

test('team calendar keeps cancelled sessions identifiable and exposes crowded days as accessible expandable controls', async () => {
  const html = await render('components/CalendarView', {
    curMonth: 3, curYear: 2026, appearance: 'team', selectedDate: null,
    sessions: [
      { ...session, id: 11, title: 'Late event', date: '2026-04-10', end_date: '2026-04-10', start_time: '17:30' },
      { ...session, id: 12, title: 'Cancelled event', date: '2026-04-10', end_date: '2026-04-10', start_time: '08:30', status: 'cancelled' },
      { ...session, id: 13, title: 'Morning event', date: '2026-04-10', end_date: '2026-04-10', start_time: '09:00' },
      { ...session, id: 14, title: 'Noon event', date: '2026-04-10', end_date: '2026-04-10', start_time: '12:00' },
      { ...session, id: 15, title: 'Other day event', date: '2026-04-11', end_date: '2026-04-11', start_time: '17:30' },
    ],
    onSelectDay: noop, onEventClick: noop, onNavigate: noop, onToday: noop,
  });
  const targets = buttons(html);
  const cancelled = targets.find((button) => button.includes('aria-label="Cancelled event ·'));
  assert.match(cancelled, /aria-label="[^"]*08:30[^\"]*Lemondva/);
  assert.ok(hasClass(cancelled, (await styles('components/CalendarView')).cancelled));
  assert.match(cancelled, />08:30<\/span>/);
  assert.ok(html.indexOf('Cancelled event') < html.indexOf('Morning event'));
  assert.ok(html.indexOf('Morning event') < html.indexOf('Noon event'));
  assert.doesNotMatch(html, /Late event/);
  assert.match(html, /Other day event/);
  const overflow = targets.filter((button) => /aria-expanded=/.test(button));
  assert.equal(overflow.length, 1);
  assert.match(overflow[0], /aria-expanded="false"/);
  assert.match(overflow[0], />\+1 további<\/button>/);
  const controlledId = overflow[0].match(/aria-controls="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${controlledId}"`), 'The expansion control must reference its own day event list');
  assertNoNestedButtons(html);
});

test('controlled workspace detail selection follows the sidebar selection and can explicitly close', async () => {
  const sessions = [
    { ...session, description: 'Stale local selection notes' },
    { ...session, id: 8, title: 'Selected from sidebar', description: 'Current sidebar selection notes' },
  ];
  const props = { ...shared, sessions, initialViewMode: 'calendar', initialDetailId: 7, onDetailChange: noop };
  const selected = await render('components/SessionWorkspace', { ...props, activeDetailId: 8 });
  assert.match(selected, /Current sidebar selection notes/);
  assert.doesNotMatch(selected, /Stale local selection notes/);
  for (const action of ['Szerkesztés', 'Törlés', 'Lemondás']) {
    assert.equal(buttonLabels(selected).filter((label) => label === action).length, 1);
  }
  const closed = await render('components/SessionWorkspace', { ...props, activeDetailId: null });
  assert.equal(hasClass(closed, (await styles('components/DetailModal')).modal), false);
  assert.ok(!buttonLabels(closed).includes('Törlés'));
});

for (const offlineMode of [false, true]) {
  test(`login demo credentials remain clickable below the fields (${offlineMode ? 'offline' : 'online'})`, async () => {
    const html = await render('components/LoginPage', { offlineMode, onLogin: noop, onRegister: noop });
    const demoSection = html.match(/<section\b[^>]*aria-labelledby="login-demo-title"[^>]*>[\s\S]*?<\/section>/)[0];
    const demoButtons = buttons(demoSection);
    assert.equal(demoButtons.length, 3);
    for (const [email, password] of [
      ['admin@example.com', 'admin123'],
      ['booker@example.com', 'booker123'],
      ['attendee@example.com', 'attendee123'],
    ]) {
      const matching = demoButtons.filter((button) => button.includes(`${email} / ${password}`));
      assert.equal(matching.length, 1);
      assert.match(matching[0], /type="button"/);
      assert.doesNotMatch(matching[0], /\sdisabled(?:[\s=>])/);
    }
    assert.ok(html.indexOf('id="login-email"') < html.indexOf(demoSection));
    assert.ok(html.indexOf('id="login-password"') < html.indexOf(demoSection));
    assert.ok(html.indexOf('type="submit"') < html.indexOf(demoSection));
    const beforeFields = html.slice(html.indexOf('<form'), html.indexOf('id="login-email"'));
    assert.equal(buttons(beforeFields).length, 0, 'Login must not ask users to choose their permissions above the fields');
    assert.doesNotMatch(html, /<select\b|type="radio"|role="tablist"/);
    assertNoNestedButtons(html);
  });
}

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
