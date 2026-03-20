/**
 * Run once to fix the demo user passwords:
 *   npx ts-node seed-passwords.ts
 *
 * Or compile and run:
 *   npx tsc seed-passwords.ts && node seed-passwords.js
 */
import * as mariadb from 'mariadb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = mariadb.createPool({
  host:     process.env.DB_HOST || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'eventflow',
});

const USERS = [
  { email: 'booker@eventflow.hu',   password: 'booker123',   role: 'booker'   },
  { email: 'attendee@eventflow.hu', password: 'attendee123', role: 'attendee' },
];

async function run() {
  const conn = await pool.getConnection();
  try {
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const existing = await conn.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length > 0) {
        await conn.query('UPDATE users SET password_hash = ?, role = ? WHERE email = ?', [hash, u.role, u.email]);
        console.log(`✅ Updated: ${u.email}`);
      } else {
        await conn.query(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [u.email.split('@')[0], u.email, hash, u.role]
        );
        console.log(`✅ Inserted: ${u.email}`);
      }
    }
    console.log('\nDone. You can now log in with the demo credentials.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
