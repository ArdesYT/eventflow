/**
 * Támogatott nyelvek és kapcsolódó konstansok.
 * A Locale típus, LOCALES lista, megjelenítési címkék és BCP47 kódok
 * az I18nProvider és a LanguageSwitcher számára szolgálnak alapként.
 * A STORAGE_KEY a localStorage kulcsa a kiválasztott nyelv megőrzéséhez.
 */
export type Locale = 'hu' | 'de' | 'en';

export const LOCALES: Locale[] = ['hu', 'en', 'de'];

export const LOCALE_LABELS: Record<Locale, String> = {
  hu: 'Magyar',
  de: 'Deutsch',
  en: 'English',
};

export const LOCALE_BCP47: Record<Locale, string> = {
  hu: 'hu-HU',
  de: 'de-DE',
  en: 'en-GB',
};

export const STORAGE_KEY = 'eventflow_locale';

export function isLocale(value: string | null): value is Locale {
  return value === 'hu' || value === 'de' || value === 'en';
}
