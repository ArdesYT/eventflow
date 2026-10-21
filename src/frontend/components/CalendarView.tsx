/**
 * Havi naptár nézet — előadások napokra osztva, max. 3 esemény/cella.
 * Használat: SessionWorkspace, PublicEventsPage (calendar viewMode).
 * Props: curMonth/curYear, sessions, selectedDate, onSelectDay, onEventClick, onNavigate, onToday.
 */
import { useId, useState, type ReactNode } from 'react';
import type { Session } from '../../backend/types';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled, localDateKey, sessionSpansDate } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import { formatDateKey, formatMonthYear, formatTimeKey, getWeekdayLabels } from '../i18n/dateFormat';
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
  appearance?: 'default' | 'team';
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
  appearance = 'default',
}: CalendarViewProps) {
  const { t, locale } = useI18n();
  const calendarId = useId();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const teamAppearance = appearance === 'team';
  const today = new Date();
  const dayLabels = getWeekdayLabels(locale);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const startDow = (new Date(curYear, curMonth, 1).getDay() + 6) % 7;
  const cells: ReactNode[] = [];

  function renderTeamDay(date: Date) {
    const ds = localDateKey(date);
    const isToday = ds === localDateKey(today);
    const isSelected = ds === selectedDate;
    const isOtherMonth = date.getMonth() !== curMonth;
    const dayEvents = sessions.filter((session) => sessionSpansDate(session, ds))
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time) || a.id - b.id);
    const expanded = expandedDays.has(ds);
    const eventsId = `${calendarId}-${ds}`;
    const bookingLabel = `${t('booking.title')}: ${formatDateKey(ds, locale, 'long')}`;

    return (
      <div key={ds} className={`${styles['cal-cell']}${isToday ? ` ${styles.today}` : ''}${isSelected ? ` ${styles.selected}` : ''}${isOtherMonth ? ` ${styles['other-month']}` : ''}`}>
        <button type="button" className={styles['day-target']} onClick={() => onSelectDay(ds)}
          aria-label={bookingLabel} title={bookingLabel} aria-pressed={isSelected} aria-current={isToday ? 'date' : undefined}>
          <span className={styles['day-num']}>{date.getDate()}</span>
          <span className={styles['day-add']} aria-hidden="true">+</span>
        </button>
        <div id={eventsId} className={styles['day-events']}>
          {(expanded ? dayEvents : dayEvents.slice(0, 3)).map((event) => {
            const multiDay = isMultiDaySession(event);
            const continuing = multiDay && ds > event.date;
            const cancelled = isSessionCancelled(event);
            const time = formatTimeKey(event.start_time);
            const label = [
              event.title,
              formatSessionDateRange(event, locale),
              `${time} – ${formatTimeKey(event.end_time)}`,
              event.room_name,
              continuing ? t('booking.multiDayContinues') : '',
              cancelled ? t('session.cancelled') : '',
            ].filter(Boolean).join(' · ');

            return (
              <button key={event.id} type="button"
                className={`${styles['cal-event']} ${styles[event.color] ?? styles.blue}${multiDay ? ` ${styles.multiday}` : ''}${cancelled ? ` ${styles.cancelled}` : ''}`}
                onClick={() => onEventClick(event.id)} aria-label={label} title={label}>
                <span className={styles['event-time']}>{time}</span>{' '}
                <span className={styles['event-title']}>{event.title}</span>
                {continuing && <span className={styles['event-continuation']} aria-hidden="true"> ↳</span>}
              </button>
            );
          })}
          {dayEvents.length > 3 && (
            <button type="button" className={styles['more-events']} aria-expanded={expanded} aria-controls={eventsId}
              onClick={() => setExpandedDays((previous) => {
                const next = new Set(previous);
                if (next.has(ds)) next.delete(ds);
                else next.add(ds);
                return next;
              })}>
              {expanded ? t('calendar.showFewer') : t('calendar.moreEvents', { count: dayEvents.length - 3 })}
            </button>
          )}
        </div>
      </div>
    );
  }

  for (let i = 0; i < startDow; i++) {
    const d = new Date(curYear, curMonth, -startDow + 1 + i);
    if (teamAppearance) {
      cells.push(renderTeamDay(d));
      continue;
    }
    cells.push(
      <div key={`pre${i}`} className={`${styles['cal-cell']} ${styles['other-month']}`}>
        <div className={styles['day-num']}>{d.getDate()}</div>
      </div>,
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    if (teamAppearance) {
      cells.push(renderTeamDay(new Date(curYear, curMonth, d)));
      continue;
    }
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
    if (teamAppearance) {
      cells.push(renderTeamDay(new Date(curYear, curMonth + 1, i)));
      continue;
    }
    cells.push(
      <div key={`post${i}`} className={`${styles['cal-cell']} ${styles['other-month']}`}>
        <div className={styles['day-num']}>{i}</div>
      </div>,
    );
  }

  if (teamAppearance) {
    return (
      <div className={styles['team-calendar']}>
        <div className={styles['cal-nav']}>
          <div>
            <h2 className={styles['cal-month-title']}>{formatMonthYear(curMonth, curYear, locale)}</h2>
            <p className={styles['calendar-subtitle']}>{t('calendar.subtitle')}</p>
          </div>
          <div className={styles['calendar-tools']}>
            <button type="button" className={styles['today-btn']} onClick={onToday}>{t('calendar.today')}</button>
            <button type="button" className={styles['cal-nav-btn']} onClick={() => onNavigate(-1)} aria-label={t('calendar.previousMonth')} title={t('calendar.previousMonth')}>‹</button>
            <button type="button" className={styles['cal-nav-btn']} onClick={() => onNavigate(1)} aria-label={t('calendar.nextMonth')} title={t('calendar.nextMonth')}>›</button>
          </div>
        </div>
        <div className={styles['calendar-grid']}>
          <div className={styles['cal-header-row']}>
            {dayLabels.map((label) => <div key={label} className={styles['cal-header-cell']}>{label}</div>)}
          </div>
          <div className={styles['cal-body']}>{cells}</div>
        </div>
      </div>
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
