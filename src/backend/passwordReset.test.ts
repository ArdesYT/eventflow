import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Pool } from 'mariadb';
import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware, signToken, verifyToken } from './auth';
import {
  createPasswordResetRepository,
  createPasswordResetRouter,
  ensurePasswordResetSchema,
  hashResetCode,
  hashResetToken,
  localResetDeliveryFromEnv,
  PasswordResetService,
  RESET_REQUEST_COOLDOWN_MS,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_TOKEN_TTL_MS,
} from './passwordReset';

interface MemoryUser { id: number; name: string; email: string; role: 'attendee'; password_hash: string; auth_version: number }
interface MemoryToken { user_id: number; token_hash: string; issued_at: number; expires_at: number; stage: 'code' | 'verified'; attempt_count: number }

/** Transactional SQL double: user-row locks serialize concurrent real repository calls. */
function memoryPool(initialHash: string) {
  const state: { user: MemoryUser; token: MemoryToken | null } = {
    user: { id: 1, name: '<Ada & test>', email: 'ada@example.com', role: 'attendee', password_hash: initialHash, auth_version: 0 },
    token: null,
  };
  let lockTail = Promise.resolve();
  let failUpdate = false;
  let commits = 0;
  let rollbacks = 0;
  const pool = {
    async getConnection() {
      let snapshot: typeof state | null = null;
      let unlock: (() => void) | null = null;
      const view = () => snapshot ?? state;
      async function lockUser() {
        const previous = lockTail;
        lockTail = new Promise<void>(resolve => { unlock = resolve; });
        await previous;
        snapshot = structuredClone(state);
      }
      return {
        async beginTransaction() {},
        async commit() {
          if (snapshot) Object.assign(state, snapshot);
          snapshot = null;
          unlock?.();
          unlock = null;
          commits += 1;
        },
        async rollback() {
          snapshot = null;
          unlock?.();
          unlock = null;
          rollbacks += 1;
        },
        release() { assert.equal(snapshot, null, 'Every write transaction must commit or roll back'); },
        async query(sqlValue: string, values: unknown[] = []) {
          const sql = sqlValue.replace(/\s+/g, ' ').trim();
          if (sql === 'SELECT id FROM users WHERE email = ? FOR UPDATE') {
            if (state.user.email !== values[0]) return [];
            await lockUser();
            return [{ id: view().user.id }];
          }
          if (sql === 'SELECT id FROM users WHERE id = ? FOR UPDATE') {
            await lockUser();
            return values[0] === view().user.id ? [{ id: view().user.id }] : [];
          }
          if (sql === 'SELECT issued_at FROM password_reset_tokens WHERE user_id = ?') {
            return view().token ? [{ issued_at: view().token!.issued_at }] : [];
          }
          if (sql.startsWith('INSERT INTO password_reset_tokens')) {
            view().token = { user_id: Number(values[0]), token_hash: String(values[1]), issued_at: Number(values[2]), expires_at: Number(values[3]), stage: 'code', attempt_count: 0 };
            return { affectedRows: 1 };
          }
          if (sql === "SELECT token_hash, attempt_count FROM password_reset_tokens WHERE user_id = ? AND stage = 'code' AND expires_at > ? FOR UPDATE") {
            const token = view().token;
            return token && token.user_id === values[0] && token.stage === 'code' && token.expires_at > Number(values[1]) ? [{ token_hash: token.token_hash, attempt_count: token.attempt_count }] : [];
          }
          if (sql === 'UPDATE password_reset_tokens SET attempt_count = attempt_count + 1 WHERE user_id = ?') {
            view().token!.attempt_count += 1;
            return { affectedRows: 1 };
          }
          if (sql === "UPDATE password_reset_tokens SET token_hash = ?, stage = 'verified' WHERE user_id = ?") {
            view().token!.token_hash = String(values[0]);
            view().token!.stage = 'verified';
            return { affectedRows: 1 };
          }
          if (sql === "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND stage = 'verified'") {
            const token = state.token;
            return token && token.token_hash === values[0] && token.stage === 'verified' ? [{ user_id: token.user_id }] : [];
          }
          if (sql === "SELECT user_id FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? AND stage = 'verified' AND expires_at > ? FOR UPDATE") {
            const token = view().token;
            return token && token.user_id === values[0] && token.token_hash === values[1] && token.stage === 'verified' && token.expires_at > Number(values[2]) ? [{ user_id: token.user_id }] : [];
          }
          if (sql === 'UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?') {
            if (failUpdate) throw new Error('Injected update failure');
            view().user.password_hash = String(values[0]);
            view().user.auth_version += 1;
            return { affectedRows: 1 };
          }
          if (sql === 'DELETE FROM password_reset_tokens WHERE user_id = ?') {
            view().token = null;
            return { affectedRows: 1 };
          }
          if (sql === 'SELECT id, name, email, role, auth_version FROM users WHERE id = ?') {
            return state.user.id === values[0] ? [{ ...state.user }] : [];
          }
          throw new Error(`Unexpected test SQL: ${sql}`);
        },
      };
    },
  } as unknown as Pool;
  return { pool, state, get commits() { return commits; }, get rollbacks() { return rollbacks; }, setFailUpdate(value: boolean) { failUpdate = value; } };
}

