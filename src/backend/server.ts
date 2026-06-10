import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import type { Session, SessionSaveUser, SessionSavesMap, Speaker, User, UserRole } from './types';
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

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

const pool: Pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'eventflow',
    connectionLimit: 5,
    timezone: 'Z'
});

const authenticate = createAuthMiddleware(pool);
const requireBookerOrAdmin = requireRoles('booker', 'admin');
const requireAttendee = requireRoles('attendee');

function toSafeUser(row: Record<string, unknown>): User {
    return {
        id: Number(row.id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role).trim().toLowerCase() as UserRole,
    };
}

// --- API VÉGPONTOK ---

// 1. Összes előadás lekérése
// Helper: Date object -> "YYYY-MM-DD HH:mm:ss"
function formatDatetime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function resolveSpeakerId(
    conn: PoolConnection,
    speakerId: number | undefined,
    speakerName: string | undefined,
): Promise<number> {
    const id = Number(speakerId);
    if (Number.isFinite(id) && id > 0) {
        const rows = await conn.query('SELECT id FROM speakers WHERE id = ?', [id]);
        if (rows.length) return Number(rows[0].id);
    }

    const name = speakerName?.trim();
    if (name) {
        const existing = await conn.query('SELECT id FROM speakers WHERE name = ? LIMIT 1', [name]);
        if (existing.length) return Number(existing[0].id);
        const r = await conn.query('INSERT INTO speakers (name) VALUES (?)', [name]);
        const newId = Number(r.insertId);
        if (!Number.isFinite(newId) || newId <= 0) {
            throw new Error(`Speaker insert failed for name: ${name}`);
        }
        return newId;
    }

    return 1;
}

function formatSessionRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => ({
        ...row,
        start_time: row.start_time instanceof Date ? formatDatetime(row.start_time) : row.start_time,
        end_time: row.end_time instanceof Date ? formatDatetime(row.end_time) : row.end_time,
        date: row.start_time instanceof Date
            ? `${row.start_time.getFullYear()}-${String(row.start_time.getMonth() + 1).padStart(2, '0')}-${String(row.start_time.getDate()).padStart(2, '0')}`
            : String(row.start_time).slice(0, 10),
    }));
}

app.get('/api/sessions', async (_req: Request, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const query = `
            SELECT s.*, r.name AS room_name, sp.name AS speaker_name 
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

// 1b. Előadók listája (booker / admin)
app.get('/api/speakers', authenticate, requireBookerOrAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows: Record<string, unknown>[] = await conn.query(
            'SELECT id, name FROM speakers ORDER BY name ASC',
        );
        const speakers: Speaker[] = rows.map((row) => ({
            id: Number(row.id),
            name: String(row.name),
        }));
        res.json(speakers);
    } catch (err) {
        console.error('Speakers list error:', err);
        res.status(500).json({ message: 'Nem sikerült lekérni az előadókat.' });
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
app.post('/api/auth/register', async (req: Request, res: Response) => {
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
app.post('/api/auth/login', async (req: Request, res: Response) => {
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

        const safeUser = toSafeUser(user);
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
app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    res.json(req.authUser);
});

// 3c. Látogató mentett programja
app.get('/api/my-schedule', authenticate, requireAttendee, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows: Record<string, unknown>[] = await conn.query(
            `SELECT s.*, r.name AS room_name, sp.name AS speaker_name
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

    // Érvénytelen dátum ellenőrzése
    if (start_time.startsWith('0000') || end_time.startsWith('0000')) {
        return res.status(400).json({ message: "Érvénytelen dátum!" });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const finalSpeakerId = await resolveSpeakerId(
            conn,
            Number(speaker_id),
            (req.body as { speaker_name?: string }).speaker_name,
        );
        const sql = `
            INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id, color) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(sql, [title, description ?? '', start_time, end_time, room_id, finalSpeakerId, color ?? 'blue']);

        res.status(201).json({ id: result.insertId.toString(), message: "Előadás létrehozva!" });
    } catch (err) {
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

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const finalSpeakerId = await resolveSpeakerId(
            conn,
            Number(speaker_id),
            (req.body as { speaker_name?: string }).speaker_name,
        );
        const result = await conn.query(
            'UPDATE sessions SET title = ?, description = ?, start_time = ?, end_time = ?, room_id = ?, speaker_id = ?, color = ? WHERE id = ?',
            [title, description ?? '', start_time, end_time, room_id, finalSpeakerId, color ?? 'blue', id],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Az előadás nem található." });
        }

        res.json({ message: "Előadás frissítve." });
    } catch (err) {
        console.error("Frissítési hiba:", err);
        res.status(500).json({ message: "Szerver hiba az előadás frissítésekor." });
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

        res.json({ message: "Előadás törölve." });
    } catch (err) {
        console.error("Törlési hiba:", err);
        res.status(500).json({ message: "Szerver hiba a törlés során." });
    } finally {
        if (conn) conn.release();
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
        res.json(rows);
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
        res.json(rows[0]);
    } catch (err) {
        console.error('Admin user update error:', err);
        res.status(500).json({ message: 'Nem sikerült frissíteni a felhasználót.' });
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
app.listen(PORT, () => {
    console.log(`
    🚀 EventFlow Backend fut!
    🌍 URL: http://localhost:${PORT}
    📅 Dátum: ${new Date().toLocaleString('hu-HU')}
    `);
});
