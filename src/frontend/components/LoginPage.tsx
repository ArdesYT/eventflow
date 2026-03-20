import { useState, type FormEvent } from 'react';

interface LoginPageProps {
  offlineMode: boolean;
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
}

export default function LoginPage({ offlineMode, onLogin }: LoginPageProps) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError(null);
    try {
      await onLogin({ email, password });
    } catch (err: any) {
      setError(err.message ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: 'booker' | 'attendee') {
    setEmail(role === 'booker' ? 'booker@eventflow.hu' : 'attendee@eventflow.hu');
    setPassword(role === 'booker' ? 'booker123' : 'attendee123');
    setError(null);
  }

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-logo">EF</div>
          <div>
            <div className="login-brand-name">EventFlow</div>
            <div className="login-brand-tagline">Your event. Perfectly organised.</div>
          </div>
        </div>
        <div className="login-decorative">
          <div className="deco-card deco-card-1"><div className="deco-dot blue" /><div className="deco-line" /><div className="deco-line short" /></div>
          <div className="deco-card deco-card-2"><div className="deco-dot amber" /><div className="deco-line" /><div className="deco-line short" /></div>
          <div className="deco-card deco-card-3"><div className="deco-dot green" /><div className="deco-line" /><div className="deco-line short" /></div>
        </div>
        <p className="login-left-footer">Manage sessions, speakers &amp; rooms<br />from one elegant dashboard.</p>
      </div>

      {/* Right form panel */}
      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to your EventFlow account</p>
          </div>

          {/* Offline mode banner */}
          {offlineMode && (
            <div className="login-offline-banner">
              ⚡ Backend unreachable — running in demo mode.
              Use the credentials below to sign in.
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Email address</label>
            <input
              className={`login-input${error ? ' error' : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              className={`login-input${error ? ' error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? <span className="login-spinner" /> : 'Sign in'}
          </button>

          <div className="login-hints">
            <p className="login-hint-title">Demo accounts</p>
            <div className="login-hint-row" onClick={() => fillDemo('booker')}>
              <span className="hint-badge booker">Booker</span>
              <span>booker@eventflow.hu / booker123</span>
            </div>
            <div className="login-hint-row" onClick={() => fillDemo('attendee')}>
              <span className="hint-badge attendee">Attendee</span>
              <span>attendee@eventflow.hu / attendee123</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