async function fixture() {
  const initialHash = await bcrypt.hash('Original!123', 4);
  const db = memoryPool(initialHash);
  let now = 1_800_000_000_000;
  const service = new PasswordResetService(createPasswordResetRepository(db.pool), { clientUrl: 'http://localhost:5173/' }, () => now, 4);
  return { db, service, initialHash, advance(ms: number) { now += ms; }, now: () => now };
}

async function serve(t: TestContext, app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(err => err ? reject(err) : resolve());
  }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function verifiedToken(f: Awaited<ReturnType<typeof fixture>>) {
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  return f.service.verify('ada@example.com', code);
}

function wrongCode(code: string) { return code === '000000' ? '999999' : '000000'; }

test('request creates a six-digit email-scoped hashed code without changing the password', async () => {
  const f = await fixture();
  const code = await f.service.request(' ADA@example.com ');
  assert.match(code!, /^\d{6}$/);
  assert.equal(f.db.state.token?.token_hash, hashResetCode('ada@example.com', code!));
  assert.notEqual(f.db.state.token?.token_hash, code);
  assert.equal(f.db.state.token?.stage, 'code');
  assert.equal(f.db.state.token?.attempt_count, 0);
  assert.equal(f.db.state.token?.expires_at, f.now() + RESET_TOKEN_TTL_MS);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  assert.equal(f.db.state.user.auth_version, 0);
  assert.notEqual(hashResetCode('other@example.com', code!), hashResetCode('ada@example.com', code!));
  assert.throws(() => verifyToken(code!), 'Reset codes cannot authenticate as JWTs');
});

