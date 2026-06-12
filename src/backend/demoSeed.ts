import type { Pool, PoolConnection } from 'mariadb';
import bcrypt from 'bcrypt';

const USERS = [
  { name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { name: 'Booker', email: 'booker@example.com', password: 'booker123', role: 'booker' },
  { name: 'Attendee', email: 'attendee@example.com', password: 'attendee123', role: 'attendee' },
];

const ROOMS = [
  { id: 1, name: 'Main Hall' },
  { id: 2, name: 'Room A' },
  { id: 3, name: 'Room B' },
  { id: 4, name: 'Workshop' },
  { id: 5, name: 'Outdoor Stage' },
];

const SPEAKERS = [
  { id: 1, name: 'Dr. Anna Kovács', bio: 'Kutató és konferencia-előadó, 15+ év tapasztalattal.' },
  { id: 2, name: 'Péter Nagy', bio: null },
  { id: 3, name: 'Eszter Molnár', bio: null },
  { id: 4, name: 'Balázs Kiss', bio: null },
  { id: 5, name: 'Multiple', bio: null },
];

const SESSIONS = [
  { title: 'Opening Keynote', description: 'Kickoff of EventFlow 2026.', start_time: '2026-03-20 09:00:00', end_time: '2026-03-20 10:30:00', room_id: 1, speaker_id: 1, color: 'blue' },
  { title: 'AI & Society Panel', description: '', start_time: '2026-03-20 11:00:00', end_time: '2026-03-20 12:00:00', room_id: 2, speaker_id: 2, color: 'amber' },
  { title: 'Workshop: Design Sys.', description: 'Hands-on workshop.', start_time: '2026-03-21 13:00:00', end_time: '2026-03-21 15:00:00', room_id: 4, speaker_id: 3, color: 'green' },
  { title: 'Startup Pitches', description: '', start_time: '2026-03-22 14:00:00', end_time: '2026-03-22 16:00:00', room_id: 1, speaker_id: 5, color: 'red' },
  { title: 'Closing Ceremony', description: '', start_time: '2026-03-25 17:00:00', end_time: '2026-03-25 18:00:00', room_id: 1, speaker_id: 1, color: 'blue' },
  { title: 'Tech Talk: Web3', description: '', start_time: '2026-03-23 10:00:00', end_time: '2026-03-23 11:00:00', room_id: 3, speaker_id: 4, color: 'amber' },
  { title: 'EventFlow Expo', description: 'Többnapos kiállítás és networking.', start_time: '2026-03-20 10:00:00', end_time: '2026-03-22 18:00:00', room_id: 1, speaker_id: 1, color: 'green' },
];

async function upsertRoom(conn: PoolConnection, room: { id: number; name: string }) {
  const existing = await conn.query('SELECT id FROM rooms WHERE id = ?', [room.id]);
  if (existing.length) {
    await conn.query('UPDATE rooms SET name = ? WHERE id = ?', [room.name, room.id]);
  } else {
    await conn.query('INSERT INTO rooms (id, name, capacity) VALUES (?, ?, 0)', [room.id, room.name]);
  }
}

async function upsertSpeaker(conn: PoolConnection, sp: { id: number; name: string; bio: string | null }) {
  const existing = await conn.query('SELECT id FROM speakers WHERE id = ?', [sp.id]);
  if (existing.length) {
    await conn.query('UPDATE speakers SET name = ?, bio = ? WHERE id = ?', [sp.name, sp.bio, sp.id]);
  } else {
    await conn.query('INSERT INTO speakers (id, name, bio) VALUES (?, ?, ?)', [sp.id, sp.name, sp.bio]);
  }
}

export interface DemoSeedResult {
  sessionsInserted: number;
  invalidRemoved: number;
  totalSessions: number;
}

export async function runDemoSeed(pool: Pool, forceSessions = false): Promise<DemoSeedResult> {
  const conn = await pool.getConnection();
  try {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, saltRounds);
      const existing = await conn.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length) {
        await conn.query(
          'UPDATE users SET name = ?, password_hash = ?, role = ? WHERE email = ?',
          [u.name, hash, u.role, u.email],
        );
      } else {
        await conn.query(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [u.name, u.email, hash, u.role],
        );
      }
    }

    for (const room of ROOMS) await upsertRoom(conn, room);
    for (const sp of SPEAKERS) await upsertSpeaker(conn, sp);

    const invalid = await conn.query(
      "DELETE FROM sessions WHERE start_time = '0000-00-00 00:00:00' OR end_time = '0000-00-00 00:00:00'",
    );

    const valid = await conn.query(
      "SELECT COUNT(*) AS n FROM sessions WHERE start_time != '0000-00-00 00:00:00'",
    );
    const validCount = Number(valid[0]?.n ?? 0);

    let sessionsInserted = 0;
    if (forceSessions || validCount === 0) {
      if (forceSessions && validCount > 0) {
        await conn.query("DELETE FROM sessions WHERE start_time != '0000-00-00 00:00:00'");
      }
      for (const s of SESSIONS) {
        await conn.query(
          `INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id, color, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
          [s.title, s.description, s.start_time, s.end_time, s.room_id, s.speaker_id, s.color],
        );
        sessionsInserted += 1;
      }
    }

    const total = await conn.query(
      "SELECT COUNT(*) AS n FROM sessions WHERE start_time != '0000-00-00 00:00:00'",
    );

    return {
      sessionsInserted,
      invalidRemoved: Number(invalid.affectedRows ?? 0),
      totalSessions: Number(total[0]?.n ?? 0),
    };
  } finally {
    conn.release();
  }
}
