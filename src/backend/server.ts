import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import type { Session, UserRole } from './types';

const VALID_ROLES: UserRole[] = ['admin', 'booker', 'attendee'];

async function requireAdmin(
    req: Request,
    res: Response,
): Promise<{ id: number; role: string } | null> {
    const userId = Number(req.headers['x-user-id']);
    if (!userId) {
        res.status(401).json({ message: 'Bejelentkezés szükséges.' });
        return null;
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT id, role FROM users WHERE id = ?',
            [userId],
        );
        if (!rows.length || rows[0].role !== 'admin') {
            res.status(403).json({ message: 'Csak adminisztrátorok számára.' });
            return null;
        }
        return rows[0];
    } finally {
        if (conn) conn.release();
    }
}

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

// --- API VÉGPONTOK ---

// 1. Összes előadás lekérése
// Helper: Date object -> "YYYY-MM-DD HH:mm:ss"
function formatDatetime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
        const rows: any[] = await conn.query(query);

        // MariaDB returns DATETIME columns as JS Date objects.
        // Convert them to plain strings so the frontend gets consistent
        // "YYYY-MM-DD HH:mm:ss" values instead of ISO timestamps.
        const formatted = rows.map(row => ({
            ...row,
            start_time: row.start_time instanceof Date ? formatDatetime(row.start_time) : row.start_time,
            end_time:   row.end_time   instanceof Date ? formatDatetime(row.end_time)   : row.end_time,
            // Derive the date string the frontend uses for calendar grouping
            date: row.start_time instanceof Date
                ? `${row.start_time.getFullYear()}-${String(row.start_time.getMonth() + 1).padStart(2, '0')}-${String(row.start_time.getDate()).padStart(2, '0')}`
                : (row.start_time as string).slice(0, 10),
        }));

        res.json(formatted);
    } catch (err) {
        console.error("Lekérdezési hiba:", err);
        res.status(500).json({ message: "Nem sikerült lekérni az előadásokat." });
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

        const { password_hash, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) {
        console.error("Bejelentkezési hiba:", err);
        res.status(500).json({ message: "Szerver hiba." });
    } finally {
        if (conn) conn.release();
    }
});

// 4. Új előadás hozzáadása
app.post('/api/sessions', async (req: Request<{}, {}, Session>, res: Response) => {
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
        // If the provided speaker_id does not match a speakers row, try to
        // create a speaker from the provided speaker_name (if any). This
        // allows using a user id/name as the booker without failing FK.
        let finalSpeakerId = speaker_id;
        if (speaker_id) {
            const rows = await conn.query('SELECT id FROM speakers WHERE id = ?', [speaker_id]);
            if (!rows.length) {
                // try to create from speaker_name in the body
                const providedName = (req.body as any).speaker_name;
                if (providedName) {
                    const r = await conn.query('INSERT INTO speakers (name) VALUES (?)', [providedName]);
                    finalSpeakerId = r.insertId;
                } else {
                    finalSpeakerId = 1; // fallback to default speaker id
                }
            }
        }
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
app.patch('/api/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, start_time, end_time, room_id, speaker_id, color } = req.body as Session;

    if (!title || !start_time || !end_time) {
        return res.status(400).json({ message: "Hiányzó kötelező adatok!" });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        // If speaker_id doesn't match, allow creating a speaker from speaker_name
        let finalSpeakerId = speaker_id;
        if (speaker_id) {
            const rows = await conn.query('SELECT id FROM speakers WHERE id = ?', [speaker_id]);
            if (!rows.length) {
                const providedName = (req.body as any).speaker_name;
                if (providedName) {
                    const r = await conn.query('INSERT INTO speakers (name) VALUES (?)', [providedName]);
                    finalSpeakerId = r.insertId;
                } else {
                    finalSpeakerId = 1; // fallback to default speaker id
                }
            }
        }
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
app.delete('/api/sessions/:id', async (req: Request, res: Response) => {
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

// 6. Admin — felhasználók listázása
app.get('/api/admin/users', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;

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

// 7. Admin — felhasználó szerepkör módosítása
app.patch('/api/admin/users/:id', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

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

// 8. Admin — felhasználó törlése
app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

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
