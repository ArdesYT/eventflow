import type { Session } from '../../Backend/types';

interface AgendaViewProps {
  sessions: Session[];
  onEventClick: (id: number) => void;
  onDelete: (id: number) => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db', amber: '#f59e0b', green: '#057a55', red: '#e02424',
};

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function AgendaView({ sessions, onEventClick, onDelete }: AgendaViewProps) {
  const today = new Date(2026, 2, 20);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const grouped: Record<string, Session[]> = {};
  [...sessions]
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });

  const sortedDates = Object.keys(grouped).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <div>No sessions scheduled yet.</div>
        <div>Click "+ New Booking" to add one.</div>
      </div>
    );
  }

  return (
    <>
      {sortedDates.map(ds => {
        const [y, m, d] = ds.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const isToday = ds === todayStr;
        const label = date.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
        });
        return (
          <div key={ds} className="agenda-day">
            <div className="agenda-date-header">
              <div className={`agenda-date-circle${isToday ? ' today' : ''}`}>{d}</div>
              <span className="agenda-date-text">{label}</span>
            </div>
            {grouped[ds].map(ev => (
              <div key={ev.id} className="agenda-event" onClick={() => onEventClick(ev.id)}>
                <div className="agenda-event-accent" style={{ background: ACCENT[ev.color] ?? '#1a56db' }} />
                <div className="agenda-event-body">
                  <div className="agenda-event-title">{ev.title}</div>
                  <div className="agenda-event-meta">
                    <span>{ev.start_time} – {ev.end_time}</span>
                    <span>{ev.room_name}</span>
                    <span>🎤 {ev.speaker_name}</span>
                  </div>
                </div>
                <div className="agenda-event-side">
                  <span className="room-tag">{ev.room_name}</span>
                  <button
                    className="delete-btn"
                    onClick={e => { e.stopPropagation(); onDelete(ev.id); }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
