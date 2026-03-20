import type { Session, User } from '../../backend/types';

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

function isValidDateString(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function normalizeDateKey(rawDate: string | null | undefined, startTime: string): string {
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  if (isValidDateString(rawDate ?? '')) {
    return new Date(rawDate as string).toISOString().slice(0, 10);
  }
  if (isValidDateString(startTime)) {
    return new Date(startTime).toISOString().slice(0, 10);
  }
  return rawDate ?? '';
}

function formatTime(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }
  return value;
}

export default function PublicEventsPage({
  sessions,
  loading,
  error,
  user,
  onLogout,
}: PublicEventsPageProps) {
  const normalized = sessions.map((s) => {
    const dateKey = normalizeDateKey((s as any).date, s.start_time);
    return {
      ...s,
      date: dateKey,
      __dateKey: dateKey,
      __startLabel: formatTime(s.start_time),
      __endLabel: formatTime(s.end_time),
    } as Session & {
      __dateKey: string;
      __startLabel: string;
      __endLabel: string;
    };
  });

  const cleaned = normalized.filter((s) => isValidDateString(s.__dateKey));

  const upcoming = [...cleaned].sort((a, b) =>
    (a.__dateKey + a.start_time).localeCompare(b.__dateKey + b.start_time),
  );

  const grouped: Record<string, typeof upcoming> = {};
  upcoming.forEach((s) => {
    if (!grouped[s.__dateKey]) grouped[s.__dateKey] = [];
    grouped[s.__dateKey].push(s);
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
          <div className="public-user-pill">
            <div className="public-user-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
            <span className="public-user-role">Attendee</span>
          </div>
          <button className="public-logout-btn" onClick={onLogout}>
            Kijelentkezés
          </button>
        </div>
      </header>

      <section className="public-hero">
        <div>
          <div className="public-hero-eyebrow">Nyilvános programok</div>
          <h1 className="public-hero-title">Események és Előadások</h1>
          <p className="public-hero-sub">
            Fedezze fel a legújabb szakmai programokat, és foglaljon helyet a
            legérdekesebb előadásokra.
          </p>
        </div>
        <div className="public-hero-stats">
          <div className="public-stat">
            <div className="public-stat-num">{totalSessions}</div>
            <div className="public-stat-label">Aktív esemény</div>
          </div>
          <div className="public-stat-divider" />
          <div className="public-stat">
            <div className="public-stat-num">{uniqueDays}</div>
            <div className="public-stat-label">Programnap</div>
          </div>
        </div>
      </section>

      <main className="public-main">
        {loading && <div className="public-status">Adatok betöltése...</div>}
        {error && <div className="public-status error">{error}</div>}

        {!loading && upcoming.length === 0 && !error && (
          <div className="public-empty">
            <div className="empty-icon">📅</div>
            <h3>Nincsenek elérhető események</h3>
            <p>Jelenleg nincs egyetlen ütemezett előadás sem a rendszerben.</p>
          </div>
        )}

        {sortedDates.map((ds) => {
          const dateObj = new Date(ds);
          const isToday =
            isValidDateString(ds) &&
            new Date().toDateString() === dateObj.toDateString();
          const dayNum = dateObj.getDate();
          const monthShort = dateObj
            .toLocaleDateString('hu-HU', { month: 'short' })
            .toUpperCase();
          const weekday = dateObj.toLocaleDateString('hu-HU', {
            weekday: 'long',
          });

          return (
            <section key={ds} className="public-day">
              <header className="public-day-header">
                <div
                  className={
                    'public-day-circle' + (isToday ? ' today' : '')
                  }
                >
                  {dayNum}
                </div>
                <div>
                  <div className="public-day-label">
                    {weekday}, {monthShort} {dayNum}.
                  </div>
                  {isToday && (
                    <div className="public-day-today-tag">Mai programok</div>
                  )}
                </div>
              </header>

              <div className="public-session-list">
                {grouped[ds].map((ev) => (
                  <article key={ev.id} className="public-session-card">
                    <div
                      className="public-session-accent"
                      style={{ background: ACCENT[ev.color] }}
                    />
                    <div className="public-session-time">
                      <div className="public-time-start">{ev.__startLabel}</div>
                      <div className="public-time-end">{ev.__endLabel}</div>
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
                          style={{ background: ACCENT[ev.color] + '22' }}
                        >
                          {ev.room_name}
                        </div>
                      </div>
                      {ev.description && (
                        <p className="public-session-desc">
                          {ev.description}
                        </p>
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