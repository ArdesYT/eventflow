import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal schedule-conflict-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('public.scheduleConflictTitle')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="schedule-conflict-intro">
          {t('public.scheduleConflictIntro', { title: session.title })}
        </p>
        <ul className="schedule-conflict-list">
          {conflicts.map((c) => (
            <li key={c.id}>{c.title}</li>
          ))}
        </ul>
        <p className="schedule-conflict-question">{t('public.scheduleConflictConfirm')}</p>
        <div className="btn-row">
          <button type="button" className="btn-save" disabled={busy} onClick={onConfirm}>
            {busy ? t('booking.saving') : t('public.scheduleConflictSaveAnyway')}
          </button>
          <button type="button" className="btn-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
