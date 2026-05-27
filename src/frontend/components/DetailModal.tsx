import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

interface DetailModalProps {
  session: Session;
  onClose: () => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number) => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

export default function DetailModal({ session, onClose, onDelete, onEdit }: DetailModalProps) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: ACCENT[session.color] ?? '#1a56db',
                flexShrink: 0,
              }}
            />
            <h2 className="modal-title">{session.title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.date')}</span>
            <span className="detail-value">{session.date}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.time')}</span>
            <span className="detail-value">
              {session.start_time} – {session.end_time}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.room')}</span>
            <span className="detail-value">{session.room_name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.speaker')}</span>
            <span className="detail-value">{session.speaker_name}</span>
          </div>
          {session.description && (
            <div className="detail-row">
              <span className="detail-label">{t('detail.notes')}</span>
              <span className="detail-value" style={{ fontWeight: 400 }}>
                {session.description}
              </span>
            </div>
          )}
        </div>
        <div className="btn-row">
          {onEdit && (
            <button
              type="button"
              className="btn-save"
              onClick={() => {
                onEdit(session.id);
                onClose();
              }}
            >
              {t('common.edit')}
            </button>
          )}
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              onDelete(session.id);
              onClose();
            }}
          >
            {t('common.delete')}
          </button>
          <button type="button" className="btn-save" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
