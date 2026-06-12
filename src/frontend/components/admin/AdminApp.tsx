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
  bookingFormToApiBody,
  duplicateBookingFormData,
  hasRoomConflict,
  toBookingFormData,
} from '../../lib/sessionBooking';
import { downloadIcsFile } from '../../lib/icsExport';
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
import SessionsView from '../SessionsView';
import AgendaView from '../AgendaView';
import BookingModal from '../BookingModal';
import DetailModal from '../DetailModal';
import RoomsUsage from './RoomsUsage';
import ActivityLogView from './ActivityLogView';
import BulkSessionToolbar from '../BulkSessionToolbar';
import LanguageSwitcher from '../LanguageSwitcher';
import { fetchActivityLog } from '../../lib/adminApi';
import type { ActivityLogEntry } from '../../../backend/types';
import { useI18n, translateError } from '../../i18n/I18nProvider';
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
  const [currentView, setCurrentView] = useState<AdminViewType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [duplicateValues, setDuplicateValues] = useState<BookingFormData | undefined>();
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [speakersLoading, setSpeakersLoading] = useState(false);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [auditLog, setAuditLog] = useState<ActivityLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  useEffect(() => {
    if (detailId !== null) onRefreshSessionSaves();
  }, [detailId, onRefreshSessionSaves]);

  useEffect(() => {
    const needsSpeakers =
      editingSessionId !== null || duplicateValues !== undefined || currentView === 'speakers';
    if (!needsSpeakers) {
      setSpeakers([]);
      return;
    }

    let cancelled = false;

    if (backendMode) {
      setSpeakersLoading(true);
      fetchSpeakers()
        .then((list) => {
          if (!cancelled) setSpeakers(list);
        })
        .catch(() => {
          if (!cancelled) setSpeakers(speakersFromSessions(sessions));
        })
        .finally(() => {
          if (!cancelled) setSpeakersLoading(false);
        });
    } else {
      setSpeakers(speakersFromSessions(sessions));
      setSpeakersLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [editingSessionId, duplicateValues, currentView, backendMode, sessions]);

  useEffect(() => {
    if (currentView !== 'audit' || !backendMode) return;
    setAuditLoading(true);
    fetchActivityLog()
      .then(setAuditLog)
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false));
  }, [currentView, backendMode, sessions]);

  function toggleSelectSession(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkApply(opts: { dateOffsetDays: number; roomId?: number }) {
    if (!onBulkUpdateSessions || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkUpdateSessions({
        ids: [...selectedIds],
        dateOffsetDays: opts.dateOffsetDays,
        roomId: opts.roomId,
      });
      setSelectedIds(new Set());
      setBulkSelectMode(false);
      onRefreshSessions();
    } finally {
      setBulkBusy(false);
    }
  }

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
  }

  async function handleDeleteSpeaker(id: number) {
    await deleteSpeaker(id);
    setSpeakers((prev) => prev.filter((s) => s.id !== id));
    onRefreshSessions();
  }

  async function handleMergeSpeakers(keepId: number, mergeIds: number[]) {
    const speaker = await mergeSpeakers(keepId, mergeIds);
    setSpeakers((prev) =>
      [...prev.filter((s) => s.id === keepId || !mergeIds.includes(s.id)), speaker].sort(
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

  async function handleDeleteSession(id: number) {
    try {
      await onDeleteSession(id);
      setDetailId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.deleteError';
      alert(translateError(msg, t));
    }
  }

  function handleEditSession(id: number) {
    setDetailId(null);
    setEditError(null);
    setDuplicateValues(undefined);
    setEditingSessionId(id);
  }

  function handleDuplicateSession(id: number) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setDetailId(null);
    setEditError(null);
    setEditingSessionId(null);
    setDuplicateValues(duplicateBookingFormData(session, t('detail.duplicateSuffix')));
  }

  function closeBookingModal() {
    setEditingSessionId(null);
    setDuplicateValues(undefined);
    setEditError(null);
  }

  function handleExportIcs() {
    downloadIcsFile(sessions, 'eventflow-program.ics', t('export.calendarName'));
  }

  const displayEditError = editError
    ? editError.startsWith('errors.')
      ? t(editError)
      : translateError(editError, t)
    : null;

  async function handleSaveSession(data: BookingFormData) {
    if (editingSessionId === null && !duplicateValues) return;
    setEditError(null);
    setEditSaving(true);

    try {
      if (hasRoomConflict(sessions, data, editingSessionId ?? undefined)) {
        throw new Error('errors.roomBusy');
      }
      if (editingSessionId !== null) {
        await onUpdateSession(editingSessionId, data);
      } else {
        await onCreateSession(bookingFormToApiBody(data));
      }
      closeBookingModal();
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
            {(currentView === 'sessions' || currentView === 'speakers') && (
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder={
                    currentView === 'speakers'
                      ? t('admin.speakers.searchPlaceholder')
                      : t('nav.searchPlaceholder')
                  }
                  value={currentView === 'speakers' ? speakerSearch : searchTerm}
                  onChange={(e) =>
                    currentView === 'speakers'
                      ? setSpeakerSearch(e.target.value)
                      : setSearchTerm(e.target.value)
                  }
                />
              </div>
            )}
            <div className="topbar-user-pill">
              <div className="topbar-user-avatar">{getInitials(initialUser.name)}</div>
              <span className="topbar-user-name">{initialUser.name}</span>
            </div>
            <button
              type="button"
              className="btn-export"
              onClick={handleExportIcs}
              title={t('export.ics')}
            >
              {t('export.ics')}
            </button>
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
          {!loading && backendMode && sessions.length === 0 && onLoadDemo && (
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
              speakers={speakers}
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
            <>
              <div className="sessions-toolbar-row">
                <div className="section-title">{t('admin.sessions.allTitle')}</div>
                {onBulkUpdateSessions && backendMode && (
                  <button
                    type="button"
                    className={'btn-export' + (bulkSelectMode ? ' active' : '')}
                    onClick={() => {
                      setBulkSelectMode((v) => !v);
                      setSelectedIds(new Set());
                    }}
                  >
                    {bulkSelectMode ? t('bulk.cancelSelect') : t('bulk.selectMode')}
                  </button>
                )}
              </div>
              {bulkSelectMode && selectedIds.size > 0 && (
                <BulkSessionToolbar
                  selectedCount={selectedIds.size}
                  busy={bulkBusy}
                  onClear={() => setSelectedIds(new Set())}
                  onApply={handleBulkApply}
                />
              )}
              <SessionsView
                sessions={filteredSessions}
                sessionSaves={sessionSaves ?? undefined}
                searchTerm={searchTerm}
                selectable={bulkSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectSession}
                onEventClick={(id) =>
                  bulkSelectMode ? toggleSelectSession(id) : setDetailId(id)
                }
              />
              <div className="section-title" style={{ marginTop: 28 }}>
                {t('admin.sessions.agendaTitle')}
              </div>
              <AgendaView
                sessions={filteredSessions}
                sessionSaves={sessionSaves ?? undefined}
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
          savedBy={sessionSaves?.[detailSession.id]}
          savesLoaded={sessionSaves !== null}
          onClose={() => setDetailId(null)}
          onDelete={handleDeleteSession}
          onEdit={handleEditSession}
          onDuplicate={handleDuplicateSession}
          onSetStatus={async (id, status) => {
            try {
              await onSetSessionStatus(id, status);
              setDetailId(null);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'errors.saveError';
              alert(translateError(msg, t));
            }
          }}
        />
      )}

      {(editingSession || duplicateValues) && (
        <BookingModal
          initialValues={
            editingSession ? toBookingFormData(editingSession) : duplicateValues
          }
          allowSpeakerEdit
          speakers={speakers}
          sessions={sessions}
          rooms={rooms}
          editingSessionId={editingSessionId}
          onSave={handleSaveSession}
          onClose={closeBookingModal}
          saving={editSaving}
          saveError={displayEditError}
        />
      )}
    </div>
  );
}
