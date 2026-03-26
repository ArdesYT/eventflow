import { useState, useMemo, useRef, useEffect } from 'react';
import type { Session, ViewType, BookingFormData, CreateSessionBody, User } from '../backend/types';
import MiniCalendar from './components/MiniCalendar';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import SessionsView from './components/SessionsView';
import StatsView from './components/StatsView';
import BookingModal from './components/BookingModal';
import DetailModal from './components/DetailModal';
import './App.css';

const NAV_ITEMS: { view: ViewType; icon: string; label: string }[] = [
  { view: 'calendar', icon: '📅', label: 'Calendar' },
  { view: 'sessions', icon: '🎬', label: 'Sessions' },
  { view: 'agenda',   icon: '📋', label: 'Agenda'   },
  { view: 'stats',    icon: '📊', label: 'Overview' },
];

const PAGE_TITLES: Record<ViewType, string> = {
  calendar: 'Calendar', sessions: 'Sessions', agenda: 'Agenda', stats: 'Overview',
};

interface AppProps {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  user: User;
  onLogout: () => void;
  onCreate: (body: object) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function App({ sessions, loading, error, user, onLogout, onCreate, onDelete }: AppProps) {
  const today = new Date(2026, 2, 20);

  const userName = user?.name ?? 'User';
  const userInitials = userName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('calendar');
  const [calSubView, setCalSubView] = useState<'month' | 'agenda'>('month');
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [showBooking, setShowBooking] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const detailSession = useMemo(
    () => sessions.find(s => s.id === detailId) ?? null,
    [sessions, detailId]
  );

  function navigateMonth(dir: -1 | 1) {
    setCurMonth(m => {
      const next = m + dir;
      if (next > 11) { setCurYear(y => y + 1); return 0; }
      if (next < 0)  { setCurYear(y => y - 1); return 11; }
      return next;
    });
  }

  function goToday() { setCurMonth(today.getMonth()); setCurYear(today.getFullYear()); }

  function selectDay(ds: string) { setSelectedDate(ds); setBookingDate(ds); setShowBooking(true); }

  async function saveBooking(data: BookingFormData) {
    setSaving(true);
    setSaveError(null);
    try {
      const body: CreateSessionBody = {
        title:       data.title,
        description: data.description,
        start_time:  `${data.date} ${data.start_time}:00`,
        end_time:    `${data.date} ${data.end_time}:00`,
        room_id:     data.room_id,
        speaker_id:  data.speaker_id,
        color:       data.color,
      };
      await onCreate(body);
      setShowBooking(false);
    } catch (e: any) {
      setSaveError(e.message ?? 'Mentési hiba.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(id: number) {
    try {
      await onDelete(id);
      setDetailId(null);
    } catch (e: any) {
      alert(e.message ?? 'Törlési hiba.');
    }
  }

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">Organiser Dashboard</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view, icon, label }) => (
            <div key={view} className={`nav-item${currentView === view ? ' active' : ''}`} onClick={() => setCurrentView(view)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
            </div>
          ))}
        </nav>
        <MiniCalendar curMonth={curMonth} curYear={curYear} sessions={sessions} onNavigate={navigateMonth}
          onSelectDate={ds => { setSelectedDate(ds); setCurrentView('calendar'); }} />
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{PAGE_TITLES[currentView]}</h1>
            {currentView === 'calendar' && (
              <div className="view-toggle">
                <button className={`view-btn${calSubView === 'month' ? ' active' : ''}`} onClick={() => setCalSubView('month')}>Month</button>
                <button className={`view-btn${calSubView === 'agenda' ? ' active' : ''}`} onClick={() => setCalSubView('agenda')}>Agenda</button>
              </div>
            )}
          </div>
          <div className="topbar-right">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search sessions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="profile-menu" ref={profileRef}>
              <button className={`profile-trigger${profileOpen ? ' open' : ''}`} onClick={() => setProfileOpen(o => !o)} aria-label="Profile menu">
                <span className="profile-avatar">{userInitials}</span>
                <span className="profile-name">{userName}</span>
                <span className="profile-chevron">▾</span>
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="dropdown-header">
                    <span className="dropdown-header-name">{userName}</span>
                    {user.email && <span className="dropdown-header-email">{user.email}</span>}
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-item">My Profile</div>
                  <div className="dropdown-item">Settings</div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-item danger" onClick={onLogout}>Logout</div>
                </div>
              )}
            </div>
            <button className="btn-new" onClick={() => { setBookingDate(undefined); setShowBooking(true); }}>+ New Booking</button>
          </div>
        </div>

        <div className="content-area">
          {loading && <div className="loader">Adatok betöltése...</div>}
          {error && <div className="error-banner">{error}</div>}
          {!loading && !error && (
            <>
              {currentView === 'calendar' && calSubView === 'month' && <CalendarView curMonth={curMonth} curYear={curYear} sessions={sessions} selectedDate={selectedDate} onSelectDay={selectDay} onEventClick={id => setDetailId(id)} onNavigate={navigateMonth} onToday={goToday} />}
              {currentView === 'calendar' && calSubView === 'agenda' && <AgendaView sessions={sessions} onEventClick={id => setDetailId(id)} onDelete={deleteSession} />}
              {currentView === 'sessions' && <SessionsView sessions={sessions} searchTerm={searchTerm} onEventClick={id => setDetailId(id)} />}
              {currentView === 'agenda' && <AgendaView sessions={sessions} onEventClick={id => setDetailId(id)} onDelete={deleteSession} />}
              {currentView === 'stats' && <StatsView sessions={sessions} onEventClick={id => setDetailId(id)} onDelete={deleteSession} />}
            </>
          )}
        </div>
      </div>

      {showBooking && (
        <BookingModal initialDate={bookingDate} onSave={saveBooking} onClose={() => setShowBooking(false)}
          saving={saving} saveError={saveError} />
      )}
      {detailSession && (
        <DetailModal session={detailSession} onClose={() => setDetailId(null)} onDelete={deleteSession} />
      )}
    </div>
  );
}
