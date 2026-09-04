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

interface AppProps
  extends Omit<
    SessionWorkspaceProps,
    'user' | 'onSetStatus' | 'onBulkUpdate' | 'initialViewMode'
  > {
  initialUser: SessionWorkspaceProps['user'];
  loading: boolean;
  error: string | null;
  onSetSessionStatus: SessionWorkspaceProps['onSetStatus'];
  onBulkUpdateSessions?: SessionWorkspaceProps['onBulkUpdate'];
  onLogout: () => void;
}

export default function App({
  initialUser,
  loading,
  error,
  onSetSessionStatus,
  onBulkUpdateSessions,
  onLogout,
  ...workspace
}: AppProps) {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<ViewType>('sessions');
  const [initialDetailId, setInitialDetailId] = useState<number | null>(null);

  function navigate(view: ViewType) {
    setInitialDetailId(null);
    setCurrentView(view);
  }

  const pageTitle = currentView === 'sessions' ? t('nav.program') : t('nav.overview');
  const initials = initialUser.name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">EventFlow</div>
          <div className="sidebar-logo-sub">{t('nav.organiserDashboard')}</div>
        </div>

        <nav className="sidebar-nav" aria-label={t('nav.mainNavigation')}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`nav-item${currentView === item.view ? ' active' : ''}`}
              onClick={() => navigate(item.view)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <div className="topbar-user-pill">
              <div className="topbar-user-avatar" aria-hidden="true">
                {initials}
              </div>
              <span className="topbar-user-name">{initialUser.name}</span>
            </div>
            <button
              type="button"
              className="topbar-logout-btn"
              onClick={onLogout}
              title={t('common.signOut')}
              aria-label={t('common.signOut')}
            >
              ⎋
            </button>
          </div>
        </header>

        <main className="content-area">
          {loading && <div className="loader">{t('common.loading')}</div>}
          {error && <div className="error-banner">{error}</div>}

          {!loading && !error && currentView === 'sessions' && (
            <SessionWorkspace
              {...workspace}
              user={initialUser}
              initialViewMode="calendar"
              initialDetailId={initialDetailId}
              onSetStatus={onSetSessionStatus}
              onBulkUpdate={onBulkUpdateSessions}
            />
          )}

          {!loading && !error && currentView === 'stats' && (
            <StatsView
              sessions={workspace.sessions}
              sessionSaves={workspace.sessionSaves ?? undefined}
              onEventClick={(sessionId) => {
                setInitialDetailId(sessionId);
                setCurrentView('sessions');
              }}
            />
          )}
        </main>
      </div>

      <MobileBottomNav
        items={NAV_ITEMS.map((item) => ({
          id: item.view,
          icon: item.icon,
          label: t(item.labelKey),
          active: currentView === item.view,
          onClick: () => navigate(item.view),
        }))}
      />
    </div>
  );
}
