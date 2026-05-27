import { useState, useEffect, useCallback } from 'react';
import type { BookingFormData, User, Session, UserRole } from '../backend/types';
import LoginPage from './components/LoginPage';
import PublicEventsPage from './components/PublicEventsPage';
import App from './App';
import AdminApp from './AdminApp';
import { apiUrl } from './lib/api';
import { loadStoredUser, saveStoredUser } from './lib/authStorage';
import { DEMO_USERS } from './lib/demoUsers';
import { normalizeSession, parseSessionDateTime } from './lib/sessionFormat';
import { fetchAdminUsers, updateUserRole, deleteAdminUser } from './lib/adminApi';
import { useI18n, translateError } from './i18n/I18nProvider';

const POLL_INTERVAL_MS = 5000;

const SEED_SESSIONS: Session[] = [
  { id: 1, title: 'Opening Keynote', date: '2026-03-20', start_time: '09:00', end_time: '10:30', room_id: 1, speaker_id: 1, room_name: 'Main Hall', speaker_name: 'Dr. Anna Kovács', color: 'blue', description: 'Kickoff of EventFlow 2026.' },
  { id: 2, title: 'AI & Society Panel', date: '2026-03-20', start_time: '11:00', end_time: '12:00', room_id: 2, speaker_id: 2, room_name: 'Room A', speaker_name: 'Péter Nagy', color: 'amber', description: '' },
  { id: 3, title: 'Workshop: Design Sys.', date: '2026-03-21', start_time: '13:00', end_time: '15:00', room_id: 4, speaker_id: 3, room_name: 'Workshop', speaker_name: 'Eszter Molnár', color: 'green', description: 'Hands-on workshop.' },
  { id: 4, title: 'Startup Pitches', date: '2026-03-22', start_time: '14:00', end_time: '16:00', room_id: 1, speaker_id: 5, room_name: 'Main Hall', speaker_name: 'Multiple', color: 'red', description: '' },
  { id: 5, title: 'Closing Ceremony', date: '2026-03-25', start_time: '17:00', end_time: '18:00', room_id: 1, speaker_id: 1, room_name: 'Main Hall', speaker_name: 'Dr. Anna Kovács', color: 'blue', description: '' },
  { id: 6, title: 'Tech Talk: Web3', date: '2026-03-23', start_time: '10:00', end_time: '11:00', room_id: 3, speaker_id: 4, room_name: 'Room B', speaker_name: 'Balázs Kiss', color: 'amber', description: '' },
];

function mapApiSessions(rows: unknown[]): Session[] {
  return rows
    .map((row) => normalizeSession(row as Record<string, unknown>))
    .filter((s): s is Session => s !== null);
}

