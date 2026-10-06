/**
 * Terem kihasználtság — havi összesítő és napi idővonal.
 * AdminApp rooms nézet; havi sávdiagram + napi timeline 8–20 óra között.
 * Props: sessions, rooms (opcionális, alapértelmezés FALLBACK_ROOMS).
 */
import { useMemo, useState } from 'react';
import type { Room, Session } from '../../../backend/types';
import { SESSION_ACCENTS } from '../../lib/display';
import { FALLBACK_ROOMS, roomLabel } from '../../lib/rooms';
import { localDateKey, sessionSpansDate } from '../../lib/sessionFormat';
import { formatTimeKey } from '../../i18n/dateFormat';
import { useI18n } from '../../i18n/I18nProvider';

const DAY_START = 8;
const DAY_END = 20;
const DAY_MINUTES = (DAY_END - DAY_START) * 60;

function parseMinutes(time: string): number {
  const m = time.match(/(\d{2}):(\d{2})/);
  if (!m) return DAY_START * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

function clampDayPosition(minutes: number): { left: number; width: number } | null {
  const start = Math.max(minutes, DAY_START * 60);
  const end = Math.min(minutes + 60, DAY_END * 60);
  if (start >= DAY_END * 60) return null;
  const left = ((start - DAY_START * 60) / DAY_MINUTES) * 100;
  const width = Math.max(((end - start) / DAY_MINUTES) * 100, 1.5);
  return { left, width };
}

export default function RoomsUsage({
  sessions,
  rooms = FALLBACK_ROOMS,
}: {
  sessions: Session[];
  rooms?: Room[];
}) {
  const { t, bcp47 } = useI18n();
  const [month, setMonth] = useState(() => new Date());
  const [dayKey, setDayKey] = useState(localDateKey);
  const monthKey = localDateKey(month).slice(0, 7);
  const monthLabel = month.toLocaleDateString(bcp47, { year: 'numeric', month: 'long' });

  // Havi előadásszám teremenként a kiválasztott hónapban
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of sessions) {
      if (s.date.startsWith(monthKey)) {
        map.set(s.room_id, (map.get(s.room_id) ?? 0) + 1);
      }
    }
    return rooms.map((r) => ({ room: r, count: map.get(r.id) ?? 0 }));
  }, [sessions, monthKey, rooms]);

  // Adott nap előadásai (többnapos eseményeket is figyelembe veszi)
  const daySessions = useMemo(
    () => sessions.filter((s) => sessionSpansDate(s, dayKey)),
    [sessions, dayKey],
  );

  const max = Math.max(...counts.map((c) => c.count), 1);

  function navigateMonth(direction: -1 | 1) {
    setMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + direction, 1));
  }

  return (
    <div className="rooms-usage-panel">
      <div className="section-title">{t('admin.rooms.monthlyTitle')}</div>
      <div className="cal-nav" style={{ marginBottom: 12 }}>
        <button type="button" className="cal-nav-btn" onClick={() => navigateMonth(-1)} aria-label="Previous month">◀</button>
        <div className="cal-month-title" style={{ textAlign: 'center' }}>
          {monthLabel}
        </div>
        <button type="button" className="cal-nav-btn" onClick={() => navigateMonth(1)} aria-label="Next month">▶</button>
      </div>

      <div className="rooms-usage-bars">
        {counts.map((c) => (
          <div key={c.room.id} className="rooms-usage-row">
            <div className="rooms-usage-label">{roomLabel(c.room, t)}</div>
            <div className="rooms-usage-track">
              <div
                className="rooms-usage-fill"
                style={{ width: `${(c.count / max) * 100}%` }}
              />
            </div>
            <div className="rooms-usage-count">{c.count}</div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>
        {t('admin.rooms.dailyTitle')}
      </div>
      <div className="rooms-day-picker">
        <input
          type="date"
          className="form-input"
          value={dayKey}
          onChange={(e) => setDayKey(e.target.value)}
        />
      </div>

      <div className="rooms-timeline">
        <div className="rooms-timeline-hours">
          {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i).map((h) => (
            <span key={h} className="rooms-timeline-hour">
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {rooms.map((room) => {
          const roomSessions = daySessions.filter((s) => s.room_id === room.id);
          return (
            <div key={room.id} className="rooms-timeline-row">
              <div className="rooms-timeline-room">{roomLabel(room, t)}</div>
              <div className="rooms-timeline-track">
                {roomSessions.map((s) => {
                  const startMin = parseMinutes(s.start_time);
                  const endMin = parseMinutes(s.end_time);
                  const pos = clampDayPosition(startMin);
                  const endPos = clampDayPosition(endMin - 1);
                  if (!pos) return null;
                  const width =
                    endPos != null
                      ? Math.max(endPos.left + endPos.width - pos.left, 2)
                      : pos.width;
                  return (
                    <div
                      key={s.id}
                      className="rooms-timeline-block"
                      style={{
                        left: `${pos.left}%`,
                        width: `${width}%`,
                        background: SESSION_ACCENTS[s.color] ?? '#1a56db',
                      }}
                      title={`${s.title} (${formatTimeKey(s.start_time)} – ${formatTimeKey(s.end_time)})`}
                    >
                      <span className="rooms-timeline-block-label">{s.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {daySessions.length === 0 && (
        <p className="admin-upcoming-empty">{t('admin.rooms.dailyEmpty')}</p>
      )}
    </div>
  );
}
