import { useRef } from 'react';
import { formatDateKey } from '../i18n/dateFormat';
import { useI18n } from '../i18n/I18nProvider';

interface LocalizedDateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
  hasError?: boolean;
  placeholder?: string;
}

export default function LocalizedDateInput({
  value,
  onChange,
  min,
  className = '',
  hasError = false,
  placeholder,
}: LocalizedDateInputProps) {
  const { locale } = useI18n();
  const nativeRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  }

  return (
    <div className={`localized-date-field${hasError ? ' error' : ''}`}>
      <button
        type="button"
        className={`localized-date-display form-input${className ? ` ${className}` : ''}`}
        onClick={openPicker}
      >
        {value ? formatDateKey(value, locale) : (placeholder ?? '—')}
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="localized-date-native"
        value={value}
        min={min}
        lang={locale === 'hu' ? 'hu-HU' : locale === 'de' ? 'de-DE' : 'en-GB'}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
