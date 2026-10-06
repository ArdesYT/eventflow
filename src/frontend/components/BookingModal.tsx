/* eslint-disable react-hooks/set-state-in-effect -- űrlap szinkron props/locale szerkesztésnél szándékos */
/**
 * Új/szerkesztett előadás foglalási modal — SessionWorkspace.
 * Űrlap validáció, ütközés-előnézet, sablonok, előadó/terem választás.
 * Props: initialDate/initialValues, speakers, sessions, rooms, editingSessionId,
 *        allowedRoomIds, onSave, onClose, saving, saveError.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { localDateKey } from '../lib/sessionFormat';
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
import styles from './BookingModal.module.css';

/** Foglalási modal props — űrlap kezdeti értékek, előadók, mentés callback. */
interface BookingModalProps {
  saving?: boolean;
  saveError?: string | null;
  initialDate?: string;
  initialValues?: BookingFormData;
  currentUserName?: string;
  speakers?: Speaker[];
  sessions?: Session[];
  rooms?: Room[];
  editingSessionId?: number | null;
  allowedRoomIds?: number[];
  onSave: (data: BookingFormData) => void;
  onClose: () => void;
}

const COLORS: EventColor[] = ['blue', 'amber', 'green', 'red'];

export default function BookingModal({
  initialDate,
  initialValues,
  currentUserName,
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
  const [speakerFilter, setSpeakerFilter] = useState('');
  // Fő űrlap állapot — BookingFormData mezők
  const [form, setForm] = useState<BookingFormData>(() => ({
    title:        '',
    description:  '',
    date:         initialDate ?? localDateKey(),
    end_date:     initialDate ?? localDateKey(),
    start_time:   '09:00',
    end_time:     '10:00',
    room_id:      rooms[0]?.id ?? 1,
    speaker_id:   0,
    room_name:    rooms[0] ? roomLabel(rooms[0], t) : '',
    speaker_name: '',
    color:        'blue',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});
  // Jelzi, ha a felhasználó manuálisan választott előadót (ne írja felül az auto-kitöltés)
  const speakerTouchedRef = useRef(false);

  // Kezdő dátum szinkronizálása props-ból (pl. naptárból kiválasztott nap)
  useEffect(() => {
    if (initialDate) {
      setForm((f) => ({
        ...f,
        date: initialDate,
        end_date: f.end_date < initialDate ? initialDate : f.end_date || initialDate,
      }));
    }
  }, [initialDate]);

  // Az előadólista frissítése nem állíthatja vissza a felhasználó módosításait.
  useEffect(() => {
    if (initialValues) setForm(initialValues);
  }, [initialValues]);

  const filteredSpeakerOptions = useMemo(() => {
    const q = speakerFilter.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter((s) => s.id === form.speaker_id || s.name.toLowerCase().includes(q));
  }, [speakers, speakerFilter, form.speaker_id]);

  // Új foglalásnál kizárólag a katalógusban szereplő előadót választunk.
  useEffect(() => {
    if (initialValues || speakerTouchedRef.current) return;
    const speaker = speakers.find((item) => item.name.toLowerCase() === currentUserName?.toLowerCase()) ?? speakers[0];
    if (!speaker) return;
    setForm((previous) => ({ ...previous, speaker_id: speaker.id, speaker_name: speaker.name }));
  }, [currentUserName, initialValues, speakers]);

  // Terem neve fordítása locale/t/room változásakor
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
    // Befejező dátum nem lehet korábbi a kezdőnél
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
    // Ha a kiválasztott terem nincs az engedélyezettek között, első elérhetőre vált
    if (!allowedRoomIds.includes(form.room_id) && availableRooms.length) {
      const room = availableRooms[0];
      setForm((f) => ({ ...f, room_id: room.id, room_name: roomLabel(room, t) }));
    }
  }, [allowedRoomIds, availableRooms, form.room_id, t]);

  // Időtartam előnézet — érvényes időintervallum esetén napok + perc
  const durationPreview = useMemo(() => {
    if (validateBookingTimes(form)) return null;
    const days = bookingDayCount(form);
    const minutes = bookingDurationMinutes(form);
    if (!days || !minutes) return null;
    return { days, label: formatDuration(minutes) };
  }, [form]);

  // Ütközés-előnézet: terem átfedés, buffer, előadó átfedés
  const conflicts = useMemo(
    () =>
      findBookingConflicts(
        sessions,
        form,
        editingSessionId ?? undefined,
      ),
    [sessions, form, editingSessionId],
  );

  const conflictGroups = (['roomOverlap', 'roomBuffer', 'speakerOverlap'] as const)
    .filter((kind) => conflicts[kind].length > 0);

  // Sablon gomb: előre definiált cím/idő/szín kitöltése
  function applyTemplate(templateId: SessionTemplateId) {
    setForm((f) => applySessionTemplate(f, templateId, t('booking.templatePrefix')));
  }

  function handleSpeakerSelect(speakerId: number) {
    speakerTouchedRef.current = true;
    const speaker = speakers.find((item) => item.id === speakerId);
    setForm((previous) => ({ ...previous, speaker_id: speaker?.id ?? 0, speaker_name: speaker?.name ?? '' }));
    setErrors((previous) => ({ ...previous, speaker_name: undefined }));
  }

  function handleSave() {
    if (saving || !validate()) return;
    const speaker = speakers.find((item) => item.id === form.speaker_id);
    if (!speaker) {
      setErrors((previous) => ({ ...previous, speaker_name: t('booking.speakerRequired') }));
      return;
    }
    onSave({ ...form, speaker_id: speaker.id, speaker_name: speaker.name });
  }

  return (
    <div className={styles['modal-backdrop']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h2 className={styles['modal-title']}>
            {initialValues ? t('booking.editTitle') : t('booking.title')}
          </h2>
          <button className={styles['modal-close']} onClick={onClose}>×</button>
        </div>

        {!initialValues && (
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.templatesLabel')}</label>
            <div className={styles['booking-template-row']}>
              {SESSION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`${styles['booking-template-btn']} ${styles[`color-${tpl.color}`] ?? ''}`}
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {t(`booking.templates.${tpl.id}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>{t('booking.sessionTitle')}</label>
          <input
            className={`${styles['form-input']}${errors.title ? ` ${styles.error}` : ''}`}
            placeholder={t('booking.titlePlaceholder')}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div className={styles['form-row']}>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.startDate')}</label>
            <LocalizedDateInput
              value={form.date}
              hasError={!!errors.date}
              onChange={handleStartDateChange}
            />
          </div>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.endDate')}</label>
            <LocalizedDateInput
              value={form.end_date}
              min={form.date}
              hasError={!!errors.end_date}
              onChange={(v) => set('end_date', v)}
            />
          </div>
        </div>

        {isMultiDay && (
          <p className={styles['booking-multiday-hint']}>{t('booking.multiDayHint')}</p>
        )}

        <div className={styles['form-row']}>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.room')}</label>
            <select
              className={styles['form-select']}
              value={form.room_id}
              onChange={e => handleRoomChange(Number(e.target.value))}
            >
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>{roomLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.durationPreview')}</label>
            <div className={styles['booking-duration-preview']} aria-live="polite">
              {durationPreview ? (
                <>
                  <span className={styles['booking-duration-days']}>
                    {durationPreview.days === 1
                      ? t('booking.dayCount', { count: 1 })
                      : t('booking.dayCount_plural', { count: durationPreview.days })}
                  </span>
                  <span className={styles['booking-duration-sep']}>·</span>
                  <span className={styles['booking-duration-time']}>{durationPreview.label}</span>
                </>
              ) : (
                <span className={styles['booking-duration-empty']}>{t('booking.durationInvalid')}</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles['form-row']}>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.startTime')}</label>
            <input
              className={styles['form-input']}
              type="time"
              lang={bcp47}
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
            />
          </div>
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>{t('booking.endTime')}</label>
            <input
              className={`${styles['form-input']}${errors.end_time ? ` ${styles.error}` : ''}`}
              type="time"
              lang={bcp47}
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            />
          </div>
        </div>

        {conflictGroups.length > 0 && (
          <div className={styles['booking-conflict-preview']} role="alert">
            {conflictGroups.map((kind) => (
              <div key={kind} className={styles['booking-conflict-block']}>
                <strong>{t(`booking.${kind}`)}</strong>
                <ul>
                  {conflicts[kind].map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>{t('booking.speaker')}</label>
          {speakers.length > 4 && (
            <input className={styles['form-input']} style={{ marginBottom: 8 }} placeholder={t('booking.speakerSearch')}
              value={speakerFilter} onChange={(event) => setSpeakerFilter(event.target.value)} />
          )}
          <select className={`${styles['form-select']}${errors.speaker_name ? ` ${styles.error}` : ''}`}
            aria-label={t('booking.speaker')} value={form.speaker_id} onChange={(event) => handleSpeakerSelect(Number(event.target.value))}>
            <option value={0}>{t('booking.speakerRequired')}</option>
            {filteredSpeakerOptions.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.name}</option>)}
          </select>
          <p className={styles['booking-catalog-hint']}>{t('booking.speakerCatalogHint')}</p>
          {errors.speaker_name && <p className={styles['login-error']} role="alert">{errors.speaker_name}</p>}
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>{t('booking.categoryColor')}</label>
          <div className={styles['color-picker']}>
            {COLORS.map(c => (
              <div
                key={c}
                className={`${styles['color-dot']} ${styles[`color-${c}`] ?? ''}${form.color === c ? ` ${styles.active}` : ''}`}
                onClick={() => set('color', c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className={styles['form-group']}>
          <label className={styles['form-label']}>{t('booking.description')}</label>
          <textarea
            className={styles['form-textarea']}
            placeholder={t('booking.descriptionPlaceholder')}
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {saveError && <div className={styles['login-error']} style={{marginBottom:"12px"}}>{saveError}</div>}
        <div className={styles['btn-row']}>
          <button type="button" className={styles['btn-cancel']} onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className={styles['btn-save']} onClick={handleSave} disabled={saving}>
            {saving ? t('booking.saving') : t('booking.saveBooking')}
          </button>
        </div>
      </div>
    </div>
  );
}
