import type { Pool, PoolConnection } from 'mariadb';

export async function ensureSessionStatusColumn(pool: Pool): Promise<void> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const cols = await conn.query("SHOW COLUMNS FROM sessions LIKE 'status'");
    if (!cols.length) {
      await conn.query(
        "ALTER TABLE sessions ADD COLUMN status ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled'",
      );
    }
  } catch (err) {
    console.error('Schema migration (sessions.status) failed:', err);
  } finally {
    if (conn) conn.release();
  }
}

export async function ensureUserRoomsTable(pool: Pool): Promise<void> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_rooms (
        user_id INT NOT NULL,
        room_id INT NOT NULL,
        PRIMARY KEY (user_id, room_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const booker = await conn.query(
      "SELECT id FROM users WHERE email = 'booker@example.com' LIMIT 1",
    );
    if (booker.length) {
      const bookerId = Number(booker[0].id);
      const existing = await conn.query(
        'SELECT room_id FROM user_rooms WHERE user_id = ?',
        [bookerId],
      );
      if (!existing.length) {
        await conn.query('INSERT INTO user_rooms (user_id, room_id) VALUES (?, ?), (?, ?)', [
          bookerId, 1, bookerId, 2,
        ]);
      }
    }
  } catch (err) {
    console.error('Schema migration (user_rooms) failed:', err);
  } finally {
    if (conn) conn.release();
  }
}

export async function ensureActivityLogTable(pool: Pool): Promise<void> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(64) NOT NULL,
        entity_type VARCHAR(64) NOT NULL,
        entity_id INT NULL,
        details TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.error('Schema migration (activity_log) failed:', err);
  } finally {
    if (conn) conn.release();
  }
}

export async function ensureEventsTable(pool: Pool): Promise<void> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        venue VARCHAR(200) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const existing = await conn.query('SELECT id FROM events LIMIT 1');
    if (!existing.length) {
      await conn.query(
        `INSERT INTO events (name, slug, venue, start_date, end_date, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          'EventFlow 2026',
          'eventflow-2026',
          'Budapest Congress Center',
          '2026-03-20',
          '2026-03-25',
          'Az esemény hivatalos programja és előadásai.',
        ],
      );
    }

    const cols = await conn.query("SHOW COLUMNS FROM sessions LIKE 'event_id'");
    if (!cols.length) {
      const ev = await conn.query('SELECT id FROM events ORDER BY id ASC LIMIT 1');
      const eventId = Number(ev[0]?.id ?? 1);
      await conn.query(
        `ALTER TABLE sessions ADD COLUMN event_id INT NULL DEFAULT ${eventId}`,
      );
      await conn.query('UPDATE sessions SET event_id = ? WHERE event_id IS NULL', [eventId]);
    }
  } catch (err) {
    console.error('Schema migration (events) failed:', err);
  } finally {
    if (conn) conn.release();
  }
}

export async function loadUserRoomIds(
  conn: PoolConnection,
  userId: number,
): Promise<number[]> {
  const rows = await conn.query(
    'SELECT room_id FROM user_rooms WHERE user_id = ? ORDER BY room_id ASC',
    [userId],
  );
  return rows.map((r: { room_id: number }) => Number(r.room_id));
}
