import type { Session, User } from '../../backend/types';
import { formatDayHeader, isTodayDateKey } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

interface PublicEventsPageProps {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  user: User;
  onLogout: () => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PublicEventsPage({
  sessions,
  loading,
  error,
  user,
  onLogout,
}: PublicEventsPageProps) {
  const { t, locale } = useI18n();

  const upcoming = [...sessions].sort((a, b) =>
    (a.date + a.start_time).localeCompare(b.date + b.start_time),
  );

  const grouped: Record<string, Session[]> = {};
  upcoming.forEach((s) => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const sortedDates = Object.keys(grouped).sort();
  const totalSessions = upcoming.length;
  const uniqueDays = sortedDates.length;

  return (
    <div className="public-page">
      <header className="public-nav">
        <div className="public-nav-brand">
          <div className="public-nav-logo">EF</div>
          <div>
            <div className="public-nav-name">EventFlow</div>
          </div>
        </div>
        <div className="public-nav-right">
          <LanguageSwitcher />
          <div className="public-user-pill">
            <div className="public-user-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
            <span className="public-user-role">{t('public.attendee')}</span>
          </div>
          <button className="public-logout-btn" onClick={onLogout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <section className="public-hero">
        <div>
          <div className="public-hero-eyebrow">{t('public.programsEyebrow')}</div>
          <h1 className="public-hero-title">{t('public.heroTitle')}</h1>
          <p className="public-hero-sub">{t('public.heroSub')}</p>
        </div>
        <div className="public-hero-stats">
          <div className="public-stat">
            <div className="public-stat-num">{totalSessions}</div>
            <div className="public-stat-label">{t('public.activeEvents')}</div>
          </div>
          <div className="public-stat-divider" />
          <div className="public-stat">
            <div className="public-stat-num">{uniqueDays}</div>
            <div className="public-stat-label">{t('public.programDays')}</div>
          </div>
        </div>
      </section>

      <main className="public-main">
        {loading && <div className="public-status">{t('common.loading')}</div>}
        {error && <div className="public-status error">{error}</div>}

        {!loading && upcoming.length === 0 && !error && (
          <div className="public-empty">
            <div className="empty-icon">📅</div>
            <h3>{t('public.emptyTitle')}</h3>
            <p>{t('public.emptySub')}</p>
          </div>
        )}

        {sortedDates.map((ds) => {
          const header = formatDayHeader(ds, locale);
          const isToday = isTodayDateKey(ds);

          return (
            <section key={ds} className="public-day">
              <header className="public-day-header">
                <div className={'public-day-circle' + (isToday ? ' today' : '')}>
                  {header.dayNum}
                </div>
                <div>
                  <div className="public-day-label">
                    {header.weekday}, {header.monthShort} {header.dayNum}.
                  </div>
                  {isToday && (
                    <div className="public-day-today-tag">{t('public.todayPrograms')}</div>
                  )}
                </div>
              </header>

              <div className="public-session-list">
                {grouped[ds].map((ev) => (
                  <article key={ev.id} className="public-session-card">
                    <div
                      className="public-session-accent"
                      style={{ background: ACCENT[ev.color] ?? ACCENT.blue }}
                    />
                    <div className="public-session-time">
                      <div className="public-time-start">{ev.start_time}</div>
                      <div className="public-time-end">{ev.end_time}</div>
                    </div>
                    <div className="public-session-body">
                      <div className="public-session-title">{ev.title}</div>
                      <div className="public-session-meta">
                        <div className="public-session-speaker">
                          <div className="public-speaker-dot">
                            {getInitials(ev.speaker_name)}
                          </div>
                          <span>{ev.speaker_name}</span>
                        </div>
                        <div
                          className="public-session-room"
                          style={{
                            background: (ACCENT[ev.color] ?? ACCENT.blue) + '22',
                          }}
                        >
                          {ev.room_name}
                        </div>
                      </div>
                      {ev.description && (
                        <p className="public-session-desc">{ev.description}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