test('request and verify API returns a console code, then a proof only after correct verification', async t => {
  const f = await fixture();
  const app = express();
  app.use(express.json());
  app.use('/reset', createPasswordResetRouter(f.service, { minimumResponseMs: 0 }));
  const base = await serve(t, app);
  const post = (endpoint: string, body: unknown) => fetch(`${base}/reset/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const missing = await post('request', { email: 'missing@example.com' });
  assert.equal(missing.status, 202);
  assert.deepEqual(await missing.json(), { message: 'passwordReset.requested', delivery: 'console' });
  const known = await post('request', { email: 'ada@example.com' });
  assert.equal(known.status, 202);
  const knownBody = await known.json();
  assert.equal(knownBody.delivery, 'console');
  assert.match(knownBody.code, /^\d{6}$/);
  const cooldown = await post('request', { email: 'ada@example.com' });
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.headers.get('Retry-After'), '60');
  assert.deepEqual(await cooldown.json(), { message: 'passwordReset.cooldown' });
  const wrong = await post('verify', { email: 'ada@example.com', code: wrongCode(knownBody.code) });
  assert.equal(wrong.status, 400);
  assert.deepEqual(await wrong.json(), { message: 'passwordReset.invalidCode' });
  const correct = await post('verify', { email: 'ada@example.com', code: knownBody.code });
  assert.equal(correct.status, 200);
  const proof = await correct.json();
  assert.equal(proof.message, 'passwordReset.verified');
  assert.match(proof.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  const reset = await post('confirm', { token: proof.token, password: 'Changed!123' });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { message: 'passwordReset.complete' });
  assert.equal(await bcrypt.compare('Changed!123', f.db.state.user.password_hash), true);
});

test('request code cannot bypass verification and confirm a new password directly', async () => {
  const f = await fixture();
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  await assert.rejects(f.service.confirm(code, 'Changed!123'), /passwordReset.invalidToken/);
  await assert.rejects(f.service.confirm('x'.repeat(43), 'Changed!123'), /passwordReset.invalidToken/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  assert.equal(f.db.state.token?.stage, 'code');
});

test('successful reset rejects the old password and consumes a verified proof once', async () => {
  const f = await fixture();
  const token = await verifiedToken(f);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.db.state.token?.token_hash, hashResetToken(token));
  assert.equal(f.db.state.token?.stage, 'verified');
  await f.service.confirm(token, 'Changed!123');
  assert.equal(await bcrypt.compare('Original!123', f.db.state.user.password_hash), false);
  assert.equal(await bcrypt.compare('Changed!123', f.db.state.user.password_hash), true);
  assert.equal(f.db.state.user.auth_version, 1);
  assert.equal(f.db.state.token, null);
  await assert.rejects(f.service.confirm(token, 'Another!123'), /passwordReset.invalidToken/);
});

test('wrong, malformed, differently scoped and exactly expired codes leave password unchanged', async () => {
  const f = await fixture();
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  await assert.rejects(f.service.verify('ada@example.com', wrongCode(code)), /passwordReset.invalidCode/);
  await assert.rejects(f.service.verify('ada@example.com', '../invalid'), /passwordReset.invalidCode/);
  await assert.rejects(f.service.verify('missing@example.com', code), /passwordReset.invalidCode/);
  f.advance(RESET_TOKEN_TTL_MS);
  await assert.rejects(f.service.verify('ada@example.com', code), /passwordReset.invalidCode/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  assert.equal(f.db.state.user.auth_version, 0);
});

test('five incorrect codes exhaust the challenge; repeated requests do not reset the attempt budget', async () => {
  const f = await fixture();
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  for (let attempt = 1; attempt < RESET_CODE_MAX_ATTEMPTS; attempt++) {
    await assert.rejects(f.service.verify('ada@example.com', wrongCode(code)), /passwordReset.invalidCode/);
  }
  await assert.rejects(f.service.request('ada@example.com'), /passwordReset.cooldown/);
  assert.equal(f.db.state.token?.attempt_count, RESET_CODE_MAX_ATTEMPTS - 1);
  await assert.rejects(f.service.verify('ada@example.com', wrongCode(code)), /passwordReset.tooManyAttempts/);
  await assert.rejects(f.service.verify('ada@example.com', code), /passwordReset.tooManyAttempts/);
  assert.equal(f.db.state.token?.attempt_count, RESET_CODE_MAX_ATTEMPTS);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  f.advance(RESET_REQUEST_COOLDOWN_MS);
  const freshCode = await f.service.request('ada@example.com');
  assert.ok(freshCode);
  assert.equal(f.db.state.token?.attempt_count, 0);
  const proof = await f.service.verify('ada@example.com', freshCode);
  await f.service.confirm(proof, 'Changed!123');
});

test('cooldown survives a service restart and applies to unknown addresses as well', async () => {
  const f = await fixture();
  await f.service.request('ada@example.com');
  await f.service.request('missing@example.com');
  await assert.rejects(f.service.request('missing@example.com'), /passwordReset.cooldown/);
  const restarted = new PasswordResetService(createPasswordResetRepository(f.db.pool), { clientUrl: 'http://localhost:5173/' }, f.now, 4);
  await assert.rejects(restarted.request('ada@example.com'), /passwordReset.cooldown/);
  assert.equal(f.db.state.token?.attempt_count, 0);
});

test('new request replaces the existing challenge and invalidates a previously verified proof', async () => {
  const f = await fixture();
  const oldToken = await verifiedToken(f);
  f.advance(RESET_REQUEST_COOLDOWN_MS);
  const currentCode = await f.service.request('ada@example.com');
  assert.ok(currentCode);
  await assert.rejects(f.service.confirm(oldToken, 'Changed!123'), /passwordReset.invalidToken/);
  const currentToken = await f.service.verify('ada@example.com', currentCode);
  await f.service.confirm(currentToken, 'Changed!123');
});

test('proofs keep the original challenge expiry and cannot extend the reset lifetime', async () => {
  const f = await fixture();
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  f.advance(RESET_TOKEN_TTL_MS - 1);
  const token = await f.service.verify('ada@example.com', code);
  f.advance(1);
  await assert.rejects(f.service.confirm(token, 'Changed!123'), /passwordReset.invalidToken/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
});

test('two concurrent verifications produce exactly one usable proof', async () => {
  const f = await fixture();
  const code = await f.service.request('ada@example.com');
  assert.ok(code);
  const results = await Promise.allSettled([f.service.verify('ada@example.com', code), f.service.verify('ada@example.com', code)]);
  const successes = results.filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled');
  assert.equal(successes.length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(f.db.state.user.auth_version, 0);
  await f.service.confirm(successes[0].value, 'Changed!123');
  assert.equal(f.db.state.user.auth_version, 1);
});

test('two concurrent confirmations produce exactly one password change', async () => {
  const f = await fixture();
  const token = await verifiedToken(f);
  const results = await Promise.allSettled([f.service.confirm(token, 'First!123'), f.service.confirm(token, 'Second!123')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(f.db.state.user.auth_version, 1);
  assert.equal(f.db.state.token, null);
});

test('password update failure rolls back and leaves its verified proof reusable', async () => {
  const f = await fixture();
  const token = await verifiedToken(f);
  f.db.setFailUpdate(true);
  await assert.rejects(f.service.confirm(token, 'Changed!123'), /Injected update failure/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  assert.equal(f.db.state.token?.token_hash, hashResetToken(token));
  assert.equal(f.db.rollbacks, 1);
  f.db.setFailUpdate(false);
  await f.service.confirm(token, 'Changed!123');
});

test('password validation enforces eight Unicode characters and the 72 UTF-8 byte bcrypt limit', async () => {
  const f = await fixture();
  const token = await verifiedToken(f);
  await assert.rejects(f.service.confirm(token, '1234567'), /passwordReset.passwordTooShort/);
  await assert.rejects(f.service.confirm(token, '🙂'.repeat(4)), /passwordReset.passwordTooShort/);
  await assert.rejects(f.service.confirm(token, 'é'.repeat(37)), /passwordReset.passwordTooLong/);
  assert.equal(f.db.state.user.password_hash, f.initialHash);
  await f.service.confirm(token, 'é'.repeat(36));
  assert.equal(await bcrypt.compare('é'.repeat(36), f.db.state.user.password_hash), true);
});

test('reset invalidates old JWTs; a fresh JWT uses the incremented account version', async t => {
  const f = await fixture();
  const oldJwt = signToken(f.db.state.user, 0);
  const app = express();
  app.get('/protected', createAuthMiddleware(f.db.pool), (_req, res) => { res.json({ ok: true }); });
  const base = await serve(t, app);
  const check = (token: string) => fetch(`${base}/protected`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await check(oldJwt)).status, 200);
  const proof = await verifiedToken(f);
  await f.service.confirm(proof, 'Changed!123');
  assert.equal((await check(oldJwt)).status, 401);
  assert.equal((await check(proof)).status, 401);
  assert.equal((await check(signToken(f.db.state.user, f.db.state.user.auth_version))).status, 200);
});

test('request IP rate limit has Retry-After and expires after 15 minutes', async t => {
  const f = await fixture();
  const app = express();
  app.use(express.json());
  app.use('/reset', createPasswordResetRouter(f.service, { minimumResponseMs: 0, now: f.now }));
  const base = await serve(t, app);
  const request = (i: number) => fetch(`${base}/reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `missing${i}@example.com` }) });
  for (let i = 0; i < 5; i++) assert.equal((await request(i)).status, 202);
  const limited = await request(5);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '900');
  assert.deepEqual(await limited.json(), { message: 'passwordReset.tooManyRequests' });
  f.advance(RESET_TOKEN_TTL_MS);
  assert.equal((await request(0)).status, 202);
});

