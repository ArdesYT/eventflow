export type Locale = 'hu' | 'de' | 'en';

export const LOCALES: Locale[] = ['hu', 'en', 'de'];

export const LOCALE_LABELS: Record<Locale, string> = {
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
