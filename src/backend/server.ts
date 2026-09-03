/**
 * =============================================================================
 * server.ts — EventFlow backend belépési pont (Express + MariaDB)
 * =============================================================================
 *
 * Felelősség:
 *  - REST API (/api/*) — előadások, auth, admin, nyilvános esemény
 *  - JWT middleware, szerepkör-ellenőrzés
 *  - MariaDB connection pool
 *  - Production: statikus frontend kiszolgálás (dist/)
 *  - Indításkor: initDatabase() — dbSchema ensure* migrációk
 *
 * Szerepkörök:
 *  - admin: felhasználók, előadók, audit, esemény profil
 *  - booker: foglalás, szerkesztés (saját termekkel korlátozva)
 *  - attendee: mentett program
 *  - vendég: nincs token — csak GET /api/sessions, /api/event
 * =============================================================================
 */

import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import type {
    ActivityAction,
    BulkUpdateSessionsBody,
    CreateSpeakerBody,
    EventProfile,
    MergeSpeakersBody,
    Session,
    SessionSaveUser,
    SessionSavesMap,
    SessionStatus,
    Speaker,
    UpdateEventBody,
    UpdateSpeakerBody,
    User,
    UserRole,
} from './types';
import { runDemoSeed } from './demoSeed';
import {
    ensureActivityLogTable,
    ensureEventsTable,
    ensureSessionStatusColumn,
    ensureUserRoomsTable,
    loadUserRoomIds,
} from './dbSchema';
import { createRateLimiter } from './rateLimit';
import { checkSessionConflicts, sessionFromRow } from './sessionConflicts';
import { resolveSessionSpeakerId } from './sessionSpeaker';
import {
    createAuthMiddleware,
    requireAdmin,
    requireRoles,
    signToken,
    type AuthenticatedRequest,
} from './auth';

const VALID_ROLES: UserRole[] = ['admin', 'booker', 'attendee'];

dotenv.config();

const app = express();

// CORS — production-ban állítsd CLIENT_URL-t a frontend originre
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
// JSON request body parse
app.use(express.json());

/** MariaDB connection pool — max 5 párhuzamos kapcsolat. */
const pool: Pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'eventflow',
    connectionLimit: 5,
    timezone: 'Z'
});

/** Middleware példányok — minden védett útvonalhoz. */
const authenticate = createAuthMiddleware(pool);
const requireBookerOrAdmin = requireRoles('booker', 'admin');
const requireAttendee = requireRoles('attendee');
/** Login/register: max 20 kérés / 15 perc / IP */
const authRateLimit = createRateLimiter(20, 15 * 60 * 1000);

/** Production biztonság: ne induljon gyenge JWT_SECRET-tel. */
if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-change-me')
) {
    console.error('❌ Állítsa be a JWT_SECRET környezeti változót production módban!');
    process.exit(1);
}

/** SQL events sor → EventProfile API válasz (dátumok YYYY-MM-DD). */
function mapEventRow(row: Record<string, unknown>): EventProfile {
    const fmt = (v: unknown) => {
        if (v instanceof Date) {
            return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
        }
        return v != null ? String(v).slice(0, 10) : null;
    };
    return {
        id: Number(row.id),
        name: String(row.name),
        slug: String(row.slug),
        venue: row.venue != null ? String(row.venue) : null,
        start_date: fmt(row.start_date),
        end_date: fmt(row.end_date),
        description: row.description != null ? String(row.description) : null,
        is_active: Boolean(row.is_active),
    };
}

/** "2026-03-20 09:00:00" → "09:00" */
function parseTimeFromDatetime(value: string): string {
    return String(value).match(/(\d{2}:\d{2})/)?.[1] ?? '00:00';
}

/**
 * Szerveroldali ütközésellenőrzés mentés előtt.
 * Dob: ROOM_BUSY | SPEAKER_BUSY — a handler 409/400-gal fordítja.
 */
