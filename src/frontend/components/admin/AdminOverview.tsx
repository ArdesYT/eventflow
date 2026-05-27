import type { Session, User } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';

interface AdminOverviewProps {
  users: User[];
  sessions: Session[];
}

export default function AdminOverview({ users, sessions }: AdminOverviewProps) {
  const { t } = useI18n();

  const admins = users.filter((u) => u.role === 'admin').length;
  const bookers = users.filter((u) => u.role === 'booker').length;
  const attendees = users.filter((u) => u.role === 'attendee').length;
  const rooms = new Set(sessions.map((s) => s.room_name)).size;
  const speakers = new Set(sessions.map((s) => s.speaker_name)).size;

  return (
    <>
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
    </>
  );
}
