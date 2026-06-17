/**
 * Előadás részletek modal — booker/admin nézet (App, AdminApp).
 * Szerkesztés, duplikálás, törlés, státuszváltás; megjeleníti a mentő felhasználókat is.
 * Props: session, savedBy, savesLoaded, onClose, onDelete, onEdit, onDuplicate, onSetStatus.
 */
import type { Session, SessionSaveUser } from '../../backend/types';
import {
  formatDuration,
  formatSessionTimeRange,
  sessionDurationMinutes,
} from '../lib/sessionBooking';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';

interface DetailModalProps {
  session: Session;
  savedBy?: SessionSaveUser[];
  savesLoaded?: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onSetStatus?: (id: number, status: 'scheduled' | 'cancelled') => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function DetailModal({
  session,
  savedBy,
  savesLoaded,
  onClose,
  onDelete,
  onEdit,
  onDuplicate,
  onSetStatus,
}: DetailModalProps) {
  const { t, locale } = useI18n();
  const showSaves = savesLoaded !== undefined;
  const durationMin = sessionDurationMinutes(session);
  const cancelled = isSessionCancelled(session);

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
            <h2 className="modal-title">
              {session.title}
              {cancelled && (
                <span className="session-cancelled-badge">{t('session.cancelled')}</span>
              )}
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div>
          <div className="detail-row">
            <span className="detail-label">
              {isMultiDaySession(session) ? t('detail.dateRange') : t('detail.date')}
            </span>
            <span className="detail-value">
              {formatSessionDateRange(session, locale)}
              {isMultiDaySession(session) && (
                <span className="detail-multiday-badge">{t('booking.multiDay')}</span>
              )}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.time')}</span>
            <span className="detail-value">
              {formatSessionTimeRange(session, locale)}
              {durationMin > 0 && (
                <span className="detail-duration">
                  {' '}
                  ({t('detail.duration', { duration: formatDuration(durationMin) })})
                </span>
              )}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.room')}</span>
            <span className="detail-value">{session.room_name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('detail.speaker')}</span>
            <div className="detail-value">
              <div>{session.speaker_name}</div>
              {session.speaker_bio?.trim() && (
                <p className="detail-speaker-bio">{session.speaker_bio}</p>
              )}
            </div>
          </div>
          {session.description && (
            <div className="detail-row">
              <span className="detail-label">{t('detail.notes')}</span>
              <span className="detail-value" style={{ fontWeight: 400 }}>
                {session.description}
              </span>
            </div>
          )}
          {showSaves && (
            <div className="detail-row detail-row-saves">
              <span className="detail-label">{t('detail.savedBy')}</span>
              <div className="detail-value detail-saves-value">
                {!savesLoaded ? (
                  <span className="detail-saves-empty">{t('detail.savesUnavailable')}</span>
                ) : !savedBy?.length ? (
                  <span className="detail-saves-empty">{t('detail.noSaves')}</span>
                ) : (
                  <ul className="saved-by-list">
                    {savedBy.map((u) => (
                      <li key={u.id} className="saved-by-item">
                        <div className="saved-by-avatar">{getInitials(u.name)}</div>
                        <div className="saved-by-info">
                          <span className="saved-by-name">{u.name}</span>
                          <span className="saved-by-email">{u.email}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="btn-row">
          {onDuplicate && (
            <button
              type="button"
              className="btn-cancel detail-duplicate-btn"
              onClick={() => {
                onDuplicate(session.id);
                onClose();
              }}
            >
              {t('detail.duplicate')}
            </button>
          )}
          {onEdit && !cancelled && (
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
          {onSetStatus && (
            <button
              type="button"
              className={cancelled ? 'btn-save' : 'btn-cancel session-cancel-btn'}
              onClick={() => {
                onSetStatus(session.id, cancelled ? 'scheduled' : 'cancelled');
                onClose();
              }}
            >
              {cancelled ? t('session.restore') : t('session.cancel')}
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
