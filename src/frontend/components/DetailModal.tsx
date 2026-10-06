/**
 * Előadás részletek modal — booker/admin nézet (App, AdminApp).
 * Szerkesztés, duplikálás, törlés, státuszváltás; megjeleníti a mentő felhasználókat is.
 * Props: session, savedBy, savesLoaded, onClose, onDelete, onEdit, onDuplicate, onSetStatus.
 */
import type { Session, SessionSaveUser } from '../../backend/types';
import { getInitials } from '../lib/display';
import { isSessionCancelled } from '../lib/sessionFormat';
import { SessionDetailHeader, SessionDetails } from './SessionDetails';
import { useI18n } from '../i18n/I18nProvider';
import styles from './DetailModal.module.css';

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
  const { t } = useI18n();
  const showSaves = savesLoaded !== undefined;
  const cancelled = isSessionCancelled(session);

  return (
    <div className={styles['modal-backdrop']} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <SessionDetailHeader session={session} onClose={onClose} />
        <div>
          <SessionDetails session={session} />
          {showSaves && (
            <div className={`${styles['detail-row']} ${styles['detail-row-saves']}`}>
              <span className={styles['detail-label']}>{t('detail.savedBy')}</span>
              <div className={`${styles['detail-value']} ${styles['detail-saves-value']}`}>
                {!savesLoaded ? (
                  <span className={styles['detail-saves-empty']}>{t('detail.savesUnavailable')}</span>
                ) : !savedBy?.length ? (
                  <span className={styles['detail-saves-empty']}>{t('detail.noSaves')}</span>
                ) : (
                  <ul className={styles['saved-by-list']}>
                    {savedBy.map((u) => (
                      <li key={u.id} className={styles['saved-by-item']}>
                        <div className={styles['saved-by-avatar']}>{getInitials(u.name)}</div>
                        <div className={styles['saved-by-info']}>
                          <span className={styles['saved-by-name']}>{u.name}</span>
                          <span className={styles['saved-by-email']}>{u.email}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={styles['btn-row']}>
          {onDuplicate && (
            <button
              type="button"
              className={`${styles['btn-cancel']} ${styles['detail-duplicate-btn']}`}
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
              className={styles['btn-save']}
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
              className={cancelled ? styles['btn-save'] : `${styles['btn-cancel']} ${styles['session-cancel-btn']}`}
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
            className={styles['btn-danger']}
            onClick={() => {
              onDelete(session.id);
              onClose();
            }}
          >
            {t('common.delete')}
          </button>
          <button type="button" className={styles['btn-save']} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
