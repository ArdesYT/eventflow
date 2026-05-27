import React, { useMemo, useState } from 'react';
import type { Session } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';

const ROOMS = [
  { id: 1, key: 'mainHall' },
  { id: 2, key: 'roomA' },
  { id: 3, key: 'roomB' },
  { id: 4, key: 'workshop' },
  { id: 5, key: 'outdoorStage' },
];

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function RoomsUsage({ sessions }: { sessions: Session[] }) {
  const { t, bcp47 } = useI18n();
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDate(new Date()));

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of ROOMS) map.set(r.id, 0);

    for (const s of sessions) {
      if (s.date.startsWith(monthKey)) {
        map.set(s.room_id, (map.get(s.room_id) ?? 0) + 1);
      }
    }

    return ROOMS.map((r) => ({ id: r.id, key: r.key, count: map.get(r.id) ?? 0 }));
  }, [sessions, monthKey]);

  const max = Math.max(...counts.map((c) => c.count), 1);

  function prevMonth() {
    const [y, m] = monthKey.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() - 1);
    setMonthKey(monthKeyFromDate(date));
  }
  function nextMonth() {
    const [y, m] = monthKey.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() + 1);
    setMonthKey(monthKeyFromDate(date));
  }

  return (
    <div>
      <div className="cal-nav" style={{ marginBottom: 12 }}>
        <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">◀</button>
        <div className="cal-month-title" style={{ textAlign: 'center' }}>
          {(() => {
            const [y, m] = monthKey.split('-').map(Number);
            const d = new Date(y, m - 1, 1);
            return d.toLocaleDateString(bcp47, { year: 'numeric', month: 'long' });
          })()}
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">▶</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {counts.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 140 }}>{t(`rooms.${c.key}`)}</div>
            <div style={{ flex: 1, background: '#eee', height: 12, borderRadius: 6 }}>
              <div style={{ width: `${(c.count / max) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 6 }} />
            </div>
            <div style={{ width: 48, textAlign: 'right' }}>{c.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
