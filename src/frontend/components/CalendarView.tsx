/**
 * Havi naptár nézet — előadások napokra osztva, max. 3 esemény/cella.
 * Használat: SessionWorkspace, PublicEventsPage (calendar viewMode).
 * Props: curMonth/curYear, sessions, selectedDate, onSelectDay, onEventClick, onNavigate, onToday.
 */
import type { ReactNode } from 'react';
import type { Session } from '../../backend/types';
import { isMultiDaySession, localDateKey, sessionSpansDate } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import { formatMonthYear, getWeekdayLabels } from '../i18n/dateFormat';
import styles from './CalendarView.module.css';

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
  const startDow = (new Date(curYear, curMonth, 1).getDay() + 6) % 7;
  const cells: ReactNode[] = [];

  for (let i = 0; i < startDow; i++) {
    const d = new Date(curYear, curMonth, -startDow + 1 + i);
    cells.push(
      <div key={`pre${i}`} className={`${styles['cal-cell']} ${styles['other-month']}`}>
        <div className={styles['day-num']}>{d.getDate()}</div>
      </div>,
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = localDateKey(new Date(curYear, curMonth, d));
    const isToday =
      d === today.getDate() &&
      curMonth === today.getMonth() &&
      curYear === today.getFullYear();
    const isSel = ds === selectedDate;
    const dayEvents = sessions.filter((s) => sessionSpansDate(s, ds));
    cells.push(
      <div
        key={ds}
        className={`${styles['cal-cell']}${isToday ? ` ${styles.today}` : ''}${isSel ? ` ${styles.selected}` : ''}`}
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
        <div className={styles['day-num']}>{d}</div>
        {dayEvents.slice(0, 3).map((ev) => (
          <div
            key={ev.id}
            className={`${styles['cal-event']} ${styles[ev.color] ?? ''}${isMultiDaySession(ev) ? ` ${styles.multiday}` : ''}`}
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
          <div className={styles['more-events']}>
            {t('calendar.moreEvents', { count: dayEvents.length - 3 })}
          </div>
        )}
      </div>,
    );
  }

  const trailing = (7 - ((startDow + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells.push(
      <div key={`post${i}`} className={`${styles['cal-cell']} ${styles['other-month']}`}>
        <div className={styles['day-num']}>{i}</div>
      </div>,
    );
  }

  return (
    <>
      <div className={styles['cal-nav']}>
        <button className={styles['cal-nav-btn']} onClick={() => onNavigate(-1)}>
          &#8592;
        </button>
        <div className={styles['cal-month-title']}>{formatMonthYear(curMonth, curYear, locale)}</div>
        <button className={styles['today-btn']} onClick={onToday}>
          {t('calendar.today')}
        </button>
        <button className={styles['cal-nav-btn']} onClick={() => onNavigate(1)}>
          &#8594;
        </button>
      </div>
      <div className={styles['calendar-grid']}>
        <div className={styles['cal-header-row']}>
          {dayLabels.map((l) => (
            <div key={l} className={styles['cal-header-cell']}>
              {l}
            </div>
          ))}
        </div>
        <div className={styles['cal-body']}>{cells}</div>
      </div>
    </>
  );
}
