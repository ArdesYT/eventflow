/**
 * =============================================================================
 * types.ts — Közös TypeScript típusok (backend + frontend)
 * =============================================================================
 *
 * A frontend közvetlenül importálja ezt a fájlt — egy forrás az API szerződéshez.
 * Ne tegyünk ide futásidejű kódot, csak típusokat és type aliasokat.
 * =============================================================================
 */

/** Előadás kártya színe a naptárban / listában. */
export type EventColor = 'blue' | 'amber' | 'green' | 'red';

/** scheduled = aktív, cancelled = lemondva (megjelenik, de szürke / nem ütközik). */
export type SessionStatus = 'scheduled' | 'cancelled';

/** Booker fő nézet oldalai (naptár, lista, napirend, statisztika). */
export type ViewType = 'calendar' | 'sessions' | 'agenda' | 'stats';

/** Admin oldalsáv menüpontjai. */
export type AdminViewType = 'overview' | 'users' | 'sessions' | 'rooms' | 'speakers' | 'audit' | 'event';

/** Terem — rooms tábla. */
export interface Room {
  id: number;
  name: string;
  capacity?: number;
}

/** Aktív esemény profilja — GET /api/event, admin szerkesztés. */
export interface EventProfile {
  id: number;
  name: string;
  slug: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  is_active: boolean;
}

/** PATCH /api/admin/event — csak a megadott mezők frissülnek. */
export interface UpdateEventBody {
  name?: string;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
}

/** Gyors sablonok a foglalási űrlapon (keynote, panel, workshop). */
export type SessionTemplateId = 'keynote' | 'panel' | 'workshop';

/** Audit napló művelet típusok — activity_log.action */
export type ActivityAction =
  | 'session.create'
  | 'session.update'
  | 'session.delete'
  | 'session.cancel'
  | 'session.restore'
  | 'session.bulk_update'
  | 'speaker.merge'
  | 'user.role_change'
  | 'user.delete'
  | 'user.rooms_update';

/** Egy audit bejegyzés — admin ActivityLogView. */
export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: ActivityAction;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

/** PATCH /api/sessions/bulk — tömeges dátum/terem módosítás. */
export interface BulkUpdateSessionsBody {
  ids: number[];
  date_offset_days?: number;
  room_id?: number;
}

// ── Raw DB columns in the sessions table ──────────────────────────────────────
export interface SessionRow {
  id: number;
  title: string;
  description?: string;
  start_time: string;   // stored as datetime or HH:MM string
  end_time: string;
  room_id: number;
  speaker_id: number;
  color: EventColor;
}

// ── Joined shape returned by GET /api/sessions ────────────────────────────────
// Adds room_name + speaker_name via LEFT JOIN, plus a plain date string
// that the frontend uses for calendar grouping.
export interface Session extends SessionRow {
  date: string;         // YYYY-MM-DD start (parsed from start_time)
  end_date: string;     // YYYY-MM-DD end (parsed from end_time; equals date when single-day)
  room_name: string;
  speaker_name: string;
  speaker_bio?: string | null;
  status?: SessionStatus;
}

// ── Data the frontend submits when creating a booking ─────────────────────────
export interface BookingFormData {
  title: string;
  description: string;
  date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  room_id: number;      // FK — sent to the DB
  speaker_id: number;   // FK — sent to the DB
  room_name: string;    // for optimistic UI update only, not written to DB
  speaker_name: string; // for optimistic UI update only, not written to DB
  color: EventColor;
}

// ── Subset actually written to the DB by POST /api/sessions ──────────────────
export interface CreateSessionBody {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  room_id: number;
  speaker_id: number;
  speaker_name?: string;
  color: EventColor;
}


// ── Auth ──────────────────────────────────────────────────────────────────────

/** Globális felhasználói szerepkör — users.role oszlop. */
export type UserRole = 'admin' | 'booker' | 'attendee';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  assigned_room_ids?: number[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** Előadó — speakers tábla; session_count admin listában. */
export interface Speaker {
  id: number;
  name: string;
  bio?: string | null;
  session_count?: number;
}

export interface CreateSpeakerBody {
  name: string;
  bio?: string;
}

export interface UpdateSpeakerBody {
  name?: string;
  bio?: string | null;
}

export interface MergeSpeakersBody {
  keep_id: number;
  merge_ids: number[];
}

/** Attendee who saved a session to their programme (booker/admin view). */
export interface SessionSaveUser {
  id: number;
  name: string;
  email: string;
}

/** session_id → kik mentették a programjukba (booker/admin részleteknél). */
export type SessionSavesMap = Record<number, SessionSaveUser[]>;
