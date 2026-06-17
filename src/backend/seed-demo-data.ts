/**
 * =============================================================================
 * seed-demo-data.ts — CLI script demo adatok betöltéséhez
 * =============================================================================
 *
 * Futtatás:
 *   npx ts-node src/backend/seed-demo-data.ts
 *   vagy: npm run seed
 *
 * A tényleges logika a demoSeed.ts runDemoSeed() függvényében van.
 * Ez a script csak:
 *  - betölti a .env környezeti változókat
 *  - létrehoz egy MariaDB connection pool-t
 *  - meghívja runDemoSeed()-et
 *  - kiírja az eredményt a konzolra
 *  - lezárja a pool-t
 *
 * Demo bejelentkezések (jelszavak a demoSeed.ts USERS tömbjében):
 *   admin@example.com / admin123
 *   booker@example.com / booker123
 *   attendee@example.com / attendee123
 * =============================================================================
 */

import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import { runDemoSeed } from './demoSeed';

dotenv.config();

/** MariaDB pool — ugyanazok a DB_* env változók, mint a server.ts-ben. */
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'eventflow',
});

/** Fő futtatási logika — hibák esetén process.exit(1). */
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
