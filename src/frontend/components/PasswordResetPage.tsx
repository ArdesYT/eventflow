/** Helyi visszaállítás: e-mail → konzolra küldött kód → új jelszó. */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import DisplayControls from './DisplayControls';
import logo from '../../assets/Logo.png';
import loginHero from '../../assets/login-hero.webp';
import styles from './LoginPage.module.css';
import { confirmPasswordReset, requestPasswordReset, verifyPasswordResetCode } from '../lib/passwordResetApi';

interface PasswordResetPageProps {
  initialEmail?: string;
  onBack: (email: string) => void;
  onPasswordChanged: () => void;
}

type ResetStep = 'email' | 'code' | 'password' | 'done';

export default function PasswordResetPage({ initialEmail = '', onBack, onPasswordChanged }: PasswordResetPageProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    setErrorKey(message.startsWith('passwordReset.') || message.startsWith('errors.') ? message : 'passwordReset.failed');
  }

  async function sendCode() {
    const result = await requestPasswordReset(email.trim());
    if (import.meta.env.DEV && result.delivery === 'console' && result.code) {
      console.info('EventFlow password reset code:', result.code);
    } else if (import.meta.env.DEV) {
      console.info('No reset code was issued. Check the email address or request a new code later.');
    }
    setCode('');
    setStep('code');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || step === 'done') return;
    setErrorKey(null);
    if (step === 'code' && !/^\d{6}$/.test(code)) {
      setErrorKey('passwordReset.invalidCode');
      return;
    }
    if (step === 'password') {
      if (Array.from(password).length < 8) {
        setErrorKey('passwordReset.passwordTooShort');
        return;
      }
      if (new TextEncoder().encode(password).length > 72) {
        setErrorKey('passwordReset.passwordTooLong');
        return;
      }
      if (password !== confirmation) {
        setErrorKey('passwordReset.passwordMismatch');
        return;
      }
    }
    setLoading(true);
    try {
      if (step === 'email') {
        await sendCode();
      } else if (step === 'code') {
        const token = await verifyPasswordResetCode(email.trim(), code);
        setResetToken(token);
        setCode('');
        setStep('password');
      } else {
        await confirmPasswordReset(resetToken, password);
        setResetToken('');
        setPassword('');
        setConfirmation('');
        setStep('done');
        onPasswordChanged();
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (loading) return;
    setLoading(true);
    setErrorKey(null);
    try {
      await sendCode();
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setCode('');
    setResetToken('');
    setPassword('');
    setConfirmation('');
    setErrorKey(null);
    setStep('email');
  }

  const titleKey = step === 'code' ? 'passwordReset.codeTitle'
    : step === 'password' ? 'passwordReset.newPasswordTitle'
    : step === 'done' ? 'passwordReset.completeTitle' : 'login.passwordReset';
  const subtitleKey = step === 'code' ? 'passwordReset.codeSubtitle'
    : step === 'password' ? 'passwordReset.newPasswordSubtitle'
    : step === 'done' ? 'passwordReset.complete' : 'login.passwordResetSubtitle';

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

        <form className={styles['login-form']} onSubmit={handleSubmit} aria-labelledby="reset-title" aria-busy={loading}>
          <div className={styles['login-form-header']} role={step === 'done' ? 'status' : undefined}>
            <h1 id="reset-title" className={styles['login-title']}>{t(titleKey)}</h1>
            <p className={styles['login-subtitle']}>{t(subtitleKey)}</p>
          </div>

          {step === 'email' && (
            <div className={styles['login-field']}>
              <label className={styles['login-label']} htmlFor="reset-email">{t('login.email')}</label>
              <div className={styles['login-input-box']}>
                <svg className={styles['login-field-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input id="reset-email" className={styles['login-input']} type="email"
                  placeholder={t('login.emailPlaceholder')} value={email}
                  onChange={(event) => { setEmail(event.target.value); setErrorKey(null); }}
                  autoComplete="email" maxLength={254} required disabled={loading} />
              </div>
            </div>
          )}

          {step === 'code' && (
            <div className={styles['login-field']}>
              <p className={styles['login-subtitle']}>{email.trim()}</p>
              <label className={styles['login-label']} htmlFor="reset-code">{t('passwordReset.code')}</label>
              <div className={styles['login-input-box']}>
                <input id="reset-code" className={styles['login-input']} type="text" inputMode="numeric"
                  autoComplete="one-time-code" placeholder="000000" value={code}
                  onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrorKey(null); }}
                  pattern="[0-9]{6}" maxLength={6} required disabled={loading}
                  aria-invalid={Boolean(errorKey)} aria-describedby={errorKey ? 'reset-error' : undefined} />
              </div>
            </div>
          )}

          {step === 'password' && (
            <>
              <div className={styles['login-field']}>
                <label className={styles['login-label']} htmlFor="reset-password">{t('passwordReset.newPassword')}</label>
                <div className={styles['login-input-box']}>
                  <input id="reset-password" className={styles['login-input']} type="password" value={password}
                    onChange={(event) => { setPassword(event.target.value); setErrorKey(null); }}
                    autoComplete="new-password" minLength={8} required disabled={loading} aria-describedby="reset-password-hint" />
                </div>
                <p id="reset-password-hint" className={styles['login-subtitle']}>{t('passwordReset.passwordHint')}</p>
              </div>
              <div className={styles['login-field']}>
                <label className={styles['login-label']} htmlFor="reset-password-confirm">{t('passwordReset.confirmPassword')}</label>
                <div className={styles['login-input-box']}>
                  <input id="reset-password-confirm" className={styles['login-input']} type="password" value={confirmation}
                    onChange={(event) => { setConfirmation(event.target.value); setErrorKey(null); }}
                    autoComplete="new-password" required disabled={loading} />
                </div>
              </div>
            </>
          )}

          {errorKey && <p id="reset-error" className={styles['login-error']} role="alert">{t(errorKey)}</p>}
          {step !== 'done' && (
            <button className={styles['login-btn']} type="submit" disabled={loading}>
              {t(loading ? 'common.loading' : step === 'code' ? 'passwordReset.verifyCode'
                : step === 'password' ? 'passwordReset.savePassword' : 'login.requestPasswordReset')}
            </button>
          )}
          {step === 'code' && (
            <>
              <p className={styles['login-mode-toggle']}>
                <button type="button" className={styles['login-toggle-link']} onClick={resendCode} disabled={loading}>
                  {t('passwordReset.resendCode')}
                </button>
              </p>
              <p className={styles['login-mode-toggle']}>
                <button type="button" className={styles['login-toggle-link']} onClick={changeEmail} disabled={loading}>
                  {t('passwordReset.changeEmail')}
                </button>
              </p>
            </>
          )}
          <p className={styles['login-mode-toggle']}>
            <button type="button" className={styles['login-toggle-link']} disabled={loading} onClick={() => onBack(email)}>
              {t('login.backToLogin')}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
