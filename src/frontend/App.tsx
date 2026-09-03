/** Szervezői alkalmazás: közös programkezelő és áttekintés. */
import { useState } from 'react';
import type { ViewType } from '../backend/types';
import SessionWorkspace from './components/SessionWorkspace';
import type { SessionWorkspaceProps } from './components/SessionWorkspace';
import StatsView from './components/StatsView';
import LanguageSwitcher from './components/LanguageSwitcher';
import MobileBottomNav from './components/MobileBottomNav';
import { useI18n } from './i18n/I18nProvider';
import './App.css';

const NAV_ITEMS: { view: ViewType; icon: string; labelKey: string }[] = [
  { view: 'sessions', icon: '📅', labelKey: 'nav.program' },
  { view: 'stats', icon: '📊', labelKey: 'nav.overview' },
];

interface AppProps extends Omit<SessionWorkspaceProps, 'user' | 'onSetStatus' | 'onBulkUpdate' | 'initialViewMode'> {
  initialUser: SessionWorkspaceProps['user'];
  loading: boolean;
  error: string | null;
  onSetSessionStatus: SessionWorkspaceProps['onSetStatus'];
  onBulkUpdateSessions?: SessionWorkspaceProps['onBulkUpdate'];
  onLogout: () => void;
}

export default function App({ initialUser, loading, error, onSetSessionStatus, onBulkUpdateSessions, onLogout, ...workspace }: AppProps) {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<ViewType>('sessions');
  const [initialDetailId, setInitialDetailId] = useState<number | null>(null);

  function navigate(view: ViewType) {
    setInitialDetailId(null);
    setCurrentView(view);
  }

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('nav.organiserDashboard')}</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view, icon, labelKey }) => (
            <button key={view} type="button" className={`nav-item${currentView === view ? ' active' : ''}`} onClick={() => navigate(view)}>
              <span className="nav-icon">{icon}</span><span>{t(labelKey)}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{t(currentView === 'sessions' ? 'nav.program' : 'nav.overview')}</h1>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher variant="select" />
            <div className="topbar-user-pill">
              <div className="topbar-user-avatar">{initialUser.name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div>
              <span className="topbar-user-name">{initialUser.name}</span>
            </div>
            <button className="topbar-logout-btn" onClick={onLogout} title={t('common.signOut')} aria-label={t('common.signOut')}>⎋</button>
          </div>
        </div>
        <div className="content-area">
          {loading && <div className="loader">{t('common.loading')}</div>}
          {error && <div className="error-banner">{error}</div>}
          {!loading && !error && (currentView === 'sessions' ? (
            <SessionWorkspace {...workspace} user={initialUser} initialViewMode="calendar" initialDetailId={initialDetailId}
              onSetStatus={onSetSessionStatus} onBulkUpdate={onBulkUpdateSessions} />
          ) : (
            <StatsView sessions={workspace.sessions} sessionSaves={workspace.sessionSaves ?? undefined}
              onEventClick={(id) => { setInitialDetailId(id); setCurrentView('sessions'); }} />
          ))}
        </div>
      </div>
      <MobileBottomNav items={NAV_ITEMS.map(({ view, icon, labelKey }) => ({
        id: view, icon, label: t(labelKey), active: currentView === view, onClick: () => navigate(view),
      }))} />
    </div>
  );
}
