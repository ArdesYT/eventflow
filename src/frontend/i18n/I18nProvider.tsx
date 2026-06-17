/**
 * React i18n kontextus — nyelvválasztás, fordítási függvény (t), BCP47 kód.
 * Az egész alkalmazást körbeveszi (main.tsx); a useI18n hook minden komponensben elérhető.
 * A translateError() a translateError.ts modulban van (fast refresh kompatibilitás).
 */
/* eslint-disable react-refresh/only-export-components -- useI18n hook a providerrel együtt */
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

/** Beágyazott objektumból pontozott kulcsú string érték kiolvasása (pl. "nav.calendar"). */
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

/** {{változó}} helyőrzők behelyettesítése a fordítási sablonban. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`,
  );
}

/** Kezdeti nyelv: localStorage-ból, vagy alapértelmezett magyar (hu). */
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
  // Aktuális nyelv — inicializálás localStorage-ból
  const [locale, setLocaleState] = useState<Locale>(loadInitialLocale);

  // Nyelvváltás: state, localStorage és document.documentElement.lang szinkronizálása
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = LOCALE_BCP47[next];
  }, []);

  // Aktuális locale szótár — locale változásakor újraszámolódik
  const dict = useMemo(() => getTranslations(locale), [locale]);

  // Fordító függvény: kulcs → szöveg, opcionális interpolációval
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
