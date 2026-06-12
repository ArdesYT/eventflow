import { useMemo, useState } from 'react';

import type { EventProfile, Session, User } from '../../backend/types';

import {

  formatDayHeader,

  formatSessionDateRange,

  groupSessionsForList,

  isMultiDaySession,

  isSessionCancelled,

  isTodayDateKey,

  sessionSpansDate,

} from '../lib/sessionFormat';

import {

  findScheduleConflicts,

  isSessionLive,

} from '../lib/sessionBooking';

import { formatTimeKey } from '../i18n/dateFormat';

import { downloadIcsFile } from '../lib/icsExport';

import { useI18n } from '../i18n/I18nProvider';

import LanguageSwitcher from './LanguageSwitcher';

import SessionFilters from './SessionFilters';

import AgendaView from './AgendaView';

import CalendarView from './CalendarView';

import AttendeeDetailModal from './AttendeeDetailModal';
import ScheduleConflictModal from './ScheduleConflictModal';
import EventCountdown from './EventCountdown';



type Tab = 'all' | 'saved' | 'speakers';

type ViewMode = 'list' | 'agenda' | 'calendar';



interface PublicEventsPageProps {

  event?: EventProfile | null;

  sessions: Session[];

  savedSessions: Session[];

  loading: boolean;

  error: string | null;

  scheduleError: string | null;

  scheduleBusyId: number | null;

  user?: User | null;

  guestMode?: boolean;

  onSaveSession: (sessionId: number) => Promise<void>;

  onRemoveSession: (sessionId: number) => Promise<void>;

  onLogout?: () => void;

  onLoginRequest?: () => void;

  onLoadDemo?: () => Promise<void>;

  loadingDemo?: boolean;

  onToggleNotifications?: (enable: boolean) => Promise<boolean>;

