import type { Session } from '../../backend/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIcsUtc(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00`);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  let out = line.slice(0, max) + '\r\n';
  let rest = line.slice(max);
  while (rest.length > max - 1) {
    out += ' ' + rest.slice(0, max - 1) + '\r\n';
    rest = rest.slice(max - 1);
  }
  return out + ' ' + rest;
}

export function buildIcsCalendar(sessions: Session[], calendarName: string): string {
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

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
