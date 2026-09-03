/** A szervező és az admin közös programkezelője. Minden előadásművelet innen indul. */
import { useEffect, useMemo, useState } from 'react';
import type { BookingFormData, CreateSessionBody, Room, Session, SessionSavesMap, Speaker, User } from '../../backend/types';
import { bookingFormToApiBody, duplicateBookingFormData, hasRoomConflict, toBookingFormData } from '../lib/sessionBooking';
import { fetchSpeakers, speakersFromSessions } from '../lib/speakersApi';
import { downloadIcsFile } from '../lib/icsExport';
import { useI18n } from '../i18n/I18nProvider';
import { translateError } from '../i18n/translateError';
import SessionFilters from './SessionFilters';
import SessionsView from './SessionsView';
import AgendaView from './AgendaView';
import CalendarView from './CalendarView';
import BookingModal from './BookingModal';
import DetailModal from './DetailModal';
import BulkSessionToolbar from './BulkSessionToolbar';

type ViewMode = 'list' | 'calendar' | 'agenda';
type Booking = { kind: 'new'; date: string } | { kind: 'edit'; id: number; values: BookingFormData } | { kind: 'duplicate'; values: BookingFormData };

export interface SessionWorkspaceProps {
  user: User;
  rooms: Room[];
  sessions: Session[];
  sessionSaves: SessionSavesMap | null;
  backendMode: boolean;
  initialViewMode?: ViewMode;
  initialDetailId?: number | null;
  onRefreshSessionSaves: () => void;
  onCreate: (body: CreateSessionBody) => Promise<void>;
  onUpdate: (id: number, data: BookingFormData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSetStatus: (id: number, status: 'scheduled' | 'cancelled') => Promise<void>;
  onBulkUpdate?: (body: { ids: number[]; dateOffsetDays: number; roomId?: number }) => Promise<void>;
}

export default function SessionWorkspace({
  user, rooms, sessions, sessionSaves, backendMode, initialViewMode = 'list', initialDetailId = null,
  onRefreshSessionSaves, onCreate, onUpdate, onDelete, onSetStatus, onBulkUpdate,
}: SessionWorkspaceProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailId, setDetailId] = useState(initialDetailId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const allowedRoomIds = user.role === 'booker' ? user.assigned_room_ids : undefined;
  const detailSession = sessions.find((session) => session.id === detailId);
  const bookingOpen = booking !== null;

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sessions.filter((session) => (
      (!speakerFilter || session.speaker_name === speakerFilter) &&
      (!roomFilter || session.room_name === roomFilter) &&
      (!query || [session.title, session.speaker_name, session.room_name].some((value) => value.toLowerCase().includes(query)))
    ));
  }, [sessions, searchTerm, speakerFilter, roomFilter]);

  useEffect(() => {
    if (detailId !== null) onRefreshSessionSaves();
  }, [detailId, onRefreshSessionSaves]);

  // Csak a foglalási űrlaphoz kell az előadólista; polling közben ne töltsük újra.
  useEffect(() => {
    if (!bookingOpen || !backendMode) return;
    let cancelled = false;
    fetchSpeakers()
      .then((list) => { if (!cancelled) setSpeakers(list); })
      .catch(() => { if (!cancelled) setSpeakers([]); });
    return () => { cancelled = true; };
  }, [bookingOpen, backendMode]);

  function changeView(view: ViewMode) {
    setViewMode(view);
    setBulkSelectMode(false);
    setSelectedIds(new Set());
  }

  function closeBooking() {
    if (saving) return;
    setBooking(null);
    setSaveError(null);
  }

  function openBooking(next: Booking) {
    setDetailId(null);
    setActionError(null);
    setSaveError(null);
    setBooking(next);
  }

  function selectBookingDay(date: string) {
    setSelectedDate(date);
    openBooking({ kind: 'new', date });
  }

  async function saveBooking(data: BookingFormData) {
    if (!booking || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const editingId = booking.kind === 'edit' ? booking.id : undefined;
      if (hasRoomConflict(sessions, data, editingId)) throw new Error('errors.roomBusy');
      if (editingId !== undefined) await onUpdate(editingId, data);
      else await onCreate(bookingFormToApiBody(data));
      setBooking(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'errors.saveError');
    } finally {
      setSaving(false);
    }
  }

  async function runSessionAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
      setDetailId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'errors.saveError');
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulk(options: { dateOffsetDays: number; roomId?: number }) {
    if (!onBulkUpdate || selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await onBulkUpdate({ ids: [...selectedIds], ...options });
      setSelectedIds(new Set());
      setBulkSelectMode(false);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section className="session-workspace" aria-label={t('nav.program')}>
      <div className="session-workspace-toolbar">
        <div className="view-toggle" role="group" aria-label={t('nav.program')}>
          {(['list', 'calendar', 'agenda'] as const).map((view) => (
            <button key={view} type="button" className={`view-btn${viewMode === view ? ' active' : ''}`}
              aria-pressed={viewMode === view} onClick={() => changeView(view)}>
              {t(view === 'list' ? 'public.viewList' : view === 'calendar' ? 'public.viewCalendar' : 'public.viewAgenda')}
            </button>
          ))}
        </div>
        <div className="session-workspace-actions">
          <button type="button" className="btn-export" onClick={() => downloadIcsFile(filteredSessions, 'eventflow-program.ics', t('export.calendarName'))}>
            {t('export.ics')}
          </button>
        </div>
      </div>
      <div className="session-workspace-filters">
        <input type="search" className="form-input" placeholder={t('nav.searchPlaceholder')}
          aria-label={t('nav.searchPlaceholder')} value={searchTerm} onChange={(event) => {
            setSearchTerm(event.target.value);
            setSelectedIds(new Set());
          }} />
        <SessionFilters sessions={sessions} speakerFilter={speakerFilter} roomFilter={roomFilter}
          onSpeakerChange={(value) => { setSpeakerFilter(value); setSelectedIds(new Set()); }}
          onRoomChange={(value) => { setRoomFilter(value); setSelectedIds(new Set()); }} />
      </div>
      {actionError && <div className="error-banner" role="alert">{translateError(actionError, t)}</div>}
      {viewMode === 'list' && (
        <>
          {onBulkUpdate && (
            <div className="sessions-toolbar-row">
              <button type="button" className={`btn-export${bulkSelectMode ? ' active' : ''}`} onClick={() => {
                setBulkSelectMode(!bulkSelectMode);
                setSelectedIds(new Set());
              }}>
                {bulkSelectMode ? t('bulk.cancelSelect') : t('bulk.selectMode')}
              </button>
            </div>
          )}
          {bulkSelectMode && selectedIds.size > 0 && (
            <BulkSessionToolbar selectedCount={selectedIds.size} busy={bulkBusy} rooms={rooms}
              allowedRoomIds={allowedRoomIds} onClear={() => setSelectedIds(new Set())} onApply={applyBulk} />
          )}
          <SessionsView sessions={filteredSessions} sessionSaves={sessionSaves ?? undefined} searchTerm={searchTerm}
            selectable={bulkSelectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect}
            onEventClick={(id) => bulkSelectMode ? toggleSelect(id) : setDetailId(id)} />
        </>
      )}
      {viewMode === 'agenda' && <AgendaView sessions={filteredSessions} sessionSaves={sessionSaves ?? undefined} onEventClick={setDetailId} />}
      {viewMode === 'calendar' && (
        <>
          <CalendarView curMonth={month.getMonth()} curYear={month.getFullYear()} sessions={filteredSessions}
            selectedDate={selectedDate} onSelectDay={selectBookingDay} onEventClick={setDetailId}
            onNavigate={(direction) => { setMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1)); setSelectedDate(null); }}
            onToday={() => { setMonth(new Date()); setSelectedDate(null); }} />
        </>
      )}
      {detailSession && <DetailModal session={detailSession} savedBy={sessionSaves?.[detailSession.id]}
        savesLoaded={sessionSaves !== null} onClose={() => setDetailId(null)}
        onDelete={(id) => runSessionAction(() => onDelete(id))}
        onSetStatus={(id, status) => runSessionAction(() => onSetStatus(id, status))}
        onEdit={() => openBooking({ kind: 'edit', id: detailSession.id, values: toBookingFormData(detailSession) })}
        onDuplicate={() => openBooking({ kind: 'duplicate', values: duplicateBookingFormData(detailSession, t('detail.duplicateSuffix')) })} />}
      {booking && <BookingModal initialDate={booking.kind === 'new' ? booking.date : undefined}
        initialValues={booking.kind === 'new' ? undefined : booking.values}
        currentUserName={user.name} speakers={backendMode ? speakers : speakersFromSessions(sessions)}
        sessions={sessions} rooms={rooms} editingSessionId={booking.kind === 'edit' ? booking.id : null}
        allowedRoomIds={allowedRoomIds} onSave={saveBooking} onClose={closeBooking} saving={saving}
        saveError={saveError ? translateError(saveError, t) : null} />}
    </section>
  );
}
