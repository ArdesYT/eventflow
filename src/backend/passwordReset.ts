/** Development reset codes and one-use password proofs are independent of login JWTs. */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Pool, PoolConnection } from 'mariadb';

export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;

/** Transactions serialize issue, verification and consumption with the account row lock. */
export interface PasswordResetRepository {
  issue(email: string, codeHash: string, now: number): Promise<'issued' | 'unknown' | 'cooldown'>;
  verify(email: string, codeHash: string, proofHash: string, now: number): Promise<'verified' | 'invalid' | 'exhausted'>;
  consume(tokenHash: string, now: number, passwordHash: string): Promise<boolean>;
}

export class PasswordResetError extends Error {
  readonly status: number;
  constructor(code: string, status = 400) {
    super(`passwordReset.${code}`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = status;
  }
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashResetCode(email: string, code: string): string {
  return hashResetToken(`code\0${email}\0${code}`);
}

/** Migration errors propagate: a partially initialized authentication service must not start. */
export async function ensurePasswordResetSchema(pool: Pool): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const columns = await conn.query("SHOW COLUMNS FROM users LIKE 'auth_version'");
    if (!columns.length) await conn.query('ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        user_id INT NOT NULL PRIMARY KEY,
        token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
        issued_at BIGINT UNSIGNED NOT NULL,
        expires_at BIGINT UNSIGNED NOT NULL,
        stage ENUM('code', 'verified') NOT NULL DEFAULT 'code',
        attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
        INDEX idx_password_reset_expiry (expires_at),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Existing link hashes are deliberately not valid proofs in the new two-step flow.
    const stageColumns = await conn.query("SHOW COLUMNS FROM password_reset_tokens LIKE 'stage'");
    if (!stageColumns.length) await conn.query("ALTER TABLE password_reset_tokens ADD COLUMN stage ENUM('code', 'verified') NOT NULL DEFAULT 'code'");
    const attemptColumns = await conn.query("SHOW COLUMNS FROM password_reset_tokens LIKE 'attempt_count'");
    if (!attemptColumns.length) await conn.query('ALTER TABLE password_reset_tokens ADD COLUMN attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0');
  } finally { conn.release(); }
}

async function rollbackQuietly(conn: PoolConnection): Promise<void> {
  try { await conn.rollback(); } catch { /* Preserve the original operation failure. */ }
}

export function createPasswordResetRepository(pool: Pool): PasswordResetRepository {
  return {
    async issue(email, codeHash, now) {
      const conn = await pool.getConnection();
      let result: 'issued' | 'unknown' | 'cooldown' = 'unknown';
      try {
        await conn.beginTransaction();
        const users = await conn.query('SELECT id FROM users WHERE email = ? FOR UPDATE', [email]);
        if (users.length) {
          const userId = Number(users[0].id);
          const existing = await conn.query('SELECT issued_at FROM password_reset_tokens WHERE user_id = ?', [userId]);
          if (existing.length && now - Number(existing[0].issued_at) < RESET_REQUEST_COOLDOWN_MS) result = 'cooldown';
          else {
            await conn.query(
              `INSERT INTO password_reset_tokens (user_id, token_hash, issued_at, expires_at, stage, attempt_count) VALUES (?, ?, ?, ?, 'code', 0)
               ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), issued_at = VALUES(issued_at), expires_at = VALUES(expires_at), stage = 'code', attempt_count = 0`,
              [userId, codeHash, now, now + RESET_TOKEN_TTL_MS],
            );
            result = 'issued';
          }
        }
        await conn.commit();
        return result;
      } catch (err) { await rollbackQuietly(conn); throw err; }
      finally { conn.release(); }
    },
    async verify(email, codeHash, proofHash, now) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const users = await conn.query('SELECT id FROM users WHERE email = ? FOR UPDATE', [email]);
        const userId = users.length ? Number(users[0].id) : null;
        const tokens = userId === null ? [] : await conn.query(
          "SELECT token_hash, attempt_count FROM password_reset_tokens WHERE user_id = ? AND stage = 'code' AND expires_at > ? FOR UPDATE",
          [userId, now],
        );
        if (!tokens.length) { await conn.rollback(); return 'invalid'; }
        const attempts = Number(tokens[0].attempt_count);
        if (attempts >= RESET_CODE_MAX_ATTEMPTS) { await conn.rollback(); return 'exhausted'; }
        const matches = timingSafeEqual(Buffer.from(String(tokens[0].token_hash), 'hex'), Buffer.from(codeHash, 'hex'));
        if (!matches) {
          await conn.query('UPDATE password_reset_tokens SET attempt_count = attempt_count + 1 WHERE user_id = ?', [userId]);
          await conn.commit();
          return attempts + 1 >= RESET_CODE_MAX_ATTEMPTS ? 'exhausted' : 'invalid';
        }
        await conn.query("UPDATE password_reset_tokens SET token_hash = ?, stage = 'verified' WHERE user_id = ?", [proofHash, userId]);
        await conn.commit();
        return 'verified';
      } catch (err) { await rollbackQuietly(conn); throw err; }
      finally { conn.release(); }
    },
    async consume(tokenHash, now, passwordHash) {
      const conn = await pool.getConnection();
      try {
        // Discover the user without locking the challenge before its user row.
        const matches = await conn.query("SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND stage = 'verified'", [tokenHash]);
        if (!matches.length) return false;
        const userId = Number(matches[0].user_id);
        await conn.beginTransaction();
        const users = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
        const tokens = await conn.query(
          "SELECT user_id FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? AND stage = 'verified' AND expires_at > ? FOR UPDATE",
          [userId, tokenHash, now],
        );
        if (!users.length || !tokens.length) { await conn.rollback(); return false; }
        await conn.query('UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, userId]);
        await conn.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
        await conn.commit();
        return true;
      } catch (err) { await rollbackQuietly(conn); throw err; }
      finally { conn.release(); }
    },
  };
}

