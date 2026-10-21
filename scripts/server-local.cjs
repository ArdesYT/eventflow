// Explicit local development delivery: reset codes are only exposed to the local browser.
process.env.NODE_ENV = 'development';
process.env.PASSWORD_RESET_DELIVERY = 'console';
process.env.CLIENT_URL ||= 'http://127.0.0.1:5173';
require('ts-node/register/transpile-only');
const { startServer, pool } = require('../src/backend/server.ts');
startServer().catch(() => {
  console.error('EventFlow could not initialize the database schema. Check the database connection and schema permissions.');
  void pool.end();
  process.exitCode = 1;
});