async function assertNoSessionConflicts(
    conn: PoolConnection,
    candidate: {
        id?: number;
        room_id: number;
        speaker_id: number;
        start_time: string;
        end_time: string;
    },
): Promise<void> {
    const rows: Record<string, unknown>[] = await conn.query(`
        SELECT s.*, r.name AS room_name, sp.name AS speaker_name
        FROM sessions s
        LEFT JOIN rooms r ON s.room_id = r.id
        LEFT JOIN speakers sp ON s.speaker_id = sp.id
        WHERE s.start_time != '0000-00-00 00:00:00'
    `);
    const existing = rows.map(sessionFromRow);
    const date = candidate.start_time.slice(0, 10);
    const endDate = candidate.end_time.slice(0, 10);
    const conflicts = checkSessionConflicts(existing, {
        id: candidate.id,
        room_id: candidate.room_id,
        speaker_id: candidate.speaker_id,
        date,
        end_date: endDate,
        start_time: parseTimeFromDatetime(candidate.start_time),
        end_time: parseTimeFromDatetime(candidate.end_time),
    });
    if (conflicts.roomOverlap || conflicts.roomBuffer) {
        throw new Error('ROOM_BUSY');
    }
    if (conflicts.speakerOverlap) {
        throw new Error('SPEAKER_BUSY');
    }
}

/** users tábla sor → API User (jelszó soha nem megy ki). */
function toSafeUser(row: Record<string, unknown>): User {
    return {
        id: Number(row.id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role).trim().toLowerCase() as UserRole,
    };
}

/** Bookernek hozzácsatolja az assigned_room_ids tömböt (user_rooms). */
async function enrichUser(conn: PoolConnection, user: User): Promise<User> {
    if (user.role === 'booker') {
        const assigned_room_ids = await loadUserRoomIds(conn, user.id);
        if (assigned_room_ids.length) {
            return { ...user, assigned_room_ids };
        }
    }
    return user;
}

/** Audit napló bejegyzés — admin tevékenységek nyomon követése. */
async function logActivity(
    conn: PoolConnection,
    userId: number | null,
    action: ActivityAction,
    entityType: string,
    entityId: number | null,
    details?: Record<string, unknown>,
): Promise<void> {
    await conn.query(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, action, entityType, entityId, details ? JSON.stringify(details) : null],
    );
}

/**
 * Booker csak a hozzárendelt termekbe foglalhat.
 * Ha nincs egyetlen hozzárendelés sem → jelenleg minden terem engedélyezett.
 */
async function assertBookerRoomAccess(
    conn: PoolConnection,
    user: User,
    roomId: number,
): Promise<void> {
    if (user.role !== 'booker') return;
    const allowed = await loadUserRoomIds(conn, user.id);
    if (allowed.length && !allowed.includes(roomId)) {
        throw new Error('ROOM_FORBIDDEN');
    }
}

// =============================================================================
// API VÉGPONTOK — lásd README „API” szekció a teljes listáért
// =============================================================================

/** Health check — frontend backendMode detektáláshoz (db: connected). */
app.get('/api/health', async (_req: Request, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        await conn.query('SELECT 1');
        res.json({ status: 'ok', version: '1.0.0', db: 'connected' });
    } catch {
        res.status(503).json({ status: 'degraded', version: '1.0.0', db: 'disconnected' });
    } finally {
        if (conn) conn.release();
    }
});

/** Nyilvános termek listája — foglalási űrlap dropdown. */
app.get('/api/rooms', async (_req: Request, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT id, name, capacity FROM rooms ORDER BY id ASC');
        res.json(
            rows.map((r: Record<string, unknown>) => ({
                id: Number(r.id),
                name: String(r.name),
                capacity: Number(r.capacity ?? 0),
            })),
        );
    } catch (err) {
        console.error('Rooms list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni a termeket.' });
    } finally {
        if (conn) conn.release();
    }
});

/** Aktív esemény profilja — is_active=1, első sor (egy-eseményes modell). */
app.get('/api/event', async (_req: Request, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT * FROM events WHERE is_active = 1 ORDER BY id ASC LIMIT 1',
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Nincs aktív esemény.' });
        }
        res.json(mapEventRow(rows[0]));
    } catch (err) {
        console.error('Event load error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni az eseményt.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1. Összes előadás lekérése
// Helper: Date object -> "YYYY-MM-DD HH:mm:ss"
function formatDatetime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sliceDatePart(value: unknown): string {
    if (value instanceof Date) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
}

function parseSessionDatetime(value: string): Date | null {
    const d = new Date(value.trim().replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
}

function isValidSessionRange(startTime: string, endTime: string): boolean {
    const start = parseSessionDatetime(startTime);
    const end = parseSessionDatetime(endTime);
    return !!start && !!end && end.getTime() > start.getTime();
}

function formatSessionRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => {
        const startFormatted = row.start_time instanceof Date ? formatDatetime(row.start_time) : row.start_time;
        const endFormatted = row.end_time instanceof Date ? formatDatetime(row.end_time) : row.end_time;
        const date = sliceDatePart(row.start_time);
        const endDate = sliceDatePart(row.end_time);
        const rawStatus = String(row.status ?? 'scheduled').toLowerCase();
        const status: SessionStatus = rawStatus === 'cancelled' ? 'cancelled' : 'scheduled';
        return {
            ...row,
            start_time: startFormatted,
            end_time: endFormatted,
            date,
            end_date: endDate,
            status,
        };
    });
}

// 1. Előadások listája (nyilvános — vendég is eléri)
app.get('/api/sessions', async (_req: Request, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const query = `
            SELECT s.*, r.name AS room_name, sp.name AS speaker_name, sp.bio AS speaker_bio
            FROM sessions s
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            WHERE s.start_time != '0000-00-00 00:00:00'
            ORDER BY s.start_time ASC
        `;
        const rows: Record<string, unknown>[] = await conn.query(query);
        res.json(formatSessionRows(rows));
    } catch (err) {
        console.error("Lekérdezési hiba:", err);
        res.status(500).json({ message: "Nem sikerült lekérni az előadásokat." });
    } finally {
        if (conn) conn.release();
    }
});

