import { useState } from 'react';
import type { LoginCredentials } from '../../backend/types';
import type { User } from '../../backend/types';

interface Props {
  offlineMode: boolean;
  // Change 'void' to 'Promise<User>'
  onLogin: (credentials: LoginCredentials) => Promise<User>; 
}

type View = 'login' | 'register';

const ACCENT_DOTS = [
  { top: '12%',  left: '8%',  size: 6,  opacity: 0.18 },
  { top: '28%',  left: '3%',  size: 3,  opacity: 0.12 },
  { top: '55%',  left: '11%', size: 8,  opacity: 0.10 },
  { top: '78%',  left: '5%',  size: 4,  opacity: 0.14 },
  { top: '90%',  left: '15%', size: 5,  opacity: 0.09 },
  { top: '8%',   left: '88%', size: 5,  opacity: 0.13 },
  { top: '35%',  left: '93%', size: 7,  opacity: 0.09 },
  { top: '62%',  left: '89%', size: 3,  opacity: 0.16 },
  { top: '82%',  left: '95%', size: 6,  opacity: 0.11 },
];

export default function LoginPage({ onLogin }: Props) {
  const [view, setView] = useState<View>('login');

  // Login state
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError,    setLoginError]    = useState<string | null>(null);
  const [loginLoading,  setLoginLoading]  = useState(false);

  // Register state
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');
  const [regRole,     setRegRole]     = useState<'booker' | 'attendee'>('attendee');
  const [regError,    setRegError]    = useState<string | null>(null);
  const [regSuccess,  setRegSuccess]  = useState(false);
  const [regLoading,  setRegLoading]  = useState(false);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await onLogin({ email: loginEmail, password: loginPassword });
    } catch (err: any) {
      setLoginError(err.message ?? 'Bejelentkezés sikertelen.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setRegError('All fields are required.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, role: regRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Registration failed.');
      setRegSuccess(true);
    } catch (err: any) {
      setRegError(err.message ?? 'Registration failed.');
    } finally {
      setRegLoading(false);
    }
  }

  function switchTo(v: View) {
    setView(v);
    setLoginError(null);
    setRegError(null);
    setRegSuccess(false);
  }

  return (
    <div style={styles.root}>
      {/* Decorative background dots */}
      {ACCENT_DOTS.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', top: d.top, left: d.left,
          width: d.size, height: d.size, borderRadius: '50%',
          background: '#1a56db', opacity: d.opacity, pointerEvents: 'none',
        }} />
      ))}

      {/* Left brand panel */}
      <div style={styles.brand}>
        <div style={styles.brandInner}>
          <div style={styles.brandLogo}>
            <span style={styles.brandLogoText}>EF</span>
          </div>
          <div style={styles.brandName}>EventFlow</div>
          <div style={styles.brandTagline}>Organiser Dashboard</div>

          <div style={styles.brandDivider} />

          <div style={styles.brandFeatures}>
            {['Manage sessions & rooms', 'Real-time calendar view', 'Speaker scheduling', 'Attendance overview'].map(f => (
              <div key={f} style={styles.brandFeatureRow}>
                <div style={styles.brandFeatureDot} />
                <span style={styles.brandFeatureText}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom gradient stripe */}
        <div style={styles.brandStripe} />
      </div>

      {/* Right form panel */}
      <div style={styles.formPanel}>
        <div style={styles.formCard}>

          {/* Tab switcher */}
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(view === 'login'    ? styles.tabActive : {}) }} onClick={() => switchTo('login')}>Sign in</button>
            <button style={{ ...styles.tab, ...(view === 'register' ? styles.tabActive : {}) }} onClick={() => switchTo('register')}>Register</button>
          </div>

          {/* ── LOGIN ── */}
          {view === 'login' && (
            <form onSubmit={submitLogin} style={styles.form}>
              <div style={styles.formHeader}>
                <h2 style={styles.formTitle}>Welcome back</h2>
                <p style={styles.formSub}>Sign in to your EventFlow account</p>
              </div>

              <Field label="Email address">
                <input style={styles.input} type="email" placeholder="you@example.com"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoFocus />
              </Field>

              <Field label="Password">
                <input style={styles.input} type="password" placeholder="••••••••"
                  value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </Field>

              {loginError && <div style={styles.errorBox}>{loginError}</div>}

              <button type="submit" style={{ ...styles.submitBtn, ...(loginLoading ? styles.submitBtnDisabled : {}) }} disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </button>

              <p style={styles.switchHint}>
                No account?{' '}
                <button type="button" style={styles.switchLink} onClick={() => switchTo('register')}>Create one</button>
              </p>
            </form>
          )}

          {/* ── REGISTER ── */}
          {view === 'register' && (
            <form onSubmit={submitRegister} style={styles.form}>
              <div style={styles.formHeader}>
                <h2 style={styles.formTitle}>Create account</h2>
                <p style={styles.formSub}>Join EventFlow to manage your events</p>
              </div>

              {regSuccess ? (
                <div style={styles.successBox}>
                  <div style={styles.successIcon}>✓</div>
                  <div style={styles.successTitle}>Account created!</div>
                  <div style={styles.successSub}>You can now sign in with your credentials.</div>
                  <button type="button" style={styles.submitBtn} onClick={() => switchTo('login')}>
                    Go to sign in
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Full name">
                    <input style={styles.input} type="text" placeholder="Anna Kovács"
                      value={regName} onChange={e => setRegName(e.target.value)} required autoFocus />
                  </Field>

                  <Field label="Email address">
                    <input style={styles.input} type="email" placeholder="you@example.com"
                      value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                  </Field>

                  <Field label="Password">
                    <input style={styles.input} type="password" placeholder="Min. 6 characters"
                      value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                  </Field>

                  <Field label="Confirm password">
                    <input style={styles.input} type="password" placeholder="Repeat password"
                      value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required />
                  </Field>

                  <Field label="Account type">
                    <div style={styles.roleRow}>
                      {(['attendee', 'booker'] as const).map(r => (
                        <button key={r} type="button"
                          style={{ ...styles.roleBtn, ...(regRole === r ? styles.roleBtnActive : {}) }}
                          onClick={() => setRegRole(r)}>
                          <span style={styles.roleIcon}>{r === 'attendee' ? '👤' : '🗂️'}</span>
                          <span style={styles.roleLabel}>{r === 'attendee' ? 'Attendee' : 'Booker'}</span>
                          <span style={styles.roleDesc}>{r === 'attendee' ? 'View sessions' : 'Manage sessions'}</span>
                        </button>
                      ))}
                    </div>
                  </Field>

                  {regError && <div style={styles.errorBox}>{regError}</div>}

                  <button type="submit" style={{ ...styles.submitBtn, ...(regLoading ? styles.submitBtnDisabled : {}) }} disabled={regLoading}>
                    {regLoading ? 'Creating account…' : 'Create account'}
                  </button>

                  <p style={styles.switchHint}>
                    Already have an account?{' '}
                    <button type="button" style={styles.switchLink} onClick={() => switchTo('login')}>Sign in</button>
                  </p>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#f9fafb',
    position: 'relative',
    overflow: 'hidden',
  },

  // ── Brand panel
  brand: {
    width: 340,
    minWidth: 340,
    background: '#111827',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  brandInner: {
    padding: '52px 40px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: '#1a56db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandLogoText: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
  },
  brandName: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 1,
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 300,
  },
  brandDivider: {
    width: 32,
    height: 1,
    background: 'rgba(255,255,255,0.1)',
    margin: '36px 0',
  },
  brandFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  brandFeatureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandFeatureDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#1a56db',
    flexShrink: 0,
  },
  brandFeatureText: {
    fontSize: 13.5,
    color: '#9ca3af',
    fontWeight: 300,
  },
  brandStripe: {
    height: 4,
    background: 'linear-gradient(90deg, #1a56db 0%, #1e429f 50%, #111827 100%)',
  },

  // ── Form panel
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
  },

  // ── Tabs
  tabs: {
    display: 'flex',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 32,
    background: '#fff',
  },
  tab: {
    flex: 1,
    padding: '11px 0',
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 400,
    color: '#6b7280',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#1a56db',
    color: '#fff',
    fontWeight: 500,
  },

  // ── Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  formHeader: {
    marginBottom: 4,
  },
  formTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 26,
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 6,
    fontWeight: 400,
  },
  formSub: {
    fontSize: 13.5,
    color: '#6b7280',
    fontWeight: 300,
  },

  // ── Field
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: 500,
    color: '#374151',
    letterSpacing: 0.1,
  },
  input: {
    padding: '10px 13px',
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
    boxSizing: 'border-box',
  },

  // ── Role picker
  roleRow: {
    display: 'flex',
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    padding: '12px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  roleBtnActive: {
    borderColor: '#1a56db',
    background: '#e1effe',
  },
  roleIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111827',
  },
  roleDesc: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // ── Feedback
  errorBox: {
    background: '#fde8e8',
    border: '1px solid #f98080',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#9b1c1c',
    lineHeight: 1.5,
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '32px 0 8px',
    textAlign: 'center',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#def7ec',
    color: '#057a55',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 700,
  },
  successTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 20,
    color: '#111827',
    fontWeight: 400,
  },
  successSub: {
    fontSize: 13.5,
    color: '#6b7280',
    marginBottom: 8,
  },

  // ── Submit
  submitBtn: {
    padding: '11px 0',
    background: '#1a56db',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  },
  submitBtnDisabled: {
    background: '#93c5fd',
    cursor: 'not-allowed',
  },

  // ── Switch hint
  switchHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#9ca3af',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#1a56db',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    padding: 0,
  },
};
