import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { authConfigFromEnv, SessionStore, type AuthState } from './auth.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

// Fail-secure: exits unless a password hash is configured or auth is
// explicitly disabled for local development.
const authConfig = authConfigFromEnv();
const auth: AuthState | null = authConfig.enabled
  ? { config: authConfig, store: new SessionStore() }
  : null;

const db = openDatabase();
const app = createApp(db, auth);

app.listen(port, host, () => {
  console.log(`Personal CRM API listening on http://${host}:${port}`);
  console.log(
    authConfig.enabled
      ? `Login enabled for user "${authConfig.username}".`
      : 'Auth disabled (CRM_AUTH_DISABLED=true) — local development only.',
  );
});