export interface LocalResetDelivery { clientUrl: string }

/** Browser-console codes require explicit local development opt-in. */
export function localResetDeliveryFromEnv(env: NodeJS.ProcessEnv = process.env): LocalResetDelivery | null {
  if (env.NODE_ENV !== 'development' || env.PASSWORD_RESET_DELIVERY !== 'console') return null;
  try {
    const url = new URL(env.CLIENT_URL || 'http://localhost:5173');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    url.hash = '';
    url.search = '';
    return { clientUrl: url.toString() };
  } catch { return null; }
}

function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const emailRegex = /^(?=.{1,254}$)(?=[^@]{1,64}@)[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  if (!emailRegex.test(email)) throw new PasswordResetError('invalidEmail');
  return email;
}

export class PasswordResetService {
  private readonly repository: PasswordResetRepository;
  private readonly delivery: LocalResetDelivery | null;
  private readonly now: () => number;
  private readonly saltRounds: number;
  private readonly requestCooldowns = new Map<string, number>();

  constructor(repository: PasswordResetRepository, delivery: LocalResetDelivery | null, now: () => number = Date.now, saltRounds = 10) {
    this.repository = repository;
    this.delivery = delivery;
    this.now = now;
    this.saltRounds = saltRounds;
  }

  async request(emailValue: unknown): Promise<string | undefined> {
    const email = normalizeEmail(emailValue);
    if (!this.delivery) throw new PasswordResetError('unavailable', 503);
    const now = this.now();
    for (const [key, expiresAt] of Array.from(this.requestCooldowns)) if (expiresAt <= now) this.requestCooldowns.delete(key);
    if (this.requestCooldowns.has(email)) throw new PasswordResetError('cooldown', 429);
    // Unknown accounts receive the same cooldown as real accounts.
    this.requestCooldowns.set(email, now + RESET_REQUEST_COOLDOWN_MS);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    try {
      const result = await this.repository.issue(email, hashResetCode(email, code), now);
      if (result === 'cooldown') throw new PasswordResetError('cooldown', 429);
      return result === 'issued' ? code : undefined;
    } catch (error) {
      if (!(error instanceof PasswordResetError)) this.requestCooldowns.delete(email);
      throw error;
    }
  }

