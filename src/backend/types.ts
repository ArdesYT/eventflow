export type EventColor = 'blue' | 'amber' | 'green' | 'red';

export type ViewType = 'calendar' | 'sessions' | 'agenda' | 'stats';

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
  date: string;         // YYYY-MM-DD (parsed from start_time, or its own DB column)
  room_name: string;
  speaker_name: string;
}

// ── Data the frontend submits when creating a booking ─────────────────────────
export interface BookingFormData {
  title: string;
  description: string;
  date: string;
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
  color: EventColor;
}


// ── Auth ──────────────────────────────────────────────
export type UserRole = 'booker' | 'attendee';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AppProps {
  initialUser: User; // Ensure 'User' is imported from your types file
  sessions: Session[];
  loading: boolean;
  error: string | null;
  onCreate: (body: CreateSessionBody) => Promise<void>; // Use CreateSessionBody, not object
  onDelete: (id: number) => Promise<void>;
  onLogout: () => void;
}