  notificationsOn?: boolean;

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



function toDateStr(y: number, m: number, d: number): string {

  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

}



function filterSessions(

  items: Session[],

  searchTerm: string,

  speakerFilter: string,

  roomFilter: string,

): Session[] {

  const q = searchTerm.trim().toLowerCase();

  return items.filter((s) => {

    if (speakerFilter && s.speaker_name !== speakerFilter) return false;

    if (roomFilter && s.room_name !== roomFilter) return false;

    if (!q) return true;

    return (

      s.title.toLowerCase().includes(q) ||

      s.speaker_name.toLowerCase().includes(q) ||

      s.room_name.toLowerCase().includes(q) ||

      (s.description ?? '').toLowerCase().includes(q)

    );

  });

}



export default function PublicEventsPage({

  event,

  sessions,

  savedSessions,

  loading,

  error,

  scheduleError,

  scheduleBusyId,

  user,

  guestMode = false,

  onSaveSession,

  onRemoveSession,

  onLogout,

  onLoginRequest,

  onLoadDemo,

  loadingDemo = false,

  onToggleNotifications,

  notificationsOn = false,

}: PublicEventsPageProps) {

  const { t, locale } = useI18n();

  const [tab, setTab] = useState<Tab>('all');

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [searchTerm, setSearchTerm] = useState('');

  const [speakerFilter, setSpeakerFilter] = useState('');

  const [roomFilter, setRoomFilter] = useState('');

  const [detailId, setDetailId] = useState<number | null>(null);

  const [todayOnly, setTodayOnly] = useState(false);

  const [conflictPrompt, setConflictPrompt] = useState<{
    sessionId: number;
    conflicts: Session[];
  } | null>(null);



  const today = new Date();

  const [curMonth, setCurMonth] = useState(today.getMonth());

  const [curYear, setCurYear] = useState(today.getFullYear());

  const [selectedDate, setSelectedDate] = useState<string | null>(

    toDateStr(today.getFullYear(), today.getMonth(), today.getDate()),

  );



  const savedIds = useMemo(() => new Set(savedSessions.map((s) => s.id)), [savedSessions]);



  const upcoming = useMemo(

    () =>

      [...sessions].sort((a, b) =>

        (a.date + a.start_time).localeCompare(b.date + b.start_time),

      ),

    [sessions],

  );



  const baseSessions = tab === 'saved' ? savedSessions : upcoming;

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const filteredSessions = useMemo(() => {
    let items = filterSessions(baseSessions, searchTerm, speakerFilter, roomFilter);
    if (todayOnly) {
      items = items.filter((s) => sessionSpansDate(s, todayStr));
    }
    return items;
  }, [baseSessions, searchTerm, speakerFilter, roomFilter, todayOnly, todayStr]);



  const listGroups = useMemo(() => groupSessionsForList(filteredSessions), [filteredSessions]);
  const { sortedDates, grouped } = listGroups.singleDayByDate;
  const multiDaySessions = listGroups.multiDay;

  const uniqueDays = new Set(upcoming.map((s) => s.date)).size;

  const liveCount = upcoming.filter((s) => isSessionLive(s)).length;



  const detailSession = detailId != null ? sessions.find((s) => s.id === detailId) ?? null : null;



  const speakers = useMemo(() => {

    const map = new Map<string, { name: string; bio: string | null; count: number; sessions: Session[] }>();

    upcoming.forEach((s) => {

      const existing = map.get(s.speaker_name);

      if (existing) {

        existing.count += 1;

        existing.sessions.push(s);

        if (!existing.bio && s.speaker_bio?.trim()) existing.bio = s.speaker_bio;

      } else {

        map.set(s.speaker_name, {

          name: s.speaker_name,

          bio: s.speaker_bio?.trim() || null,

          count: 1,

          sessions: [s],

        });

      }

    });

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));

  }, [upcoming]);



  function handleExportIcs() {

    const filename = tab === 'saved' ? 'eventflow-mentett.ics' : 'eventflow-program.ics';

    const name =

      tab === 'saved' ? t('export.savedCalendarName') : t('export.calendarName');

    downloadIcsFile(filteredSessions, filename, name);

  }



  async function trySave(sessionId: number, force = false) {

    if (guestMode) {

      onLoginRequest?.();

      return;

    }

    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;



    const conflicts = findScheduleConflicts(savedSessions, session);

    if (!force && conflicts.length > 0) {

      setConflictPrompt({ sessionId, conflicts });

      return;

    }



    setConflictPrompt(null);

    await onSaveSession(sessionId);

  }



  function renderSessionCard(ev: Session, showRemoveOnly: boolean) {

    const isSaved = savedIds.has(ev.id);

    const busy = scheduleBusyId === ev.id;

    const live = isSessionLive(ev);

    const cancelled = isSessionCancelled(ev);

    const hasConflict = !isSaved && findScheduleConflicts(savedSessions, ev).length > 0;



    return (

      <article

        key={ev.id}

        className={
          'public-session-card' +
          (live ? ' live' : '') +
          (cancelled ? ' cancelled' : '')
        }

        onClick={() => setDetailId(ev.id)}

        role="button"

        tabIndex={0}

        onKeyDown={(e) => {

          if (e.key === 'Enter' || e.key === ' ') {

            e.preventDefault();

            setDetailId(ev.id);

          }

        }}

      >

        <div

          className="public-session-accent"

          style={{ background: ACCENT[ev.color] ?? ACCENT.blue }}

        />

        <div className="public-session-time">

          {isMultiDaySession(ev) ? (

            <div className="public-time-range">{formatSessionDateRange(ev, locale)}</div>

          ) : (

            <>

              <div className="public-time-start">{formatTimeKey(ev.start_time)}</div>

              <div className="public-time-end">{formatTimeKey(ev.end_time)}</div>

            </>

          )}

        </div>

        <div className="public-session-body">

          <div className="public-session-title-row">

            <div className="public-session-title">

              {ev.title}

              {cancelled && (
                <span className="session-cancelled-badge">{t('session.cancelled')}</span>
              )}

              {live && <span className="public-live-badge">{t('public.liveNow')}</span>}

              {isMultiDaySession(ev) && (

                <span className="public-multiday-badge">{t('booking.multiDay')}</span>

              )}

              {hasConflict && !guestMode && (

                <span className="public-conflict-badge" title={t('public.scheduleConflict')}>

                  ⚠

                </span>

              )}

            </div>

            {showRemoveOnly ? (

              <button

                type="button"

                className="public-save-btn remove"

                disabled={busy}

                onClick={(e) => {

                  e.stopPropagation();

                  onRemoveSession(ev.id);

                }}

              >

                {busy ? t('booking.saving') : t('public.removeSaved')}

              </button>

            ) : (

              <button

                type="button"

                className={'public-save-btn' + (isSaved ? ' saved' : '')}

                disabled={busy || isSaved || cancelled}

                onClick={(e) => {

                  e.stopPropagation();

                  if (!isSaved && !cancelled) trySave(ev.id);

                }}

              >

                {busy

                  ? t('booking.saving')

                  : guestMode

                    ? t('public.loginToSave')

                    : isSaved

                      ? t('public.savedSession')

                      : t('public.saveSession')}

              </button>

            )}

          </div>

          <div className="public-session-meta">

            <div className="public-session-speaker">

              <div className="public-speaker-dot">{getInitials(ev.speaker_name)}</div>

              <div className="public-speaker-info">

                <span>{ev.speaker_name}</span>

                {ev.speaker_bio?.trim() && (

                  <p className="public-speaker-bio">{ev.speaker_bio}</p>

                )}

              </div>

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



  const showProgramViews = tab === 'all' || tab === 'saved';



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

          <button type="button" className="btn-export public-export-btn" onClick={handleExportIcs}>

            {t('export.ics')}

          </button>

          <LanguageSwitcher />

          {guestMode ? (

            <button type="button" className="btn-save public-login-btn" onClick={onLoginRequest}>

              {t('public.login')}

            </button>

          ) : (

            <>

              <div className="public-user-pill">

                <div className="public-user-avatar">{getInitials(user?.name ?? '')}</div>

                <span>{user?.name}</span>

                <span className="public-user-role">{t('public.attendee')}</span>

              </div>

              <button className="public-logout-btn" onClick={onLogout}>

                {t('common.logout')}

              </button>

            </>

          )}

        </div>

      </header>



      {guestMode && (

        <div className="public-guest-banner">

          <span>{t('public.guestBanner')}</span>

          <button type="button" className="public-guest-login-link" onClick={onLoginRequest}>

            {t('public.login')}

          </button>

        </div>

      )}



      <div className="public-hero-area">
        <section className="public-hero">
          <div className="public-hero-bg" aria-hidden="true" />
          <div className="public-hero-content">
            <div className="public-hero-text">
              <div className="public-hero-eyebrow">{t('public.programsEyebrow')}</div>
              <h1 className="public-hero-title">{event?.name ?? t('public.heroTitle')}</h1>
              <p className="public-hero-sub">{event?.description ?? t('public.heroSub')}</p>
              {event?.venue && (
                <p className="public-hero-venue">📍 {event.venue}</p>
              )}
              <EventCountdown event={event} />
            </div>
            <div className="public-hero-stats">
              <div className="public-stat-card">
                <div className="public-stat-num">{upcoming.length}</div>
                <div className="public-stat-label">{t('public.activeEvents')}</div>
              </div>
              <div className="public-stat-card">
                <div className="public-stat-num">{uniqueDays}</div>
                <div className="public-stat-label">{t('public.programDays')}</div>
              </div>
              {!guestMode && (
                <div className="public-stat-card">
                  <div className="public-stat-num">{savedSessions.length}</div>
                  <div className="public-stat-label">{t('public.mySchedule')}</div>
                </div>
              )}
              {liveCount > 0 && (
                <div className="public-stat-card public-stat-card--live">
                  <div className="public-stat-num">{liveCount}</div>
                  <div className="public-stat-label">{t('public.liveNow')}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="public-control-panel">
          <nav
            className={'public-tabs' + (showProgramViews ? '' : ' public-tabs--solo')}
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'all'}
              className={'public-tab' + (tab === 'all' ? ' active' : '')}
              onClick={() => setTab('all')}
            >
              {t('public.allPrograms')}
            </button>
            {!guestMode && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'saved'}
                className={'public-tab' + (tab === 'saved' ? ' active' : '')}
                onClick={() => setTab('saved')}
              >
                {t('public.mySchedule')}
                {savedSessions.length > 0 && (
                  <span className="public-tab-badge">{savedSessions.length}</span>
                )}
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'speakers'}
              className={'public-tab' + (tab === 'speakers' ? ' active' : '')}
              onClick={() => setTab('speakers')}
            >
              {t('public.speakersTab')}
            </button>
          </nav>

          {showProgramViews && (
            <div className="public-toolbar">
              <label className="public-search-wrap">
                <svg className="public-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path d="m14 14 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  className="public-search-input"
                  placeholder={t('public.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label={t('public.searchPlaceholder')}
                />
              </label>
              <div className="public-toolbar-bottom">
                <button
                  type="button"
                  className={'public-today-btn' + (todayOnly ? ' active' : '')}
                  onClick={() => setTodayOnly((v) => !v)}
                >
                  {t('public.todayFilter')}
                </button>
                <SessionFilters
                  compact
                  className="public-filters"
                  sessions={baseSessions}
                  speakerFilter={speakerFilter}
                  roomFilter={roomFilter}
                  onSpeakerChange={setSpeakerFilter}
                  onRoomChange={setRoomFilter}
                />
                <div className="public-view-toggle" role="group" aria-label={t('public.viewList')}>
                  <button
                    type="button"
                    className={'public-view-btn' + (viewMode === 'list' ? ' active' : '')}
                    onClick={() => setViewMode('list')}
                  >
                    {t('public.viewList')}
                  </button>
                  <button
                    type="button"
                    className={'public-view-btn' + (viewMode === 'agenda' ? ' active' : '')}
                    onClick={() => setViewMode('agenda')}
                  >
                    {t('public.viewAgenda')}
                  </button>
                  <button
                    type="button"
                    className={'public-view-btn' + (viewMode === 'calendar' ? ' active' : '')}
                    onClick={() => setViewMode('calendar')}
                  >
                    {t('public.viewCalendar')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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

            {onLoadDemo && (
              <button
                type="button"
                className="btn-save public-load-demo-btn"
                disabled={loadingDemo}
                onClick={() => onLoadDemo()}
              >
                {loadingDemo ? t('common.loading') : t('public.loadDemo')}
              </button>
            )}

          </div>

        )}



        {!loading && tab === 'saved' && savedSessions.length === 0 && (

          <div className="public-empty">

            <div className="empty-icon">⭐</div>

            <h3>{t('public.savedEmptyTitle')}</h3>

            <p>{t('public.savedEmptySub')}</p>

          </div>

        )}



        {!loading && showProgramViews && filteredSessions.length === 0 && baseSessions.length > 0 && (

          <div className="public-empty">

            <div className="empty-icon">🔍</div>

            <h3>{t('public.noResults')}</h3>

            <p>{t('public.noResultsSub')}</p>

          </div>

        )}



        {tab === 'saved' && !guestMode && onToggleNotifications && (
          <div className="public-notify-row">
            <button
              type="button"
              className={'public-notify-btn' + (notificationsOn ? ' active' : '')}
              onClick={() => onToggleNotifications(!notificationsOn)}
            >
              {notificationsOn ? t('public.notificationsOn') : t('public.notificationsOff')}
            </button>
          </div>
        )}

        {tab === 'saved' && savedSessions.length > 0 && (

          <p className="public-saved-summary">

            {savedSessions.length === 1

              ? t('public.savedCount', { count: savedSessions.length })

              : t('public.savedCount_plural', { count: savedSessions.length })}

          </p>

        )}



        {tab === 'speakers' && (

          <div className="public-speakers-grid">

            {speakers.length === 0 ? (

              <div className="public-empty">

                <div className="empty-icon">🎤</div>

                <h3>{t('public.speakersEmpty')}</h3>

              </div>

            ) : (

              speakers.map((sp) => (

                <article key={sp.name} className="public-speaker-card">

                  <div className="public-speaker-card-avatar">{getInitials(sp.name)}</div>

                  <div className="public-speaker-card-body">

                    <h3 className="public-speaker-card-name">{sp.name}</h3>

                    <p className="public-speaker-card-count">

                      {sp.count === 1

                        ? t('public.speakerSessionCount', { count: sp.count })

                        : t('public.speakerSessionCount_plural', { count: sp.count })}

                    </p>

                    {sp.bio && <p className="public-speaker-card-bio">{sp.bio}</p>}

                    <ul className="public-speaker-sessions">

                      {sp.sessions.slice(0, 4).map((s) => (

                        <li key={s.id}>

                          <button

                            type="button"

                            className="public-speaker-session-link"

                            onClick={() => setDetailId(s.id)}

                          >

                            {s.title}

                          </button>

                        </li>

                      ))}

                    </ul>

                  </div>

                </article>

              ))

            )}

          </div>

        )}



        {showProgramViews && viewMode === 'list' && multiDaySessions.length > 0 && (
          <section className="public-day public-multiday-section">
            <header className="public-day-header public-multiday-header">
              <div className="public-day-circle public-multiday-circle">📅</div>
              <div>
                <div className="public-day-label">{t('public.multiDaySection')}</div>
                <div className="public-day-today-tag">{t('booking.multiDay')}</div>
              </div>
            </header>
            <div className="public-session-list">
              {multiDaySessions.map((ev) => renderSessionCard(ev, tab === 'saved'))}
            </div>
          </section>
        )}

        {showProgramViews && viewMode === 'list' &&

          sortedDates.map((ds) => {

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



        {showProgramViews && viewMode === 'agenda' && filteredSessions.length > 0 && (

          <div className="public-agenda-wrap">

            <AgendaView

              sessions={filteredSessions}

              onEventClick={setDetailId}

              readOnly

            />

          </div>

        )}



        {showProgramViews && viewMode === 'calendar' && (

          <div className="public-calendar-wrap">

            <CalendarView

              curMonth={curMonth}

              curYear={curYear}

              sessions={filteredSessions}

              selectedDate={selectedDate}

              onSelectDay={setSelectedDate}

              onEventClick={setDetailId}

              onNavigate={(dir) => {

                const next = new Date(curYear, curMonth + dir, 1);

                setCurMonth(next.getMonth());

                setCurYear(next.getFullYear());

              }}

              onToday={() => {

                const n = new Date();

                setCurMonth(n.getMonth());

                setCurYear(n.getFullYear());

                setSelectedDate(toDateStr(n.getFullYear(), n.getMonth(), n.getDate()));

              }}

            />

          </div>

        )}

      </main>



      {detailSession && (

        <AttendeeDetailModal

          session={detailSession}

          isSaved={savedIds.has(detailSession.id)}

          busy={scheduleBusyId === detailSession.id}

          guestMode={guestMode}

          onClose={() => setDetailId(null)}

          onSave={() => trySave(detailSession.id)}

          onRemove={() => onRemoveSession(detailSession.id)}

          onLoginRequest={onLoginRequest}

        />

      )}

      {conflictPrompt && (() => {
        const conflictSession = sessions.find((s) => s.id === conflictPrompt.sessionId);
        if (!conflictSession) return null;
        return (
          <ScheduleConflictModal
            session={conflictSession}
            conflicts={conflictPrompt.conflicts}
            busy={scheduleBusyId === conflictPrompt.sessionId}
            onConfirm={() => trySave(conflictPrompt.sessionId, true)}
            onClose={() => setConflictPrompt(null)}
          />
        );
      })()}

    </div>

  );

}


