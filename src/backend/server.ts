import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb'; // Így lesz jó a 3. sor!
// Pool helyett PoolConnection-t is importálunk
import type { Pool, PoolConnection } from 'mariadb';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import type { Session } from './types'; // Feltételezve, hogy a types.ts létezik

dotenv.config();

const app = express();

// Middleware-ek
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// MariaDB Kapcsolati Pool konfiguráció
const pool: Pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '', // XAMPP esetén üres
    database: process.env.DB_NAME || 'eventflow',
    connectionLimit: 5,
    timezone: 'Z'
});

// --- API VÉGPONTOK ---

// 1. Összes előadás lekérése (Látogatói modul)
app.get('/api/sessions', async (_req: Request, res: Response) => {
    // Connection helyett PoolConnection
let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const query = `
            SELECT s.*, r.name AS room_name, sp.name AS speaker_name 
            FROM sessions s
            LEFT JOIN rooms r ON s.room_id = r.id
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            ORDER BY s.start_time ASC
        `;
        const rows: Session[] = await conn.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Lekérdezési hiba:", err);
        res.status(500).json({ message: "Nem sikerült lekérni az előadásokat." });
    } finally {
        if (conn) conn.release();
    }
});

// 2. Regisztráció (Auth modul)
app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Hiányzó adatok!" });
    }

    // Connection helyett PoolConnection
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();

        // Email ellenőrzése
        const existing = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: "Ez az email már regisztrálva van!" });
        }

        // Jelszó hashelése
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

// 3. Új előadás hozzáadása (Admin modul)
app.post('/api/sessions', async (req: Request<{}, {}, Session>, res: Response) => {
    const { title, description, start_time, end_time, room_id, speaker_id } = req.body;

    // Connection helyett PoolConnection
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const sql = `
            INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(sql, [title, description, start_time, end_time, room_id, speaker_id]);
        
        res.status(201).json({ id: result.insertId.toString(), message: "Előadás létrehozva!" });
    } catch (err) {
        console.error("Admin mentési hiba:", err);
        res.status(500).json({ message: "Szerver hiba az előadás mentésekor." });
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