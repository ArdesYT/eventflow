import { useState } from 'react';
import { DEMO_USERS, getDemoUser } from '../lib/demoUsers';
import { useI18n, translateError } from '../i18n/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

interface LoginPageProps {
  offlineMode: boolean;
  onBrowseGuest?: () => void;
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onRegister: (credentials: { name: string; email: string; password: string }) => Promise<void>;
}

export default function LoginPage({ offlineMode, onBrowseGuest, onLogin, onRegister }: LoginPageProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || (mode === 'register' && !name.trim())) {
      setError(t('login.fillAllFields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
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

  function fillDemo(role: 'admin' | 'booker' | 'attendee') {
    const demo = getDemoUser(role);
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-logo">EF</div>
          <div>
            <div className="login-brand-name">EventFlow</div>
            <div className="login-brand-tagline">{t('login.tagline')}</div>
          </div>
        </div>
        <div className="login-decorative">
          <div className="deco-card deco-card-1">
            <div className="deco-dot blue" />
            <div className="deco-line" />
            <div className="deco-line short" />
          </div>
          <div className="deco-card deco-card-2">
            <div className="deco-dot amber" />
            <div className="deco-line" />
            <div className="deco-line short" />
          </div>
          <div className="deco-card deco-card-3">
            <div className="deco-dot green" />
            <div className="deco-line" />
            <div className="deco-line short" />
          </div>
        </div>
        <p className="login-left-footer">
          {t('login.footer').split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form-top">
            <LanguageSwitcher />
          </div>
          <div className="login-form-header">
            <h1 className="login-title">
              {mode === 'register' ? t('login.registerTitle') : t('login.welcome')}
            </h1>
            <p className="login-subtitle">
              {mode === 'register' ? t('login.registerSubtitle') : t('login.subtitle')}
            </p>
          </div>

          {offlineMode && (
            <div className="login-offline-banner">
              {t('login.offlineBanner').split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
          )}

          {mode === 'register' && (
            <div className="login-field">
              <label className="login-label">{t('login.name')}</label>
              <input
                className={`login-input${error ? ' error' : ''}`}
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

          <div className="login-field">
            <label className="login-label">{t('login.email')}</label>
            <input
              className={`login-input${error ? ' error' : ''}`}
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

          <div className="login-field">
            <label className="login-label">{t('login.password')}</label>
            <input
              className={`login-input${error ? ' error' : ''}`}
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

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : mode === 'register' ? (
              t('login.register')
            ) : (
              t('login.signIn')
            )}
          </button>

          <div className="login-mode-toggle">
            {mode === 'register' ? (
              <p>
                {t('login.loginPrompt')}{' '}
                <button
                  type="button"
                  className="login-toggle-link"
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
                  className="login-toggle-link"
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
              className="login-browse-btn"
              onClick={onBrowseGuest}
            >
              {t('login.browseWithoutLogin')}
            </button>
          )}

          <div className="login-hints">
            <p className="login-hint-title">{t('login.demoAccounts')}</p>
            {DEMO_USERS.map((demo) => (
              <div
                key={demo.role}
                className="login-hint-row"
                onClick={() => fillDemo(demo.role)}
              >
                <span className={`hint-badge ${demo.role}`}>
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
