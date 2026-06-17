/**
 * Booker főalkalmazás — Root rendereli booker szerepkör esetén.
 * Nézetek: naptár, előadások, napirend, statisztika; foglalás szerkesztés, tömeges műveletek.
 * Props: initialUser, rooms, sessions, sessionSaves, CRUD callback-ek, loading, error, onLogout.
 */
import { useState, useMemo, useEffect } from 'react';
import type { Room, Session, SessionSavesMap, ViewType, BookingFormData, CreateSessionBody, Speaker, User } from '../backend/types';
import { fetchSpeakers, speakersFromSessions } from './lib/speakersApi';
import {
  bookingFormToApiBody,
  duplicateBookingFormData,
  hasRoomConflict,
  toBookingFormData,
} from './lib/sessionBooking';
import { sessionSpansDate } from './lib/sessionFormat';
import { downloadIcsFile } from './lib/icsExport';
import MiniCalendar from './components/MiniCalendar';
import SessionFilters from './components/SessionFilters';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import SessionsView from './components/SessionsView';
import StatsView from './components/StatsView';
import BookingModal from './components/BookingModal';
import DetailModal from './components/DetailModal';
import BulkSessionToolbar from './components/BulkSessionToolbar';
import LanguageSwitcher from './components/LanguageSwitcher';
import MobileBottomNav from './components/MobileBottomNav';
import { useI18n } from './i18n/I18nProvider';
import { translateError } from './i18n/translateError';
import './App.css';

const NAV_ITEMS: { view: ViewType; icon: string; labelKey: string }[] = [
  { view: 'calendar', icon: '📅', labelKey: 'nav.calendar' },
  { view: 'sessions', icon: '🎬', labelKey: 'nav.sessions' },
  { view: 'agenda', icon: '📋', labelKey: 'nav.agenda' },
  { view: 'stats', icon: '📊', labelKey: 'nav.overview' },
];

const PAGE_TITLE_KEYS: Record<ViewType, string> = {
  calendar: 'nav.calendar',
  sessions: 'nav.sessions',
  agenda: 'nav.agenda',
  stats: 'nav.overview',
};

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Booker alkalmazás props — Root-ból érkező adatok és CRUD callback-ek. */
interface AppProps {
  initialUser: User;
  rooms: Room[];
  sessions: Session[];
  sessionSaves: SessionSavesMap | null;
  onRefreshSessionSaves: () => void;
  loading: boolean;
  error: string | null;
  onCreate: (body: CreateSessionBody) => Promise<void>;
  onUpdate: (id: number, data: BookingFormData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSetSessionStatus: (id: number, status: 'scheduled' | 'cancelled') => Promise<void>;
  onBulkUpdateSessions?: (body: { ids: number[]; dateOffsetDays: number; roomId?: number }) => Promise<void>;
  onLogout: () => void;
}

export default function App({
  initialUser,
  rooms,
  sessions,
  sessionSaves,
  onRefreshSessionSaves,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onSetSessionStatus,
  onBulkUpdateSessions,
  onLogout,
}: AppProps) {
  const { t } = useI18n();
  // Mentés állapot a BookingModal-hoz
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Aktív főnézet és naptár alnézet
  const [currentView, setCurrentView] = useState<ViewType>('calendar');
  const [calSubView, setCalSubView] = useState<'month' | 'agenda'>('month');
  // Naptár hónap/év és kiválasztott nap
  const [curMonth, setCurMonth] = useState(() => new Date().getMonth());
  const [curYear, setCurYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Keresés és szűrők
  const [searchTerm, setSearchTerm] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  // Foglalási modal állapot (új/szerkesztés/duplikálás)
  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [showBooking, setShowBooking] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [duplicateValues, setDuplicateValues] = useState<BookingFormData | undefined>();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  // Tömeges kijelölés és módosítás
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowedRoomIds = initialUser.assigned_room_ids;

  // Szűrt előadások — keresés + előadó/terem szűrő
  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sessions.filter((s) => {
      if (speakerFilter && s.speaker_name !== speakerFilter) return false;
      if (roomFilter && s.room_name !== roomFilter) return false;
      if (!query) return true;
      return (
        s.title.toLowerCase().includes(query) ||
        s.speaker_name.toLowerCase().includes(query) ||
        s.room_name.toLowerCase().includes(query)
      );
    });
  }, [sessions, searchTerm, speakerFilter, roomFilter]);

