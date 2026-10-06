/**
 * Ütközés figyelmeztető modal — résztvevői nézet (PublicEventsPage).
 * Megjelenik, ha a felhasználó menteni akar egy előadást, ami átfed a saját programjával.
 * Props: session (mentendő), conflicts (ütköző előadások), busy, onConfirm (mentés mégis), onClose.
 */
import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';
import styles from './ScheduleConflictModal.module.css';

interface ScheduleConflictModalProps {
  session: Session;
  conflicts: Session[];
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ScheduleConflictModal({
  session,
  conflicts,
  busy = false,
  onConfirm,
  onClose,
}: ScheduleConflictModalProps) {
  const { t } = useI18n();

  return (
    <div className={styles['modal-backdrop']} onClick={onClose}>
      <div className={`${styles.modal} ${styles['schedule-conflict-modal']}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h2 className={styles['modal-title']}>{t('public.scheduleConflictTitle')}</h2>
          <button type="button" className={styles['modal-close']} onClick={onClose}>
            ×
          </button>
        </div>
        <p className={styles['schedule-conflict-intro']}>
          {t('public.scheduleConflictIntro', { title: session.title })}
        </p>
        <ul className={styles['schedule-conflict-list']}>
          {conflicts.map((c) => (
            <li key={c.id}>{c.title}</li>
          ))}
        </ul>
        <p className={styles['schedule-conflict-question']}>{t('public.scheduleConflictConfirm')}</p>
        <div className={styles['btn-row']}>
          <button type="button" className={styles['btn-save']} disabled={busy} onClick={onConfirm}>
            {busy ? t('booking.saving') : t('public.scheduleConflictSaveAnyway')}
          </button>
          <button type="button" className={styles['btn-cancel']} onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
