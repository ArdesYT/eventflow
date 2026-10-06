/**
 * Nyelvváltó — gombsor vagy legördülő lista.
 * Használat: App/AdminApp topbar, LoginPage, PublicEventsPage.
 * Props: className (opcionális), variant ('pill' | 'compact' | 'select').
 */
import { LOCALES, LOCALE_LABELS } from '../i18n/locales';
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

  return (
    <div
      className={`lang-switcher lang-switcher--${variant}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t('common.language')}
    >
      {LOCALES.map((code) => (
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
