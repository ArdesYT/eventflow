/** Scheduling conflicts and MariaDB date conversion regressions. Run with npm test. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSessionConflicts, hasBufferConflict, sessionFromRow, sessionsOverlap } from './sessionConflicts';
import { formatDate, formatDatetime, formatTime } from './datetime';
import type { Session } from './types';

/**
 * Teszt előadás gyártó — alapértelmezett mezőkkel, partial felülírható.
 * Csak az ütközés-számításhoz szükséges mezőket tölti ki.
 */
function session(partial: Partial<Session> & Pick<Session, 'id'>): Session {
  return {
    title: 'Test',
    date: '2026-03-20',
    end_date: '2026-03-20',
    start_time: '10:00',
    end_time: '11:00',
    room_id: 1,
    speaker_id: 1,
    room_name: 'Hall',
    speaker_name: 'Speaker',
    color: 'blue',
    ...partial,
  };
}

/** sessionsOverlap — két időintervallum átfedésének detektálása. */
describe('sessionsOverlap', () => {
  it('detects overlapping times in same room', () => {
    const a = session({ id: 1, start_time: '10:00', end_time: '11:00' });
    const b = session({ id: 2, start_time: '10:30', end_time: '11:30' });
    assert.equal(sessionsOverlap(a, b), true);
  });

  it('allows non-overlapping times with gap', () => {
    const a = session({ id: 1, start_time: '09:00', end_time: '10:00' });
    const b = session({ id: 2, start_time: '14:00', end_time: '15:00' });
    assert.equal(sessionsOverlap(a, b), false);
  });

  it('allows back-to-back intervals and detects overlap across dates', () => {
    const a = session({ id: 1, start_time: '23:00', end_date: '2026-03-21', end_time: '01:00' });
    const b = session({ id: 2, date: '2026-03-21', end_date: '2026-03-21', start_time: '01:00', end_time: '02:00' });
    assert.equal(sessionsOverlap(a, b), false);
    assert.equal(sessionsOverlap(a, { ...b, start_time: '00:30' }), true);
  });
});

/** hasBufferConflict — 2 órás buffer szabály (átfedés nélkül, de túl kicsi rés). */
describe('hasBufferConflict', () => {
  it('flags gap under 2 hours', () => {
    const a = session({ id: 1, start_time: '10:00', end_time: '11:00' });
    const b = session({ id: 2, start_time: '12:00', end_time: '13:00' });
    assert.equal(hasBufferConflict(a, b), true);
  });

  it('allows exactly two hours in either order, but flags shorter gaps and overlap', () => {
    const a = session({ id: 1 });
    const b = session({ id: 2, start_time: '13:00', end_time: '14:00' });
    assert.equal(hasBufferConflict(a, b), false);
    assert.equal(hasBufferConflict(b, a), false);
    assert.equal(hasBufferConflict(a, { ...b, start_time: '12:59' }), true);
    assert.equal(hasBufferConflict(a, a), true);
  });
});

/** checkSessionConflicts — összesített ellenőrzés meglévő előadásokkal szemben. */
describe('checkSessionConflicts', () => {
  it('skips cancelled sessions', () => {
    const existing = [session({ id: 1, status: 'cancelled' })];
    const result = checkSessionConflicts(existing, {
      room_id: 1,
      speaker_id: 1,
      date: '2026-03-20',
      start_time: '10:00',
      end_time: '11:00',
    });
    assert.equal(result.roomOverlap, false);
  });

  it('checks room and speaker conflicts independently and excludes the edited session', () => {
    const candidate = session({ id: 1 });
    const result = checkSessionConflicts([
      candidate,
      session({ id: 2, room_id: 2 }),
      session({ id: 3, speaker_id: 2, start_time: '12:00', end_time: '13:00' }),
      session({ id: 4, room_id: 2, speaker_id: 2 }),
    ], candidate);
    assert.deepEqual(result, { roomOverlap: false, roomBuffer: true, speakerOverlap: true });
  });
});

describe('MariaDB date formatting', () => {
  it('preserves local dates and times for Date values and datetime strings', () => {
    const date = new Date(2026, 2, 20, 9, 5, 7);
    assert.equal(formatDatetime(date), '2026-03-20 09:05:07');
    for (const value of [date, '2026-03-20 09:05:07']) {
      assert.equal(formatDate(value), '2026-03-20');
      assert.equal(formatTime(value), '09:05');
    }
    assert.equal(formatTime('unparsed'), 'unparsed');
  });

  it('maps Date and string rows to the same session while preserving defaults', () => {
    const row = { id: '1', title: 'Test', room_id: '2', speaker_id: '3', status: 'CANCELLED' };
    const strings = sessionFromRow({ ...row, start_time: '2026-03-20 23:00:00', end_time: '2026-03-21 01:00:00' });
    const dates = sessionFromRow({ ...row, start_time: new Date(2026, 2, 20, 23), end_time: new Date(2026, 2, 21, 1) });
    assert.deepEqual(dates, strings);
    assert.equal(dates.end_date, '2026-03-21');
    assert.equal(dates.status, 'cancelled');
    assert.equal(dates.color, 'blue');
    assert.equal(dates.room_name, '');
    assert.equal(dates.description, undefined);
  });
});
