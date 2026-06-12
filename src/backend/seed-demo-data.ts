/**
 * Demo rooms, speakers, users and sessions for development.
 *   npx ts-node src/backend/seed-demo-data.ts
 */
import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import { runDemoSeed } from './demoSeed';

dotenv.config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'eventflow',
});

async function run() {
  try {
    const result = await runDemoSeed(pool);
    console.log('✅ Demo users, rooms and speakers ready');
    if (result.invalidRemoved > 0) {
      console.log(`🗑️  Removed ${result.invalidRemoved} invalid session(s)`);
    }
    if (result.sessionsInserted > 0) {
      console.log(`✅ Inserted ${result.sessionsInserted} demo sessions`);
    } else {
      console.log('ℹ️  Valid sessions already exist — skipped session insert');
    }
    console.log(`\nDone. ${result.totalSessions} session(s) available at GET /api/sessions`);
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
