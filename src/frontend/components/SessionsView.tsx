/**
 * Előadás kártyarács — kereshető lista nézet.
 * Használat: SessionWorkspace; a kapott lista már szűrt.
 * Props: sessions, sessionSaves, searchTerm, onEventClick, selectable/selectedIds/onToggleSelect (tömeges művelethez).
 */
import { getInitials } from '../lib/display';
import type { Session, SessionSavesMap } from '../../backend/types';
import { formatTimeKey } from '../i18n/dateFormat';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled } from '../lib/sessionFormat';
import { formatSessionTimeRange } from '../lib/sessionBooking';
import { useI18n } from '../i18n/I18nProvider';
import styles from './SessionsView.module.css';

interface SessionsViewProps {
  sessions: Session[];
  sessionSaves?: SessionSavesMap;
  searchTerm: string;
  onEventClick: (id: number) => void;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
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
  if (sessions.length === 0) {
    return (
      <div className={styles['empty-state']}>
        <div className={styles['empty-state-icon']}>🔍</div>
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
        {t(sessions.length === 1 ? 'sessions.count' : 'sessions.count_plural', { count: sessions.length })}
      </p>
      <div className={styles['sessions-grid']}>
        {sessions.map((s) => {
          const saveCount = sessionSaves?.[s.id]?.length ?? 0;
          const cancelled = isSessionCancelled(s);
          return (
          <div
            key={s.id}
            className={`${styles['session-card']}${cancelled ? ` ${styles.cancelled}` : ''}${selectable && selectedIds?.has(s.id) ? ` ${styles.selected}` : ''}`}
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
            <div className={styles['session-card-header']}>
              {selectable && onToggleSelect && (
                <input
                  type="checkbox"
                  className={styles['session-select-checkbox']}
                  checked={selectedIds?.has(s.id) ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(s.id)}
                  aria-label={s.title}
                />
              )}
              <span className={styles['room-badge']}>{s.room_name}</span>
              <div className={styles['session-card-header-right']}>
                {saveCount > 0 && (
                  <span className={styles['session-save-badge']} title={t('detail.savedBy')}>
                    ⭐ {saveCount}
                  </span>
                )}
                <span className={styles['session-time-label']}>{formatTimeKey(s.start_time)}</span>
              </div>
            </div>
            <div className={styles['session-title']}>
              {s.title}
              {cancelled && (
                <span className={styles['session-cancelled-badge']}>{t('session.cancelled')}</span>
              )}
            </div>
            <div className={styles['session-speaker']}>
              <div className={styles['speaker-avatar']}>{getInitials(s.speaker_name)}</div>
              {s.speaker_name}
            </div>
            <div className={styles['session-card-footer']}>
              <span className={styles['session-date']}>
                {formatSessionDateRange(s, locale)}
                {isMultiDaySession(s) && (
                  <span className={styles['session-multiday-badge']}>{t('booking.multiDay')}</span>
                )}
              </span>
              <span className={`${styles['session-duration']} ${styles[s.color] ?? ''}`}>
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
