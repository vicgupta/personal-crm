import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DatabaseSync } from 'node:sqlite';

export interface AuthState {
  store: SessionStore;
  db: DatabaseSync;
}

/** True when the server should run with no login (local development only). */
export function authDisabledByEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.CRM_AUTH_DISABLED ?? '').toLowerCase() === 'true';
}

// ---------------------------------------------------------------------------
// User store (SQLite)
// ---------------------------------------------------------------------------

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export function ensureUsersTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function countUsers(db: DatabaseSync): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
}

export function getUser(db: DatabaseSync, username: string): UserRow | null {
  return (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined) ?? null;
}

export function listUsers(db: DatabaseSync): Array<Pick<UserRow, 'id' | 'username' | 'created_at'>> {
  return db.prepare('SELECT id, username, created_at FROM users ORDER BY id').all() as Array<
    Pick<UserRow, 'id' | 'username' | 'created_at'>
  >;
}

export function createUser(db: DatabaseSync, username: string, passwordHash: string): void {
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
}

export function setUserPassword(db: DatabaseSync, username: string, passwordHash: string): boolean {
  const r = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username);
  return r.changes > 0;
}

export function deleteUser(db: DatabaseSync, username: string): boolean {
  const r = db.prepare('DELETE FROM users WHERE username = ?').run(username);
  return r.changes > 0;
}

/**
 * Fail-secure auth initialization against the database.
 *
 * - CRM_AUTH_DISABLED=true → null (no auth, local development only).
 * - Empty users table + CRM_PASSWORD_HASH set → one-time bootstrap of the
 *   initial user from the environment (migration path from env-file auth).
 * - Empty users table + no hash → throws with instructions (never runs open).
 * - Otherwise → auth state backed by the users table.
 */
export function initAuth(db: DatabaseSync, env: NodeJS.ProcessEnv = process.env): AuthState | null {
  if (authDisabledByEnv(env)) return null;
  ensureUsersTable(db);
  if (countUsers(db) === 0) {
    const hash = (env.CRM_PASSWORD_HASH ?? '').trim();
    if (hash) {
      const username = (env.CRM_USERNAME ?? 'vic').trim() || 'vic';
      createUser(db, username, hash);
      console.log(`Bootstrapped login user "${username}" from CRM_PASSWORD_HASH into the database.`);
    } else {
      throw new Error(
        'No login users in the database and CRM_PASSWORD_HASH is not set. ' +
          'Create one with: npm run user add <username> (from the server directory), ' +
          'or run with CRM_AUTH_DISABLED=true for local development only.',
      );
    }
  }
  return { store: new SessionStore(), db };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding
export const SESSION_COOKIE = 'crm_session';

export interface Session {
  username: string;
  expires: number;
}

export class SessionStore {
  private sessions = new Map<string, Session>();

  create(username: string): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { username, expires: Date.now() + SESSION_TTL_MS });
    return token;
  }

  get(token: string | undefined): Session | null {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    if (s.expires < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    s.expires = Date.now() + SESSION_TTL_MS;
    return s;
  }

  revoke(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }
}

export function getSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export function sessionCookie(token: string, secure = false): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
    (secure ? '; Secure' : '')
  );
}

export const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function requireAuth(store: SessionStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    const s = store.get(getSessionToken(req));
    if (!s) return res.status(401).json({ error: 'not authenticated' });
    (req as Request & { user?: { username: string } }).user = { username: s.username };
    next();
  };
}

/** Brute-force guard on the login endpoint: 10 attempts per 10 minutes per IP. */
export function loginRateLimit() {
  const hits = new Map<string, { count: number; reset: number }>();
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX = 10;
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || h.reset < now) {
      hits.set(ip, { count: 1, reset: now + WINDOW_MS });
      return next();
    }
    h.count += 1;
    if (h.count > MAX) {
      return res.status(429).json({ error: 'too many login attempts, try again later' });
    }
    next();
  };
}
