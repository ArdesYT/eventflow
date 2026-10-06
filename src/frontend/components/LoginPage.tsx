/**
 * Bejelentkezés és regisztráció oldal — Root rendereli, ha nincs bejelentkezett user.
 * Offline módban csak demo fiókok; online módban regisztráció is elérhető.
 * Props: offlineMode, onBrowseGuest, onLogin, onRegister.
 */
import { useState } from 'react';
import { DEMO_USERS, getDemoUser } from '../lib/demoUsers';
import { useI18n } from '../i18n/I18nProvider';
import { translateError } from '../i18n/translateError';
import LanguageSwitcher from './LanguageSwitcher';
import logo from '../../assets/Logo.png';
import styles from './LoginPage.module.css';

/** Bejelentkezési oldal props — offline flag és auth callback-ek. */
interface LoginPageProps {
  offlineMode: boolean;
  onBrowseGuest?: () => void;
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onRegister: (credentials: { name: string; email: string; password: string }) => Promise<void>;
}

export default function LoginPage({ offlineMode, onBrowseGuest, onLogin, onRegister }: LoginPageProps) {
  const { t } = useI18n();
  // login | register — űrlap mód váltása
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const registering = mode === 'register';

  // Űrlap beküldés — validáció, majd onLogin vagy onRegister hívása
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || (registering && !name.trim())) {
      setError(t('login.fillAllFields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (registering) {
        await onRegister({ name: name.trim(), email, password });
      } else {
        await onLogin({ email, password });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'login.loginFailed';
      setError(
        msg.startsWith('errors.') || msg.startsWith('login.')
          ? t(msg)
          : translateError(msg, t),
      );
    } finally {
      setLoading(false);
    }
  }

  // Demo fiók adatok kitöltése egy kattintással (offline/teszt)
  function fillDemo(role: 'admin' | 'booker' | 'attendee') {
    const demo = getDemoUser(role);
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  }

  return (
    <div className={styles['login-page']}>
      <div className={styles['login-left']}>
        <div className={styles['login-brand']}>
          <div className={styles['login-brand-logo']}><img src={logo} alt="EventFlow" /></div>
          <div>
            <div className={styles['login-brand-name']}>EventFlow</div>
            <div className={styles['login-brand-tagline']}>{t('login.tagline')}</div>
          </div>
        </div>
        <div className={styles['login-decorative']}>
          {['blue', 'amber', 'green'].map((color, index) => (
            <div key={color} className={`${styles['deco-card']} ${styles[`deco-card-${index + 1}`] ?? ''}`}>
              <div className={`${styles['deco-dot']} ${styles[color] ?? ''}`} />
              <div className={styles['deco-line']} />
              <div className={`${styles['deco-line']} ${styles.short}`} />
            </div>
          ))}
        </div>
        <p className={styles['login-left-footer']}>
          {t('login.footer').split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      </div>

      <div className={styles['login-right']}>
        <form className={styles['login-form']} onSubmit={handleSubmit} noValidate>
          <div className={styles['login-form-top']}>
            <LanguageSwitcher />
          </div>
          <div className={styles['login-form-header']}>
            <h1 className={styles['login-title']}>
              {t(registering ? 'login.registerTitle' : 'login.welcome')}
            </h1>
            <p className={styles['login-subtitle']}>
              {t(registering ? 'login.registerSubtitle' : 'login.subtitle')}
            </p>
          </div>

          {offlineMode && (
            <div className={styles['login-offline-banner']}>
              {t('login.offlineBanner').split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
          )}

          {registering && (
            <div className={styles['login-field']}>
              <label className={styles['login-label']}>{t('login.name')}</label>
              <input
                className={`${styles['login-input']}${error ? ` ${styles.error}` : ''}`}
                type="text"
                placeholder={t('login.namePlaceholder')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                autoComplete="name"
              />
            </div>
          )}

          <div className={styles['login-field']}>
            <label className={styles['login-label']}>{t('login.email')}</label>
            <input
              className={`${styles['login-input']}${error ? ` ${styles.error}` : ''}`}
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="email"
            />
          </div>

          <div className={styles['login-field']}>
            <label className={styles['login-label']}>{t('login.password')}</label>
            <input
              className={`${styles['login-input']}${error ? ` ${styles.error}` : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoComplete="current-password"
            />
          </div>

          {error && <div className={styles['login-error']}>{error}</div>}

          <button className={styles['login-btn']} type="submit" disabled={loading}>
            {loading ? (
              <span className={styles['login-spinner']} />
            ) : registering ? (
              t('login.register')
            ) : (
              t('login.signIn')
            )}
          </button>

          <div className={styles['login-mode-toggle']}>
            {registering ? (
              <p>
                {t('login.loginPrompt')}{' '}
                <button
                  type="button"
                  className={styles['login-toggle-link']}
                  onClick={() => {
                    setMode('login');
                    setName('');
                  }}
                >
                  {t('login.signIn')}
                </button>
              </p>
            ) : !offlineMode ? (
              <p>
                {t('login.registerPrompt')}{' '}
                <button
                  type="button"
                  className={styles['login-toggle-link']}
                  onClick={() => {
                    setMode('register');
                    setName('');
                  }}
                >
                  {t('login.register')}
                </button>
              </p>
            ) : null}
          </div>

          {onBrowseGuest && (
            <button
              type="button"
              className={styles['login-browse-btn']}
              onClick={onBrowseGuest}
            >
              {t('login.browseWithoutLogin')}
            </button>
          )}

          <div className={styles['login-hints']}>
            <p className={styles['login-hint-title']}>{t('login.demoAccounts')}</p>
            {DEMO_USERS.map((demo) => (
              <div
                key={demo.role}
                className={styles['login-hint-row']}
                onClick={() => fillDemo(demo.role)}
              >
                <span className={`${styles['hint-badge']} ${styles[demo.role] ?? ''}`}>
                  {t(`login.${demo.role}`)}
                </span>
                <span>
                  {demo.email} / {demo.password}
                </span>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
