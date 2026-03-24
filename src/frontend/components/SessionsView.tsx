import type { Session } from '../../Backend/types';

interface SessionsViewProps {
  sessions: Session[];
  searchTerm: string;
  onEventClick: (id: number) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function SessionsView({ sessions, searchTerm, onEventClick }: SessionsViewProps) {
  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.speaker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.room_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div>No sessions found{searchTerm ? ` for "${searchTerm}"` : ''}.</div>
      </div>
    );
  }

  return (
    <>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--gray-400)' }}>
        {filtered.length} session{filtered.length !== 1 ? 's' : ''}
      </p>
      <div className="sessions-grid">
        {filtered.map(s => (
          <div key={s.id} className="session-card" onClick={() => onEventClick(s.id)}>
            <div className="session-card-header">
              <span className="room-badge">{s.room_name}</span>
              <span className="session-time-label">{s.start_time}</span>
            </div>
            <div className="session-title">{s.title}</div>
            <div className="session-speaker">
              <div className="speaker-avatar">{getInitials(s.speaker_name)}</div>
              {s.speaker_name}
            </div>
            <div className="session-card-footer">
              <span className="session-date">{String(s.date).slice(0, 10)}</span>
              <span className={`session-duration ${s.color}`}>
                {String(s.start_time).slice(0,5)} – {String(s.end_time).slice(0,5)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
