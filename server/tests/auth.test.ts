import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword, SessionStore, type AuthState } from '../src/auth.js';

function authedApp() {
  const db = openDatabase(':memory:');
  const auth: AuthState = {
    config: { enabled: true, username: 'tester', passwordHash: hashPassword('s3cret-pass') },
    store: new SessionStore(),
  };
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

  it('hashes and verifies passwords (wrong password fails, tampered hash fails)', async () => {
    const { verifyPassword } = await import('../src/auth.js');
    const hash = hashPassword('another-secret');
    expect(verifyPassword('another-secret', hash)).toBe(true);
    expect(verifyPassword('another-secreu', hash)).toBe(false);
    expect(verifyPassword('another-secret', 'scrypt$dead$beef')).toBe(false);
    expect(verifyPassword('another-secret', 'not-a-hash')).toBe(false);
  });
});
