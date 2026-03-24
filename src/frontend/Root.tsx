import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '../Backend/types';
import LoginPage from './components/LoginPage';
import PublicEventsPage from './components/PublicEventsPage';
import App from './App';

const API = 'http://localhost:3000';
const POLL_INTERVAL_MS = 5000;

const DEMO_USERS: (User & { password: string })[] = [
  { id: 1, name: 'Anna Kovács', email: 'booker@eventflow.hu',   password: 'booker123',   role: 'booker'   },
  { id: 2, name: 'Péter Nagy',  email: 'attendee@eventflow.hu', password: 'attendee123', role: 'attendee' },
];

const SEED_SESSIONS: Session[] = [
  { id: 1, title: 'Opening Keynote',       date: '2026-03-20', start_time: '09:00', end_time: '10:30', room_id: 1, speaker_id: 1, room_name: 'Main Hall', speaker_name: 'Dr. Anna Kovács', color: 'blue',  description: 'Kickoff of EventFlow 2026.' },
  { id: 2, title: 'AI & Society Panel',    date: '2026-03-20', start_time: '11:00', end_time: '12:00', room_id: 2, speaker_id: 2, room_name: 'Room A',    speaker_name: 'Péter Nagy',      color: 'amber', description: '' },
  { id: 3, title: 'Workshop: Design Sys.', date: '2026-03-21', start_time: '13:00', end_time: '15:00', room_id: 4, speaker_id: 3, room_name: 'Workshop',  speaker_name: 'Eszter Molnár',   color: 'green', description: 'Hands-on workshop.' },
  { id: 4, title: 'Startup Pitches',       date: '2026-03-22', start_time: '14:00', end_time: '16:00', room_id: 1, speaker_id: 5, room_name: 'Main Hall', speaker_name: 'Multiple',        color: 'red',   description: '' },
  { id: 5, title: 'Closing Ceremony',      date: '2026-03-25', start_time: '17:00', end_time: '18:00', room_id: 1, speaker_id: 1, room_name: 'Main Hall', speaker_name: 'Dr. Anna Kovács', color: 'blue',  description: '' },
  { id: 6, title: 'Tech Talk: Web3',       date: '2026-03-23', start_time: '10:00', end_time: '11:00', room_id: 3, speaker_id: 4, room_name: 'Room B',    speaker_name: 'Balázs Kiss',     color: 'amber', description: '' },
];

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/sessions`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export default function Root() {
  const [user,        setUser]        = useState<User | null>(null);
  const [sessions,    setSessions]    = useState<Session[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<boolean | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Session[] = await res.json();
      // Normalize date/time fields — DB may return full ISO strings like
      // "2026-03-05T08:00:00.000Z" instead of "2026-03-05" / "09:00"
      const normalized = data.map(s => {
        const rawDate  = String(s.date       ?? s.start_time ?? '');
        const rawStart = String(s.start_time ?? '');
        const rawEnd   = String(s.end_time   ?? '');
        return {
          ...s,
          color:      s.color ?? 'blue',
          date:       rawDate.slice(0, 10),           // "2026-03-05"
          start_time: rawStart.length > 5
                        ? rawStart.slice(11, 16)      // "T09:00" → "09:00"
                        : rawStart.slice(0, 5),       // already "09:00"
          end_time:   rawEnd.length > 5
                        ? rawEnd.slice(11, 16)
                        : rawEnd.slice(0, 5),
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

  useEffect(() => {
    if (!user || user.role !== 'booker' && user.role !== 'attendee') return;
    if (user.role !== 'attendee' || !backendMode) return;
    const id = setInterval(fetchSessions, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, backendMode, fetchSessions]);

  async function handleLogin(credentials: { email: string; password: string }): Promise<User> {
    if (backendMode) {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Invalid email or password.');
      }
      const u: User = await res.json();
      // Normalize role just in case DB returns different casing
      return { ...u, role: u.role?.trim().toLowerCase() as User['role'] };
    }
    const match = DEMO_USERS.find(u => u.email === credentials.email && u.password === credentials.password);
    if (!match) throw new Error('Invalid email or password.');
    const { password: _, ...user } = match;
    return user;
  }

  async function handleCreate(body: object): Promise<void> {
    if (backendMode) {
      try {
        const res = await fetch(`${API}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message ?? 'Failed to save session.');
        }
        await fetchSessions();
      } catch (e: any) {
        // Re-throw so App.tsx can show the error in the modal — don't crash the page
        throw e;
      }
    } else {
      // Demo mode — optimistic local add
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
      const res = await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to delete session.');
      }
      await fetchSessions();
    } else {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  }

  if (!user) {
    return (
      <LoginPage
        offlineMode={backendMode === false}
        onLogin={async (credentials) => {
          const loggedInUser = await handleLogin(credentials);
          console.log('Logged in:', loggedInUser.email, '| role:', loggedInUser.role);
          setUser(loggedInUser);
        }}
      />
    );
  }

  if (user.role?.trim().toLowerCase() === 'booker') {
    return (
      <App
        initialUser={user}
        sessions={sessions}
        loading={loading}
        error={error}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onLogout={() => setUser(null)}
      />
    );
  }

  return (
    <PublicEventsPage
      sessions={sessions}
      loading={loading}
      error={error}
      user={user}
      onLogout={() => setUser(null)}
    />
  );
}
