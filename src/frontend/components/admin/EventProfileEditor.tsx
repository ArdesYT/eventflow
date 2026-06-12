import { useState, type FormEvent } from 'react';
import type { EventProfile } from '../../../backend/types';
import LocalizedDateInput from '../LocalizedDateInput';
import { useI18n } from '../../i18n/I18nProvider';

interface EventProfileEditorProps {
  event: EventProfile;
  onSave: (data: Partial<EventProfile>) => Promise<void>;
}

export default function EventProfileEditor({ event, onSave }: EventProfileEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState(event.name);
  const [venue, setVenue] = useState(event.venue ?? '');
  const [startDate, setStartDate] = useState(event.start_date ?? '');
  const [endDate, setEndDate] = useState(event.end_date ?? '');
  const [description, setDescription] = useState(event.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave({
        name: name.trim(),
        venue: venue.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'errors.saveError');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="event-profile-editor" onSubmit={handleSubmit}>
      <p className="admin-users-hint">{t('admin.event.hint')}</p>
      {error && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error.startsWith('errors.') ? t(error) : error}
        </div>
      )}
      {saved && <div className="success-banner">{t('admin.event.saved')}</div>}
      <div className="form-group">
        <label className="form-label">{t('admin.event.name')}</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">{t('admin.event.venue')}</label>
        <input
          className="form-input"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('booking.startDate')}</label>
          <LocalizedDateInput value={startDate} onChange={setStartDate} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('booking.endDate')}</label>
          <LocalizedDateInput value={endDate} min={startDate} onChange={setEndDate} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('admin.event.description')}</label>
        <textarea
          className="form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <button type="submit" className="btn-save" disabled={saving}>
        {saving ? t('booking.saving') : t('common.save')}
      </button>
    </form>
  );
}
