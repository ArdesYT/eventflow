import type { ReactNode } from 'react';
import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';
import { formatMonthYear, getMiniWeekdayLabels } from '../i18n/dateFormat';

interface MiniCalendarProps {
  curMonth: number;
  curYear: number;
  sessions: Session[];
  onNavigate: (dir: -1 | 1) => void;
  onSelectDate: (dateStr: string) => void;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function MiniCalendar({
  curMonth,
  curYear,
  sessions,
  onNavigate,
  onSelectDate,
}: MiniCalendarProps) {
  const { locale } = useI18n();
  const today = new Date();
  const dayLabels = getMiniWeekdayLabels(locale);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  let startDow = new Date(curYear, curMonth, 1).getDay() - 1;
  if (startDow < 0) startDow = 6;

  const eventDates = new Set(sessions.map((s) => s.date));

  const cells: ReactNode[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(curYear, curMonth, d);
    const isToday =
      d === today.getDate() &&
      curMonth === today.getMonth() &&
      curYear === today.getFullYear();
    const hasEvent = eventDates.has(ds);
    cells.push(
      <div
        key={ds}
        className={`mini-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}`}
        onClick={() => onSelectDate(ds)}
      >
        {d}
      </div>,
    );
  }

  return (
    <div className="mini-calendar">
      <div className="mini-cal-header">
        <span className="mini-cal-title">{formatMonthYear(curMonth, curYear, locale)}</span>
        <button type="button" className="mini-cal-nav" onClick={() => onNavigate(-1)}>
          &#9664;
        </button>
        <button type="button" className="mini-cal-nav" onClick={() => onNavigate(1)}>
          &#9654;
        </button>
      </div>
      <div className="mini-cal-grid">
        {dayLabels.map((l, i) => (
          <div key={i} className="mini-day-label">
            {l}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