function mapSpeakerRow(row: Record<string, unknown>): Speaker {
    return {
        id: Number(row.id),
        name: String(row.name),
        bio: row.bio != null ? String(row.bio) : null,
        session_count: Number(row.session_count ?? 0),
    };
}

const SPEAKERS_LIST_QUERY = `
    SELECT sp.id, sp.name, sp.bio,
           (SELECT COUNT(*) FROM sessions s WHERE s.speaker_id = sp.id) AS session_count
    FROM speakers sp
    ORDER BY sp.name ASC
`;

// 1b. Előadók listája (booker / admin)
app.get('/api/speakers', authenticate, requireBookerOrAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows: Record<string, unknown>[] = await conn.query(SPEAKERS_LIST_QUERY);
        res.json(rows.map(mapSpeakerRow));
    } catch (err) {
        console.error('Speakers list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni az előadókat.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1b2. Új előadó (admin)
app.post('/api/speakers', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { name, bio } = req.body as CreateSpeakerBody;
    const trimmedName = name?.trim();
    if (!trimmedName) {
        return res.status(400).json({ message: 'Az előadó neve kötelező.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const existing = await conn.query('SELECT id FROM speakers WHERE name = ? LIMIT 1', [trimmedName]);
        if (existing.length) {
            return res.status(409).json({ message: 'Már létezik ilyen nevű előadó.' });
        }

        const bioValue = bio?.trim() || null;
        const result = await conn.query(
            'INSERT INTO speakers (name, bio) VALUES (?, ?)',
            [trimmedName, bioValue],
        );
        const newId = Number(result.insertId);
        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT sp.id, sp.name, sp.bio, 0 AS session_count FROM speakers sp WHERE sp.id = ?`,
            [newId],
        );
        res.status(201).json(mapSpeakerRow(rows[0]));
    } catch (err) {
        console.error('Speaker create error:', err);
        res.status(500).json({ message: 'Nem sikerült létrehozni az előadót.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1b3. Előadó szerkesztése (admin)
app.patch('/api/speakers/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, bio } = req.body as UpdateSpeakerBody;

    if (name !== undefined && !name.trim()) {
        return res.status(400).json({ message: 'Az előadó neve nem lehet üres.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();

        if (name !== undefined) {
            const trimmedName = name.trim();
            const duplicate = await conn.query(
                'SELECT id FROM speakers WHERE name = ? AND id != ? LIMIT 1',
                [trimmedName, id],
            );
            if (duplicate.length) {
                return res.status(409).json({ message: 'Már létezik ilyen nevű előadó.' });
            }
        }

        const fields: string[] = [];
        const values: unknown[] = [];
        if (name !== undefined) {
            fields.push('name = ?');
            values.push(name.trim());
        }
        if (bio !== undefined) {
            fields.push('bio = ?');
            values.push(bio?.trim() || null);
        }
        if (!fields.length) {
            return res.status(400).json({ message: 'Nincs módosítandó mező.' });
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE speakers SET ${fields.join(', ')} WHERE id = ?`,
            values,
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Előadó nem található.' });
        }

        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT sp.id, sp.name, sp.bio,
                    (SELECT COUNT(*) FROM sessions s WHERE s.speaker_id = sp.id) AS session_count
             FROM speakers sp WHERE sp.id = ?`,
            [id],
        );
        res.json(mapSpeakerRow(rows[0]));
    } catch (err) {
        console.error('Speaker update error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni az előadót.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1b4a. Duplikált előadók egyesítése (admin)
app.post('/api/speakers/merge', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { keep_id, merge_ids } = req.body as MergeSpeakersBody;
    const keepId = Number(keep_id);
    const ids = Array.isArray(merge_ids) ? merge_ids.map(Number).filter((id) => id > 0 && id !== keepId) : [];

    if (!keepId || ids.length === 0) {
        return res.status(400).json({ message: 'Érvénytelen egyesítési kérés.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const keepRows = await conn.query('SELECT id, name, bio FROM speakers WHERE id = ?', [keepId]);
        if (!keepRows.length) {
            return res.status(404).json({ message: 'A megtartandó előadó nem található.' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const mergeRows = await conn.query(
            `SELECT id, bio FROM speakers WHERE id IN (${placeholders})`,
            ids,
        );
        if (mergeRows.length !== ids.length) {
            return res.status(400).json({ message: 'Egy vagy több egyesítendő előadó nem található.' });
        }

        let keepBio = keepRows[0].bio as string | null;
        for (const row of mergeRows) {
            if (!keepBio && row.bio) keepBio = String(row.bio);
        }
        if (keepBio !== keepRows[0].bio) {
            await conn.query('UPDATE speakers SET bio = ? WHERE id = ?', [keepBio, keepId]);
        }

        await conn.query(
            `UPDATE sessions SET speaker_id = ? WHERE speaker_id IN (${placeholders})`,
            [keepId, ...ids],
        );
        await conn.query(
            `DELETE FROM speakers WHERE id IN (${placeholders})`,
            ids,
        );

        await logActivity(conn, req.authUser!.id, 'speaker.merge', 'speaker', keepId, {
            merge_ids: ids,
            name: keepRows[0].name,
        });

        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT sp.id, sp.name, sp.bio,
                    (SELECT COUNT(*) FROM sessions s WHERE s.speaker_id = sp.id) AS session_count
             FROM speakers sp WHERE sp.id = ?`,
            [keepId],
        );
        res.json({
            speaker: mapSpeakerRow(rows[0]),
            merged_count: ids.length,
        });
    } catch (err) {
        console.error('Speaker merge error:', err);
        res.status(500).json({ message: 'Nem sikerült egyesíteni az előadókat.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1b4. Előadó törlése (admin)
app.delete('/api/speakers/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM speakers WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Előadó nem található.' });
        }
        res.json({ message: 'Előadó törölve.' });
    } catch (err) {
        console.error('Speaker delete error:', err);
        res.status(500).json({ message: 'Nem sikerült törölni az előadót.' });
    } finally {
        if (conn) conn.release();
    }
});

// 1c. Mely látogatók mentették el az előadásokat (booker / admin)
app.get('/api/sessions/saves', authenticate, requireBookerOrAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT us.session_id, u.id, u.name, u.email
             FROM user_schedule us
             JOIN users u ON u.id = us.user_id
             ORDER BY us.session_id ASC, u.name ASC`,
        );

        const saves: SessionSavesMap = {};
        for (const row of rows) {
            const sessionId = Number(row.session_id);
            if (!saves[sessionId]) saves[sessionId] = [];
            saves[sessionId].push({
                id: Number(row.id),
                name: String(row.name),
                email: String(row.email),
            } satisfies SessionSaveUser);
        }

        res.json(saves);
    } catch (err) {
        console.error('Session saves list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni a mentések listáját.' });
    } finally {
        if (conn) conn.release();
    }
});

// 2. Regisztráció
app.post('/api/auth/register', authRateLimit, async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Hiányzó adatok!" });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();

        const existing = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: "Ez az email már regisztrálva van!" });
        }

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await conn.query(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: "Sikeres regisztráció!" });
    } catch (err) {
        console.error("Regisztrációs hiba:", err);
        res.status(500).json({ message: "Hiba történt a mentés során." });
    } finally {
        if (conn) conn.release();
    }
});

// 3. Bejelentkezés
app.post('/api/auth/login', authRateLimit, async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Hiányzó adatok!" });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();

        const rows = await conn.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: "Hibás email vagy jelszó!" });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: "Hibás email vagy jelszó!" });
        }

        const safeUser = await enrichUser(conn, toSafeUser(user));
        const token = signToken(safeUser);
        res.json({ user: safeUser, token });
    } catch (err) {
        console.error("Bejelentkezési hiba:", err);
        res.status(500).json({ message: "Szerver hiba." });
    } finally {
        if (conn) conn.release();
    }
});

// 3b. Aktuális felhasználó (JWT)
app.get('/api/auth/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const user = await enrichUser(conn, req.authUser!);
        res.json(user);
    } catch (err) {
        console.error('Auth me error:', err);
        res.status(500).json({ message: 'Szerver hiba.' });
    } finally {
        if (conn) conn.release();
    }
});

// 3c. Látogató mentett programja
app.get('/api/my-schedule', authenticate, requireAttendee, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT s.*, r.name AS room_name, sp.name AS speaker_name, sp.bio AS speaker_bio
             FROM user_schedule us
             JOIN sessions s ON s.id = us.session_id
             LEFT JOIN rooms r ON s.room_id = r.id
             LEFT JOIN speakers sp ON s.speaker_id = sp.id
             WHERE us.user_id = ? AND s.start_time != '0000-00-00 00:00:00'
             ORDER BY s.start_time ASC`,
            [userId],
        );
        res.json(formatSessionRows(rows));
    } catch (err) {
        console.error('My schedule list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni a mentett programot.' });
    } finally {
        if (conn) conn.release();
    }
});

