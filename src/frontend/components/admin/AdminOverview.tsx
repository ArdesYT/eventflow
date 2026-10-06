/**
 * Admin áttekintő dashboard — statisztikák, szerepkörök, közelgő előadások.
 * AdminApp overview nézet; csak megjelenítés, nincs saját state.
 * Props: users, sessions, event.
 */
import type { EventProfile, Session, User } from '../../../backend/types';
import { formatSessionDateRange, localDateKey } from '../../lib/sessionFormat';
import { formatTimeKey } from '../../i18n/dateFormat';
import { useI18n } from '../../i18n/I18nProvider';
import StatCards from '../StatCards';
import styles from './AdminOverview.module.css';

interface AdminOverviewProps {
  users: User[];
  sessions: Session[];
  event: EventProfile;
}

export default function AdminOverview({ users, sessions, event }: AdminOverviewProps) {
  const { t, locale } = useI18n();

  const rooms = new Set(sessions.map((s) => s.room_name)).size;
  const speakers = new Set(sessions.map((s) => s.speaker_name)).size;
  const today = localDateKey();
  const upcoming = sessions
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);

  return (
    <>
      <div className={styles['admin-event-summary']}>
        <h2 className={styles['admin-event-summary-title']}>{event.name}</h2>
        {event.venue && <p className={styles['admin-event-summary-venue']}>{event.venue}</p>}
        {event.start_date && event.end_date && (
          <p className={styles['admin-event-summary-dates']}>
            {formatSessionDateRange(
              { date: event.start_date, end_date: event.end_date },
              locale,
            )}
          </p>
        )}
      </div>
      <StatCards cards={[
        { labelKey: 'admin.stats.users', value: users.length, subKey: 'admin.stats.usersSub' },
        { labelKey: 'admin.stats.sessions', value: sessions.length, subKey: 'admin.stats.sessionsSub' },
        { labelKey: 'admin.stats.rooms', value: rooms, subKey: 'admin.stats.roomsSub' },
        { labelKey: 'admin.stats.speakers', value: speakers, subKey: 'admin.stats.speakersSub' },
      ]} />

      <div className={styles['section-title']}>{t('admin.stats.rolesTitle')}</div>
      <div className={styles['admin-role-grid']}>
        {(['admin', 'booker', 'attendee'] as const).map((role) => (
          <div key={role} className={styles['admin-role-card']}>
            <span className={`${styles['hint-badge']} ${styles[role] ?? ''}`}>{t(`login.${role}`)}</span>
            <span className={styles['admin-role-count']}>{users.filter((user) => user.role === role).length}</span>
          </div>
        ))}
      </div>

      <div className={styles['section-title']} style={{ marginTop: 28 }}>
        {t('admin.stats.upcomingTitle')}
      </div>
      {upcoming.length === 0 ? (
        <p className={styles['admin-upcoming-empty']}>{t('admin.stats.upcomingEmpty')}</p>
      ) : (
        <ul className={styles['admin-upcoming-list']}>
          {upcoming.map((s) => (
            <li key={s.id} className={styles['admin-upcoming-item']}>
              <span className={styles['admin-upcoming-date']}>{formatSessionDateRange(s, locale)}</span>
              <span className={styles['admin-upcoming-time']}>{formatTimeKey(s.start_time)}</span>
              <span className={styles['admin-upcoming-title']}>{s.title}</span>
              <span className={styles['admin-upcoming-meta']}>{s.speaker_name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
