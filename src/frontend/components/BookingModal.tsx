import { useState, useEffect, useMemo, useRef } from 'react';
import type { BookingFormData, EventColor, Room, Session, SessionTemplateId, Speaker } from '../../backend/types';
import { FALLBACK_ROOMS, roomLabel } from '../lib/rooms';
import {
  applySessionTemplate,
  bookingDayCount,
  bookingDurationMinutes,
  findBookingConflicts,
  formatDuration,
  SESSION_TEMPLATES,
  validateBookingTimes,
} from '../lib/sessionBooking';
import LocalizedDateInput from './LocalizedDateInput';
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
  allowNewSpeaker?: boolean;
  speakers?: Speaker[];
  sessions?: Session[];
  rooms?: Room[];
  editingSessionId?: number | null;
  allowedRoomIds?: number[];
  onSave: (data: BookingFormData) => void;
  onClose: () => void;
}

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
  allowNewSpeaker = true,
  speakers = [],
  sessions = [],
  rooms = FALLBACK_ROOMS,
  editingSessionId = null,
  allowedRoomIds,
  onSave,
  onClose,
  saving = false,
  saveError = null,
}: BookingModalProps) {
  const { t, bcp47 } = useI18n();
  const [customSpeakerName, setCustomSpeakerName] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [form, setForm] = useState<BookingFormData>({
    title:        '',
    description:  '',
    date:         initialDate ?? todayStr(),
    end_date:     initialDate ?? todayStr(),
    start_time:   '09:00',
    end_time:     '10:00',
    room_id:      rooms[0]?.id ?? 1,
    speaker_id:   currentUserId ?? 1,
    room_name:    rooms[0] ? roomLabel(rooms[0], t) : '',
    speaker_name: currentUserName ?? 'Speaker',
    color:        'blue',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});
  const initializedEditKeyRef = useRef<string | null>(null);
  const speakerTouchedRef = useRef(false);

  useEffect(() => {
    if (initialDate) {
      setForm((f) => ({
        ...f,
        date: initialDate,
        end_date: f.end_date < initialDate ? initialDate : f.end_date || initialDate,
      }));
    }
  }, [initialDate]);

  useEffect(() => {
    if (!initialValues) {
      initializedEditKeyRef.current = null;
      return;
    }

    const editKey = [
      initialValues.date,
      initialValues.end_date,
      initialValues.start_time,
      initialValues.end_time,
      initialValues.speaker_id,
      initialValues.title,
    ].join('\0');

    if (initializedEditKeyRef.current === editKey) return;

    initializedEditKeyRef.current = editKey;
    setForm(initialValues);
    setCustomSpeakerName(
      initialValues.speaker_id === NEW_SPEAKER_ID ? initialValues.speaker_name : '',
    );
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

  const filteredSpeakerOptions = useMemo(() => {
    const q = speakerFilter.trim().toLowerCase();
    if (!q) return speakerOptions;
    return speakerOptions.filter((s) => s.name.toLowerCase().includes(q));
  }, [speakerOptions, speakerFilter]);

  const showSpeakerFilter = allowSpeakerEdit && speakerOptions.length > 4;

  const isCustomSpeaker =
    allowSpeakerEdit &&
    allowNewSpeaker &&
    (form.speaker_id === NEW_SPEAKER_ID ||
      !speakerOptions.some((s) => s.id === form.speaker_id));

  useEffect(() => {
    if (initialValues || !currentUserName || !allowSpeakerEdit) return;
    if (speakerTouchedRef.current) return;

    const byName = speakers.find(
      (s) => s.name.toLowerCase() === currentUserName.toLowerCase(),
    );
    const byId =
      allowNewSpeaker && currentUserId
        ? speakers.find((s) => s.id === currentUserId)
        : undefined;
    const self = byName ?? byId;

    if (!self) return;

    setForm((f) => ({
      ...f,
      speaker_id: self.id,
      speaker_name: self.name,
    }));
  }, [currentUserId, currentUserName, initialValues, allowSpeakerEdit, allowNewSpeaker, speakers]);

  // Keep the visible `room_name` translated when locale (t) or selected room changes.
  useEffect(() => {
    setForm((f) => {
      const room = rooms.find((r) => r.id === f.room_id) ?? rooms[0];
      return { ...f, room_name: room ? roomLabel(room, t) : f.room_name };
    });
  }, [t, form.room_id, rooms]);

  function set<K extends keyof BookingFormData>(key: K, value: BookingFormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function handleRoomChange(id: number) {
    const room = rooms.find((r) => r.id === id)!;
    setForm((f) => ({ ...f, room_id: room.id, room_name: roomLabel(room, t) }));
  }


  function handleStartDateChange(value: string) {
    setForm((f) => ({
      ...f,
      date: value,
      end_date: f.end_date < value ? value : f.end_date,
    }));
    setErrors((e) => ({ ...e, date: undefined, end_date: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = t('common.required');
    if (!form.date) errs.date = t('common.required');
    if (!form.end_date) errs.end_date = t('common.required');
    const timeError = validateBookingTimes(form);
    if (timeError === 'endBeforeStart') errs.end_date = t('booking.endBeforeStart');
    if (timeError === 'invalidRange') errs.end_time = t('booking.invalidTimeRange');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const isMultiDay = form.end_date > form.date;

  const availableRooms = useMemo(() => {
    if (!allowedRoomIds?.length) return rooms;
    return rooms.filter((r) => allowedRoomIds.includes(r.id));
  }, [allowedRoomIds, rooms]);

  useEffect(() => {
    if (!allowedRoomIds?.length) return;
    if (!allowedRoomIds.includes(form.room_id) && availableRooms.length) {
      const room = availableRooms[0];
      setForm((f) => ({ ...f, room_id: room.id, room_name: roomLabel(room, t) }));
    }
  }, [allowedRoomIds, availableRooms, form.room_id, t]);

  const durationPreview = useMemo(() => {
    if (validateBookingTimes(form)) return null;
    const days = bookingDayCount(form);
    const minutes = bookingDurationMinutes(form);
    if (!days || !minutes) return null;
    return { days, minutes, label: formatDuration(minutes) };
  }, [form]);

  const conflicts = useMemo(
    () =>
      findBookingConflicts(
        sessions,
        form,
        editingSessionId ?? undefined,
      ),
    [sessions, form, editingSessionId],
  );

  const hasConflictPreview =
    conflicts.roomOverlap.length > 0 ||
    conflicts.roomBuffer.length > 0 ||
    conflicts.speakerOverlap.length > 0;

  function applyTemplate(templateId: SessionTemplateId) {
    setForm((f) => applySessionTemplate(f, templateId, t('booking.templatePrefix')));
  }

  function handleSpeakerSelect(speakerId: number) {
    speakerTouchedRef.current = true;
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
    speakerTouchedRef.current = true;
    setCustomSpeakerName(value);
    setForm((f) => ({
      ...f,
      speaker_id: NEW_SPEAKER_ID,
      speaker_name: value,
    }));
  }

  function handleSave() {
    if (!validate()) return;
    const payload = isCustomSpeaker
      ? {
          ...form,
          speaker_id: NEW_SPEAKER_ID,
          speaker_name: (customSpeakerName || form.speaker_name).trim(),
        }
      : form;
    if (
      allowSpeakerEdit &&
      !allowNewSpeaker &&
      (payload.speaker_id === NEW_SPEAKER_ID ||
        !speakerOptions.some((s) => s.id === payload.speaker_id))
    ) {
      setErrors((e) => ({ ...e, speaker_name: t('booking.speakerRequired') }));
      return;
    }
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

        {!initialValues && (
          <div className="form-group">
            <label className="form-label">{t('booking.templatesLabel')}</label>
            <div className="booking-template-row">
              {SESSION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`booking-template-btn color-${tpl.color}`}
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {t(`booking.templates.${tpl.id}`)}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <label className="form-label">{t('booking.startDate')}</label>
            <LocalizedDateInput
              value={form.date}
              hasError={!!errors.date}
              onChange={handleStartDateChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('booking.endDate')}</label>
            <LocalizedDateInput
              value={form.end_date}
              min={form.date}
              hasError={!!errors.end_date}
              onChange={(v) => set('end_date', v)}
            />
          </div>
        </div>

        {isMultiDay && (
          <p className="booking-multiday-hint">{t('booking.multiDayHint')}</p>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('booking.room')}</label>
            <select
              className="form-select"
              value={form.room_id}
              onChange={e => handleRoomChange(Number(e.target.value))}
            >
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>{roomLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('booking.durationPreview')}</label>
            <div className="booking-duration-preview" aria-live="polite">
              {durationPreview ? (
                <>
                  <span className="booking-duration-days">
                    {durationPreview.days === 1
                      ? t('booking.dayCount', { count: 1 })
                      : t('booking.dayCount_plural', { count: durationPreview.days })}
                  </span>
                  <span className="booking-duration-sep">·</span>
                  <span className="booking-duration-time">{durationPreview.label}</span>
                </>
              ) : (
                <span className="booking-duration-empty">{t('booking.durationInvalid')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('booking.startTime')}</label>
            <input
              className="form-input"
              type="time"
              lang={bcp47}
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('booking.endTime')}</label>
            <input
              className={`form-input${errors.end_time ? ' error' : ''}`}
              type="time"
              lang={bcp47}
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            />
          </div>
        </div>

        {hasConflictPreview && (
          <div className="booking-conflict-preview" role="alert">
            {conflicts.roomOverlap.length > 0 && (
              <div className="booking-conflict-block">
                <strong>{t('booking.roomOverlap')}</strong>
                <ul>
                  {conflicts.roomOverlap.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              </div>
            )}
            {conflicts.roomBuffer.length > 0 && (
              <div className="booking-conflict-block">
                <strong>{t('booking.roomBuffer')}</strong>
                <ul>
                  {conflicts.roomBuffer.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              </div>
            )}
            {conflicts.speakerOverlap.length > 0 && (
              <div className="booking-conflict-block">
                <strong>{t('booking.speakerOverlap')}</strong>
                <ul>
                  {conflicts.speakerOverlap.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">{t('booking.speaker')}</label>
          {allowSpeakerEdit ? (
            <>
              {showSpeakerFilter && (
                <input
                  className="form-input"
                  style={{ marginBottom: 8 }}
                  placeholder={t('booking.speakerSearch')}
                  value={speakerFilter}
                  onChange={(e) => setSpeakerFilter(e.target.value)}
                />
              )}
              <select
                className="form-select"
                value={isCustomSpeaker ? NEW_SPEAKER_ID : form.speaker_id}
                onChange={(e) => handleSpeakerSelect(Number(e.target.value))}
              >
                {filteredSpeakerOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {currentUserName &&
                    s.name.toLowerCase() === currentUserName.toLowerCase()
                      ? ` (${t('booking.speakerSelf')})`
                      : ''}
                  </option>
                ))}
                {allowNewSpeaker && (
                  <option value={NEW_SPEAKER_ID}>{t('booking.newSpeaker')}</option>
                )}
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
