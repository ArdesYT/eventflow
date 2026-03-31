export type EventColor = 'blue' | 'amber' | 'green' | 'red';
export type ViewType = 'calendar' | 'sessions' | 'agenda' | 'stats';
export type UserRole = 'booker' | 'attendee';

// --- Adatbázis Nyers Sorok ---
export interface SessionRow {
  id: number;
  title: string;
  description?: string;
  start_time: string;   // DB: "YYYY-MM-DD HH:mm:ss"
  end_time: string;     // DB: "YYYY-MM-DD HH:mm:ss"
  room_id: number;
  speaker_id: number;
  color: EventColor;
}

// --- Frontend Kibővített Modell ---
export interface Session extends SessionRow {
  date: string;         // Segédmező: "YYYY-MM-DD"
  room_name: string;    // JOIN-olt érték
  speaker_name: string; // JOIN-olt érték
}

// --- Foglalási Form Adatok ---
export interface BookingFormData {
  title: string;
  description: string;
  date: string;         // HTML date inputhoz
  start_time: string;   // HTML time inputhoz ("HH:mm")
  end_time: string;     // HTML time inputhoz ("HH:mm")
  room_id: number;
  speaker_id: number;
  room_name: string;
  speaker_name: string;
  color: EventColor;
}

// --- API Payload (Amit a POST/PUT küld) ---
export interface CreateSessionBody {
  title: string;
  description?: string;
  start_time: string;   // Már összefűzve: "YYYY-MM-DD HH:mm:ss"
  end_time: string;
  room_id: number;
  speaker_id: number;
  color: EventColor;
}

// --- Felhasználói Típusok ---
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

// --- Naptár Specifikus Típusok ---
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: Session[];
}

export interface NavItem {
  view: ViewType;
  icon: string;
  label: string;
}