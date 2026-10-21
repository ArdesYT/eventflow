import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const dark = theme === 'dark';
  const label = t(dark ? 'theme.switchToLight' : 'theme.switchToDark');

  return (
    <button
      type="button"
      className={`${styles['theme-toggle']}${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={dark}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </>
        ) : (
          <path d="M20.9 13.1A8.6 8.6 0 0 1 10.9 3.1 8.7 8.7 0 1 0 20.9 13.1Z" />
        )}
      </svg>
    </button>
  );
}