// 3d. Előadás mentése a személyes programba (látogató)
app.post('/api/my-schedule/:sessionId', authenticate, requireAttendee, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const sessionId = Number(req.params.sessionId);
    if (!sessionId) {
        return res.status(400).json({ message: 'Érvénytelen előadás azonosító.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const sessions = await conn.query('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        if (!sessions.length) {
            return res.status(404).json({ message: 'Az előadás nem található.' });
        }

        await conn.query(
            'INSERT IGNORE INTO user_schedule (user_id, session_id) VALUES (?, ?)',
            [userId, sessionId],
        );
        res.status(201).json({ message: 'Előadás mentve a programba.' });
    } catch (err) {
        console.error('My schedule add error:', err);
        res.status(500).json({ message: 'Nem sikerült menteni az előadást.' });
    } finally {
        if (conn) conn.release();
    }
});

// 3e. Előadás eltávolítása a személyes programból (látogató)
app.delete('/api/my-schedule/:sessionId', authenticate, requireAttendee, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const sessionId = Number(req.params.sessionId);
    if (!sessionId) {
        return res.status(400).json({ message: 'Érvénytelen előadás azonosító.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'DELETE FROM user_schedule WHERE user_id = ? AND session_id = ?',
            [userId, sessionId],
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Az előadás nincs a mentett programban.' });
        }
        res.json({ message: 'Előadás eltávolítva a programból.' });
    } catch (err) {
        console.error('My schedule remove error:', err);
        res.status(500).json({ message: 'Nem sikerült eltávolítani az előadást.' });
    } finally {
        if (conn) conn.release();
    }
});

// 4. Új előadás hozzáadása
app.post('/api/sessions', authenticate, requireBookerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { title, description, start_time, end_time, room_id, speaker_id, color } = req.body;

    if (!title || !start_time || !end_time) {
        return res.status(400).json({ message: "Hiányzó kötelező adatok!" });
    }

    if (start_time.startsWith('0000') || end_time.startsWith('0000')) {
        return res.status(400).json({ message: "Érvénytelen dátum!" });
    }
    if (!isValidSessionRange(start_time, end_time)) {
        return res.status(400).json({ message: 'A befejezés időpontjának a kezdés után kell lennie.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        await assertBookerRoomAccess(conn, req.authUser!, Number(room_id));
        const finalSpeakerId = await resolveSessionSpeakerId(conn, Number(speaker_id));
        await assertNoSessionConflicts(conn, {
            room_id: Number(room_id),
            speaker_id: finalSpeakerId,
            start_time,
            end_time,
        });
        const sql = `
            INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id, color) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(sql, [title, description ?? '', start_time, end_time, room_id, finalSpeakerId, color ?? 'blue']);
        const newId = Number(result.insertId);
        await logActivity(conn, req.authUser!.id, 'session.create', 'session', newId, { title });

        res.status(201).json({ id: String(newId), message: "Előadás létrehozva!" });
    } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_SPEAKER') {
            return res.status(400).json({ message: 'Csak meglévő előadó választható.' });
        }
        if (err instanceof Error && err.message === 'ROOM_FORBIDDEN') {
            return res.status(403).json({ message: 'Nincs jogosultsága ehhez a teremhez.' });
        }
        if (err instanceof Error && err.message === 'ROOM_BUSY') {
            return res.status(409).json({ message: 'A kiválasztott terem foglalt a megadott időben.' });
        }
        if (err instanceof Error && err.message === 'SPEAKER_BUSY') {
            return res.status(409).json({ message: 'Az előadó már foglalt ebben az időben.' });
        }
        console.error("Admin mentési hiba:", err);
        res.status(500).json({ message: "Szerver hiba az előadás mentésekor." });
    } finally {
        if (conn) conn.release();
    }
});

// 5. Előadás frissítése
app.patch('/api/sessions/:id', authenticate, requireBookerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { title, description, start_time, end_time, room_id, speaker_id, color } = req.body as Session;

    if (!title || !start_time || !end_time) {
        return res.status(400).json({ message: "Hiányzó kötelező adatok!" });
    }
    if (!isValidSessionRange(start_time, end_time)) {
        return res.status(400).json({ message: 'A befejezés időpontjának a kezdés után kell lennie.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        await assertBookerRoomAccess(conn, req.authUser!, Number(room_id));
        const finalSpeakerId = await resolveSessionSpeakerId(conn, Number(speaker_id));
        await assertNoSessionConflicts(conn, {
            id: Number(id),
            room_id: Number(room_id),
            speaker_id: finalSpeakerId,
            start_time,
            end_time,
        });
        const result = await conn.query(
            'UPDATE sessions SET title = ?, description = ?, start_time = ?, end_time = ?, room_id = ?, speaker_id = ?, color = ? WHERE id = ?',
            [title, description ?? '', start_time, end_time, room_id, finalSpeakerId, color ?? 'blue', id],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Az előadás nem található." });
        }

        await logActivity(conn, req.authUser!.id, 'session.update', 'session', Number(id), { title });
        res.json({ message: "Előadás frissítve." });
    } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_SPEAKER') {
            return res.status(400).json({ message: 'Csak meglévő előadó választható.' });
        }
        if (err instanceof Error && err.message === 'ROOM_FORBIDDEN') {
            return res.status(403).json({ message: 'Nincs jogosultsága ehhez a teremhez.' });
        }
        if (err instanceof Error && err.message === 'ROOM_BUSY') {
            return res.status(409).json({ message: 'A kiválasztott terem foglalt a megadott időben.' });
        }
        if (err instanceof Error && err.message === 'SPEAKER_BUSY') {
            return res.status(409).json({ message: 'Az előadó már foglalt ebben az időben.' });
        }
        console.error("Frissítési hiba:", err);
        res.status(500).json({ message: "Szerver hiba az előadás frissítésekor." });
    } finally {
        if (conn) conn.release();
    }
});

// 5b. Előadás státusz (lemondás / visszaállítás)
app.patch('/api/sessions/:id/status', authenticate, requireBookerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status?: SessionStatus };
    if (status !== 'scheduled' && status !== 'cancelled') {
        return res.status(400).json({ message: 'Érvénytelen státusz.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('UPDATE sessions SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Az előadás nem található.' });
        }
        await logActivity(
            conn,
            req.authUser!.id,
            status === 'cancelled' ? 'session.cancel' : 'session.restore',
            'session',
            Number(id),
            { status },
        );
        res.json({ message: status === 'cancelled' ? 'Előadás lemondva.' : 'Előadás visszaállítva.', status });
    } catch (err) {
        console.error('Session status error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni a státuszt.' });
    } finally {
        if (conn) conn.release();
    }
});

// 6. Előadás törlése
app.delete('/api/sessions/:id', authenticate, requireBookerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query("DELETE FROM sessions WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Az előadás nem található." });
        }

        await logActivity(conn, req.authUser!.id, 'session.delete', 'session', Number(id));
        res.json({ message: "Előadás törölve." });
    } catch (err) {
        console.error("Törlési hiba:", err);
        res.status(500).json({ message: "Szerver hiba a törlés során." });
    } finally {
        if (conn) conn.release();
    }
});

// 6a. Tömeges előadás módosítás (dátum eltolás / terem)
app.patch('/api/sessions/bulk', authenticate, requireBookerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { ids, date_offset_days, room_id } = req.body as BulkUpdateSessionsBody;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Nincs kiválasztott előadás.' });
    }
    const offset = Number(date_offset_days ?? 0);
    const newRoomId = room_id != null ? Number(room_id) : null;
    if (offset === 0 && newRoomId == null) {
        return res.status(400).json({ message: 'Nincs módosítandó mező.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        if (newRoomId != null) {
            await assertBookerRoomAccess(conn, req.authUser!, newRoomId);
        }

        const placeholders = ids.map(() => '?').join(',');
        const rows = await conn.query(
            `SELECT id, start_time, end_time, room_id FROM sessions WHERE id IN (${placeholders})`,
            ids,
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Nem található előadás.' });
        }

        for (const row of rows) {
            const sessionRoomId = Number(row.room_id);
            if (newRoomId != null) {
                await assertBookerRoomAccess(conn, req.authUser!, sessionRoomId);
            }
            let start = row.start_time instanceof Date ? row.start_time : new Date(String(row.start_time).replace(' ', 'T'));
            let end = row.end_time instanceof Date ? row.end_time : new Date(String(row.end_time).replace(' ', 'T'));
            if (offset !== 0) {
                start = new Date(start.getTime() + offset * 86400000);
                end = new Date(end.getTime() + offset * 86400000);
            }
            const nextRoom = newRoomId ?? sessionRoomId;
            await conn.query(
                'UPDATE sessions SET start_time = ?, end_time = ?, room_id = ? WHERE id = ?',
                [formatDatetime(start), formatDatetime(end), nextRoom, row.id],
            );
        }

        await logActivity(conn, req.authUser!.id, 'session.bulk_update', 'session', null, {
            ids,
            date_offset_days: offset,
            room_id: newRoomId,
        });

        res.json({ message: 'Előadások frissítve.', updated: rows.length });
    } catch (err) {
        if (err instanceof Error && err.message === 'ROOM_FORBIDDEN') {
            return res.status(403).json({ message: 'Nincs jogosultsága ehhez a teremhez.' });
        }
        console.error('Bulk session update error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni az előadásokat.' });
    } finally {
        if (conn) conn.release();
    }
});

// 6b. Admin — demo adatok betöltése
app.post('/api/admin/seed-demo', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const force = !!(req.body as { force?: boolean }).force;
    try {
        await ensureSessionStatusColumn(pool);
        const result = await runDemoSeed(pool, force);
        res.json(result);
    } catch (err) {
        console.error('Demo seed error:', err);
        res.status(500).json({ message: 'Nem sikerült betölteni a demo adatokat.' });
    }
});

// 7. Admin — felhasználók listázása
app.get('/api/admin/users', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT id, name, email, role FROM users ORDER BY id ASC',
        );
        const users: User[] = [];
        for (const row of rows) {
            const user = await enrichUser(conn, toSafeUser(row));
            users.push(user);
        }
        res.json(users);
    } catch (err) {
        console.error('Admin users list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni a felhasználókat.' });
    } finally {
        if (conn) conn.release();
    }
});

// 8. Admin — felhasználó szerepkör módosítása
app.patch('/api/admin/users/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const admin = req.authUser!;
    const { id } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
        return res.status(400).json({ message: 'Érvénytelen szerepkör.' });
    }

    if (Number(id) === admin.id && role !== 'admin') {
        return res.status(400).json({ message: 'Saját admin jogosultság nem vonható vissza.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, id],
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Felhasználó nem található.' });
        }
        const rows = await conn.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [id],
        );
        await logActivity(conn, admin.id, 'user.role_change', 'user', Number(id), { role });
        const user = await enrichUser(conn, toSafeUser(rows[0]));
        res.json(user);
    } catch (err) {
        console.error('Admin user update error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni a felhasználót.' });
    } finally {
        if (conn) conn.release();
    }
});

// 8b. Admin — booker termek hozzárendelése
app.put('/api/admin/users/:id/rooms', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { room_ids } = req.body as { room_ids?: number[] };
    if (!Array.isArray(room_ids)) {
        return res.status(400).json({ message: 'Érvénytelen termek listája.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const users = await conn.query('SELECT id, role FROM users WHERE id = ?', [id]);
        if (!users.length) {
            return res.status(404).json({ message: 'Felhasználó nem található.' });
        }
        if (String(users[0].role) !== 'booker') {
            return res.status(400).json({ message: 'Csak szervezőhöz rendelhető terem.' });
        }

        await conn.query('DELETE FROM user_rooms WHERE user_id = ?', [id]);
        for (const roomId of room_ids) {
            await conn.query('INSERT INTO user_rooms (user_id, room_id) VALUES (?, ?)', [id, roomId]);
        }

        await logActivity(conn, req.authUser!.id, 'user.rooms_update', 'user', Number(id), { room_ids });

        const rows = await conn.query('SELECT id, name, email, role FROM users WHERE id = ?', [id]);
        const user = await enrichUser(conn, toSafeUser(rows[0]));
        res.json(user);
    } catch (err) {
        console.error('Admin user rooms error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni a termeket.' });
    } finally {
        if (conn) conn.release();
    }
});

// 8c. Admin — audit napló
app.get('/api/admin/activity-log', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
            SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
                   u.name AS user_name
            FROM activity_log a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT 100
        `);
        res.json(
            rows.map((r: Record<string, unknown>) => ({
                id: Number(r.id),
                user_id: r.user_id != null ? Number(r.user_id) : null,
                user_name: r.user_name != null ? String(r.user_name) : null,
                action: String(r.action),
                entity_type: String(r.entity_type),
                entity_id: r.entity_id != null ? Number(r.entity_id) : null,
                details: r.details != null ? String(r.details) : null,
                created_at: r.created_at instanceof Date
                    ? formatDatetime(r.created_at)
                    : String(r.created_at),
            })),
        );
    } catch (err) {
        console.error('Activity log error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni a naplót.' });
    } finally {
        if (conn) conn.release();
    }
});

