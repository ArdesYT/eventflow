import type { Session, User } from '../../backend/types';

interface PublicEventsPageProps {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  user: User;
  onLogout: () => void;
}

const ACCENT: Record<string, string> = { blue: '#1a56db', amber: '#f59e0b', green: '#057a55', red: '#e02424' };

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PublicEventsPage({ sessions, loading, error, user, onLogout }: PublicEventsPageProps) {
  // Rendezés időrendbe, szűrés nélkül, hogy minden látsszon
  const upcoming = [...sessions].sort((a, b) => 
    (a.date + a.start_time).localeCompare(b.date + b.start_time)
  );

  const grouped: Record<string, Session[]> = {};
  upcoming.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="public-page">
      <header className="public-header">
        <div className="public-header-content">
          <div className="public-logo">
            <div className="logo-icon">EF</div>
            <span className="logo-text">EventFlow</span>
          </div>
          <div className="public-user-nav">
            <span className="public-welcome">Üdvözöljük, <strong>{user.name}</strong>!</span>
            <button className="public-logout-btn" onClick={onLogout}>Kijelentkezés</button>
          </div>
        </div>
      </header>

      <main className="public-main">
        <div className="public-hero">
          <h1>Események és Előadások</h1>
          <p>Fedezze fel a legújabb szakmai programokat és foglaljon helyet.</p>
        </div>

        {loading && <div className="public-status">Adatok betöltése...</div>}
        {error && <div className="public-status error">{error}</div>}
        
        {!loading && upcoming.length === 0 && (
          <div className="public-empty">
            <div className="empty-icon">📅</div>
            <h3>Nincsenek elérhető események</h3>
            <p>Jelenleg nincs egyetlen ütemezett előadás sem a rendszerben.</p>
          </div>
        )}

        {sortedDates.map(ds => {
          const dateObj = new Date(ds);
          return (
            <section key={ds} className="public-date-section">
              <div className="public-date-sidebar">
                <div className="public-date-card">
                  <div className="public-month">
                    {dateObj.toLocaleDateString('hu-HU', { month: 'short' }).toUpperCase()}
                  </div>
                  <div className="public-day">{dateObj.getDate()}</div>
                </div>
              </div>
              <div className="public-session-list">
                {grouped[ds].map(ev => (
                  <div key={ev.id} className="public-session-card">
                    <div className="public-session-accent" style={{ background: ACCENT[ev.color] }} />
                    <div className="public-session-time">
                      <div className="public-time-start">{ev.start_time}</div>
                      <div className="public-time-divider"></div>
                      <div className="public-time-end">{ev.end_time}</div>
                    </div>
                    <div className="public-session-body">
                      <div className="public-session-title">{ev.title}</div>
                      <div className="public-session-meta">
                        <div className="public-speaker">
                          <div className="public-avatar">{getInitials(ev.speaker_name)}</div>
                          <span>{ev.speaker_name}</span>
                        </div>
                        <div className="public-room-badge">{ev.room_name}</div>
                      </div>
                      {ev.description && <p className="public-description">{ev.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}