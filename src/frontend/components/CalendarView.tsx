/**
 * Havi naptár nézet — előadások napokra osztva, max. 3 esemény/cella.
 * Használat: SessionWorkspace, PublicEventsPage (calendar viewMode).
 * Props: curMonth/curYear, sessions, selectedDate, onSelectDay, onEventClick, onNavigate, onToday.
 */
import type { ReactNode } from 'react';
import type { Session } from '../../backend/types';
import { isMultiDaySession, sessionSpansDate } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import { formatMonthYear, getWeekdayLabels } from '../i18n/dateFormat';

interface CalendarViewProps {
  curMonth: number;
  curYear: number;
  sessions: Session[];
  selectedDate: string | null;
  onSelectDay: (dateStr: string) => void;
  onEventClick: (id: number) => void;
  onNavigate: (dir: -1 | 1) => void;
  onToday: () => void;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarView({
  curMonth,
  curYear,
  sessions,
  selectedDate,
  onSelectDay,
  onEventClick,
  onNavigate,
  onToday,
}: CalendarViewProps) {
  const { t, locale } = useI18n();
  const today = new Date();
  const dayLabels = getWeekdayLabels(locale);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  let startDow = new Date(curYear, curMonth, 1).getDay() - 1;
  if (startDow < 0) startDow = 6;

  const getSessionsForDate = (ds: string) => sessions.filter((s) => sessionSpansDate(s, ds));
  const cells: ReactNode[] = [];

  for (let i = 0; i < startDow; i++) {
    const d = new Date(curYear, curMonth, -startDow + 1 + i);
    cells.push(
      <div key={`pre${i}`} className="cal-cell other-month">
        <div className="day-num">{d.getDate()}</div>
      </div>,
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(curYear, curMonth, d);
    const isToday =
      d === today.getDate() &&
      curMonth === today.getMonth() &&
      curYear === today.getFullYear();
    const isSel = ds === selectedDate;
    const dayEvents = getSessionsForDate(ds);
    cells.push(
      <div
        key={ds}
        className={`cal-cell${isToday ? ' today' : ''}${isSel ? ' selected' : ''}`}
        onClick={() => onSelectDay(ds)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelectDay(ds);
          }
        }}
      >
        <div className="day-num">{d}</div>
        {dayEvents.slice(0, 3).map((ev) => (
          <div
            key={ev.id}
            className={`cal-event ${ev.color}${isMultiDaySession(ev) ? ' multiday' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(ev.id);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onEventClick(ev.id);
              }
            }}
          >
            {ev.title}
          </div>
        ))}
        {dayEvents.length > 3 && (
          <div className="more-events">
            {t('calendar.moreEvents', { count: dayEvents.length - 3 })}
          </div>
        )}
      </div>,
    );
  }

  const trailing = (7 - ((startDow + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells.push(
      <div key={`post${i}`} className="cal-cell other-month">
        <div className="day-num">{i}</div>
      </div>,
    );
  }

  return (
    <>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)}>
          &#8592;
        </button>
        <div className="cal-month-title">{formatMonthYear(curMonth, curYear, locale)}</div>
        <button className="today-btn" onClick={onToday}>
          {t('calendar.today')}
        </button>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)}>
          &#8594;
        </button>
      </div>
      <div className="calendar-grid">
        <div className="cal-header-row">
          {dayLabels.map((l) => (
            <div key={l} className="cal-header-cell">
              {l}
            </div>
          ))}
        </div>
        <div className="cal-body">{cells}</div>
      </div>
    </>
  );
}
