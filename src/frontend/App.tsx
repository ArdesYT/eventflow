import { useState, useMemo, useEffect } from 'react';
import type { Session, SessionSavesMap, ViewType, BookingFormData, CreateSessionBody, User } from '../backend/types';
import MiniCalendar from './components/MiniCalendar';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import SessionsView from './components/SessionsView';
import StatsView from './components/StatsView';
import BookingModal from './components/BookingModal';
import DetailModal from './components/DetailModal';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n, translateError } from './i18n/I18nProvider';
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

interface AppProps {
  initialUser: User;
  sessions: Session[];
  sessionSaves: SessionSavesMap | null;
  onRefreshSessionSaves: () => void;
  loading: boolean;
  error: string | null;
  onCreate: (body: CreateSessionBody) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onLogout: () => void;
}

export default function App({
  initialUser,
  sessions,
  sessionSaves,
  onRefreshSessionSaves,
  loading,
  error,
  onCreate,
  onDelete,
  onLogout,
}: AppProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('calendar');
  const [calSubView, setCalSubView] = useState<'month' | 'agenda'>('month');
  const [curMonth, setCurMonth] = useState(() => new Date().getMonth());
  const [curYear, setCurYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [showBooking, setShowBooking] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      s.title.toLowerCase().includes(query) ||
      s.speaker_name.toLowerCase().includes(query) ||
      s.room_name.toLowerCase().includes(query)
    );
  });

  const filteredSessionsInCurrentMonth = filteredSessions.filter((s) => {
    const currentMonth = String(curMonth + 1).padStart(2, '0');
    const prefix = `${curYear}-${currentMonth}`;
    return s.date.startsWith(prefix);
  });

  const detailSession = useMemo(
    () => sessions.find((s) => s.id === detailId) ?? null,
    [sessions, detailId],
  );

  useEffect(() => {
    if (detailId !== null) onRefreshSessionSaves();
  }, [detailId, onRefreshSessionSaves]);

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

  function selectDay(ds: string) {
    setSelectedDate(ds);
    setBookingDate(ds);
    setShowBooking(true);
  }

  async function saveBooking(data: BookingFormData) {
    setSaving(true);
    setSaveError(null);
    try {
      // Conflict check: enforce 2-hour gap in the same room on the same date
      const newStart = new Date(`${data.date}T${data.start_time}:00`);
      const newEnd = new Date(`${data.date}T${data.end_time}:00`);
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const conflict = sessions.some((s) => {
        if (s.room_id !== data.room_id) return false;
        if (s.date !== data.date) return false;
        const existingStart = new Date(`${s.date}T${s.start_time}:00`);
        const existingEnd = new Date(`${s.date}T${s.end_time}:00`);
        // ok if new start is at least 2 hours after existing end, or existing start at least 2 hours after new end
        if (newStart.getTime() >= existingEnd.getTime() + TWO_HOURS_MS) return false;
        if (existingStart.getTime() >= newEnd.getTime() + TWO_HOURS_MS) return false;
        return true; // conflict
      });

      if (conflict) {
        throw new Error('errors.roomBusy');
      }
      const body: CreateSessionBody = {
        title: data.title,
        description: data.description,
        start_time: `${data.date} ${data.start_time}:00`,
        end_time: `${data.date} ${data.end_time}:00`,
        room_id: data.room_id,
        speaker_id: data.speaker_id,
        speaker_name: data.speaker_name,
        color: data.color,
      };
      await onCreate(body);
      setShowBooking(false);
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
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('nav.bookerDashboard')}</div>
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
        <MiniCalendar
          curMonth={curMonth}
          curYear={curYear}
          sessions={sessions}
          onNavigate={navigateMonth}
          onSelectDate={(ds) => {
            setSelectedDate(ds);
            setCurrentView('calendar');
          }}
        />
        <div className="sidebar-lang">
          <LanguageSwitcher variant="compact" />
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
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
              className="btn-new"
              onClick={() => {
                setBookingDate(undefined);
                setShowBooking(true);
              }}
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
          {!loading && !error && (
            <>
              {currentView === 'calendar' && calSubView === 'month' && (
                searchTerm.trim() && filteredSessions.length > 0 && filteredSessionsInCurrentMonth.length === 0 ? (
                  <SessionsView
                    sessions={filteredSessions}
                    sessionSaves={sessionSaves}
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
                  sessionSaves={sessionSaves}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
              {currentView === 'sessions' && (
                <SessionsView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves}
                  searchTerm={searchTerm}
                  onEventClick={(id) => setDetailId(id)}
                />
              )}
              {currentView === 'agenda' && (
                <AgendaView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
              {currentView === 'stats' && (
                <StatsView
                  sessions={filteredSessions}
                  sessionSaves={sessionSaves}
                  onEventClick={(id) => setDetailId(id)}
                  onDelete={deleteSession}
                />
              )}
            </>
          )}
        </div>
      </div>

      {showBooking && (
        <BookingModal
          initialDate={bookingDate}
          currentUserId={initialUser.id}
          currentUserName={initialUser.name}
          onSave={saveBooking}
          onClose={() => setShowBooking(false)}
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
        />
      )}
    </div>
  );
}
