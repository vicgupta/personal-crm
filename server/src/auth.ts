import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AuthConfig {
  enabled: boolean;
  username: string;
  /** "scrypt$<saltHex>$<derivedHex>" */
  passwordHash: string;
}

export interface AuthState {
  config: AuthConfig;
  store: SessionStore;
}

/**
 * Fail-secure configuration: auth is enabled when CRM_PASSWORD_HASH is set.
 * Local dev can opt out explicitly with CRM_AUTH_DISABLED=true.
 * Anything else is a startup error — never silently run open.
 */
export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const hash = (env.CRM_PASSWORD_HASH ?? '').trim();
  const disabled = String(env.CRM_AUTH_DISABLED ?? '').toLowerCase() === 'true';
  if (hash) {
    const username = (env.CRM_USERNAME ?? 'vic').trim() || 'vic';
    return { enabled: true, username, passwordHash: hash };
  }
  if (disabled) return { enabled: false, username: '', passwordHash: '' };
  throw new Error(
    'Auth is not configured: set CRM_PASSWORD_HASH to enable login, ' +
      'or CRM_AUTH_DISABLED=true to run without auth (local development only).',
  );
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

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
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
