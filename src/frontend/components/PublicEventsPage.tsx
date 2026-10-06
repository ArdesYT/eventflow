/**
 * Nyilvános/résztvevői programoldal — attendee és vendég (guest) nézet.
 * Root rendereli attendee szerepkörnél; guestBrowse módban bejelentkezés nélkül.
 * Fülek: összes program, saját program, előadók; nézetek: lista, napirend, naptár.
 * Props: event, sessions, savedSessions, schedule callback-ek, user/guestMode, onLogout.
 */
import { useMemo, useState } from 'react';
import type { EventProfile, Session, User } from '../../backend/types';
import { getInitials, SESSION_ACCENTS } from '../lib/display';
import {
  formatDayHeader,
  formatSessionDateRange,
  groupSessionsForList,
  isMultiDaySession,
  isSessionCancelled,
  isTodayDateKey,
  localDateKey,
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
import styles from './PublicEventsPage.module.css';

type Tab = 'all' | 'saved' | 'speakers';

type ViewMode = 'list' | 'agenda' | 'calendar';

const TABS: { id: Tab; labelKey: string }[] = [
  { id: 'all', labelKey: 'public.allPrograms' },
  { id: 'saved', labelKey: 'public.mySchedule' },
  { id: 'speakers', labelKey: 'public.speakersTab' },
];

const PROGRAM_VIEWS: { mode: ViewMode; labelKey: string }[] = [
  { mode: 'list', labelKey: 'public.viewList' },
  { mode: 'agenda', labelKey: 'public.viewAgenda' },
  { mode: 'calendar', labelKey: 'public.viewCalendar' },
];

/** Résztvevői oldal props — program, mentett előadások, schedule műveletek. */
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
  onToggleNotifications?: (enable: boolean) => Promise<boolean>;
  notificationsOn?: boolean;
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
  onToggleNotifications,
  notificationsOn = false,
}: PublicEventsPageProps) {
  const { t, locale } = useI18n();
  // UI állapot: fül, nézetmód, szűrők, részletek modal, ütközés prompt
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
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(localDateKey);
  // Mentett előadás ID-k gyors kereséshez
  const savedIds = useMemo(() => new Set(savedSessions.map((s) => s.id)), [savedSessions]);
  const upcoming = useMemo(
    () =>
      [...sessions].sort((a, b) =>
        (a.date + a.start_time).localeCompare(b.date + b.start_time),
      ),
    [sessions],
  );
  const baseSessions = tab === 'saved' ? savedSessions : upcoming;
  const todayStr = localDateKey();
  // Aktív fül alapján szűrt lista + ma szűrő
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
  const detailSession = sessions.find((s) => s.id === detailId);
  const conflictSession = sessions.find((s) => s.id === conflictPrompt?.sessionId);
  const speakers = useMemo(() => {
    const map = new Map<string, { name: string; bio: string | null; sessions: Session[] }>();
    upcoming.forEach((s) => {
      const existing = map.get(s.speaker_name);
      if (existing) {
        existing.sessions.push(s);
        if (!existing.bio && s.speaker_bio?.trim()) existing.bio = s.speaker_bio;
      } else {
        map.set(s.speaker_name, {
          name: s.speaker_name,
          bio: s.speaker_bio?.trim() || null,
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
  // Előadás mentése — ütközés esetén modal, force=true esetén mentés mégis
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
  function renderSessionCard(ev: Session) {
    const isSaved = savedIds.has(ev.id);
    const live = isSessionLive(ev);
    const cancelled = isSessionCancelled(ev);
    const multiDay = isMultiDaySession(ev);
    const accent = SESSION_ACCENTS[ev.color] ?? SESSION_ACCENTS.blue;
    const hasConflict = !isSaved && findScheduleConflicts(savedSessions, ev).length > 0;
    return (
      <article
        key={ev.id}
        className={`${styles['public-session-card']}${live ? ` ${styles.live}` : ''}${cancelled ? ` ${styles.cancelled}` : ''}`}
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
          className={styles['public-session-accent']}
          style={{ background: accent }}
        />
        <div className={styles['public-session-time']}>
          {multiDay ? (
            <div className={styles['public-time-range']}>{formatSessionDateRange(ev, locale)}</div>
          ) : (
            <>
              <div className={styles['public-time-start']}>{formatTimeKey(ev.start_time)}</div>
              <div className={styles['public-time-end']}>{formatTimeKey(ev.end_time)}</div>
            </>
          )}
        </div>
        <div className={styles['public-session-body']}>
          <div className={styles['public-session-title-row']}>
            <div className={styles['public-session-title']}>
              {ev.title}
              {cancelled && (
                <span className={styles['session-cancelled-badge']}>{t('session.cancelled')}</span>
              )}
              {live && <span className={styles['public-live-badge']}>{t('public.liveNow')}</span>}
              {multiDay && (
                <span className={styles['public-multiday-badge']}>{t('booking.multiDay')}</span>
              )}
              {hasConflict && !guestMode && (
                <span className={styles['public-conflict-badge']} title={t('public.scheduleConflict')}>
                  ⚠
                </span>
              )}
            </div>
            {isSaved && <span className={styles['public-saved-badge']}>{t('public.savedSession')}</span>}
          </div>
          <div className={styles['public-session-meta']}>
            <div className={styles['public-session-speaker']}>
              <div className={styles['public-speaker-dot']}>{getInitials(ev.speaker_name)}</div>
              <div className={styles['public-speaker-info']}>
                <span>{ev.speaker_name}</span>
                {ev.speaker_bio?.trim() && (
                  <p className={styles['public-speaker-bio']}>{ev.speaker_bio}</p>
                )}
              </div>
            </div>
            <div
              className={styles['public-session-room']}
              style={{ background: accent + '22' }}
            >
              {ev.room_name}
            </div>
          </div>
          {ev.description && <p className={styles['public-session-desc']}>{ev.description}</p>}
        </div>
      </article>
    );
  }
  const showProgramViews = tab === 'all' || tab === 'saved';
  return (
    <div className={styles['public-page']}>
      <header className={styles['public-nav']}>
        <div className={styles['public-nav-brand']}>
          <div className={styles['public-nav-logo']}>EF</div>
          <div>
            <div className={styles['public-nav-name']}>EventFlow</div>
          </div>
        </div>
        <div className={styles['public-nav-right']}>
          <LanguageSwitcher variant="select" className={styles['public-nav-lang']} />
          <div className={styles['public-nav-toolbar']}>
            {guestMode ? (
              <button type="button" className={`${styles['btn-save']} ${styles['public-login-btn']}`} onClick={onLoginRequest}>
                {t('public.login')}
              </button>
            ) : (
              <>
                <div className={styles['public-user-pill']}>
                  <div className={styles['public-user-avatar']}>{getInitials(user?.name ?? '')}</div>
                  <span className={styles['public-user-name']}>{user?.name}</span>
                  <span className={styles['public-user-role']}>{t('public.attendee')}</span>
                </div>
                <button
                  type="button"
                  className={styles['public-logout-btn']}
                  onClick={onLogout}
                  title={t('common.logout')}
                  aria-label={t('common.logout')}
                >
                  <span className={styles['public-logout-label']}>{t('common.logout')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {guestMode && (
        <div className={styles['public-guest-banner']}>
          <span>{t('public.guestBanner')}</span>
        </div>
      )}
      <div className={styles['public-hero-area']}>
        <section className={styles['public-hero']}>
          <div className={styles['public-hero-bg']} aria-hidden="true" />
          <div className={styles['public-hero-content']}>
            <div className={styles['public-hero-text']}>
              <div className={styles['public-hero-eyebrow']}>{t('public.programsEyebrow')}</div>
              <h1 className={styles['public-hero-title']}>{event?.name ?? t('public.heroTitle')}</h1>
              <p className={styles['public-hero-sub']}>{event?.description ?? t('public.heroSub')}</p>
              {event?.venue && (
                <p className={styles['public-hero-venue']}>📍 {event.venue}</p>
              )}
              <EventCountdown event={event} />
            </div>
            <div className={styles['public-hero-stats']}>
              <div className={styles['public-stat-card']}>
                <div className={styles['public-stat-num']}>{upcoming.length}</div>
                <div className={styles['public-stat-label']}>{t('public.activeEvents')}</div>
              </div>
              <div className={styles['public-stat-card']}>
                <div className={styles['public-stat-num']}>{uniqueDays}</div>
                <div className={styles['public-stat-label']}>{t('public.programDays')}</div>
              </div>
              {!guestMode && (
                <div className={styles['public-stat-card']}>
                  <div className={styles['public-stat-num']}>{savedSessions.length}</div>
                  <div className={styles['public-stat-label']}>{t('public.mySchedule')}</div>
                </div>
              )}
              {liveCount > 0 && (
                <div className={`${styles['public-stat-card']} ${styles['public-stat-card--live']}`}>
                  <div className={styles['public-stat-num']}>{liveCount}</div>
                  <div className={styles['public-stat-label']}>{t('public.liveNow')}</div>
                </div>
              )}
            </div>
          </div>
        </section>
        <div className={styles['public-control-panel']}>
          <nav
            className={`${styles['public-tabs']}${showProgramViews ? '' : ` ${styles['public-tabs--solo']}`}`}
            role="tablist"
          >
            {TABS.filter(({ id }) => !guestMode || id !== 'saved').map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`${styles['public-tab']}${tab === id ? ` ${styles.active}` : ''}`}
                onClick={() => setTab(id)}
              >
                {t(labelKey)}
                {id === 'saved' && savedSessions.length > 0 && (
                  <span className={styles['public-tab-badge']}>{savedSessions.length}</span>
                )}
              </button>
            ))}
          </nav>
          {showProgramViews && (
            <div className={styles['public-toolbar']}>
              <label className={styles['public-search-wrap']}>
                <svg className={styles['public-search-icon']} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path d="m14 14 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  className={styles['public-search-input']}
                  placeholder={t('public.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label={t('public.searchPlaceholder')}
                />
              </label>
              <div className={styles['public-toolbar-bottom']}>
                <button
                  type="button"
                  className={`${styles['public-today-btn']}${todayOnly ? ` ${styles.active}` : ''}`}
                  onClick={() => setTodayOnly((v) => !v)}
                >
                  {t('public.todayFilter')}
                </button>
                <SessionFilters
                  compact
                  className={styles['public-filters']}
                  sessions={baseSessions}
                  speakerFilter={speakerFilter}
                  roomFilter={roomFilter}
                  onSpeakerChange={setSpeakerFilter}
                  onRoomChange={setRoomFilter}
                />
                <button type="button" className={`${styles['btn-export']} ${styles['public-export-btn']}`} onClick={handleExportIcs}>{t('export.ics')}</button>
                <div className={styles['public-view-toggle']} role="group" aria-label={t('public.viewList')}>
                  {PROGRAM_VIEWS.map(({ mode, labelKey }) => (
                    <button key={mode} type="button"
                      className={`${styles['public-view-btn']}${viewMode === mode ? ` ${styles.active}` : ''}`}
                      onClick={() => setViewMode(mode)}>
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <main className={styles['public-main']}>
        {loading && <div className={styles['public-status']}>{t('common.loading')}</div>}
        {error && <div className={`${styles['public-status']} ${styles.error}`}>{error}</div>}
        {scheduleError && <div className={`${styles['public-status']} ${styles.error}`}>{scheduleError}</div>}
        {!loading && tab === 'all' && upcoming.length === 0 && !error && (
          <div className={styles['public-empty']}>
            <div className={styles['empty-icon']}>📅</div>
            <h3>{t('public.emptyTitle')}</h3>
            <p>{t('public.emptySub')}</p>
          </div>
        )}
        {!loading && tab === 'saved' && savedSessions.length === 0 && (
          <div className={styles['public-empty']}>
            <div className={styles['empty-icon']}>⭐</div>
            <h3>{t('public.savedEmptyTitle')}</h3>
            <p>{t('public.savedEmptySub')}</p>
          </div>
        )}
        {!loading && showProgramViews && filteredSessions.length === 0 && baseSessions.length > 0 && (
          <div className={styles['public-empty']}>
            <div className={styles['empty-icon']}>🔍</div>
            <h3>{t('public.noResults')}</h3>
            <p>{t('public.noResultsSub')}</p>
          </div>
        )}
        {tab === 'saved' && !guestMode && onToggleNotifications && (
          <div className={styles['public-notify-row']}>
            <button
              type="button"
              className={`${styles['public-notify-btn']}${notificationsOn ? ` ${styles.active}` : ''}`}
              onClick={() => onToggleNotifications(!notificationsOn)}
            >
              {notificationsOn ? t('public.notificationsOn') : t('public.notificationsOff')}
            </button>
          </div>
        )}
        {tab === 'saved' && savedSessions.length > 0 && (
          <p className={styles['public-saved-summary']}>
            {savedSessions.length === 1
              ? t('public.savedCount', { count: savedSessions.length })
              : t('public.savedCount_plural', { count: savedSessions.length })}
          </p>
        )}
        {tab === 'speakers' && (
          <div className={styles['public-speakers-grid']}>
            {speakers.length === 0 ? (
              <div className={styles['public-empty']}>
                <div className={styles['empty-icon']}>🎤</div>
                <h3>{t('public.speakersEmpty')}</h3>
              </div>
            ) : (
              speakers.map((sp) => (
                <article key={sp.name} className={styles['public-speaker-card']}>
                  <div className={styles['public-speaker-card-avatar']}>{getInitials(sp.name)}</div>
                  <div className={styles['public-speaker-card-body']}>
                    <h3 className={styles['public-speaker-card-name']}>{sp.name}</h3>
                    <p className={styles['public-speaker-card-count']}>
                      {t(sp.sessions.length === 1 ? 'public.speakerSessionCount' : 'public.speakerSessionCount_plural', {
                        count: sp.sessions.length,
                      })}
                    </p>
                    {sp.bio && <p className={styles['public-speaker-card-bio']}>{sp.bio}</p>}
                    <ul className={styles['public-speaker-sessions']}>
                      {sp.sessions.slice(0, 4).map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={styles['public-speaker-session-link']}
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
          <section className={`${styles['public-day']} ${styles['public-multiday-section']}`}>
            <header className={`${styles['public-day-header']} ${styles['public-multiday-header']}`}>
              <div className={`${styles['public-day-circle']} ${styles['public-multiday-circle']}`}>📅</div>
              <div>
                <div className={styles['public-day-label']}>{t('public.multiDaySection')}</div>
                <div className={styles['public-day-today-tag']}>{t('booking.multiDay')}</div>
              </div>
            </header>
            <div className={styles['public-session-list']}>
              {multiDaySessions.map(renderSessionCard)}
            </div>
          </section>
        )}
        {showProgramViews && viewMode === 'list' &&
          sortedDates.map((ds) => {
            const header = formatDayHeader(ds, locale);
            const isToday = isTodayDateKey(ds);
            return (
              <section key={ds} className={styles['public-day']}>
                <header className={styles['public-day-header']}>
                  <div className={`${styles['public-day-circle']}${isToday ? ` ${styles.today}` : ''}`}>
                    {header.dayNum}
                  </div>
                  <div>
                    <div className={styles['public-day-label']}>
                      {header.weekday}, {header.monthShort} {header.dayNum}.
                    </div>
                    {isToday && (
                      <div className={styles['public-day-today-tag']}>{t('public.todayPrograms')}</div>
                    )}
                  </div>
                </header>
                <div className={styles['public-session-list']}>
                  {grouped[ds].map(renderSessionCard)}
                </div>
              </section>
            );
          })}
        {showProgramViews && viewMode === 'agenda' && filteredSessions.length > 0 && (
          <div className={styles['public-agenda-wrap']}>
            <AgendaView
              sessions={filteredSessions}
              onEventClick={setDetailId}
            />
          </div>
        )}
        {showProgramViews && viewMode === 'calendar' && (
          <div className={styles['public-calendar-wrap']}>
            <CalendarView
              curMonth={month.getMonth()}
              curYear={month.getFullYear()}
              sessions={filteredSessions}
              selectedDate={selectedDate}
              onSelectDay={setSelectedDate}
              onEventClick={setDetailId}
              onNavigate={(dir) => setMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + dir, 1))}
              onToday={() => {
                const today = new Date();
                setMonth(today);
                setSelectedDate(localDateKey(today));
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
      {conflictPrompt && conflictSession && (
        <ScheduleConflictModal
          session={conflictSession}
          conflicts={conflictPrompt.conflicts}
          busy={scheduleBusyId === conflictPrompt.sessionId}
          onConfirm={() => trySave(conflictPrompt.sessionId, true)}
          onClose={() => setConflictPrompt(null)}
        />
      )}
    </div>
  );
}