  // Aktuális hónapban látható előadások (keresés + hónap szűrés naptárhoz)
  const filteredSessionsInCurrentMonth = filteredSessions.filter((s) => {
    const currentMonth = String(curMonth + 1).padStart(2, '0');
    const prefix = `${curYear}-${currentMonth}`;
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${prefix}-${String(d).padStart(2, '0')}`;
      if (sessionSpansDate(s, ds)) return true;
    }
    return false;
  });

  const detailSession = useMemo(
    () => sessions.find((s) => s.id === detailId) ?? null,
    [sessions, detailId],
  );

  const editingSession = useMemo(
    () => sessions.find((s) => s.id === editingSessionId) ?? null,
    [sessions, editingSessionId],
  );

  function closeBooking() {
    setShowBooking(false);
    setEditingSessionId(null);
    setDuplicateValues(undefined);
    setSaveError(null);
  }

  function openNewBooking(date?: string) {
    setEditingSessionId(null);
    setDuplicateValues(undefined);
    setBookingDate(date);
    setSaveError(null);
    setShowBooking(true);
  }

  // Részletek modal megnyitásakor frissíti a mentő felhasználók listáját
  useEffect(() => {
    if (detailId !== null) onRefreshSessionSaves();
  }, [detailId, onRefreshSessionSaves]);

  // Foglalási modal nyitásakor előadók betöltése API-ból (fallback: sessions-ből)
  useEffect(() => {
    if (!showBooking) {
      setSpeakers([]);
      return;
    }

    let cancelled = false;

    fetchSpeakers()
      .then((list) => {
        if (!cancelled) setSpeakers(list);
      })
      .catch(() => {
        if (!cancelled) setSpeakers(speakersFromSessions(sessions));
      });

    return () => {
      cancelled = true;
    };
  }, [showBooking, sessions]);

  // Hónap lapozás — évhatár kezeléssel
  function navigateMonth(dir: -1 | 1) {
    setCurMonth((m) => {
      const next = m + dir;
      if (next > 11) {
        setCurYear((y) => y + 1);
        return 0;
      }
      if (next < 0) {
        setCurYear((y) => y - 1);
        return 11;
      }
      return next;
    });
  }

  function goToday() {
    const now = new Date();
    setCurMonth(now.getMonth());
    setCurYear(now.getFullYear());
  }

  // Nap kiválasztása naptárból — új foglalás modal megnyitása az adott dátummal
  function selectDay(ds: string) {
    setSelectedDate(ds);
    openNewBooking(ds);
  }

  function handleEditSession(id: number) {
    setDetailId(null);
    setDuplicateValues(undefined);
    setEditingSessionId(id);
    setSaveError(null);
    setShowBooking(true);
  }

  // Duplikálás: meglévő előadás adatai másolása, új rekordként mentés
  function handleDuplicateSession(id: number) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setDetailId(null);
    setEditingSessionId(null);
    setDuplicateValues(duplicateBookingFormData(session, t('detail.duplicateSuffix')));
    setBookingDate(session.date);
    setSaveError(null);
    setShowBooking(true);
  }

  function handleExportIcs() {
    downloadIcsFile(filteredSessions, 'eventflow-program.ics', t('export.calendarName'));
  }

  function toggleSelectSession(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Tömeges módosítás alkalmazása (dátum eltolás, opcionális teremcsere)
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
    } finally {
      setBulkBusy(false);
    }
  }

  async function saveBooking(data: BookingFormData) {
    setSaving(true);
    setSaveError(null);
    try {
      if (hasRoomConflict(sessions, data, editingSessionId ?? undefined)) {
        throw new Error('errors.roomBusy');
      }
      if (editingSessionId !== null) {
        await onUpdate(editingSessionId, data);
      } else {
        await onCreate(bookingFormToApiBody(data));
      }
      closeBooking();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.saveError';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(id: number) {
    try {
      await onDelete(id);
      setDetailId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'errors.deleteError';
      alert(translateError(msg, t));
    }
  }

  const displaySaveError = saveError
    ? saveError.startsWith('errors.')
      ? t(saveError)
      : translateError(saveError, t)
    : null;

  return (
    <div className="app-wrapper">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('common.close')}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('nav.bookerDashboard')}</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view, icon, labelKey }) => (
            <div
              key={view}
              className={`nav-item${currentView === view ? ' active' : ''}`}
              onClick={() => {
                setCurrentView(view);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{icon}</span>
              <span>{t(labelKey)}</span>
            </div>
          ))}
        </nav>
        <MiniCalendar
          curMonth={curMonth}
          curYear={curYear}
          sessions={sessions}
          onNavigate={navigateMonth}
          onSelectDate={(ds) => {
            setSelectedDate(ds);
            setCurrentView('calendar');
            setSidebarOpen(false);
          }}
        />
        <div className="sidebar-lang">
          <LanguageSwitcher variant="compact" />
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={t('nav.menu')}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              ☰
            </button>
            <h1 className="page-title">{t(PAGE_TITLE_KEYS[currentView])}</h1>
            {currentView === 'calendar' && (
              <div className="view-toggle">
                <button
                  className={`view-btn${calSubView === 'month' ? ' active' : ''}`}
                  onClick={() => setCalSubView('month')}
                >
                  {t('nav.month')}
                </button>
                <button
                  className={`view-btn${calSubView === 'agenda' ? ' active' : ''}`}
                  onClick={() => setCalSubView('agenda')}
                >
                  {t('nav.agenda')}
                </button>
              </div>
            )}
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder={t('nav.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
              className="btn-new"
              onClick={() => openNewBooking(undefined)}
            >
              {t('nav.newBooking')}
            </button>
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
          {loading && <div className="loader">{t('common.loading')}</div>}
          {error && <div className="error-banner">{error}</div>}
          {!loading && !error && (currentView === 'sessions' || currentView === 'agenda') && (
            <SessionFilters
              sessions={sessions}
              speakerFilter={speakerFilter}
              roomFilter={roomFilter}
              onSpeakerChange={setSpeakerFilter}
              onRoomChange={setRoomFilter}
            />
          )}
          {!loading && !error && (
            <>
              {currentView === 'calendar' && calSubView === 'month' && (
                searchTerm.trim() && filteredSessions.length > 0 && filteredSessionsInCurrentMonth.length === 0 ? (
                  <SessionsView
                    sessions={filteredSessions}
                    sessionSaves={sessionSaves ?? undefined}
                    searchTerm={searchTerm}
                    onEventClick={(id) => setDetailId(id)}
                  />
                ) : (
                  <CalendarView
                    curMonth={curMonth}
                    curYear={curYear}
                    sessions={filteredSessions}
                    selectedDate={selectedDate}
                    onSelectDay={selectDay}
                    onEventClick={(id) => setDetailId(id)}
                    onNavigate={navigateMonth}
                    onToday={goToday}
                  />
                )
              )}
              {currentView === 'calendar' && calSubView === 'agenda' && (
                <AgendaView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves ?? undefined}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
              {currentView === 'sessions' && (
                <>
                  {onBulkUpdateSessions && (
                    <div className="sessions-toolbar-row">
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
                    </div>
                  )}
                  {bulkSelectMode && selectedIds.size > 0 && (
                    <BulkSessionToolbar
                      selectedCount={selectedIds.size}
                      busy={bulkBusy}
                      allowedRoomIds={allowedRoomIds}
                      rooms={rooms}
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
                </>
              )}
              {currentView === 'agenda' && (
                <AgendaView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves ?? undefined}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
              {currentView === 'stats' && (
                <StatsView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves ?? undefined}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
            </>
          )}
        </div>
      </div>

      <MobileBottomNav
        items={NAV_ITEMS.map(({ view, icon, labelKey }) => ({
          id: view,
          icon,
          label: t(labelKey),
          active: currentView === view,
          onClick: () => setCurrentView(view),
        }))}
      />

      {showBooking && (
        <BookingModal
          initialDate={bookingDate}
          initialValues={
            editingSession
              ? toBookingFormData(editingSession)
              : duplicateValues
          }
          currentUserId={initialUser.id}
          currentUserName={initialUser.name}
          allowSpeakerEdit
          allowNewSpeaker={false}
          speakers={speakers}
          sessions={sessions}
          rooms={rooms}
          editingSessionId={editingSessionId}
          allowedRoomIds={allowedRoomIds}
          onSave={saveBooking}
          onClose={closeBooking}
          saving={saving}
          saveError={displaySaveError}
        />
      )}
      {detailSession && (
        <DetailModal
          session={detailSession}
          savedBy={sessionSaves?.[detailSession.id]}
          savesLoaded={sessionSaves !== null}
          onClose={() => setDetailId(null)}
          onDelete={deleteSession}
          onEdit={handleEditSession}
          onDuplicate={handleDuplicateSession}
          onSetStatus={async (id, status) => {
            try {
              await onSetSessionStatus(id, status);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'errors.saveError';
              alert(translateError(msg, t));
            }
          }}
        />
      )}
    </div>
  );
}