// 8d. Admin — esemény profil
app.patch('/api/admin/event', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as UpdateEventBody;
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT id FROM events WHERE is_active = 1 ORDER BY id ASC LIMIT 1',
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Nincs aktív esemény.' });
        }
        const eventId = Number(rows[0].id);
        const current = await conn.query('SELECT * FROM events WHERE id = ?', [eventId]);
        const cur = current[0];
        const name = body.name?.trim() || String(cur.name);
        const venue = body.venue !== undefined ? body.venue : cur.venue;
        const start_date = body.start_date !== undefined ? body.start_date : cur.start_date;
        const end_date = body.end_date !== undefined ? body.end_date : cur.end_date;
        const description = body.description !== undefined ? body.description : cur.description;

        await conn.query(
            'UPDATE events SET name = ?, venue = ?, start_date = ?, end_date = ?, description = ? WHERE id = ?',
            [name, venue, start_date, end_date, description, eventId],
        );
        await logActivity(conn, req.authUser!.id, 'session.update', 'event', eventId, { name });

        const updated = await conn.query('SELECT * FROM events WHERE id = ?', [eventId]);
        res.json(mapEventRow(updated[0]));
    } catch (err) {
        console.error('Event update error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni az eseményt.' });
    } finally {
        if (conn) conn.release();
    }
});

