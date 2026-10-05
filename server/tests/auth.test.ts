import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import {
  hashPassword,
  verifyPassword,
  SessionStore,
  ensureUsersTable,
  countUsers,
  getUser,
  createUser,
  setUserPassword,
  deleteUser,
  listUsers,
  initAuth,
  type AuthState,
} from '../src/auth.js';

function authedApp() {
  const db = openDatabase(':memory:');
  ensureUsersTable(db);
  createUser(db, 'tester', hashPassword('s3cret-pass'));
  const auth: AuthState = { store: new SessionStore(), db };
  return request(createApp(db, auth));
}

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const setCookie = res.headers['set-cookie'] as string[] | undefined;
  const raw = (setCookie ?? []).find((c) => c.startsWith('crm_session='));
  if (!raw) throw new Error('no session cookie set');
  return raw.split(';')[0];
}

describe('authentication', () => {
  it('rejects unauthenticated API access but leaves health and me public', async () => {
    const app = authedApp();
    expect((await app.get('/api/organizations')).status).toBe(401);
    expect((await app.get('/api/dashboard')).status).toBe(401);
    expect((await app.post('/api/organizations').send({ name: 'x' })).status).toBe(401);
    expect((await app.get('/api/health')).status).toBe(200);
    expect((await app.get('/api/me')).status).toBe(401);
  });

  it('rejects wrong credentials and accepts the right ones', async () => {
    const app = authedApp();
    const bad = await app.post('/api/login').send({ username: 'tester', password: 'wrong' });
    expect(bad.status).toBe(401);
    const badUser = await app.post('/api/login').send({ username: 'nobody', password: 's3cret-pass' });
    expect(badUser.status).toBe(401);

    const good = await app.post('/api/login').send({ username: 'tester', password: 's3cret-pass' });
    expect(good.status).toBe(200);
    expect(good.body.username).toBe('tester');
    const cookie = sessionCookie(good);

    const me = await app.get('/api/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('tester');

    const orgs = await app.get('/api/organizations').set('Cookie', cookie);
    expect(orgs.status).toBe(200);
  });

  it('logs out and invalidates the session', async () => {
    const app = authedApp();
    const good = await app.post('/api/login').send({ username: 'tester', password: 's3cret-pass' });
    const cookie = sessionCookie(good);
    expect((await app.get('/api/me').set('Cookie', cookie)).status).toBe(200);

    const out = await app.post('/api/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect((await app.get('/api/me').set('Cookie', cookie)).status).toBe(401);
    expect((await app.get('/api/organizations').set('Cookie', cookie)).status).toBe(401);
  });

  it('hashes and verifies passwords (wrong password fails, tampered hash fails)', () => {
    const hash = hashPassword('another-secret');
    expect(verifyPassword('another-secret', hash)).toBe(true);
    expect(verifyPassword('another-secreu', hash)).toBe(false);
    expect(verifyPassword('another-secret', 'scrypt$dead$beef')).toBe(false);
    expect(verifyPassword('another-secret', 'not-a-hash')).toBe(false);
  });
});

describe('user store', () => {
  it('creates, lists, updates and deletes users', () => {
    const db = openDatabase(':memory:');
    ensureUsersTable(db);
    expect(countUsers(db)).toBe(0);

    createUser(db, 'alice', hashPassword('pw1'));
    createUser(db, 'bob', hashPassword('pw2'));
    expect(countUsers(db)).toBe(2);
    expect(listUsers(db).map((u) => u.username)).toEqual(['alice', 'bob']);

    const alice = getUser(db, 'alice');
    expect(alice).not.toBeNull();
    expect(verifyPassword('pw1', alice!.password_hash)).toBe(true);

    expect(setUserPassword(db, 'alice', hashPassword('newpw'))).toBe(true);
    expect(verifyPassword('newpw', getUser(db, 'alice')!.password_hash)).toBe(true);
    expect(setUserPassword(db, 'nobody', hashPassword('x'))).toBe(false);

    expect(() => createUser(db, 'alice', hashPassword('x'))).toThrow();

    expect(deleteUser(db, 'bob')).toBe(true);
    expect(deleteUser(db, 'bob')).toBe(false);
    expect(countUsers(db)).toBe(1);
  });

  it('initAuth bootstraps the first user from CRM_PASSWORD_HASH', () => {
    const db = openDatabase(':memory:');
    const env = { CRM_PASSWORD_HASH: hashPassword('boot-pass'), CRM_USERNAME: 'vic' };
    const auth = initAuth(db, env);
    expect(auth).not.toBeNull();
    expect(countUsers(db)).toBe(1);
    const user = getUser(db, 'vic');
    expect(user).not.toBeNull();
    expect(verifyPassword('boot-pass', user!.password_hash)).toBe(true);
  });

  it('initAuth uses existing DB users and ignores the env hash', () => {
    const db = openDatabase(':memory:');
    ensureUsersTable(db);
    createUser(db, 'existing', hashPassword('db-pass'));
    const env = { CRM_PASSWORD_HASH: hashPassword('env-pass'), CRM_USERNAME: 'vic' };
    const auth = initAuth(db, env);
    expect(auth).not.toBeNull();
    expect(countUsers(db)).toBe(1);
    expect(getUser(db, 'existing')).not.toBeNull();
    expect(getUser(db, 'vic')).toBeNull();
  });

  it('initAuth throws when no users and no hash, returns null when disabled', () => {
    const db = openDatabase(':memory:');
    expect(() => initAuth(db, {})).toThrow(/No login users/);
    expect(initAuth(db, { CRM_AUTH_DISABLED: 'true' })).toBeNull();
  });
});
