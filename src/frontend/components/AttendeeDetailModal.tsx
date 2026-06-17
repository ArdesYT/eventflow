/**
 * Résztvevői előadás-részletek modal — PublicEventsPage.
 * Megjeleníti az előadás adatait; mentés/eltávolítás a saját programhoz (vagy bejelentkezés vendég módban).
 * Props: session, isSaved, busy, guestMode, onClose, onSave, onRemove, onLoginRequest.
 */
import type { Session } from '../../backend/types';
import {
  formatDuration,
  formatSessionTimeRange,
  sessionDurationMinutes,
} from '../lib/sessionBooking';
import { formatSessionDateRange, isMultiDaySession, isSessionCancelled } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';

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

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

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
  const { t, locale } = useI18n();
  const durationMin = sessionDurationMinutes(session);
  const cancelled = isSessionCancelled(session);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal attendee-detail-modal" onClick={(e) => e.stopPropagation()}>
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
        </div>

        <div className="btn-row">
          {guestMode ? (
            <button type="button" className="btn-save" onClick={onLoginRequest}>
              {t('public.loginToSave')}
            </button>
          ) : cancelled ? (
            <span className="attendee-cancelled-note">{t('session.cancelledHint')}</span>
          ) : isSaved ? (
            <button type="button" className="btn-danger" disabled={busy} onClick={onRemove}>
              {busy ? t('booking.saving') : t('public.removeSaved')}
            </button>
          ) : (
            <button type="button" className="btn-save" disabled={busy} onClick={onSave}>
              {busy ? t('booking.saving') : t('public.saveSession')}
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
