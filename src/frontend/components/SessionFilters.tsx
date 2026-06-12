import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

interface SessionFiltersProps {
  sessions: Session[];
  speakerFilter: string;
  roomFilter: string;
  onSpeakerChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  compact?: boolean;
  className?: string;
}

export default function SessionFilters({
  sessions,
  speakerFilter,
  roomFilter,
  onSpeakerChange,
  onRoomChange,
  compact = false,
  className = '',
}: SessionFiltersProps) {
  const { t } = useI18n();

  const speakers = [...new Set(sessions.map((s) => s.speaker_name).filter(Boolean))].sort();
  const rooms = [...new Set(sessions.map((s) => s.room_name).filter(Boolean))].sort();

  return (
    <div
      className={`session-filters${compact ? ' session-filters--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <select
        className="form-select session-filter-select"
        value={speakerFilter}
        onChange={(e) => onSpeakerChange(e.target.value)}
        aria-label={t('filters.speaker')}
      >
        <option value="">{t('filters.allSpeakers')}</option>
        {speakers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="form-select session-filter-select"
        value={roomFilter}
        onChange={(e) => onRoomChange(e.target.value)}
        aria-label={t('filters.room')}
      >
        <option value="">{t('filters.allRooms')}</option>
        {rooms.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {(speakerFilter || roomFilter) && (
        <button
          type="button"
          className="session-filter-clear"
          onClick={() => {
            onSpeakerChange('');
            onRoomChange('');
          }}
        >
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}
