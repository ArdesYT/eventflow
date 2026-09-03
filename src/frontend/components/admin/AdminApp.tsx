/**
 * Admin főalkalmazás — Root rendereli admin szerepkör esetén.
 * Nézetek: áttekintés, felhasználók, előadások, termek, előadók, audit, eseményprofil.
 * Props: initialUser, event, rooms, sessions, users, CRUD callback-ek, backendMode, onLogout.
 */
import { useState, useEffect } from 'react';
import type {
  CreateSessionBody,
  EventProfile,
  Room,
  Session,
  SessionSavesMap,
  Speaker,
  User,
  AdminViewType,
  BookingFormData,
} from '../../../backend/types';
import EventProfileEditor from './EventProfileEditor';
import {
  createSpeaker,
  deleteSpeaker,
  fetchSpeakers,
  mergeSpeakers,
  speakersFromSessions,
  updateSpeaker,
} from '../../lib/speakersApi';
import AdminOverview from './AdminOverview';
import UsersView from './UsersView';
import SpeakersView from './SpeakersView';
import SessionWorkspace from '../SessionWorkspace';
import RoomsUsage from './RoomsUsage';
import ActivityLogView from './ActivityLogView';
import LanguageSwitcher from '../LanguageSwitcher';
import MobileBottomNav from '../MobileBottomNav';
import { fetchActivityLog } from '../../lib/adminApi';
import type { ActivityLogEntry } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';
import { translateError } from '../../i18n/translateError';
import '../../App.css';

const NAV_ITEMS: { view: AdminViewType; icon: string; labelKey: string }[] = [
  { view: 'overview', icon: '📊', labelKey: 'admin.nav.overview' },
  { view: 'users', icon: '👥', labelKey: 'admin.nav.users' },
  { view: 'sessions', icon: '🎬', labelKey: 'admin.nav.sessions' },
  { view: 'rooms', icon: '🏛', labelKey: 'admin.nav.rooms' },
  { view: 'speakers', icon: '🎤', labelKey: 'admin.nav.speakers' },
  { view: 'audit', icon: '📋', labelKey: 'admin.nav.audit' },
  { view: 'event', icon: '⚙️', labelKey: 'admin.nav.event' },
];

