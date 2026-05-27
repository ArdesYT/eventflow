import { useState, useEffect } from 'react';
import type { BookingFormData, EventColor } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

interface BookingModalProps {
  saving?: boolean;
  saveError?: string | null;
  initialDate?: string;
  initialValues?: BookingFormData;
  currentUserId?: number;
  currentUserName?: string;
  onSave: (data: BookingFormData) => void;
  onClose: () => void;
}

// Mirror your rooms / speakers tables here, or fetch them from
// GET /api/rooms and GET /api/speakers at mount time.
const ROOMS = [
  { id: 1, key: 'mainHall' },
  { id: 2, key: 'roomA'    },
  { id: 3, key: 'roomB'    },
  { id: 4, key: 'workshop' },
  { id: 5, key: 'outdoorStage' },
];

// Logged-in booker becomes the speaker for created sessions.

const COLORS: EventColor[] = ['blue', 'amber', 'green', 'red'];

function todayStr(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function BookingModal({ initialDate, initialValues, currentUserId, currentUserName, onSave, onClose, saving = false, saveError = null }: BookingModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<BookingFormData>({
    title:        '',
    description:  '',
    date:         initialDate ?? todayStr(),
    start_time:   '09:00',
    end_time:     '10:00',
    room_id:      ROOMS[0].id,
    speaker_id:   currentUserId ?? 1,
    room_name:    t(`rooms.${ROOMS[0].key}`),
    speaker_name: currentUserName ?? 'Speaker',
    color:        'blue',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});

  useEffect(() => {
    if (initialDate) setForm(f => ({ ...f, date: initialDate }));
  }, [initialDate]);

  useEffect(() => {
    if (initialValues) {
      setForm(initialValues);
    }
  }, [initialValues]);

  useEffect(() => {
    if (!initialValues && currentUserName) {
      setForm((f) => ({
        ...f,
        speaker_id: currentUserId ?? f.speaker_id,
        speaker_name: currentUserName,
      }));
    }
  }, [currentUserId, currentUserName, initialValues]);

  // Keep the visible `room_name` translated when locale (t) or selected room changes.
  useEffect(() => {
    setForm((f) => {
      const room = ROOMS.find((r) => r.id === f.room_id) ?? ROOMS[0];
      return { ...f, room_name: t(`rooms.${room.key}`) };
    });
  }, [t, form.room_id]);

  function set<K extends keyof BookingFormData>(key: K, value: BookingFormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function handleRoomChange(id: number) {
    const room = ROOMS.find(r => r.id === id)!;
    setForm(f => ({ ...f, room_id: room.id, room_name: t(`rooms.${room.key}`) }));
  }


  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = t('common.required');
    if (!form.date) errs.date = t('common.required');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (validate()) onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initialValues ? t('booking.editTitle') : t('booking.title')}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label className="form-label">{t('booking.sessionTitle')}</label>
          <input
            className={`form-input${errors.title ? ' error' : ''}`}
            placeholder={t('booking.titlePlaceholder')}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('booking.date')}</label>
            <input
              className={`form-input${errors.date ? ' error' : ''}`}
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('booking.room')}</label>
            <select
              className="form-select"
              value={form.room_id}
              onChange={e => handleRoomChange(Number(e.target.value))}
            >
              {ROOMS.map(r => (
                <option key={r.id} value={r.id}>{t(`rooms.${r.key}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('booking.startTime')}</label>
            <input
              className="form-input"
              type="time"
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('booking.endTime')}</label>
            <input
              className="form-input"
              type="time"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            />
          </div>
        </div>


        <div className="form-group">
          <label className="form-label">{t('booking.speaker')}</label>
          <input
            className="form-input"
            value={form.speaker_name}
            readOnly
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('booking.categoryColor')}</label>
          <div className="color-picker">
            {COLORS.map(c => (
              <div
                key={c}
                className={`color-dot color-${c}${form.color === c ? ' active' : ''}`}
                onClick={() => set('color', c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('booking.description')}</label>
          <textarea
            className="form-textarea"
            placeholder={t('booking.descriptionPlaceholder')}
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {saveError && <div className="login-error" style={{marginBottom:"12px"}}>{saveError}</div>}
        <div className="btn-row">
          <button type="button" className="btn-cancel" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('booking.saving') : t('booking.saveBooking')}
          </button>
        </div>
      </div>
    </div>
  );
}
