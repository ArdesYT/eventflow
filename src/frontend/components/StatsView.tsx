/**
 * Statisztika és áttekintés nézet — booker dashboard (App stats nézet).
 * Összesítő kártyák, terem szerinti eloszlás, közelgő előadások AgendaView-val.
 * Props: sessions, sessionSaves, onEventClick (átirányítás a programkezelőbe).
 */
import type { Session, SessionSavesMap } from '../../backend/types';
import AgendaView from './AgendaView';
import { useI18n } from '../i18n/I18nProvider';

interface StatsViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  onEventClick: (id: number) => void;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function StatsView({ sessions, sessionSaves, onEventClick }: StatsViewProps) {
  const { t } = useI18n();
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const uniqueRooms = new Set(sessions.map((s) => s.room_name)).size;
  const uniqueSpeakers = new Set(sessions.map((s) => s.speaker_name)).size;
  const uniqueDays = new Set(sessions.map((s) => s.date)).size;

  const roomCount: Record<string, number> = {};
  sessions.forEach((s) => {
    roomCount[s.room_name] = (roomCount[s.room_name] ?? 0) + 1;
  });
  const sortedRooms = Object.entries(roomCount).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedRooms[0]?.[1] ?? 1;

  const upcoming = sessions
    .filter((s) => s.date >= todayStr)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('stats.totalSessions')}</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-sub">{t('stats.totalSessionsSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('stats.roomsUsed')}</div>
          <div className="stat-value">{uniqueRooms}</div>
          <div className="stat-sub">{t('stats.roomsUsedSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('stats.speakers')}</div>
          <div className="stat-value">{uniqueSpeakers}</div>
          <div className="stat-sub">{t('stats.speakersSub')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('stats.eventDays')}</div>
          <div className="stat-value">{uniqueDays}</div>
          <div className="stat-sub">{t('stats.eventDaysSub')}</div>
        </div>
      </div>

      <div className="section-title">{t('stats.byRoom')}</div>
      <div className="room-bar-container">
        {sortedRooms.map(([room, count]) => (
          <div key={room} className="bar-row">
            <div className="bar-row-header">
              <span className="bar-room-name">{room}</span>
              <span className="bar-count">
                {count === 1
                  ? t('stats.sessionCount', { count })
                  : t('stats.sessionCount_plural', { count })}
              </span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">{t('stats.upcoming')}</div>
      <AgendaView
        sessions={upcoming}
        sessionSaves={sessionSaves}
        onEventClick={onEventClick}
      />
    </>
  );
}
