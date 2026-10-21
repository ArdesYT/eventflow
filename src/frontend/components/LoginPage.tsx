/** Bejelentkezés és regisztráció; a hitelesítést és a szerepköröket a Root kezeli. */
import { useState } from 'react';
import { DEMO_USERS, getDemoUser } from '../lib/demoUsers';
import { useI18n } from '../i18n/I18nProvider';
import { translateError } from '../i18n/translateError';
import DisplayControls from './DisplayControls';
import logo from '../../assets/Logo.png';
import loginHero from '../../assets/login-hero.webp';
import styles from './LoginPage.module.css';

interface LoginPageProps {
  offlineMode: boolean;
  initialEmail?: string;
  onBrowseGuest?: () => void;
  onPasswordReset?: (email: string) => void;
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onRegister: (credentials: { name: string; email: string; password: string }) => Promise<void>;
}

export default function LoginPage({ offlineMode, initialEmail = '', onBrowseGuest, onPasswordReset, onLogin, onRegister }: LoginPageProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const registering = mode === 'register';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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

  function switchMode() {
    setMode(registering ? 'login' : 'register');
    setName('');
    setShowPassword(false);
    setError(null);
  }

  function fillDemo(role: 'admin' | 'booker' | 'attendee') {
    const demo = getDemoUser(role);
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setShowPassword(false);
    setError(null);
  }

  return (
    <div className={styles['login-page']}>
      <div className={styles['login-left']} aria-hidden="true">
        <img className={styles['login-photo']} src={loginHero} alt="" fetchPriority="high" />
      </div>

      <main className={styles['login-right']}>
        <div className={styles['login-form-top']}>
          <div className={styles['login-brand']}>
            <img src={logo} alt="" width="28" height="28" />
            <span>EventFlow</span>
          </div>
          <DisplayControls />
        </div>

        <form className={styles['login-form']} onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
          <div className={styles['login-form-header']}>
            <h1 id="login-title" className={styles['login-title']}>
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
              <label className={styles['login-label']} htmlFor="login-name">{t('login.name')}</label>
              <div className={`${styles['login-input-box']}${error ? ` ${styles.error}` : ''}`}>
                <svg className={styles['login-field-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                </svg>
                <input
                  id="login-name"
                  className={styles['login-input']}
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  autoComplete="name"
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>
          )}

          <div className={styles['login-field']}>
            <label className={styles['login-label']} htmlFor="login-email">{t('login.email')}</label>
            <div className={`${styles['login-input-box']}${error ? ` ${styles.error}` : ''}`}>
              <svg className={styles['login-field-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                id="login-email"
                className={styles['login-input']}
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                autoComplete="email"
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          <div className={styles['login-field']}>
            <label className={styles['login-label']} htmlFor="login-password">{t('login.password')}</label>
            <div className={`${styles['login-input-box']}${error ? ` ${styles.error}` : ''}`}>
              <svg className={styles['login-field-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="login-password"
                className={styles['login-input']}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                autoComplete={registering ? 'new-password' : 'current-password'}
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                className={styles['login-password-toggle']}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                aria-controls="login-password"
                disabled={loading}
              >
                {t(showPassword ? 'login.hide' : 'login.show')}
              </button>
            </div>
          </div>

          {error && <div id="login-error" className={styles['login-error']} role="alert">{error}</div>}

          <button className={styles['login-btn']} type="submit" disabled={loading} aria-busy={loading}>
            {t(registering ? 'login.register' : 'login.signIn')}
            {loading ? (
              <span className={styles['login-spinner']} aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            )}
          </button>

          {(registering || !offlineMode) && (
            <p className={styles['login-mode-toggle']}>
              {t(registering ? 'login.loginPrompt' : 'login.registerPrompt')}{' '}
              <button type="button" className={styles['login-toggle-link']} onClick={switchMode} disabled={loading}>
                {t(registering ? 'login.signIn' : 'login.register')}
              </button>
            </p>
          )}
          {!registering && onPasswordReset && (
            <p className={styles['login-mode-toggle']}>
              {t('login.resetPasswordPrompt')}{' '}
              <button type="button" className={styles['login-toggle-link']} onClick={() => onPasswordReset(email)} disabled={loading}>
                {t('login.passwordReset')}
              </button>
            </p>
          )}

          {onBrowseGuest && (
            <button type="button" className={styles['login-browse-btn']} onClick={onBrowseGuest} disabled={loading}>
              {t('login.browseWithoutLogin')}
            </button>
          )}

          {!registering && (
            <section className={styles['login-hints']} aria-labelledby="login-demo-title">
              <h2 id="login-demo-title" className={styles['login-hints-title']}>{t('login.demoAccounts')}</h2>
              <div className={styles['login-hint-list']}>
                {DEMO_USERS.map((demo) => (
                  <button key={demo.role} type="button" className={styles['login-hint-row']} onClick={() => fillDemo(demo.role)} disabled={loading}>
                    <span className={`${styles['hint-badge']} ${styles[demo.role] ?? ''}`}>
                      {t(`login.${demo.role}`)}
                    </span>
                    <span>{demo.email} / {demo.password}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </form>
      </main>
    </div>
  );
}
