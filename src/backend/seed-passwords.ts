/** Reset demo user passwords with 10 bcrypt rounds: npx ts-node src/backend/seed-passwords.ts */
import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import { DEMO_USERS, upsertDemoUser } from './demoSeed';

dotenv.config();

/** MariaDB pool — .env DB_* változók alapján. */
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'eventflow',
});

/** Minden demo felhasználó jelszavának bcrypt hash-elése és DB-be írása. */
async function run() {
  const conn = await pool.getConnection();
  try {
    for (const user of DEMO_USERS) {
      const action = await upsertDemoUser(conn, user, 10);
      console.log(`✅ ${action}: ${user.email} (${user.role})`);
    }
    console.log('\nDone. Demo logins: admin / booker / attendee @example.com');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
