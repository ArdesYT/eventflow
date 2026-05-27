/**
 * Run once to fix the demo user passwords:
 *   npx ts-node src/backend/seed-passwords.ts
 */
import * as mariadb from 'mariadb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'eventflow',
});

const USERS = [
  { name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { name: 'Booker', email: 'booker@example.com', password: 'booker123', role: 'booker' },
  { name: 'Attendee', email: 'attendee@example.com', password: 'attendee123', role: 'attendee' },
];

async function run() {
  const conn = await pool.getConnection();
  try {
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const existing = await conn.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length > 0) {
        await conn.query(
          'UPDATE users SET name = ?, password_hash = ?, role = ? WHERE email = ?',
          [u.name, hash, u.role, u.email],
        );
        console.log(`✅ Updated: ${u.email} (${u.role})`);
      } else {
        await conn.query(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [u.name, u.email, hash, u.role],
        );
        console.log(`✅ Inserted: ${u.email} (${u.role})`);
      }
    }
    console.log('\nDone. Demo logins: admin / booker / attendee @example.com');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
