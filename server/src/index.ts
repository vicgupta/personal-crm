import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { initAuth, type AuthState } from './auth.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const db = openDatabase();

// Fail-secure: credentials live in the SQLite users table. Exits unless at
// least one user exists (bootstrapped from CRM_PASSWORD_HASH when set) or
// auth is explicitly disabled for local development.
const auth: AuthState | null = initAuth(db);
const app = createApp(db, auth);

app.listen(port, host, () => {
  console.log(`Personal CRM API listening on http://${host}:${port}`);
  console.log(
    auth
      ? 'Login enabled (credentials stored in the database).'
      : 'Auth disabled (CRM_AUTH_DISABLED=true) — local development only.',
  );
});
