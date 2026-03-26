import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../backend/types';
import App from './App';
import type { User } from '../backend/types';
import LoginPage from './components/LoginPage';

const API = 'http://localhost:3000';

const SEED_SESSIONS: Session[] = [];

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/sessions`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export default function Root() {
  const [sessions,    setSessions]    = useState<Session[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<boolean | null>(null);
  const [user,        setUser]        = useState<User | null>(null);

  // 1. Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Session[] = await res.json();
      const normalized = data.map(s => {
        const rawDate  = String(s.date       ?? s.start_time ?? '');
        const rawStart = String(s.start_time ?? '');
        const rawEnd   = String(s.end_time   ?? '');
        return {
          ...s,
          color:      s.color ?? 'blue',
          date:       rawDate.slice(0, 10),
          start_time: rawStart.length > 5 ? rawStart.slice(11, 16) : rawStart.slice(0, 5),
          end_time:   rawEnd.length > 5   ? rawEnd.slice(11, 16)   : rawEnd.slice(0, 5),
        };
      });
      setSessions(normalized);
      setError(null);
    } catch (e) {
      console.error('fetchSessions failed:', e);
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const reachable = await isBackendReachable();
      setBackendMode(reachable);
      if (reachable) {
        await fetchSessions();
      } else {
        setSessions(SEED_SESSIONS);
        setLoading(false);
      }
    })();
  }, [fetchSessions]);

  async function handleCreate(body: object): Promise<void> {
    if (backendMode) {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to save session.');
      }
      await fetchSessions();
    } else {
      const b = body as any;
      const newSession: Session = {
        id:           Date.now(),
        title:        b.title        ?? '',
        description:  b.description  ?? '',
        date:         b.start_time?.slice(0, 10) ?? '',
        start_time:   b.start_time?.slice(11, 16) ?? '',
        end_time:     b.end_time?.slice(11, 16)   ?? '',
        room_id:      b.room_id      ?? 1,
        speaker_id:   b.speaker_id   ?? 1,
        room_name:    b.room_name    ?? 'Room',
        speaker_name: b.speaker_name ?? 'Speaker',
        color:        b.color        ?? 'blue',
      };
      setSessions(prev => [...prev, newSession]);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (backendMode) {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/sessions/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to delete session.');
      }
      await fetchSessions();
    } else {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  }

  async function handleLogin(credentials: { email: string; password: string }): Promise<void> {
    if (backendMode) {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message ?? 'Invalid email or password.');
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        const userData = { id: data.id, name: data.name, email: data.email, role: data.role };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
    }
  }

  async function handleRegister(credentials: { name: string; email: string; password: string }): Promise<void> {
    if (backendMode) {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json().catch(() => ({}));
      // Note: Backend register currently returns {id, message}, not success: true
      if (res.status !== 201) throw new Error(data.message ?? 'Registration failed.');
      
      // Usually, you'd auto-login here or redirect to login page
      alert('Registration successful! Please log in.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <App
      sessions={sessions}
      loading={loading}
      error={error}
      user={user}
      onLogout={handleLogout}
      onCreate={handleCreate}
      onDelete={handleDelete}
    />
  );
}