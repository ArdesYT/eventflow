import { useState, useEffect, useCallback } from 'react';
import type { User, Session, CreateSessionBody, LoginCredentials } from '../backend/types';
import LoginPage from './components/LoginPage';
import PublicEventsPage from './components/PublicEventsPage';
import App from './App';

const API = import.meta.env.VITE_API_URL ?? '';
const USER_KEY = 'ef_user';

export default function Root() {
  // Initialise from localStorage so the session survives a page refresh
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Hiba az adatok lekérésekor:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function persistUser(u: User | null) {
    if (u) {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    setUser(u);
  }

  async function handleLogin(credentials: LoginCredentials): Promise<User> {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Hibás belépés!");
    }

    const data = await res.json();
    const loggedInUser: User = {
      ...data.user,
      role: data.user.role.trim().toLowerCase()
    };

    persistUser(loggedInUser);
    return loggedInUser;
  }

  // App.tsx saveBooking already formats start_time and end_time as full datetime
  // strings before calling onCreate — so we just pass the body straight through.
  async function handleCreate(body: CreateSessionBody) {
    const res = await fetch(`${API}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Hiba a mentés során!");
    }

    await fetchSessions();
  }

  async function handleDelete(id: number) {
    const res = await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Törlési hiba!");
    }
    await fetchSessions();
  }

  if (loading && !user) return <div className="loader">Betöltés...</div>;

  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        offlineMode={false}
      />
    );
  }

  const isBooker = user.role?.trim().toLowerCase() === 'booker';

  return isBooker ? (
    <App
      user={user}
      sessions={sessions}
      loading={loading}
      error={null}
      onCreate={handleCreate}
      onDelete={handleDelete}
      onLogout={() => persistUser(null)}
    />
  ) : (
    <PublicEventsPage
      sessions={sessions}
      loading={loading}
      error={null}
      user={user}
      onLogout={() => persistUser(null)}
    />
  );
}