// 9. Admin — felhasználó törlése
app.delete('/api/admin/users/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const admin = req.authUser!;
    const { id } = req.params;
    if (Number(id) === admin.id) {
        return res.status(400).json({ message: 'Saját fiók nem törölhető.' });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Felhasználó nem található.' });
        }
        await logActivity(conn, admin.id, 'user.delete', 'user', Number(id));
        res.json({ message: 'Felhasználó törölve.' });
    } catch (err) {
        console.error('Admin user delete error:', err);
        res.status(500).json({ message: 'Nem sikerült törölni a felhasználót.' });
    } finally {
        if (conn) conn.release();
    }
});

// Szerver indítása
const PORT = process.env.PORT || 3000;

async function logSessionCountHint(): Promise<void> {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT COUNT(*) AS n FROM sessions WHERE start_time != '0000-00-00 00:00:00'",
        );
        const n = Number(rows[0]?.n ?? 0);
        if (n === 0) {
            console.log('⚠️  Nincs érvényes előadás az adatbázisban. Futtasd: npm run seed');
        }
    } catch {
        /* DB not ready yet */
    } finally {
        if (conn) conn.release();
    }
}

if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../../dist');
    app.use(express.static(distPath));
    // SPA fallback — nem-API útvonalaknál index.html (React Router)
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

export async function initDatabase(): Promise<void> {
    /** Párhuzamosan futtatjuk az összes séma-ensure lépést induláskor. */
    await Promise.all([
        ensureSessionStatusColumn(pool),
        ensureUserRoomsTable(pool),
        ensureActivityLogTable(pool),
        ensureEventsTable(pool),
    ]);
}

export { app, pool };

void initDatabase().then(() => {
    app.listen(PORT, () => {
        const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        console.log(`
    🚀 EventFlow Backend fut! (${mode})
    🌍 URL: http://localhost:${PORT}
    📅 Dátum: ${new Date().toLocaleString('hu-HU')}
    `);
        void logSessionCountHint();
    });
});
