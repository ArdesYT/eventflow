import { useState, useEffect, useMemo, useRef } from 'react';
import type { BookingFormData, EventColor, Speaker } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

const NEW_SPEAKER_ID = 0;

interface BookingModalProps {
  saving?: boolean;
  saveError?: string | null;
  initialDate?: string;
  initialValues?: BookingFormData;
  currentUserId?: number;
  currentUserName?: string;
  allowSpeakerEdit?: boolean;
  speakers?: Speaker[];
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

export default function BookingModal({
  initialDate,
  initialValues,
  currentUserId,
  currentUserName,
  allowSpeakerEdit = false,
  speakers = [],
  onSave,
  onClose,
  saving = false,
  saveError = null,
}: BookingModalProps) {
  const { t } = useI18n();
  const [customSpeakerName, setCustomSpeakerName] = useState('');
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
  const initializedEditKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialDate) setForm(f => ({ ...f, date: initialDate }));
  }, [initialDate]);

  useEffect(() => {
    if (!initialValues) {
      initializedEditKeyRef.current = null;
      return;
    }

    const editKey = [
      initialValues.date,
      initialValues.start_time,
      initialValues.end_time,
      initialValues.speaker_id,
      initialValues.title,
    ].join('\0');

    if (initializedEditKeyRef.current === editKey) return;

    initializedEditKeyRef.current = editKey;
    setForm(initialValues);
    setCustomSpeakerName('');
  }, [initialValues, speakers]);

  const speakerOptions = useMemo(() => {
    const list = [...speakers];
    if (
      form.speaker_id &&
      form.speaker_id !== NEW_SPEAKER_ID &&
      !list.some((s) => s.id === form.speaker_id)
    ) {
      list.unshift({ id: form.speaker_id, name: form.speaker_name });
    }
    return list;
  }, [speakers, form.speaker_id, form.speaker_name]);

  const isCustomSpeaker =
    allowSpeakerEdit &&
    (form.speaker_id === NEW_SPEAKER_ID ||
      !speakerOptions.some((s) => s.id === form.speaker_id));

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

  function handleSpeakerSelect(speakerId: number) {
    if (speakerId === NEW_SPEAKER_ID) {
      setCustomSpeakerName('');
      setForm((f) => ({
        ...f,
        speaker_id: NEW_SPEAKER_ID,
        speaker_name: '',
      }));
      return;
    }
    const speaker = speakerOptions.find((s) => s.id === speakerId);
    if (speaker) {
      setForm((f) => ({
        ...f,
        speaker_id: speaker.id,
        speaker_name: speaker.name,
      }));
      setCustomSpeakerName('');
    }
  }

  function handleCustomSpeakerName(value: string) {
    setCustomSpeakerName(value);
    setForm((f) => ({
      ...f,
      speaker_id: NEW_SPEAKER_ID,
      speaker_name: value,
    }));
  }

  function handleSave() {
    if (!validate()) return;
    const payload =
      isCustomSpeaker && customSpeakerName.trim()
        ? { ...form, speaker_id: NEW_SPEAKER_ID, speaker_name: customSpeakerName.trim() }
        : form;
    if (allowSpeakerEdit && !payload.speaker_name.trim()) {
      setErrors((e) => ({ ...e, speaker_name: t('common.required') }));
      return;
    }
    onSave(payload);
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
          {allowSpeakerEdit ? (
            <>
              <select
                className="form-select"
                value={isCustomSpeaker ? NEW_SPEAKER_ID : form.speaker_id}
                onChange={(e) => handleSpeakerSelect(Number(e.target.value))}
              >
                {speakerOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={NEW_SPEAKER_ID}>{t('booking.newSpeaker')}</option>
              </select>
              {isCustomSpeaker && (
                <input
                  className={`form-input${errors.speaker_name ? ' error' : ''}`}
                  style={{ marginTop: 8 }}
                  placeholder={t('booking.newSpeakerPlaceholder')}
                  value={customSpeakerName}
                  onChange={(e) => handleCustomSpeakerName(e.target.value)}
                />
              )}
            </>
          ) : (
            <input className="form-input" value={form.speaker_name} readOnly />
          )}
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
