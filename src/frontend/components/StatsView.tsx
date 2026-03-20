import type { Session } from '../../backend/types';
import AgendaView from './AgendaView';

interface StatsViewProps {
  sessions: Session[];
  onEventClick: (id: number) => void;
  onDelete: (id: number) => void;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function StatsView({ sessions, onEventClick, onDelete }: StatsViewProps) {
  const today = new Date(2026, 2, 20);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const uniqueRooms    = new Set(sessions.map(s => s.room_name)).size;
  const uniqueSpeakers = new Set(sessions.map(s => s.speaker_name)).size;
  const uniqueDays     = new Set(sessions.map(s => s.date)).size;

  const roomCount: Record<string, number> = {};
  sessions.forEach(s => { roomCount[s.room_name] = (roomCount[s.room_name] ?? 0) + 1; });
  const sortedRooms = Object.entries(roomCount).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedRooms[0]?.[1] ?? 1;

  const upcoming = sessions
    .filter(s => s.date >= todayStr)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-sub">Across all rooms</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rooms Used</div>
          <div className="stat-value">{uniqueRooms}</div>
          <div className="stat-sub">Active venues</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Speakers</div>
          <div className="stat-value">{uniqueSpeakers}</div>
          <div className="stat-sub">Unique presenters</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Event Days</div>
          <div className="stat-value">{uniqueDays}</div>
          <div className="stat-sub">This month</div>
        </div>
      </div>

      <div className="section-title">Sessions by Room</div>
      <div className="room-bar-container">
        {sortedRooms.map(([room, count]) => (
          <div key={room} className="bar-row">
            <div className="bar-row-header">
              <span className="bar-room-name">{room}</span>
              <span className="bar-count">{count} session{count > 1 ? 's' : ''}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.round(count / maxCount * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Upcoming Sessions</div>
      <AgendaView sessions={upcoming} onEventClick={onEventClick} onDelete={onDelete} />
    </>
  );
}
