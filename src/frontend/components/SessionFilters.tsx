/**
 * Előadó- és terem szűrők legördülő listákkal — prezentációs komponens.
 * Használat: App (sessions/agenda nézet), PublicEventsPage toolbar.
 * Props: sessions (opciók forrása), speakerFilter/roomFilter, onSpeakerChange/onRoomChange,
 *        compact (kisebb elrendezés), className.
 */
import type { Session } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';
import styles from './SessionFilters.module.css';

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
      className={`${styles['session-filters']}${compact ? ` ${styles['session-filters--compact']}` : ''}${className ? ` ${className}` : ''}`}
    >
      {[
        { label: 'filters.speaker', all: 'filters.allSpeakers', value: speakerFilter, options: speakers, onChange: onSpeakerChange },
        { label: 'filters.room', all: 'filters.allRooms', value: roomFilter, options: rooms, onChange: onRoomChange },
      ].map(({ label, all, value, options, onChange }) => (
        <select key={label} className={`${styles['form-select']} ${styles['session-filter-select']}`} value={value}
          onChange={(event) => onChange(event.target.value)} aria-label={t(label)}>
          <option value="">{t(all)}</option>
          {options.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      ))}
      {(speakerFilter || roomFilter) && (
        <button
          type="button"
          className={styles['session-filter-clear']}
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
