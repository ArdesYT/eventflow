import express from 'express';
import type { Request, Response } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcrypt';
import type { Session, CreateSessionBody } from './types';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

const pool: Pool = mariadb.createPool({
  host:            process.env.DB_HOST || 'localhost',
  port:            Number(process.env.DB_PORT) || 3306,
  user:            process.env.DB_USER || 'root',
  password:        process.env.DB_PASS || '',
  database:        process.env.DB_NAME || 'eventflow',
  connectionLimit: 5,
});

// ── 1. GET /api/sessions — all sessions (joined) ──────────────────────────────
app.get('/api/sessions', async (_req: Request, res: Response) => {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const rows: Session[] = await conn.query(`
      SELECT
        s.id,
        s.title,
        s.description,
        DATE_FORMAT(s.start_time, '%Y-%m-%d') AS date,
        DATE_FORMAT(s.start_time, '%H:%i')    AS start_time,
        DATE_FORMAT(s.end_time,   '%H:%i')    AS end_time,
        s.room_id,
        s.speaker_id,
        COALESCE(s.color, 'blue') AS color,
        r.name  AS room_name,
        sp.name AS speaker_name
      FROM sessions s
      LEFT JOIN rooms    r  ON s.room_id    = r.id
      LEFT JOIN speakers sp ON s.speaker_id = sp.id
      ORDER BY s.start_time ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/sessions error:', err);
    res.status(500).json({ message: 'Nem sikerült lekérni az előadásokat.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 2. POST /api/sessions — create a session ──────────────────────────────────
app.post('/api/sessions', async (req: Request<{}, {}, CreateSessionBody>, res: Response) => {
  const { title, description, start_time, end_time, room_id, speaker_id, color } = req.body;

  if (!title || !start_time || !end_time || !room_id || !speaker_id) {
    return res.status(400).json({ message: 'Hiányzó mezők.' });
  }

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      `INSERT INTO sessions (title, description, start_time, end_time, room_id, speaker_id, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description ?? '', start_time, end_time, room_id, speaker_id, color ?? 'blue']
    );
    res.status(201).json({ id: Number(result.insertId), message: 'Előadás létrehozva!' });
  } catch (err) {
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ message: 'Szerver hiba az előadás mentésekor.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 3. DELETE /api/sessions/:id — remove a session ───────────────────────────
app.delete('/api/sessions/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Érvénytelen azonosító.' });

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM sessions WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Az előadás nem található.' });
    }
    res.json({ message: 'Előadás törölve.' });
  } catch (err) {
    console.error('DELETE /api/sessions/:id error:', err);
    res.status(500).json({ message: 'Szerver hiba a törlés során.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 4. POST /api/auth/login — check credentials, return user + role ───────────
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Hiányzó adatok.' });
  }

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    // Expect a `users` table with columns: id, name, email, password_hash, role
    const rows = await conn.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Hibás email vagy jelszó.' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Hibás email vagy jelszó.' });
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ message: 'Szerver hiba bejelentkezéskor.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 5. POST /api/auth/register ────────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Hiányzó adatok.' });
  }

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const existing = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Ez az email már regisztrálva van.' });
    }
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await conn.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role ?? 'attendee']
    );
    res.status(201).json({ message: 'Sikeres regisztráció!' });
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ message: 'Hiba a mentés során.' });
  } finally {
    if (conn) conn.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 EventFlow Backend fut!
  🌍 URL: http://localhost:${PORT}
  📅 Dátum: ${new Date().toLocaleString('hu-HU')}
  `);
});