  async verify(emailValue: unknown, codeValue: unknown): Promise<string> {
    if (!this.delivery) throw new PasswordResetError('unavailable', 503);
    const email = normalizeEmail(emailValue);
    if (typeof codeValue !== 'string' || !/^\d{6}$/.test(codeValue)) throw new PasswordResetError('invalidCode');
    const token = randomBytes(32).toString('base64url');
    const result = await this.repository.verify(email, hashResetCode(email, codeValue), hashResetToken(token), this.now());
    if (result === 'exhausted') throw new PasswordResetError('tooManyAttempts', 429);
    if (result !== 'verified') throw new PasswordResetError('invalidCode');
    return token;
  }

  async confirm(tokenValue: unknown, passwordValue: unknown): Promise<void> {
    if (!this.delivery) throw new PasswordResetError('unavailable', 503);
    if (typeof tokenValue !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(tokenValue)) throw new PasswordResetError('invalidToken');
    if (typeof passwordValue !== 'string' || Array.from(passwordValue).length < 8) throw new PasswordResetError('passwordTooShort');
    if (Buffer.byteLength(passwordValue, 'utf8') > 72) throw new PasswordResetError('passwordTooLong');
    const passwordHash = await bcrypt.hash(passwordValue, this.saltRounds);
    if (!await this.repository.consume(hashResetToken(tokenValue), this.now(), passwordHash)) throw new PasswordResetError('invalidToken');
  }
}

function resetRateLimiter(maxRequests: number, now: () => number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const time = now();
    for (const [key, bucket] of Array.from(buckets)) if (bucket.resetAt <= time) buckets.delete(key);
    const key = req.ip ?? 'unknown';
    const bucket = buckets.get(key) ?? { count: 0, resetAt: time + RESET_TOKEN_TTL_MS };
    buckets.set(key, bucket);
    if (++bucket.count > maxRequests) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)));
      res.status(429).json({ message: 'passwordReset.tooManyRequests' });
      return;
    }
    next();
  };
}

function respondToResetError(err: unknown, res: Response): void {
  if (err instanceof PasswordResetError) {
    if (err.message === 'passwordReset.cooldown') res.setHeader('Retry-After', RESET_REQUEST_COOLDOWN_MS / 1000);
    res.status(err.status).json({ message: err.message });
  } else {
    console.error('Password reset operation failed.');
    res.status(503).json({ message: 'passwordReset.failed' });
  }
}

export function createPasswordResetRouter(service: PasswordResetService, options: { minimumResponseMs?: number; now?: () => number } = {}): Router {
  const router = Router();
  const now = options.now ?? Date.now;
  router.post('/request', resetRateLimiter(5, now), async (req, res) => {
    const start = Date.now();
    let error: unknown;
    let code: string | undefined;
    try { code = await service.request(req.body?.email); } catch (err) { error = err; }
    await delay(Math.max(0, (options.minimumResponseMs ?? 250) - (Date.now() - start)));
    if (error) respondToResetError(error, res);
    else res.status(202).json({ message: 'passwordReset.requested', delivery: 'console', code });
  });
  router.post('/verify', resetRateLimiter(20, now), async (req, res) => {
    try {
      const token = await service.verify(req.body?.email, req.body?.code);
      res.json({ message: 'passwordReset.verified', token });
    } catch (err) { respondToResetError(err, res); }
  });
  router.post('/confirm', resetRateLimiter(20, now), async (req, res) => {
    try {
      await service.confirm(req.body?.token, req.body?.password);
      res.json({ message: 'passwordReset.complete' });
    } catch (err) { respondToResetError(err, res); }
  });
  return router;
}
