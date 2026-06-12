import { useState } from 'react';
import type { Room } from '../../backend/types';
import { FALLBACK_ROOMS, roomLabel } from '../lib/rooms';
import { useI18n } from '../i18n/I18nProvider';

interface BulkSessionToolbarProps {
  selectedCount: number;
  busy?: boolean;
  allowedRoomIds?: number[];
  rooms?: Room[];
  onClear: () => void;
  onApply: (opts: { dateOffsetDays: number; roomId?: number }) => Promise<void>;
}

export default function BulkSessionToolbar({
  selectedCount,
  busy = false,
  allowedRoomIds,
  rooms = FALLBACK_ROOMS,
  onClear,
  onApply,
}: BulkSessionToolbarProps) {
  const { t } = useI18n();
  const [dateOffset, setDateOffset] = useState(0);
  const [roomId, setRoomId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const roomOptions = allowedRoomIds?.length
    ? rooms.filter((r) => allowedRoomIds.includes(r.id))
    : rooms;

  async function handleApply() {
    if (dateOffset === 0 && roomId === '') return;
    setError(null);
    try {
      await onApply({
        dateOffsetDays: dateOffset,
        roomId: roomId === '' ? undefined : roomId,
      });
      onClear();
      setDateOffset(0);
      setRoomId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'errors.saveError');
    }
  }

  return (
    <div className="bulk-session-toolbar">
      <span className="bulk-session-count">
        {t('bulk.selected', { count: selectedCount })}
      </span>
      <label className="bulk-field">
        <span>{t('bulk.dateOffset')}</span>
        <input
          type="number"
          className="form-input bulk-offset-input"
          value={dateOffset}
          onChange={(e) => setDateOffset(Number(e.target.value))}
        />
      </label>
      <label className="bulk-field">
        <span>{t('bulk.newRoom')}</span>
        <select
          className="form-select"
          value={roomId}
          onChange={(e) =>
            setRoomId(e.target.value === '' ? '' : Number(e.target.value))
          }
        >
          <option value="">{t('bulk.keepRoom')}</option>
          {roomOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {roomLabel(r, t)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn-save"
        disabled={busy || (dateOffset === 0 && roomId === '')}
        onClick={handleApply}
      >
        {busy ? t('booking.saving') : t('bulk.apply')}
      </button>
      <button type="button" className="btn-cancel" onClick={onClear}>
        {t('common.cancel')}
      </button>
      {error && (
        <span className="bulk-error">
          {error.startsWith('errors.') ? t(error) : error}
        </span>
      )}
    </div>
  );
}
