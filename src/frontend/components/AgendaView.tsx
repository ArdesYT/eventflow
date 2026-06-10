import type { Session, SessionSavesMap } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';
import { formatWeekdayLong } from '../i18n/dateFormat';

interface AgendaViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  onEventClick: (id: number) => void;
  onDelete: (id: number) => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function AgendaView({ sessions, sessionSaves, onEventClick, onDelete }: AgendaViewProps) {
  const { t, locale } = useI18n();
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const grouped: Record<string, Session[]> = {};
  [...sessions]
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .forEach((s) => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });

  const sortedDates = Object.keys(grouped).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <div>{t('agenda.emptyTitle')}</div>
        <div>{t('agenda.emptySub')}</div>
      </div>
    );
  }

  return (
    <>
      {sortedDates.map((ds) => {
        const [y, m, d] = ds.split('-').map(Number);
        const isToday = ds === todayStr;
        const label = formatWeekdayLong(y, m - 1, d, locale);
        return (
          <div key={ds} className="agenda-day">
            <div className="agenda-date-header">
              <div className={`agenda-date-circle${isToday ? ' today' : ''}`}>{d}</div>
              <span className="agenda-date-text">{label}</span>
            </div>
            {grouped[ds].map((ev) => {
              const saveCount = sessionSaves?.[ev.id]?.length ?? 0;
              return (
              <div key={ev.id} className="agenda-event" onClick={() => onEventClick(ev.id)}>
                <div
                  className="agenda-event-accent"
                  style={{ background: ACCENT[ev.color] ?? '#1a56db' }}
                />
                <div className="agenda-event-body">
                  <div className="agenda-event-title">{ev.title}</div>
                  <div className="agenda-event-meta">
                    <span>
                      {ev.start_time} – {ev.end_time}
                    </span>
                    <span>{ev.room_name}</span>
                    <span>🎤 {ev.speaker_name}</span>
                    {saveCount > 0 && (
                      <span className="agenda-save-badge">⭐ {saveCount}</span>
                    )}
                  </div>
                </div>
                <div className="agenda-event-side">
                  <span className="room-tag">{ev.room_name}</span>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(ev.id);
                    }}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
