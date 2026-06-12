import type { Locale } from './locales';
import { LOCALE_BCP47 } from './locales';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(dateKey: string): Date | null {
  const match = DATE_KEY.exec(dateKey.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Locale-aware calendar date from YYYY-MM-DD (hu: 2026. 06. 12.) */
export function formatDateKey(
  dateKey: string,
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  const bcp47 = LOCALE_BCP47[locale];
  if (style === 'long') {
    const label = date.toLocaleDateString(bcp47, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return date.toLocaleDateString(bcp47, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateRange(
  startKey: string,
  endKey: string,
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  if (!endKey || endKey <= startKey) return formatDateKey(startKey, locale, style);
  return `${formatDateKey(startKey, locale, style)} – ${formatDateKey(endKey, locale, style)}`;
}

/** 24h time label (hu: 09:00) */
export function formatTimeKey(time: string): string {
  const match = time.match(/(\d{2}):(\d{2})/);
  if (!match) return time;
  return `${match[1]}:${match[2]}`;
}

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
