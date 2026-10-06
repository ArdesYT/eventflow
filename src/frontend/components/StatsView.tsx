/**
 * Statisztika és áttekintés nézet — booker dashboard (App stats nézet).
 * Összesítő kártyák, terem szerinti eloszlás, közelgő előadások AgendaView-val.
 * Props: sessions, sessionSaves, onEventClick (átirányítás a programkezelőbe).
 */
import { localDateKey } from '../lib/sessionFormat';
import type { Session, SessionSavesMap } from '../../backend/types';
import AgendaView from './AgendaView';
import StatCards from './StatCards';
import { useI18n } from '../i18n/I18nProvider';
import styles from './StatsView.module.css';

interface StatsViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  onEventClick: (id: number) => void;
}

export default function StatsView({ sessions, sessionSaves, onEventClick }: StatsViewProps) {
  const { t } = useI18n();
  const todayStr = localDateKey();
  const uniqueSpeakers = new Set(sessions.map((s) => s.speaker_name)).size;
  const uniqueDays = new Set(sessions.map((s) => s.date)).size;

  const roomCount = new Map<string, number>();
  for (const session of sessions) {
    roomCount.set(session.room_name, (roomCount.get(session.room_name) ?? 0) + 1);
  }
  const sortedRooms = [...roomCount].sort((a, b) => b[1] - a[1]);
  const maxCount = sortedRooms[0]?.[1] ?? 1;

  const upcoming = sessions
    .filter((s) => s.date >= todayStr)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);

  return (
    <>
      <StatCards cards={[
        { labelKey: 'stats.totalSessions', value: sessions.length, subKey: 'stats.totalSessionsSub' },
        { labelKey: 'stats.roomsUsed', value: roomCount.size, subKey: 'stats.roomsUsedSub' },
        { labelKey: 'stats.speakers', value: uniqueSpeakers, subKey: 'stats.speakersSub' },
        { labelKey: 'stats.eventDays', value: uniqueDays, subKey: 'stats.eventDaysSub' },
      ]} />

      <div className={styles['section-title']}>{t('stats.byRoom')}</div>
      <div className={styles['room-bar-container']}>
        {sortedRooms.map(([room, count]) => (
          <div key={room} className={styles['bar-row']}>
            <div className={styles['bar-row-header']}>
              <span className={styles['bar-room-name']}>{room}</span>
              <span className={styles['bar-count']}>
                {count === 1
                  ? t('stats.sessionCount', { count })
                  : t('stats.sessionCount_plural', { count })}
              </span>
            </div>
            <div className={styles['bar-track']}>
              <div
                className={styles['bar-fill']}
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles['section-title']}>{t('stats.upcoming')}</div>
      <AgendaView
        sessions={upcoming}
        sessionSaves={sessionSaves}
        onEventClick={onEventClick}
      />
    </>
  );
}
