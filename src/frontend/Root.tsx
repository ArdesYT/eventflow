import { useState, useEffect, useCallback } from 'react';
import type { BookingFormData, User, Session, SessionSavesMap, UserRole } from '../backend/types';
import LoginPage from './components/LoginPage';
import PublicEventsPage from './components/PublicEventsPage';
import App from './App';
import AdminApp from './components/admin/AdminApp';
import { apiUrl } from './lib/api';
import { loadStoredAuth, saveAuth, clearAuth } from './lib/authStorage';
import { authFetch } from './lib/authFetch';
import { DEMO_USERS } from './lib/demoUsers';
import { normalizeSession, parseSessionDateTime } from './lib/sessionFormat';
import { fetchAdminUsers, updateUserRole, deleteAdminUser } from './lib/adminApi';
import {
  addToMySchedule,
  fetchMySchedule,
  fetchSessionSaves,
  removeFromMySchedule,
} from './lib/scheduleApi';
import { loadOfflineSchedule, saveOfflineSchedule } from './lib/scheduleStorage';
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
  const [user, setUser] = useState<User | null>(() => loadStoredAuth()?.user ?? null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [scheduleBusyId, setScheduleBusyId] = useState<number | null>(null);
  const [sessionSaves, setSessionSaves] = useState<SessionSavesMap | null>(null);
  const [backendMode, setBackendMode] = useState<boolean | null>(null);

  const displayError = error
    ? error.startsWith('errors.')
      ? t(error)
      : translateError(error, t)
    : null;

  const displayScheduleError = scheduleError
    ? scheduleError.startsWith('errors.')
      ? t(scheduleError)
      : translateError(scheduleError, t)
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

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const list = await fetchAdminUsers();
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
        const auth = loadStoredAuth();
        if (auth?.token) {
          try {
            const res = await authFetch('/api/auth/me');
            if (!res.ok) {
              clearAuth();
              setUser(null);
            } else {
              const fresh = (await res.json()) as User;
              const u = { ...fresh, role: fresh.role?.trim().toLowerCase() as UserRole };
              saveAuth(u, auth.token);
              setUser(u);
            }
          } catch {
            /* keep cached user on transient network errors */
          }
        } else if (auth?.user) {
          clearAuth();
          setUser(null);
        }
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
      fetchUsers();
    } else {
      setUsers(demoUsersList());
    }
  }, [user, backendMode, fetchUsers]);

  const fetchSessionSavesMap = useCallback(async () => {
    if (!user || !backendMode) return;
    const role = user.role?.trim().toLowerCase();
    if (role !== 'admin' && role !== 'booker') return;

    try {
      const data = await fetchSessionSaves();
      setSessionSaves(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg !== 'errors.savesNotAvailable') {
        console.error('fetchSessionSaves failed:', e);
      }
      setSessionSaves(null);
    }
  }, [user, backendMode]);

  const fetchSavedSchedule = useCallback(async () => {
    if (!user || user.role?.trim().toLowerCase() !== 'attendee' || !backendMode) return;

    try {
      const data = await fetchMySchedule();
      setSavedSessions(mapApiSessions(data));
      setScheduleError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'errors.saveError';
      if (msg === 'errors.scheduleNotAvailable') {
        setScheduleError(msg);
      } else {
        console.error('fetchSavedSchedule failed:', e);
      }
    }
  }, [user, backendMode]);

  useEffect(() => {
    if (!user || user.role?.trim().toLowerCase() !== 'attendee') return;
    if (backendMode) {
      fetchSavedSchedule();
    } else {
      const ids = loadOfflineSchedule(user.id);
      setSavedSessions(sessions.filter((s) => ids.includes(s.id)));
    }
  }, [user, backendMode, sessions, fetchSavedSchedule]);

  useEffect(() => {
    if (!user || !backendMode) return;
    const role = user.role?.trim().toLowerCase();
    if (role === 'admin' || role === 'booker') {
      fetchSessionSavesMap();
    }
  }, [user, backendMode, fetchSessionSavesMap]);

  useEffect(() => {
    if (!user || !backendMode) return;
    const role = user.role?.trim().toLowerCase();

    const id = setInterval(() => {
      fetchSessions();
      if (role === 'attendee') {
        fetchSavedSchedule();
      } else if (role === 'admin' || role === 'booker') {
        fetchSessionSavesMap();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, backendMode, fetchSessions, fetchSavedSchedule, fetchSessionSavesMap]);

  async function handleSaveSession(sessionId: number) {
    if (!user) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    setScheduleBusyId(sessionId);
    setScheduleError(null);
    try {
      if (backendMode) {
        await addToMySchedule(sessionId);
        setSavedSessions((prev) =>
          [...prev.filter((s) => s.id !== sessionId), session].sort((a, b) =>
            (a.date + a.start_time).localeCompare(b.date + b.start_time),
          ),
        );
      } else {
        const ids = loadOfflineSchedule(user.id);
        if (!ids.includes(sessionId)) {
          saveOfflineSchedule(user.id, [...ids, sessionId]);
          setSavedSessions((prev) => [...prev, session]);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'errors.saveError';
      setScheduleError(msg);
    } finally {
      setScheduleBusyId(null);
    }
  }

  async function handleRemoveSession(sessionId: number) {
    if (!user) return;

    setScheduleBusyId(sessionId);
    setScheduleError(null);
    try {
      if (backendMode) {
        await removeFromMySchedule(sessionId);
      } else {
        const ids = loadOfflineSchedule(user.id).filter((id) => id !== sessionId);
        saveOfflineSchedule(user.id, ids);
      }
      setSavedSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'errors.deleteError';
      setScheduleError(msg);
    } finally {
      setScheduleBusyId(null);
    }
  }

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
      const raw = data.user ?? data;
      const u: User = { ...raw, role: raw.role?.trim().toLowerCase() as UserRole };
      if (data.token) saveAuth(u, data.token);
      return u;
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
      const res = await authFetch('/api/sessions', {
        method: 'POST',
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
      const res = await authFetch(`/api/sessions/${id}`, { method: 'DELETE' });
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
      const res = await authFetch(`/api/sessions/${id}`, {
        method: 'PATCH',
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
      const updated = await updateUserRole(userId, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...updated, role: updated.role as UserRole } : u)),
      );
      if (userId === user.id) {
        const next = { ...user, role };
        setUser(next);
        saveAuth(next, loadStoredAuth()?.token ?? null);
      }
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
    }
  }

  async function handleDeleteUser(userId: number) {
    if (backendMode && user?.role === 'admin') {
      await deleteAdminUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  }

  function handleLogout() {
    clearAuth();
    setUser(null);
  }

  if (!user) {
    return (
      <LoginPage
        offlineMode={backendMode === false}
        onLogin={async (credentials) => {
          const loggedInUser = await handleLogin(credentials);
          if (!backendMode) saveAuth(loggedInUser, null);
          setUser(loggedInUser);
        }}
        onRegister={async (credentials) => {
          const registeredUser = await handleRegister(credentials);
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
        sessionSaves={sessionSaves}
        onRefreshSessionSaves={fetchSessionSavesMap}
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
        sessionSaves={sessionSaves}
        onRefreshSessionSaves={fetchSessionSavesMap}
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
      savedSessions={savedSessions}
      loading={loading}
      error={displayError}
      scheduleError={displayScheduleError}
      scheduleBusyId={scheduleBusyId}
      user={user}
      onSaveSession={handleSaveSession}
      onRemoveSession={handleRemoveSession}
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
