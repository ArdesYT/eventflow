import type { Session } from '../../backend/types';

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

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function CalendarView({
  curMonth, curYear, sessions, selectedDate,
  onSelectDay, onEventClick, onNavigate, onToday,
}: CalendarViewProps) {
  const today = new Date(2026, 2, 20);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  let startDow = new Date(curYear, curMonth, 1).getDay() - 1;
  if (startDow < 0) startDow = 6;

  const getSessionsForDate = (ds: string) => sessions.filter(s => s.date === ds);
  const cells: JSX.Element[] = [];

  for (let i = 0; i < startDow; i++) {
    const d = new Date(curYear, curMonth, -startDow + 1 + i);
    cells.push(
      <div key={`pre${i}`} className="cal-cell other-month">
        <div className="day-num">{d.getDate()}</div>
      </div>
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
      >
        <div className="day-num">{d}</div>
        {dayEvents.slice(0, 3).map(ev => (
          <div
            key={ev.id}
            className={`cal-event ${ev.color}`}
            onClick={e => { e.stopPropagation(); onEventClick(ev.id); }}
          >
            {ev.start_time} {ev.title}
          </div>
        ))}
        {dayEvents.length > 3 && (
          <div className="more-events">+{dayEvents.length - 3} more</div>
        )}
      </div>
    );
  }

  const totalCells = startDow + daysInMonth;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= trailing; i++) {
    cells.push(
      <div key={`post${i}`} className="cal-cell other-month">
        <div className="day-num">{i}</div>
      </div>
    );
  }

  return (
    <>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)}>&#8592;</button>
        <div className="cal-month-title">{MONTHS[curMonth]} {curYear}</div>
        <button className="today-btn" onClick={onToday}>Today</button>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)}>&#8594;</button>
      </div>
      <div className="calendar-grid">
        <div className="cal-header-row">
          {DAY_LABELS.map(l => <div key={l} className="cal-header-cell">{l}</div>)}
        </div>
        <div className="cal-body">{cells}</div>
      </div>
    </>
  );
}
