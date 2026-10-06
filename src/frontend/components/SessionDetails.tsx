import type { Session } from '../../backend/types';
import { SESSION_ACCENTS } from '../lib/display';
import { formatDuration, formatSessionTimeRange, sessionDurationMinutes } from '../lib/sessionBooking';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import styles from './SessionDetails.module.css';

export function SessionDetailHeader({ session, onClose }: { session: Session; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles['modal-header']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: SESSION_ACCENTS[session.color] ?? SESSION_ACCENTS.blue, flexShrink: 0,
        }} />
        <h2 className={styles['modal-title']}>
          {session.title}
          {isSessionCancelled(session) && (
            <span className={styles['session-cancelled-badge']}>{t('session.cancelled')}</span>
          )}
        </h2>
      </div>
      <button type="button" className={styles['modal-close']} onClick={onClose}>×</button>
    </div>
  );
}

export function SessionDetails({ session }: { session: Session }) {
  const { t, locale } = useI18n();
  const multiDay = isMultiDaySession(session);
  const duration = sessionDurationMinutes(session);

  return (
    <>
      <div className={styles['detail-row']}>
        <span className={styles['detail-label']}>{t(multiDay ? 'detail.dateRange' : 'detail.date')}</span>
        <span className={styles['detail-value']}>
          {formatSessionDateRange(session, locale)}
          {multiDay && <span className={styles['detail-multiday-badge']}>{t('booking.multiDay')}</span>}
        </span>
      </div>
      <div className={styles['detail-row']}>
        <span className={styles['detail-label']}>{t('detail.time')}</span>
        <span className={styles['detail-value']}>
          {formatSessionTimeRange(session, locale)}
          {duration > 0 && (
            <span className={styles['detail-duration']}>
              {' '}({t('detail.duration', { duration: formatDuration(duration) })})
            </span>
          )}
        </span>
      </div>
      <div className={styles['detail-row']}>
        <span className={styles['detail-label']}>{t('detail.room')}</span>
        <span className={styles['detail-value']}>{session.room_name}</span>
      </div>
      <div className={styles['detail-row']}>
        <span className={styles['detail-label']}>{t('detail.speaker')}</span>
        <div className={styles['detail-value']}>
          <div>{session.speaker_name}</div>
          {session.speaker_bio?.trim() && <p className={styles['detail-speaker-bio']}>{session.speaker_bio}</p>}
        </div>
      </div>
      {session.description && (
        <div className={styles['detail-row']}>
          <span className={styles['detail-label']}>{t('detail.notes')}</span>
          <span className={styles['detail-value']} style={{ fontWeight: 400 }}>{session.description}</span>
        </div>
      )}
    </>
  );
}
