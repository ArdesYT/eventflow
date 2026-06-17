/**
 * Nyelvváltó — gombsor vagy legördülő lista.
 * Használat: App/AdminApp topbar, LoginPage, PublicEventsPage.
 * Props: className (opcionális), variant ('pill' | 'compact' | 'select').
 */
import { useId } from 'react';
import { LOCALES, LOCALE_LABELS, type Locale } from '../i18n/locales';
import { useI18n } from '../i18n/I18nProvider';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'compact' | 'select';
}

export default function LanguageSwitcher({
  className = '',
  variant = 'pill',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const selectId = useId();

  if (variant === 'select') {
    return (
      <div className={`lang-switcher lang-switcher--select${className ? ` ${className}` : ''}`}>
        <label className="lang-switcher-label" htmlFor={selectId}>
          {t('common.language')}
        </label>
        <select
          id={selectId}
          className="lang-switcher-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label={t('common.language')}
        >
          {LOCALES.map((code: Locale) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className={`lang-switcher lang-switcher--${variant}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t('common.language')}
    >
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          className={`lang-switcher-btn${locale === code ? ' active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
