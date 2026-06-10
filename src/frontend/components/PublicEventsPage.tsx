import { useMemo, useState } from 'react';
import type { Session, User } from '../../backend/types';
import { formatDayHeader, isTodayDateKey } from '../lib/sessionFormat';
import { useI18n } from '../i18n/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

type Tab = 'all' | 'saved';

interface PublicEventsPageProps {
  sessions: Session[];
  savedSessions: Session[];
  loading: boolean;
  error: string | null;
  scheduleError: string | null;
  scheduleBusyId: number | null;
  user: User;
  onSaveSession: (sessionId: number) => Promise<void>;
  onRemoveSession: (sessionId: number) => Promise<void>;
  onLogout: () => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function groupByDate(items: Session[]): { sortedDates: string[]; grouped: Record<string, Session[]> } {
  const grouped: Record<string, Session[]> = {};
  items.forEach((s) => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });
  return { sortedDates: Object.keys(grouped).sort(), grouped };
}

export default function PublicEventsPage({
  sessions,
  savedSessions,
  loading,
  error,
  scheduleError,
  scheduleBusyId,
  user,
  onSaveSession,
  onRemoveSession,
  onLogout,
}: PublicEventsPageProps) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>('all');

  const savedIds = useMemo(() => new Set(savedSessions.map((s) => s.id)), [savedSessions]);

  const upcoming = useMemo(
    () =>
      [...sessions].sort((a, b) =>
        (a.date + a.start_time).localeCompare(b.date + b.start_time),
      ),
    [sessions],
  );

  const displaySessions = tab === 'all' ? upcoming : savedSessions;
  const { sortedDates, grouped } = groupByDate(displaySessions);
  const uniqueDays = new Set(upcoming.map((s) => s.date)).size;

  function renderSessionCard(ev: Session, showRemoveOnly: boolean) {
    const isSaved = savedIds.has(ev.id);
    const busy = scheduleBusyId === ev.id;

    return (
      <article key={ev.id} className="public-session-card">
        <div
          className="public-session-accent"
          style={{ background: ACCENT[ev.color] ?? ACCENT.blue }}
        />
        <div className="public-session-time">
          <div className="public-time-start">{ev.start_time}</div>
          <div className="public-time-end">{ev.end_time}</div>
        </div>
        <div className="public-session-body">
          <div className="public-session-title-row">
            <div className="public-session-title">{ev.title}</div>
            {showRemoveOnly ? (
              <button
                type="button"
                className="public-save-btn remove"
                disabled={busy}
                onClick={() => onRemoveSession(ev.id)}
              >
                {busy ? t('booking.saving') : t('public.removeSaved')}
              </button>
            ) : (
              <button
                type="button"
                className={'public-save-btn' + (isSaved ? ' saved' : '')}
                disabled={busy || isSaved}
                onClick={() => (isSaved ? undefined : onSaveSession(ev.id))}
              >
                {busy ? t('booking.saving') : isSaved ? t('public.savedSession') : t('public.saveSession')}
              </button>
            )}
          </div>
          <div className="public-session-meta">
            <div className="public-session-speaker">
              <div className="public-speaker-dot">{getInitials(ev.speaker_name)}</div>
              <span>{ev.speaker_name}</span>
            </div>
            <div
              className="public-session-room"
              style={{ background: (ACCENT[ev.color] ?? ACCENT.blue) + '22' }}
            >
              {ev.room_name}
            </div>
          </div>
          {ev.description && <p className="public-session-desc">{ev.description}</p>}
        </div>
      </article>
    );
  }

  return (
    <div className="public-page">
      <header className="public-nav">
        <div className="public-nav-brand">
          <div className="public-nav-logo">EF</div>
          <div>
            <div className="public-nav-name">EventFlow</div>
          </div>
        </div>
        <div className="public-nav-right">
          <LanguageSwitcher />
          <div className="public-user-pill">
            <div className="public-user-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
            <span className="public-user-role">{t('public.attendee')}</span>
          </div>
          <button className="public-logout-btn" onClick={onLogout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <section className="public-hero">
        <div>
          <div className="public-hero-eyebrow">{t('public.programsEyebrow')}</div>
          <h1 className="public-hero-title">{t('public.heroTitle')}</h1>
          <p className="public-hero-sub">{t('public.heroSub')}</p>
        </div>
        <div className="public-hero-stats">
          <div className="public-stat">
            <div className="public-stat-num">{upcoming.length}</div>
            <div className="public-stat-label">{t('public.activeEvents')}</div>
          </div>
          <div className="public-stat-divider" />
          <div className="public-stat">
            <div className="public-stat-num">{uniqueDays}</div>
            <div className="public-stat-label">{t('public.programDays')}</div>
          </div>
        </div>
      </section>

      <div className="public-tabs">
        <button
          type="button"
          className={'public-tab' + (tab === 'all' ? ' active' : '')}
          onClick={() => setTab('all')}
        >
          {t('public.allPrograms')}
        </button>
        <button
          type="button"
          className={'public-tab' + (tab === 'saved' ? ' active' : '')}
          onClick={() => setTab('saved')}
        >
          {t('public.mySchedule')}
          {savedSessions.length > 0 && (
            <span className="public-tab-badge">{savedSessions.length}</span>
          )}
        </button>
      </div>

      <main className="public-main">
        {loading && <div className="public-status">{t('common.loading')}</div>}
        {error && <div className="public-status error">{error}</div>}
        {scheduleError && <div className="public-status error">{scheduleError}</div>}

        {!loading && tab === 'all' && upcoming.length === 0 && !error && (
          <div className="public-empty">
            <div className="empty-icon">📅</div>
            <h3>{t('public.emptyTitle')}</h3>
            <p>{t('public.emptySub')}</p>
          </div>
        )}

        {!loading && tab === 'saved' && savedSessions.length === 0 && (
          <div className="public-empty">
            <div className="empty-icon">⭐</div>
            <h3>{t('public.savedEmptyTitle')}</h3>
            <p>{t('public.savedEmptySub')}</p>
          </div>
        )}

        {tab === 'saved' && savedSessions.length > 0 && (
          <p className="public-saved-summary">
            {savedSessions.length === 1
              ? t('public.savedCount', { count: savedSessions.length })
              : t('public.savedCount_plural', { count: savedSessions.length })}
          </p>
        )}

        {sortedDates.map((ds) => {
          const header = formatDayHeader(ds, locale);
          const isToday = isTodayDateKey(ds);

          return (
            <section key={ds} className="public-day">
              <header className="public-day-header">
                <div className={'public-day-circle' + (isToday ? ' today' : '')}>
                  {header.dayNum}
                </div>
                <div>
                  <div className="public-day-label">
                    {header.weekday}, {header.monthShort} {header.dayNum}.
                  </div>
                  {isToday && (
                    <div className="public-day-today-tag">{t('public.todayPrograms')}</div>
                  )}
                </div>
              </header>

              <div className="public-session-list">
                {grouped[ds].map((ev) => renderSessionCard(ev, tab === 'saved'))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
