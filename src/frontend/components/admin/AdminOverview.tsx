import type { EventProfile, Session, User } from '../../../backend/types';
import { formatSessionDateRange } from '../../lib/sessionFormat';
import { formatTimeKey } from '../../i18n/dateFormat';
import { useI18n } from '../../i18n/I18nProvider';

interface AdminOverviewProps {
  users: User[];
  sessions: Session[];
  event: EventProfile;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminOverview({ users, sessions, event }: AdminOverviewProps) {
  const { t, locale } = useI18n();

  const admins = users.filter((u) => u.role === 'admin').length;
  const bookers = users.filter((u) => u.role === 'booker').length;
  const attendees = users.filter((u) => u.role === 'attendee').length;
  const rooms = new Set(sessions.map((s) => s.room_name)).size;
  const speakers = new Set(sessions.map((s) => s.speaker_name)).size;
  const today = todayStr();
  const upcoming = sessions
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);

  return (
    <>
      <div className="admin-event-summary">
        <h2 className="admin-event-summary-title">{event.name}</h2>
        {event.venue && <p className="admin-event-summary-venue">{event.venue}</p>}
        {event.start_date && event.end_date && (
          <p className="admin-event-summary-dates">
            {formatSessionDateRange(
              { date: event.start_date, end_date: event.end_date },
              locale,
            )}
          </p>
        )}
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('admin.stats.users')}</div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-sub">{t('admin.stats.usersSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('admin.stats.sessions')}</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-sub">{t('admin.stats.sessionsSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('admin.stats.rooms')}</div>
          <div className="stat-value">{rooms}</div>
          <div className="stat-sub">{t('admin.stats.roomsSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('admin.stats.speakers')}</div>
          <div className="stat-value">{speakers}</div>
          <div className="stat-sub">{t('admin.stats.speakersSub')}</div>
        </div>
      </div>

      <div className="section-title">{t('admin.stats.rolesTitle')}</div>
      <div className="admin-role-grid">
        <div className="admin-role-card">
          <span className="hint-badge admin">{t('login.admin')}</span>
          <span className="admin-role-count">{admins}</span>
        </div>
        <div className="admin-role-card">
          <span className="hint-badge booker">{t('login.booker')}</span>
          <span className="admin-role-count">{bookers}</span>
        </div>
        <div className="admin-role-card">
          <span className="hint-badge attendee">{t('login.attendee')}</span>
          <span className="admin-role-count">{attendees}</span>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>
        {t('admin.stats.upcomingTitle')}
      </div>
      {upcoming.length === 0 ? (
        <p className="admin-upcoming-empty">{t('admin.stats.upcomingEmpty')}</p>
      ) : (
        <ul className="admin-upcoming-list">
          {upcoming.map((s) => (
            <li key={s.id} className="admin-upcoming-item">
              <span className="admin-upcoming-date">{formatSessionDateRange(s, locale)}</span>
              <span className="admin-upcoming-time">{formatTimeKey(s.start_time)}</span>
              <span className="admin-upcoming-title">{s.title}</span>
              <span className="admin-upcoming-meta">{s.speaker_name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
