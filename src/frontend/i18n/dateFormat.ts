import type { Locale } from './locales';
import { LOCALE_BCP47 } from './locales';

export function formatMonthYear(monthIndex: number, year: number, locale: Locale): string {
  const date = new Date(year, monthIndex, 1);
  const label = date.toLocaleDateString(LOCALE_BCP47[locale], {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatWeekdayLong(
  year: number,
  monthIndex: number,
  day: number,
  locale: Locale,
): string {
  const date = new Date(year, monthIndex, day);
  const label = date.toLocaleDateString(LOCALE_BCP47[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getWeekdayLabels(locale: Locale, short = false): string[] {
  const base = new Date(2024, 0, 1); // Monday
  const fmt = new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    weekday: short ? 'short' : 'short',
  });
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, 1 + i);
    labels.push(fmt.format(d).replace('.', ''));
  }
  return labels;
}

export function getMiniWeekdayLabels(locale: Locale): string[] {
  return getWeekdayLabels(locale, true).map((l) => l.charAt(0).toUpperCase());
}
