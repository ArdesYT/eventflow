/**
 * Napirend nézet — előadások dátum szerinti csoportosítva.
 * Használat: SessionWorkspace, StatsView, PublicEventsPage. A sorok a közös részletezőt nyitják meg.
 * Props: sessions, sessionSaves (mentések száma), onEventClick.
 */
import type { Session, SessionSavesMap } from '../../backend/types';
import { SESSION_ACCENTS } from '../lib/display';
import { formatSessionTimeRange } from '../lib/sessionBooking';
import { groupSessionsForList, isSessionCancelled, localDateKey } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import { formatWeekdayLong } from '../i18n/dateFormat';
import styles from './AgendaView.module.css';

interface AgendaViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  onEventClick: (id: number) => void;
}

export default function AgendaView({
  sessions,
  sessionSaves,
  onEventClick,
}: AgendaViewProps) {
  const { t, locale } = useI18n();
  const todayStr = localDateKey();

  const { multiDay, singleDayByDate } = groupSessionsForList(sessions);
  const { sortedDates, grouped } = singleDayByDate;

  if (sortedDates.length === 0 && multiDay.length === 0) {
    return (
      <div className={styles['empty-state']}>
        <div className={styles['empty-state-icon']}>📅</div>
        <div>{t('agenda.emptyTitle')}</div>
        <div>{t('agenda.emptySub')}</div>
      </div>
    );
  }

  // A napirend megjelenítési nézet; műveletek az előadás részleteinél érhetők el.
  function renderEvent(ev: Session) {
    const saveCount = sessionSaves?.[ev.id]?.length ?? 0;
    const cancelled = isSessionCancelled(ev);
    return (
      <div
        key={ev.id}
        className={`${styles['agenda-event']}${cancelled ? ` ${styles.cancelled}` : ''}`}
        onClick={() => onEventClick(ev.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onEventClick(ev.id);
          }
        }}
      >
        <div
          className={styles['agenda-event-accent']}
          style={{ background: SESSION_ACCENTS[ev.color] ?? '#1a56db' }}
        />
        <div className={styles['agenda-event-body']}>
          <div className={styles['agenda-event-title']}>
            {ev.title}
            {cancelled && (
              <span className={styles['session-cancelled-badge']}>{t('session.cancelled')}</span>
            )}
          </div>
          <div className={styles['agenda-event-meta']}>
            <span>{formatSessionTimeRange(ev, locale)}</span>
            <span>{ev.room_name}</span>
            <span>🎤 {ev.speaker_name}</span>
            {saveCount > 0 && (
              <span className={styles['agenda-save-badge']}>⭐ {saveCount}</span>
            )}
          </div>
        </div>
        <div className={styles['agenda-event-side']}>
          <span className={styles['room-tag']}>{ev.room_name}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {multiDay.length > 0 && (
        <div className={`${styles['agenda-day']} ${styles['agenda-multiday-section']}`}>
          <div className={`${styles['agenda-date-header']} ${styles['agenda-multiday-header']}`}>
            <div className={styles['agenda-date-circle']}>📅</div>
            <span className={styles['agenda-date-text']}>{t('public.multiDaySection')}</span>
          </div>
          {multiDay.map(renderEvent)}
        </div>
      )}
      {sortedDates.map((ds) => {
        const [y, m, d] = ds.split('-').map(Number);
        const isToday = ds === todayStr;
        const label = formatWeekdayLong(y, m - 1, d, locale);
        return (
          <div key={ds} className={styles['agenda-day']}>
            <div className={styles['agenda-date-header']}>
              <div className={`${styles['agenda-date-circle']}${isToday ? ` ${styles.today}` : ''}`}>{d}</div>
              <span className={styles['agenda-date-text']}>{label}</span>
            </div>
            {grouped[ds].map(renderEvent)}
          </div>
        );
      })}
    </>
  );
}
