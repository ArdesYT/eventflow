/**
 * iCalendar (.ics) export — személyes program letöltése.
 *
 * Mit csinál: Session listából RFC 5545 kompatibilis VCALENDAR szöveget készít és letölti.
 * Ki használja: App, AgendaView („Exportálás naptárba”).
 * Fő exportok: {@link buildIcsCalendar}, {@link downloadIcsFile}.
 */

import type { Session } from '../../backend/types';

/** Kétjegyű zero-pad (ICS dátum/idő mezőkhöz) */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC formátum (YYYYMMDDTHHMMSSZ) az időbélyeghez és a session időpontjaihoz. */
function formatIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function toIcsUtc(date: string, time: string): string {
  return formatIcsUtc(new Date(`${date}T${time}:00`));
}

/** ICS speciális karakterek escape-elése a szövegmezőkben */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 sor tördelés max 75 karakter (folytató sorok szóközzel) */
function foldLine(line: string): string {
  const lines = [line.slice(0, 75)];
  for (let offset = 75; offset < line.length; offset += 74) {
    lines.push(` ${line.slice(offset, offset + 74)}`);
  }
  return lines.join('\r\n');
}

/**
 * Teljes ICS naptár szöveg építése session listából.
 * @param sessions - Exportálandó előadások
 * @param calendarName - Megjelenő naptár neve (X-WR-CALNAME)
 * @returns .ics fájl tartalma (CRLF sorvégekkel)
 */
export function buildIcsCalendar(sessions: Session[], calendarName: string): string {
  const dtstamp = formatIcsUtc(new Date());

  const events = sessions.map((s) => {
    const uid = `eventflow-session-${s.id}@eventflow`;
    const summary = escapeIcs(s.title);
    const location = escapeIcs(s.room_name);
    const description = escapeIcs(
      [s.speaker_name, s.description].filter(Boolean).join('\n'),
    );
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(s.date, s.start_time)}`,
      `DTEND:${toIcsUtc(s.end_date ?? s.date, s.end_time)}`,
      foldLine(`SUMMARY:${summary}`),
      location ? foldLine(`LOCATION:${location}`) : '',
      description ? foldLine(`DESCRIPTION:${description}`) : '',
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventFlow//Program//HU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcs(calendarName)}`),
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * ICS fájl generálása és böngészős letöltés indítása.
 * @param sessions - Exportálandó sessionök
 * @param filename - Letöltendő fájlnév (pl. program.ics)
 * @param calendarName - Naptár megjelenítendő neve
 */
export function downloadIcsFile(sessions: Session[], filename: string, calendarName: string): void {
  const content = buildIcsCalendar(sessions, calendarName);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
