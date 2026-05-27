import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isLocale,
  LOCALE_BCP47,
  STORAGE_KEY,
  type Locale,
} from './locales';
import { getTranslations } from './translations';

type Vars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  bcp47: string;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`,
  );
}

function loadInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      document.documentElement.lang = LOCALE_BCP47[stored];
      return stored;
    }
  } catch {
    /* ignore */
  }
  document.documentElement.lang = LOCALE_BCP47.hu;
  return 'hu';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = LOCALE_BCP47[next];
  }, []);

  const dict = useMemo(() => getTranslations(locale), [locale]);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const raw = getNested(dict as unknown as Record<string, unknown>, key) ?? key;
      return interpolate(raw, vars);
    },
    [dict],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      bcp47: LOCALE_BCP47[locale],
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Map known API / legacy error strings to translation keys. */
export function translateError(message: string, t: I18nContextValue['t']): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('csatlakoz') ||
    lower.includes('server') ||
    lower.includes('reach') ||
    lower.includes('verbindung')
  ) {
    return t('errors.serverConnect');
  }
  if (
    lower.includes('email') ||
    lower.includes('jelszó') ||
    lower.includes('password') ||
    lower.includes('hibás') ||
    lower.includes('ungültig')
  ) {
    return t('errors.invalidCredentials');
  }
  if (lower.includes('ment') || lower.includes('save') || lower.includes('speicher')) {
    return t('errors.saveError');
  }
  if (lower.includes('törl') || lower.includes('delete') || lower.includes('lösch')) {
    return t('errors.deleteError');
  }
  if (message.startsWith('HTTP ')) {
    const status = message.replace(/\D/g, '');
    return t('errors.http', { status });
  }
  return message;
}
