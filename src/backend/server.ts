import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import type { Session } from './types';

dotenv.config();

const app = express();

// In production (Back4App) the React app is served from the same origin,
// so we allow the CLIENT_URL env var or fall back to all origins in dev.
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Serve the compiled React frontend from the /public folder
const PUBLIC_DIR = path.join(__dirname, '../../public');
app.use(express.static(PUBLIC_DIR));

const pool: Pool = mariadb.createPool({
    host:            process.env.DB_HOST     || 'localhost',
    port:            Number(process.env.DB_PORT) || 3306,
    user:            process.env.DB_USER     || 'root',
    password:        process.env.DB_PASS     || '',
    database:        process.env.DB_NAME     || 'eventflow',
    connectionLimit: 5,
});

// --- SEGÉDFÜGGVÉNYEK ---

function formatDatetime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- API VÉGPONTOK ---

// 1. Összes előadás lekérése
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

        const formatted = rows.map(row => {
            const start = row.start_time instanceof Date ? row.start_time : new Date(row.start_time);
            const end   = row.end_time   instanceof Date ? row.end_time   : new Date(row.end_time);
            return {
                ...row,
                start_time: formatDatetime(start),
                end_time:   formatDatetime(end),
                date:       formatDate(start),
            };
        });

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
        res.json({ user: safeUser });
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

    if (start_time.startsWith('0000') || end_time.startsWith('0000')) {
        return res.status(400).json({ message: "Érvénytelen dátum!" });
    }

    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const sql = `
            INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id, color) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(sql, [
            title,
            description ?? '',
            start_time,
            end_time,
            room_id,
            speaker_id,
            color ?? 'blue'
        ]);

        res.status(201).json({ id: result.insertId.toString(), message: "Előadás létrehozva!" });
    } catch (err) {
        console.error("Admin mentési hiba:", err);
        res.status(500).json({ message: "Szerver hiba az előadás mentésekor." });
    } finally {
        if (conn) conn.release();
    }
});

// 5. Előadás törlése
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

// Catch-all: send React's index.html for any non-API route (client-side routing)
app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const port = process.env.PORT ?? 8080;
    app.listen(port, () => console.log(`Listening on ${port}`));