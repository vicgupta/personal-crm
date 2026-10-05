import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import {
  clearSessionCookie,
  getSessionToken,
  getUser,
  loginRateLimit,
  requireAuth,
  sessionCookie,
  verifyPassword,
  type AuthState,
} from './auth.js';
import {
  STAGES,
  STAGE_PROBABILITY,
  CONTACT_STATUSES,
  ACTIVITY_TYPES,
  type Stage,
  type DashboardData,
  type Activity,
} from './types.js';

function toActivity(row: Record<string, unknown>): Activity {
  return { ...(row as object), done: Boolean((row as { done: number }).done) } as Activity;
}

function likeParam(s: string): string {
  return `%${s.replace(/[%_]/g, '')}%`;
}

function resolveCloseDate(stage: string, closeDate: string): string {
  // A deal closed as won/lost without a close date counts as closed today,
  // so the dashboard's won charts stay in sync with the pipeline board.
  if ((stage === 'won' || stage === 'lost') && !closeDate) {
    return new Date().toISOString().slice(0, 10);
  }
  return closeDate;
}

export function createApp(db: DatabaseSync, auth?: AuthState | null) {
  const app = express();
  // Behind Caddy (TLS terminator) in production: trust X-Forwarded-* so
  // req.ip is the real client (rate limiter) and req.secure reflects HTTPS.
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ---------------- authentication ----------------
  // Public auth endpoints; everything else under /api is protected when enabled.
  app.get('/api/me', (req, res) => {
    if (!auth) return res.json({ authenticated: false, authDisabled: true });
    const s = auth.store.get(getSessionToken(req));
    if (!s) return res.status(401).json({ error: 'not authenticated' });
    res.json({ authenticated: true, username: s.username });
  });

  if (auth) {
    const limiter = loginRateLimit();
    app.post('/api/login', limiter, (req, res) => {
      const { username = '', password = '' } = req.body ?? {};
      const user = getUser(auth.db, String(username).trim());
      if (user && verifyPassword(String(password), user.password_hash)) {
        const secure = req.secure || req.get('x-forwarded-proto') === 'https';
        const token = auth.store.create(user.username);
        res.setHeader('Set-Cookie', sessionCookie(token, secure));
        return res.json({ ok: true, username: user.username });
      }
      return res.status(401).json({ error: 'invalid username or password' });
    });

    app.post('/api/logout', (req, res) => {
      auth.store.revoke(getSessionToken(req));
      res.setHeader('Set-Cookie', clearSessionCookie);
      res.json({ ok: true });
    });

    // Everything registered below under /api requires a valid session.
    app.use('/api', requireAuth(auth.store));
  }

  // ---------------- organizations ----------------
  app.get('/api/organizations', (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const rows = search
      ? db
          .prepare(
            'SELECT * FROM organizations WHERE name LIKE ? OR industry LIKE ? OR website LIKE ? ORDER BY name',
          )
          .all(likeParam(search), likeParam(search), likeParam(search))
      : db.prepare('SELECT * FROM organizations ORDER BY name').all();
    res.json(rows);
  });

  app.post('/api/organizations', (req, res) => {
    const { name, website = '', industry = '', notes = '' } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const r = db
      .prepare('INSERT INTO organizations (name, website, industry, notes) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), String(website), String(industry), String(notes));
    res
      .status(201)
      .json(db.prepare('SELECT * FROM organizations WHERE id = ?').get(r.lastInsertRowid));
  });

  app.get('/api/organizations/:id', (req, res) => {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!org) return res.status(404).json({ error: 'organization not found' });
    const contacts = db
      .prepare('SELECT * FROM contacts WHERE organization_id = ? ORDER BY name')
      .all(org.id);
    const deals = db
      .prepare('SELECT * FROM deals WHERE organization_id = ? ORDER BY value DESC')
      .all(org.id);
    res.json({ ...org, contacts, deals });
  });

  app.put('/api/organizations/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM organizations WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'organization not found' });
    const { name, website = '', industry = '', notes = '' } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    db.prepare('UPDATE organizations SET name = ?, website = ?, industry = ?, notes = ? WHERE id = ?').run(
      String(name).trim(),
      String(website),
      String(industry),
      String(notes),
      req.params.id,
    );
    res.json(db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/organizations/:id', (req, res) => {
    const r = db.prepare('DELETE FROM organizations WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'organization not found' });
    res.status(204).end();
  });

  // ---------------- contacts ----------------
  app.get('/api/contacts', (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const where: string[] = [];
    const params: string[] = [];
    if (search) {
      where.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.title LIKE ?)');
      params.push(likeParam(search), likeParam(search), likeParam(search), likeParam(search));
    }
    if (status) {
      if (!(CONTACT_STATUSES as readonly string[]).includes(status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      where.push('c.status = ?');
      params.push(status);
    }
    const rows = db
      .prepare(
        `SELECT c.*, o.name AS organization_name FROM contacts c
         LEFT JOIN organizations o ON o.id = c.organization_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.name`,
      )
      .all(...params);
    res.json(rows);
  });

  app.post('/api/contacts', (req, res) => {
    const { name, email = '', phone = '', title = '', organization_id = null, status = 'lead' } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (!(CONTACT_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const r = db
      .prepare(
        'INSERT INTO contacts (name, email, phone, title, organization_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(String(name).trim(), String(email), String(phone), String(title), organization_id, status);
    res.status(201).json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid));
  });

  app.get('/api/contacts/:id', (req, res) => {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!contact) return res.status(404).json({ error: 'contact not found' });
    const organization = contact.organization_id
      ? db.prepare('SELECT * FROM organizations WHERE id = ?').get(contact.organization_id)
      : null;
    const activities = db
      .prepare('SELECT * FROM activities WHERE contact_id = ? ORDER BY happened_at DESC, id DESC')
      .all(contact.id)
      .map(toActivity);
    res.json({ ...contact, organization, activities });
  });

  app.put('/api/contacts/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'contact not found' });
    const { name, email = '', phone = '', title = '', organization_id = null, status = 'lead' } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (!(CONTACT_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    db.prepare(
      'UPDATE contacts SET name = ?, email = ?, phone = ?, title = ?, organization_id = ?, status = ? WHERE id = ?',
    ).run(String(name).trim(), String(email), String(phone), String(title), organization_id, status, req.params.id);
    res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/contacts/:id', (req, res) => {
    const r = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'contact not found' });
    res.status(204).end();
  });

  // ---------------- deals ----------------
  app.get('/api/deals', (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const rows = search
      ? db
          .prepare(
            `SELECT d.*, o.name AS organization_name, c.name AS contact_name FROM deals d
             LEFT JOIN organizations o ON o.id = d.organization_id
             LEFT JOIN contacts c ON c.id = d.contact_id
             WHERE d.name LIKE ? OR o.name LIKE ? OR c.name LIKE ?
             ORDER BY d.value DESC`,
          )
          .all(likeParam(search), likeParam(search), likeParam(search))
      : db
          .prepare(
            `SELECT d.*, o.name AS organization_name, c.name AS contact_name FROM deals d
             LEFT JOIN organizations o ON o.id = d.organization_id
             LEFT JOIN contacts c ON c.id = d.contact_id
             ORDER BY d.value DESC`,
          )
          .all();
    res.json(rows);
  });

  app.post('/api/deals', (req, res) => {
    const {
      name,
      organization_id = null,
      contact_id = null,
      stage = 'new',
      value = 0,
      probability,
      close_date = '',
    } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (!(STAGES as readonly string[]).includes(stage)) {
      return res.status(400).json({ error: 'invalid stage' });
    }
    const prob = probability === undefined ? STAGE_PROBABILITY[stage as Stage] : Number(probability);
    const r = db
      .prepare(
        'INSERT INTO deals (name, organization_id, contact_id, stage, value, probability, close_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(String(name).trim(), organization_id, contact_id, stage, Number(value) || 0, prob, resolveCloseDate(stage, String(close_date)));
    res.status(201).json(db.prepare('SELECT * FROM deals WHERE id = ?').get(r.lastInsertRowid));
  });

  app.get('/api/deals/:id', (req, res) => {
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!deal) return res.status(404).json({ error: 'deal not found' });
    const organization = deal.organization_id
      ? db.prepare('SELECT * FROM organizations WHERE id = ?').get(deal.organization_id)
      : null;
    const contact = deal.contact_id
      ? db.prepare('SELECT * FROM contacts WHERE id = ?').get(deal.contact_id)
      : null;
    const activities = db
      .prepare('SELECT * FROM activities WHERE deal_id = ? ORDER BY happened_at DESC, id DESC')
      .all(deal.id)
      .map(toActivity);
    res.json({ ...deal, organization, contact, activities });
  });

  app.put('/api/deals/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({ error: 'deal not found' });
    const {
      name,
      organization_id = null,
      contact_id = null,
      stage,
      value = 0,
      probability,
      close_date = '',
    } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const nextStage = stage ?? existing.stage;
    if (!(STAGES as readonly string[]).includes(nextStage as string)) {
      return res.status(400).json({ error: 'invalid stage' });
    }
    const prob =
      probability === undefined
        ? nextStage === existing.stage
          ? existing.probability
          : STAGE_PROBABILITY[nextStage as Stage]
        : Number(probability);
    db.prepare(
      'UPDATE deals SET name = ?, organization_id = ?, contact_id = ?, stage = ?, value = ?, probability = ?, close_date = ? WHERE id = ?',
    ).run(
      String(name).trim(),
      organization_id,
      contact_id,
      nextStage,
      Number(value) || 0,
      prob,
      resolveCloseDate(nextStage as string, String(close_date)),
      req.params.id,
    );
    res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
  });

  /** Move a deal to a new pipeline stage (probability follows the stage default). */
  app.patch('/api/deals/:id/stage', (req, res) => {
    const { stage } = req.body ?? {};
    if (!(STAGES as readonly string[]).includes(stage)) {
      return res.status(400).json({ error: 'invalid stage' });
    }
    const existing = db.prepare('SELECT id, close_date FROM deals WHERE id = ?').get(req.params.id) as
      | { id: number; close_date: string }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'deal not found' });
    db.prepare('UPDATE deals SET stage = ?, probability = ?, close_date = ? WHERE id = ?').run(
      stage,
      STAGE_PROBABILITY[stage as Stage],
      resolveCloseDate(stage, existing.close_date ?? ''),
      req.params.id,
    );
    res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/deals/:id', (req, res) => {
    const r = db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'deal not found' });
    res.status(204).end();
  });

  // ---------------- activities ----------------
  app.get('/api/activities', (req, res) => {
    const contactId = req.query.contact_id ? String(req.query.contact_id) : null;
    const dealId = req.query.deal_id ? String(req.query.deal_id) : null;
    const where: string[] = [];
    const params: string[] = [];
    if (contactId) {
      where.push('a.contact_id = ?');
      params.push(contactId);
    }
    if (dealId) {
      where.push('a.deal_id = ?');
      params.push(dealId);
    }
    const rows = db
      .prepare(
        `SELECT a.*, c.name AS contact_name, d.name AS deal_name FROM activities a
         LEFT JOIN contacts c ON c.id = a.contact_id
         LEFT JOIN deals d ON d.id = a.deal_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY a.happened_at DESC, a.id DESC`,
      )
      .all(...params)
      .map(toActivity);
    res.json(rows);
  });

  app.post('/api/activities', (req, res) => {
    const {
      type = 'note',
      contact_id = null,
      deal_id = null,
      description = '',
      happened_at,
      due_date = '',
      done = false,
    } = req.body ?? {};
    if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) {
      return res.status(400).json({ error: 'invalid activity type' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (contact_id === null && deal_id === null) {
      return res.status(400).json({ error: 'activity must relate to a contact or a deal' });
    }
    const happened = happened_at ? String(happened_at) : new Date().toISOString().slice(0, 16).replace('T', ' ');
    const r = db
      .prepare(
        'INSERT INTO activities (type, contact_id, deal_id, description, happened_at, due_date, done) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(type, contact_id, deal_id, String(description).trim(), happened, String(due_date), done ? 1 : 0);
    const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(toActivity(row as Record<string, unknown>));
  });

  app.put('/api/activities/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({ error: 'activity not found' });
    const {
      type = existing.type,
      description = existing.description,
      happened_at = existing.happened_at,
      due_date = existing.due_date,
      done = existing.done,
    } = req.body ?? {};
    if (!(ACTIVITY_TYPES as readonly string[]).includes(type as string)) {
      return res.status(400).json({ error: 'invalid activity type' });
    }
    db.prepare('UPDATE activities SET type = ?, description = ?, happened_at = ?, due_date = ?, done = ? WHERE id = ?').run(
      type,
      String(description),
      String(happened_at),
      String(due_date),
      done ? 1 : 0,
      req.params.id,
    );
    const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    res.json(toActivity(row as Record<string, unknown>));
  });

  app.delete('/api/activities/:id', (req, res) => {
    const r = db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'activity not found' });
    res.status(204).end();
  });

  // ---------------- dashboard ----------------
  app.get('/api/dashboard', (_req, res) => {
    const wonByMonth = db
      .prepare(
        `SELECT substr(close_date, 1, 7) AS month, COUNT(*) AS deals, COALESCE(SUM(value), 0) AS revenue
         FROM deals WHERE stage = 'won' AND close_date <> '' GROUP BY month ORDER BY month`,
      )
      .all();
    const pipeline = STAGES.map((stage) => {
      const r = db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS totalValue,
                  COALESCE(SUM(value * probability / 100.0), 0) AS expectedValue
           FROM deals WHERE stage = ?`,
        )
        .get(stage) as { count: number; totalValue: number; expectedValue: number };
      return { stage, ...r };
    });
    const withNames = `
      SELECT a.*, c.name AS contact_name, d.name AS deal_name FROM activities a
      LEFT JOIN contacts c ON c.id = a.contact_id
      LEFT JOIN deals d ON d.id = a.deal_id`;
    const recentActivities = db
      .prepare(`${withNames} ORDER BY a.happened_at DESC, a.id DESC LIMIT 10`)
      .all()
      .map(toActivity);
    const upcomingTasks = db
      .prepare(`${withNames} WHERE a.due_date <> '' AND a.due_date >= date('now') AND a.done = 0 ORDER BY a.due_date ASC LIMIT 20`)
      .all()
      .map(toActivity);
    const overdueTasks = db
      .prepare(`${withNames} WHERE a.due_date <> '' AND a.due_date < date('now') AND a.done = 0 ORDER BY a.due_date ASC LIMIT 20`)
      .all()
      .map(toActivity);
    const data: DashboardData = { wonByMonth: wonByMonth as DashboardData['wonByMonth'], pipeline, recentActivities, upcomingTasks, overdueTasks };
    res.json(data);
  });

  // Serve the built frontend (production) with an SPA fallback so that
  // client-side routes like /organizations/1 resolve to index.html.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
