/**
 * Résztvevői előadás-részletek modal — PublicEventsPage.
 * Megjeleníti az előadás adatait; mentés/eltávolítás a saját programhoz (vagy bejelentkezés vendég módban).
 * Props: session, isSaved, busy, guestMode, onClose, onSave, onRemove, onLoginRequest.
 */
import type { Session } from '../../backend/types';
import { isSessionCancelled } from '../lib/sessionFormat';
import { SessionDetailHeader, SessionDetails } from './SessionDetails';
import { useI18n } from '../i18n/I18nProvider';
import styles from './AttendeeDetailModal.module.css';

interface AttendeeDetailModalProps {
  session: Session;
  isSaved: boolean;
  busy: boolean;
  guestMode?: boolean;
  onClose: () => void;
  onSave: () => void;
  onRemove: () => void;
  onLoginRequest?: () => void;
}

export default function AttendeeDetailModal({
  session,
  isSaved,
  busy,
  guestMode = false,
  onClose,
  onSave,
  onRemove,
  onLoginRequest,
}: AttendeeDetailModalProps) {
  const { t } = useI18n();
  const cancelled = isSessionCancelled(session);

  return (
    <div className={styles['modal-backdrop']} onClick={onClose}>
      <div className={`${styles.modal} ${styles['attendee-detail-modal']}`} onClick={(e) => e.stopPropagation()}>
        <SessionDetailHeader session={session} onClose={onClose} />
        <div>
          <SessionDetails session={session} />
        </div>

        <div className={styles['btn-row']}>
          {guestMode ? (
            <button type="button" className={styles['btn-save']} onClick={onLoginRequest}>
              {t('public.loginToSave')}
            </button>
          ) : isSaved ? (
            <button type="button" className={styles['btn-danger']} disabled={busy} onClick={onRemove}>
              {busy ? t('booking.saving') : t('public.removeSaved')}
            </button>
          ) : cancelled ? (
            <span className={styles['attendee-cancelled-note']}>{t('session.cancelledHint')}</span>
          ) : (
            <button type="button" className={styles['btn-save']} disabled={busy} onClick={onSave}>
              {busy ? t('booking.saving') : t('public.saveSession')}
            </button>
          )}
          <button type="button" className={styles['btn-cancel']} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
