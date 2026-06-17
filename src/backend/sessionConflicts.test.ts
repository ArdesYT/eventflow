/**
 * =============================================================================
 * sessionConflicts.test.ts — Ütközés-ellenőrzés egységtesztek
 * =============================================================================
 *
 * A sessionConflicts.ts exportált függvényeit teszteli (Node.js beépített test runner).
 *
 * Lefedett szabályok:
 *  - sessionsOverlap: időbeli átfedés ugyanabban a teremben
 *  - hasBufferConflict: 2 órás minimális szünet két nem átfedő előadás között
 *  - checkSessionConflicts: lemondott előadások kihagyása az ellenőrzésből
 *
 * Futtatás: npm test (vagy node --test src/backend/sessionConflicts.test.ts)
 * =============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSessionConflicts, hasBufferConflict, sessionsOverlap } from './sessionConflicts';
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
});

/** hasBufferConflict — 2 órás buffer szabály (átfedés nélkül, de túl kicsi rés). */
describe('hasBufferConflict', () => {
  it('flags gap under 2 hours', () => {
    const a = session({ id: 1, start_time: '10:00', end_time: '11:00' });
    const b = session({ id: 2, start_time: '12:00', end_time: '13:00' });
    assert.equal(hasBufferConflict(a, b), true);
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
});