const PAGE_TITLE_KEYS: Record<AdminViewType, string> = {
  overview: 'admin.nav.overview',
  users: 'admin.nav.users',
  sessions: 'admin.nav.sessions',
  rooms: 'admin.nav.rooms',
  speakers: 'admin.nav.speakers',
  audit: 'admin.nav.audit',
  event: 'admin.nav.event',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Admin alkalmazás props — teljes admin state és CRUD callback-ek. */
interface AdminAppProps {
  initialUser: User;
  event: EventProfile;
  rooms: Room[];
  sessions: Session[];
  users: User[];
  onUpdateEvent: (data: Partial<EventProfile>) => Promise<void>;
  sessionSaves: SessionSavesMap | null;
  onRefreshSessionSaves: () => void;
  loading: boolean;
  usersLoading: boolean;
  error: string | null;
  backendMode: boolean;
  onUpdateUserRole: (userId: number, role: User['role']) => Promise<void>;
  onUpdateUserRooms?: (userId: number, roomIds: number[]) => Promise<void>;
  onBulkUpdateSessions?: (body: { ids: number[]; dateOffsetDays: number; roomId?: number }) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
  onDeleteSession: (id: number) => Promise<void>;
  onCreateSession: (body: CreateSessionBody) => Promise<void>;
  onUpdateSession: (id: number, data: BookingFormData) => Promise<void>;
  onRefreshSessions: () => void;
  onSetSessionStatus: (id: number, status: 'scheduled' | 'cancelled') => Promise<void>;
  onLoadDemo?: () => Promise<void>;
  loadingDemo?: boolean;
  onLogout: () => void;
}

export default function AdminApp({
  initialUser,
  event,
  rooms,
  sessions,
  users,
  onUpdateEvent,
  sessionSaves,
  onRefreshSessionSaves,
  loading,
  usersLoading,
  error,
  backendMode,
  onUpdateUserRole,
  onUpdateUserRooms,
  onBulkUpdateSessions,
  onDeleteUser,
  onDeleteSession,
  onCreateSession,
  onUpdateSession,
  onRefreshSessions,
  onSetSessionStatus,
  onLoadDemo,
  loadingDemo = false,
  onLogout,
}: AdminAppProps) {
  const { t } = useI18n();
  // Aktív admin nézet és keresés
  const [currentView, setCurrentView] = useState<AdminViewType>('overview');
  const [userActionError, setUserActionError] = useState<string | null>(null);
  // Előadók listája (szerkesztés/speakers nézet)
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [speakersLoading, setSpeakersLoading] = useState(false);
  const [speakerSearch, setSpeakerSearch] = useState('');
  // Audit napló (audit nézet)
  const [auditLog, setAuditLog] = useState<ActivityLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  function navigate(view: AdminViewType) {
    if (view === currentView) return;
    if (view === 'speakers' && backendMode) setSpeakersLoading(true);
    if (view === 'audit' && backendMode) setAuditLoading(true);
    setCurrentView(view);
  }

  // A katalógust nézetváltáskor töltjük; CRUD után helyben frissítjük.
  useEffect(() => {
    if (currentView !== 'speakers' || !backendMode) return;
    let cancelled = false;
    fetchSpeakers()
      .then((list) => { if (!cancelled) setSpeakers(list); })
      .catch(() => { if (!cancelled) setSpeakers([]); })
      .finally(() => { if (!cancelled) setSpeakersLoading(false); });
    return () => { cancelled = true; };
  }, [currentView, backendMode]);

  useEffect(() => {
    if (currentView !== 'audit' || !backendMode) return;
    let cancelled = false;
    fetchActivityLog()
      .then((entries) => { if (!cancelled) setAuditLog(entries); })
      .catch(() => { if (!cancelled) setAuditLog([]); })
      .finally(() => { if (!cancelled) setAuditLoading(false); });
    return () => { cancelled = true; };
  }, [currentView, backendMode]);

  async function handleCreateSpeaker(name: string, bio: string) {
    const speaker = await createSpeaker({ name, bio: bio || undefined });
    setSpeakers((prev) =>
      [...prev.filter((s) => s.id !== speaker.id), speaker].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }

  async function handleUpdateSpeaker(id: number, name: string, bio: string) {
    const speaker = await updateSpeaker(id, { name, bio: bio || null });
    setSpeakers((prev) =>
      prev.map((s) => (s.id === id ? speaker : s)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    onRefreshSessions();
  }

  async function handleDeleteSpeaker(id: number) {
    await deleteSpeaker(id);
    setSpeakers((prev) => prev.filter((s) => s.id !== id));
    onRefreshSessions();
  }

  async function handleMergeSpeakers(keepId: number, mergeIds: number[]) {
    const speaker = await mergeSpeakers(keepId, mergeIds);
    setSpeakers((prev) =>
      [...prev.filter((s) => s.id !== keepId && !mergeIds.includes(s.id)), speaker].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    );
    onRefreshSessions();
  }

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

  return (
    <div className="app-wrapper admin-app">
      <aside className="sidebar admin-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('admin.dashboardTitle')}</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view, icon, labelKey }) => (
            <button
              type="button"
              key={view}
              className={`nav-item${currentView === view ? ' active' : ''}`}
              onClick={() => navigate(view)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-mode-badge">
            {backendMode ? t('admin.modeLive') : t('admin.modeDemo')}
          </div>
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
            <LanguageSwitcher variant="select" />
            {currentView === 'speakers' && (
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder={t('admin.speakers.searchPlaceholder')}
                  value={speakerSearch} onChange={(event) => setSpeakerSearch(event.target.value)} />
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
          {!loading && currentView === 'overview' && backendMode && sessions.length === 0 && onLoadDemo && (
            <div className="admin-demo-seed-banner">
              <span>{t('public.emptySub')}</span>
              <button
                type="button"
                className="btn-save"
                disabled={loadingDemo}
                onClick={() => onLoadDemo()}
              >
                {loadingDemo ? t('common.loading') : t('public.loadDemo')}
              </button>
            </div>
          )}
          {userActionError && (
            <div className="error-banner">
              {userActionError.startsWith('errors.')
                ? t(userActionError)
                : translateError(userActionError, t)}
            </div>
          )}

          {!loading && currentView === 'overview' && (
            <AdminOverview users={users} sessions={sessions} event={event} />
          )}

          {currentView === 'event' && backendMode && (
            <EventProfileEditor event={event} onSave={onUpdateEvent} />
          )}

          {!loading && currentView === 'rooms' && (
            <>
              <div className="section-title">{t('admin.nav.rooms')}</div>
              <RoomsUsage sessions={sessions} rooms={rooms} />
            </>
          )}

          {currentView === 'speakers' && (
            <SpeakersView
              speakers={backendMode ? speakers : speakersFromSessions(sessions)}
              loading={speakersLoading && speakers.length === 0}
              backendMode={backendMode}
              searchTerm={speakerSearch}
              onCreate={handleCreateSpeaker}
              onUpdate={handleUpdateSpeaker}
              onDelete={handleDeleteSpeaker}
              onMerge={backendMode ? handleMergeSpeakers : undefined}
            />
          )}

          {currentView === 'users' && (
            <>
              {usersLoading && <div className="loader">{t('common.loading')}</div>}
              {!usersLoading && (
                <UsersView
                  users={users}
                  currentUserId={initialUser.id}
                  onRoleChange={handleRoleChange}
                  onRoomsChange={backendMode ? onUpdateUserRooms : undefined}
                  onDelete={handleDeleteUser}
                />
              )}
            </>
          )}

          {currentView === 'audit' && backendMode && (
            <ActivityLogView entries={auditLog} loading={auditLoading} />
          )}

          {currentView === 'sessions' && !loading && (
            <SessionWorkspace user={initialUser} rooms={rooms} sessions={sessions}
              sessionSaves={sessionSaves} backendMode={backendMode}
              onRefreshSessionSaves={onRefreshSessionSaves} onCreate={onCreateSession}
              onUpdate={onUpdateSession} onDelete={onDeleteSession} onSetStatus={onSetSessionStatus}
              onBulkUpdate={backendMode ? onBulkUpdateSessions : undefined} />
          )}
        </div>
      </div>

      <MobileBottomNav
        scrollable
        items={NAV_ITEMS.map(({ view, icon, labelKey }) => ({
          id: view,
          icon,
          label: t(labelKey),
          active: currentView === view,
          onClick: () => navigate(view),
        }))}
      />

    </div>
  );
}