function demoUsersList(): User[] {
  return DEMO_USERS.map(({ password: _, ...u }) => u);
}

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/sessions'), {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function Root() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<boolean | null>(null);

  const displayError = error
    ? error.startsWith('errors.')
      ? t(error)
      : translateError(error, t)
    : null;

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/sessions'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown[] = await res.json();
      setSessions(mapApiSessions(data));
      setError(null);
    } catch (e) {
      console.error('fetchSessions failed:', e);
      setError('errors.serverConnect');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (adminId: number) => {
    setUsersLoading(true);
    try {
      const list = await fetchAdminUsers(adminId);
      setUsers(list.map((u) => ({ ...u, role: u.role?.trim().toLowerCase() as UserRole })));
    } catch (e) {
      console.error('fetchUsers failed:', e);
      setUsers(demoUsersList());
    } finally {
      setUsersLoading(false);
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
        setUsers(demoUsersList());
        setLoading(false);
      }
    })();
  }, [fetchSessions]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (backendMode) {
      fetchUsers(user.id);
    } else {
      setUsers(demoUsersList());
    }
  }, [user, backendMode, fetchUsers]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'attendee' || !backendMode) return;
    const id = setInterval(fetchSessions, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, backendMode, fetchSessions]);

  async function handleLogin(credentials: {
    email: string;
    password: string;
  }): Promise<User> {
    if (backendMode) {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'errors.invalidCredentials');
      }
      const data = await res.json();
      const u: User = data.user ?? data;
      return { ...u, role: u.role?.trim().toLowerCase() as UserRole };
    }
    const match = DEMO_USERS.find(
      (u) => u.email === credentials.email && u.password === credentials.password,
    );
    if (!match) throw new Error('errors.invalidCredentials');
    const { password: _, ...loggedIn } = match;
    return loggedIn;
  }

  async function handleRegister(credentials: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    if (!backendMode) {
      throw new Error('errors.serverConnect');
    }

    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? 'errors.saveError');
    }

    const loggedInUser = await handleLogin({
      email: credentials.email,
      password: credentials.password,
    });

    return loggedInUser;
  }

  async function handleCreate(body: object): Promise<void> {
    if (backendMode) {
      const res = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'errors.saveError');
      }
      await fetchSessions();
    } else {
      const b = body as CreateSessionBodyLocal;
      const start = parseSessionDateTime(b.start_time ?? '');
      const end = parseSessionDateTime(b.end_time ?? '');
      const newSession: Session = {
        id: Date.now(),
        title: b.title ?? '',
        description: b.description ?? '',
        date: start?.date ?? '',
        start_time: start?.time ?? '',
        end_time: end?.time ?? '',
        room_id: b.room_id ?? 1,
        speaker_id: b.speaker_id ?? 1,
        room_name: 'Room',
        speaker_name: 'Speaker',
        color: b.color ?? 'blue',
      };
      setSessions((prev) => [...prev, newSession]);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (backendMode) {
      const res = await fetch(apiUrl(`/api/sessions/${id}`), { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'errors.deleteError');
      }
      await fetchSessions();
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function handleUpdateSession(id: number, data: BookingFormData): Promise<void> {
    if (backendMode) {
      const body = {
        title: data.title,
        description: data.description,
        start_time: `${data.date} ${data.start_time}:00`,
        end_time: `${data.date} ${data.end_time}:00`,
        room_id: data.room_id,
        speaker_id: data.speaker_id,
        speaker_name: data.speaker_name,
        color: data.color,
      };
      const res = await fetch(apiUrl(`/api/sessions/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'errors.saveError');
      }
      await fetchSessions();
    } else {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id
            ? {
                ...session,
                title: data.title,
                description: data.description,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                room_id: data.room_id,
                room_name: data.room_name,
                speaker_id: data.speaker_id,
                speaker_name: data.speaker_name,
                color: data.color,
              }
            : session,
        ),
      );
    }
  }

  async function handleUpdateUserRole(userId: number, role: UserRole) {
    if (backendMode && user?.role === 'admin') {
      const updated = await updateUserRole(user.id, userId, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...updated, role: updated.role as UserRole } : u)),
      );
      if (userId === user.id) {
        setUser((u) => (u ? { ...u, role } : u));
        saveStoredUser({ ...user, role });
      }
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
    }
  }

  async function handleDeleteUser(userId: number) {
    if (backendMode && user?.role === 'admin') {
      await deleteAdminUser(user.id, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  }

  function handleLogout() {
    saveStoredUser(null);
    setUser(null);
  }

  if (!user) {
    return (
      <LoginPage
        offlineMode={backendMode === false}
        onLogin={async (credentials) => {
          const loggedInUser = await handleLogin(credentials);
          saveStoredUser(loggedInUser);
          setUser(loggedInUser);
        }}
        onRegister={async (credentials) => {
          const registeredUser = await handleRegister(credentials);
          saveStoredUser(registeredUser);
          setUser(registeredUser);
        }}
      />
    );
  }

  const role = user.role?.trim().toLowerCase();

  if (role === 'admin') {
    return (
      <AdminApp
        initialUser={user}
        sessions={sessions}
        users={users}
        loading={loading}
        usersLoading={usersLoading}
        error={displayError}
        backendMode={backendMode === true}
        onUpdateUserRole={handleUpdateUserRole}
        onDeleteUser={handleDeleteUser}
        onDeleteSession={handleDelete}
        onUpdateSession={handleUpdateSession}
        onLogout={handleLogout}
      />
    );
  }

  if (role === 'booker') {
    return (
      <App
        initialUser={user}
        sessions={sessions}
        loading={loading}
        error={displayError}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <PublicEventsPage
      sessions={sessions}
      loading={loading}
      error={displayError}
      user={user}
      onLogout={handleLogout}
    />
  );
}

interface CreateSessionBodyLocal {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  room_id?: number;
  speaker_id?: number;
  color?: Session['color'];
}
