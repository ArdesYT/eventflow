import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as mariadb from 'mariadb';
import type { Pool, PoolConnection } from 'mariadb';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import type { Session, CreateSessionBody } from './types';
import bcrypt from 'bcrypt';

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

// ── 1. Middleware: Verify Token ─────────────────────────────────────────────
// Defined here so it's available for all routes below
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Nincs token, jelentkezz be.' });

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Érvénytelen vagy lejárt token.' });
    req.user = user;
    next();
  });
};


// ── 3. GET /api/sessions — Public route ──────────────────────────────────────
app.get('/api/sessions', async (_req: Request, res: Response) => {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const rows: Session[] = await conn.query(`
      SELECT
        s.id, s.title, s.description,
        DATE_FORMAT(s.start_time, '%Y-%m-%d') AS date,
        DATE_FORMAT(s.start_time, '%H:%i')    AS start_time,
        DATE_FORMAT(s.end_time,   '%H:%i')    AS end_time,
        s.room_id, s.speaker_id,
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
    console.error(err);
    res.status(500).json({ message: 'Szerver hiba.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 4. POST /api/sessions — Protected ────────────────────────────────────────
app.post('/api/sessions', authenticateToken, async (req: Request<{}, {}, CreateSessionBody>, res: Response) => {
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
    res.status(500).json({ message: 'Mentési hiba.' });
  } finally {
    if (conn) conn.release();
  }
});

// ── 5. DELETE /api/sessions/:id — Protected ──────────────────────────────────
app.delete('/api/sessions/:id', authenticateToken, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Hibás ID.' });

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM sessions WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen előadás.' });
    res.json({ message: 'Törölve.' });
  } catch (err) {
    res.status(500).json({ message: 'Törlési hiba.' });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)   return res.status(400).json({ message: 'Name, email and password are required.' });
  else{
    let conn: PoolConnection | undefined;
    try {
      conn = await pool.getConnection();
      const existing = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) return res.status(409).json({ message: 'Email already in use.' });
      
      const password_hash = await bcrypt.hash(password, 10);
      const result = await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, password_hash, role || 'user']
      );
      res.status(201).json({ id: Number(result.insertId), message: 'User registered!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Registration failed.' });
    } finally {
      if (conn) conn.release();
    }
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });
  
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const users = await conn.query('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    if (users.length === 0)
      return res.status(401).json({ message: 'Invalid credentials.' });
    
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '10000d' }
    );
    res.json({ success: true, token, id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed.' });
  } finally {
    if (conn) conn.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EventFlow Backend fut: http://localhost:${PORT}`);
});