import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../backend/types';
import App from './App';
import type { User } from '../backend/types';
import LoginPage from './components/LoginPage';
import PublicEventsPage from './components/PublicEventsPage';
import type { CreateSessionBody } from '../backend/types';

const API = 'http://localhost:3000';

const SEED_SESSIONS: Session[] = [];

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/sessions`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export default function Root() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // 1. Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  // Helper to handle 401/403 responses (expired/invalid token)
  function handleUnauthorized() {
    handleLogout();
    setError('Session expired. Please log in again.');
  }

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Session[] = await res.json();
      const normalized = data.map((s) => {
        const rawDate = String(s.date ?? s.start_time ?? '');
        const rawStart = String(s.start_time ?? '');
        const rawEnd = String(s.end_time ?? '');
        return {
          ...s,
          color: s.color ?? 'blue',
          date: rawDate.slice(0, 10),
          start_time:
            rawStart.length > 5 ? rawStart.slice(11, 16) : rawStart.slice(0, 5),
          end_time:
            rawEnd.length > 5 ? rawEnd.slice(11, 16) : rawEnd.slice(0, 5),
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

      if (!token) {
        handleUnauthorized();
        throw new Error('No token found. Please log in.');
      }

      const res = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      // Handle BOTH 401 AND 403
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        throw new Error('Invalid or expired token. Please log in again.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to save session.');
      }

      await fetchSessions();
    } else {
      const b = body as any;
      const newSession: Session = {
        id: Date.now(),
        title: b.title ?? '',
        description: b.description ?? '',
        date: b.start_time?.slice(0, 10) ?? '',
        start_time: b.start_time?.slice(11, 16) ?? '',
        end_time: b.end_time?.slice(11, 16) ?? '',
        room_id: b.room_id ?? 1,
        speaker_id: b.speaker_id ?? 1,
        room_name: b.room_name ?? 'Room',
        speaker_name: b.speaker_name ?? 'Speaker',
        color: b.color ?? 'blue',
      };
      setSessions((prev) => [...prev, newSession]);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (backendMode) {
      const token = localStorage.getItem('token');

      if (!token) {
        handleUnauthorized();
        throw new Error('No token found. Please log in.');
      }

      const res = await fetch(`${API}/api/sessions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle BOTH 401 AND 403
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        throw new Error('Invalid or expired token. Please log in again.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to delete session.');
      }

      await fetchSessions();
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function handleLogin(credentials: {
    email: string;
    password: string;
  }): Promise<User> {
    if (backendMode) {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token) {
        throw new Error(data.message ?? 'Login failed. No token received.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    }
    throw new Error('Backend not reachable.');
  }

  async function handleRegister(credentials: {
    name: string;
    email: string;
    password: string;
  }): Promise<void> {
    if (backendMode) {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status !== 201)
        throw new Error(data.message ?? 'Registration failed.');

      alert('Registration successful! Please log in.');
    }
  }

  // 1. Handle Login State
  if (!user) {
    return (
      <LoginPage
        offlineMode={backendMode === false}
        onLogin={handleLogin}
      />
    );
  }

  // 2. Role-Based Routing
  const userRole = user.role?.trim().toLowerCase();

  if (userRole === 'booker') {
    return (
      <App
        user={user}
        sessions={sessions}
        loading={loading}
        error={error}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onLogout={handleLogout}
      />
    );
  }

  // 3. Default to Attendee View
  return (
    <PublicEventsPage
      sessions={sessions}
      loading={loading}
      error={error}
      user={user}
      onLogout={handleLogout}
    />
  );
}