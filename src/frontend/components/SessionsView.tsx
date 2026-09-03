/**
 * Előadás kártyarács — kereshető lista nézet.
 * Használat: SessionWorkspace; a kapott lista már szűrt.
 * Props: sessions, sessionSaves, searchTerm, onEventClick, selectable/selectedIds/onToggleSelect (tömeges művelethez).
 */
import type { Session, SessionSavesMap } from '../../backend/types';
import { formatTimeKey } from '../i18n/dateFormat';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled } from '../lib/sessionFormat';
import { formatSessionTimeRange } from '../lib/sessionBooking';
import { useI18n } from '../i18n/I18nProvider';

interface SessionsViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  searchTerm: string;
  onEventClick: (id: number) => void;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SessionsView({
  sessions,
  sessionSaves,
  searchTerm,
  onEventClick,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: SessionsViewProps) {
  const { t, locale } = useI18n();
  const filtered = sessions;

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div>
          {t('sessions.noneFound', {
            query: searchTerm ? t('sessions.noneFoundQuery', { term: searchTerm }) : '',
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--gray-400)' }}>
        {filtered.length === 1
          ? t('sessions.count', { count: filtered.length })
          : t('sessions.count_plural', { count: filtered.length })}
      </p>
      <div className="sessions-grid">
        {filtered.map((s) => {
          const saveCount = sessionSaves?.[s.id]?.length ?? 0;
          return (
          <div
            key={s.id}
            className={
              'session-card' +
              (isSessionCancelled(s) ? ' cancelled' : '') +
              (selectable && selectedIds?.has(s.id) ? ' selected' : '')
            }
            onClick={() => onEventClick(s.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onEventClick(s.id);
              }
            }}
          >
            <div className="session-card-header">
              {selectable && onToggleSelect && (
                <input
                  type="checkbox"
                  className="session-select-checkbox"
                  checked={selectedIds?.has(s.id) ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(s.id)}
                  aria-label={s.title}
                />
              )}
              <span className="room-badge">{s.room_name}</span>
              <div className="session-card-header-right">
                {saveCount > 0 && (
                  <span className="session-save-badge" title={t('detail.savedBy')}>
                    ⭐ {saveCount}
                  </span>
                )}
                <span className="session-time-label">{formatTimeKey(s.start_time)}</span>
              </div>
            </div>
            <div className="session-title">
              {s.title}
              {isSessionCancelled(s) && (
                <span className="session-cancelled-badge">{t('session.cancelled')}</span>
              )}
            </div>
            <div className="session-speaker">
              <div className="speaker-avatar">{getInitials(s.speaker_name)}</div>
              {s.speaker_name}
            </div>
            <div className="session-card-footer">
              <span className="session-date">
                {formatSessionDateRange(s, locale)}
                {isMultiDaySession(s) && (
                  <span className="session-multiday-badge">{t('booking.multiDay')}</span>
                )}
              </span>
              <span className={`session-duration ${s.color}`}>
                {formatSessionTimeRange(s, locale)}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </>
  );
}
