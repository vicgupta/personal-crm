import { openDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const db = openDatabase();
const app = createApp(db);

app.listen(port, host, () => {
  console.log(`Personal CRM API listening on http://${host}:${port}`);
});
