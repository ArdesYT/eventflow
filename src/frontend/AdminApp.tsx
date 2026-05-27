import { useState } from 'react';
import type { Session, User, AdminViewType, BookingFormData } from '../backend/types';
import AdminOverview from './components/admin/AdminOverview';
import UsersView from './components/admin/UsersView';
import SessionsView from './components/SessionsView';
import AgendaView from './components/AgendaView';
import BookingModal from './components/BookingModal';
import DetailModal from './components/DetailModal';
import RoomsUsage from './components/admin/RoomsUsage';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n, translateError } from './i18n/I18nProvider';
import './App.css';

const NAV_ITEMS: { view: AdminViewType; icon: string; labelKey: string }[] = [
  { view: 'overview', icon: '📊', labelKey: 'admin.nav.overview' },
  { view: 'users', icon: '👥', labelKey: 'admin.nav.users' },
  { view: 'sessions', icon: '🎬', labelKey: 'admin.nav.sessions' },
  { view: 'rooms', icon: '🏛', labelKey: 'admin.nav.rooms' },
];

const PAGE_TITLE_KEYS: Record<AdminViewType, string> = {
  overview: 'admin.nav.overview',
  users: 'admin.nav.users',
  sessions: 'admin.nav.sessions',
  rooms: 'admin.nav.rooms',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface AdminAppProps {
  initialUser: User;
  sessions: Session[];
  users: User[];
  loading: boolean;
  usersLoading: boolean;
  error: string | null;
  backendMode: boolean;
  onUpdateUserRole: (userId: number, role: User['role']) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
  onDeleteSession: (id: number) => Promise<void>;
  onUpdateSession: (id: number, data: BookingFormData) => Promise<void>;
  onLogout: () => void;
}

export default function AdminApp({
  initialUser,
  sessions,
  users,
  loading,
  usersLoading,
  error,
  backendMode,
  onUpdateUserRole,
  onDeleteUser,
  onDeleteSession,
  onUpdateSession,
  onLogout,
}: AdminAppProps) {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<AdminViewType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const filteredSessions = sessions.filter((s) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      s.title.toLowerCase().includes(query) ||
      s.speaker_name.toLowerCase().includes(query) ||
      s.room_name.toLowerCase().includes(query)
    );
  });

  const detailSession = sessions.find((s) => s.id === detailId) ?? null;
  const editingSession = sessions.find((s) => s.id === editingSessionId) ?? null;

  async function handleRoleChange(userId: number, role: User['role']) {
    setUserActionError(null);
    try {
      await onUpdateUserRole(userId, role);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.saveError';
      setUserActionError(msg);
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!window.confirm(t('admin.users.confirmDelete'))) return;
    setUserActionError(null);
    try {
      await onDeleteUser(userId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.deleteError';
      setUserActionError(msg);
    }
  }

  async function handleDeleteSession(id: number) {
    try {
      await onDeleteSession(id);
      setDetailId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.deleteError';
      alert(translateError(msg, t));
    }
  }

  function toBookingFormData(session: Session): BookingFormData {
    const parseTime = (value: string) => {
      const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);
      return match ? match[1] : value;
    };

    return {
      title: session.title,
      description: session.description ?? '',
      date: session.date,
      start_time: parseTime(session.start_time),
      end_time: parseTime(session.end_time),
      room_id: session.room_id,
      speaker_id: session.speaker_id,
      room_name: session.room_name,
      speaker_name: session.speaker_name,
      color: session.color,
    };
  }

  function handleEditSession(id: number) {
    setDetailId(null);
    setEditError(null);
    setEditingSessionId(id);
  }

  async function handleSaveSession(data: BookingFormData) {
    if (editingSessionId === null) return;
    setEditError(null);
    setEditSaving(true);

    try {
      await onUpdateSession(editingSessionId, data);
      setEditingSessionId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.saveError';
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="app-wrapper admin-app">
      <aside className="sidebar admin-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('admin.dashboardTitle')}</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view, icon, labelKey }) => (
            <div
              key={view}
              className={`nav-item${currentView === view ? ' active' : ''}`}
              onClick={() => setCurrentView(view)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{t(labelKey)}</span>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-mode-badge">
            {backendMode ? t('admin.modeLive') : t('admin.modeDemo')}
          </div>
          <LanguageSwitcher variant="compact" />
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{t(PAGE_TITLE_KEYS[currentView])}</h1>
            <span className="hint-badge admin admin-topbar-badge">
              {t('login.admin')}
            </span>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            {currentView === 'sessions' && (
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder={t('nav.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
            <div className="topbar-user-pill">
              <div className="topbar-user-avatar">{getInitials(initialUser.name)}</div>
              <span className="topbar-user-name">{initialUser.name}</span>
            </div>
            <button
              className="topbar-logout-btn"
              onClick={onLogout}
              title={t('common.signOut')}
            >
              ⎋
            </button>
          </div>
        </div>

        <div className="content-area">
          {loading && currentView !== 'users' && (
            <div className="loader">{t('common.loading')}</div>
          )}
          {error && <div className="error-banner">{error}</div>}
          {userActionError && (
            <div className="error-banner">
              {userActionError.startsWith('errors.')
                ? t(userActionError)
                : translateError(userActionError, t)}
            </div>
          )}

          {!loading && currentView === 'overview' && (
            <AdminOverview users={users} sessions={sessions} />
          )}

          {!loading && currentView === 'rooms' && (
            <>
              <div className="section-title">{t('admin.nav.rooms')}</div>
              <RoomsUsage sessions={sessions} />
            </>
          )}

          {currentView === 'users' && (
            <>
              {usersLoading && <div className="loader">{t('common.loading')}</div>}
              {!usersLoading && (
                <UsersView
                  users={users}
                  currentUserId={initialUser.id}
                  onRoleChange={handleRoleChange}
                  onDelete={handleDeleteUser}
                />
              )}
            </>
          )}

          {currentView === 'sessions' && !loading && (
            <>
              <div className="section-title">{t('admin.sessions.allTitle')}</div>
              <SessionsView
                sessions={filteredSessions}
                searchTerm={searchTerm}
                onEventClick={(id) => setDetailId(id)}
              />
              <div className="section-title" style={{ marginTop: 28 }}>
                {t('admin.sessions.agendaTitle')}
              </div>
              <AgendaView
                sessions={filteredSessions}
                onEventClick={(id) => setDetailId(id)}
                onDelete={handleDeleteSession}
              />
            </>
          )}
        </div>
      </div>

      {detailSession && (
        <DetailModal
          session={detailSession}
          onClose={() => setDetailId(null)}
          onDelete={handleDeleteSession}
          onEdit={handleEditSession}
        />
      )}

      {editingSession && (
        <BookingModal
          initialValues={toBookingFormData(editingSession)}
          onSave={handleSaveSession}
          onClose={() => {
            setEditingSessionId(null);
            setEditError(null);
          }}
          saving={editSaving}
          saveError={editError}
        />
      )}
    </div>
  );
}
