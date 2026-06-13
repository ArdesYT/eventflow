import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Pool, PoolConnection } from 'mariadb';
import type { User, UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];

export interface JwtPayload {
  sub: number;
  role: UserRole;
  email: string;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signToken(user: Pick<User, 'id' | 'role' | 'email'>): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }
  const p = decoded as Record<string, unknown>;
  return {
    sub: Number(p.sub),
    role: String(p.role).trim().toLowerCase() as UserRole,
    email: String(p.email),
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function loadUserById(
  pool: Pool,
  userId: number,
): Promise<AuthenticatedUser | null> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [userId],
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: String(row.role).trim().toLowerCase() as UserRole,
    };
  } finally {
    if (conn) conn.release();
  }
}

export function createAuthMiddleware(pool: Pool) {
  return async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ message: 'Bejelentkezés szükséges.' });
      return;
    }

    try {
      const payload = verifyToken(token);
      const user = await loadUserById(pool, payload.sub);
      if (!user) {
        res.status(401).json({ message: 'Érvénytelen vagy lejárt munkamenet.' });
        return;
      }
      req.authUser = user;
      next();
    } catch {
      res.status(401).json({ message: 'Érvénytelen vagy lejárt munkamenet.' });
    }
  };
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ message: 'Bejelentkezés szükséges.' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ message: 'Nincs jogosultsága ehhez a művelethez.' });
      return;
    }
    next();
  };
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ message: 'Bejelentkezés szükséges.' });
    return;
  }
  if (req.authUser.role !== 'admin') {
    res.status(403).json({ message: 'Csak adminisztrátorok számára.' });
    return;
  }
  next();
}