test('verification has an independent IP rate limit', async t => {
  const f = await fixture();
  const app = express();
  app.use(express.json());
  app.use('/reset', createPasswordResetRouter(f.service, { now: f.now }));
  const base = await serve(t, app);
  const verify = () => fetch(`${base}/reset/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'missing@example.com', code: '000000' }) });
  for (let i = 0; i < 20; i++) assert.equal((await verify()).status, 400);
  assert.equal((await verify()).status, 429);
});

test('invalid input and unavailable delivery return explicit errors without mutations', async t => {
  const f = await fixture();
  const unavailable = new PasswordResetService(createPasswordResetRepository(f.db.pool), null, f.now, 4);
  await assert.rejects(unavailable.request('ada@example.com'), /passwordReset.unavailable/);
  await assert.rejects(unavailable.verify('ada@example.com', '000000'), /passwordReset.unavailable/);
  await assert.rejects(unavailable.confirm('x'.repeat(43), 'Changed!123'), /passwordReset.unavailable/);
  const app = express();
  app.use(express.json());
  app.use('/reset', createPasswordResetRouter(unavailable, { minimumResponseMs: 0 }));
  const base = await serve(t, app);
  const response = await fetch(`${base}/reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ada@example.com' }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: 'passwordReset.unavailable' });
  for (const email of [null, {}, ['ada@example.com'], 'bad', 'bad@@example.com']) await assert.rejects(f.service.request(email), /passwordReset.invalidEmail/);
  assert.equal(f.db.state.token, null);
});

test('console delivery requires explicit development mode and a local frontend URL', () => {
  assert.equal(localResetDeliveryFromEnv({}), null);
  assert.equal(localResetDeliveryFromEnv({ PASSWORD_RESET_DELIVERY: 'console' }), null);
  assert.equal(localResetDeliveryFromEnv({ NODE_ENV: 'production', PASSWORD_RESET_DELIVERY: 'console' }), null);
  assert.equal(localResetDeliveryFromEnv({ NODE_ENV: 'development', PASSWORD_RESET_DELIVERY: 'file' }), null);
  for (const clientUrl of ['javascript:alert(1)', 'file:///tmp/index.html', 'http://user:pass@localhost:5173', 'https://eventflow.example']) {
    assert.equal(localResetDeliveryFromEnv({ NODE_ENV: 'development', PASSWORD_RESET_DELIVERY: 'console', CLIENT_URL: clientUrl }), null);
  }
  for (const clientUrl of ['http://localhost:5173/', 'http://127.0.0.1:5173/', 'http://[::1]:5173/']) {
    assert.equal(localResetDeliveryFromEnv({ NODE_ENV: 'development', PASSWORD_RESET_DELIVERY: 'console', CLIENT_URL: `${clientUrl}#untrusted` })?.clientUrl, clientUrl);
  }
});

test('migration upgrades the existing reset table with stage and attempt count', async () => {
  const queries: string[] = [];
  let released = false;
  const pool = { getConnection: async () => ({ query: async (sql: string) => { queries.push(sql); return sql.includes("users LIKE 'auth_version'") ? [{ Field: 'auth_version' }] : []; }, release: () => { released = true; } }) } as unknown as Pool;
  await ensurePasswordResetSchema(pool);
  assert.ok(queries.some(sql => sql.startsWith('ALTER TABLE password_reset_tokens ADD COLUMN stage')));
  assert.ok(queries.some(sql => sql.startsWith('ALTER TABLE password_reset_tokens ADD COLUMN attempt_count')));
  assert.equal(released, true);
});

test('migration propagates failure instead of enabling a partially initialized reset service', async () => {
  let released = false;
  const pool = { getConnection: async () => ({ query: async () => { throw new Error('Migration unavailable'); }, release: () => { released = true; } }) } as unknown as Pool;
  await assert.rejects(ensurePasswordResetSchema(pool), /Migration unavailable/);
  assert.equal(released, true);
});

test('JWT signing reads the configured secret after module import (dotenv startup ordering)', () => {
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = 'isolated-password-reset-test-secret';
    const token = signToken({ id: 1, role: 'attendee', email: 'ada@example.com' });
    assert.equal((jwt.verify(token, 'isolated-password-reset-test-secret') as jwt.JwtPayload).sub, 1);
    assert.equal(verifyToken(token).ver, 0);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
