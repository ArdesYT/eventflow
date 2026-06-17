/**
 * =============================================================================
 * dbSchema.ts — Futásidőben futó séma-migrációk (ensure*)
 * =============================================================================
 *
 * A szerver indulásakor (initDatabase) hívódik meg minden ensure* függvény.
 * Cél: régi eventflow.sql dump + új funkciók közötti szakadék pótlása
 * anélkül, hogy külön migrációs CLI-t kellene futtatni.
 *
 * FIGYELEM: Ez NEM helyettesíti a verziózott SQL migrációkat nagy projektnél,
 * de fejlesztés/demo környezetben kényelmes.
 * =============================================================================
 */

import type { Pool, PoolConnection } from 'mariadb';

/**
 * sessions.status oszlop — 'scheduled' | 'cancelled'.
 * Lemondott előadások megmaradnak, de nem ütköznek és szűrhetők.
 */
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

/**
 * user_rooms kapcsolótábla: mely booker mely termeket foglalhatja.
 * Ha üres a booker listája → jelenleg bármely terem engedélyezett (server.ts logika).
 * Demo booker@example.com kap 1. és 2. termet seed-ként.
 */
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

    // Demó booker első indításkor: Main Hall + Room A
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

/**
 * activity_log — admin audit napló (ki mit csinált, mikor).
 * Az admin felület „Audit” fülén jelenik meg.
 */
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

/**
 * events tábla — egy aktív esemény profilja (név, helyszín, dátumok, leírás).
 * GET /api/event → WHERE is_active = 1 LIMIT 1
 *
 * Ha a tábla régi multi-tenant sémából maradt, hiányzó oszlopokat ALTER-rel pótoljuk.
 * Üres DB esetén seed „EventFlow 2026” sor.
 * sessions.event_id oszlop is itt kerül hozzá (jelenleg kevésbé használt).
 */
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

    // Régi events tábla: hiányzó oszlopok hozzáadása (pl. is_active)
    const columnDefs: Record<string, string> = {
      venue: 'ADD COLUMN venue VARCHAR(200) NULL',
      start_date: 'ADD COLUMN start_date DATE NULL',
      end_date: 'ADD COLUMN end_date DATE NULL',
      description: 'ADD COLUMN description TEXT NULL',
      is_active: 'ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
    };
    for (const [column, alter] of Object.entries(columnDefs)) {
      const present = await conn.query('SHOW COLUMNS FROM events LIKE ?', [column]);
      if (!present.length) {
        await conn.query(`ALTER TABLE events ${alter}`);
      }
    }

    // Alapértelmezett esemény, ha üres a tábla
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

    // sessions → event_id FK-szerű kapcsolat (multi-event előkészítés)
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

/**
 * Bookerhez rendelt terem ID-k lekérdezése.
 * @returns room_id tömb növekvő sorrendben
 */
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
