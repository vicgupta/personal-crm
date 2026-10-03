import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

function freshApp() {
  const db = openDatabase(':memory:');
  return request(createApp(db));
}

describe('organizations CRUD', () => {
  it('creates, reads, updates and deletes an organization', async () => {
    const app = freshApp();
    const created = await app
      .post('/api/organizations')
      .send({ name: 'Test Corp', website: 'testcorp.com', industry: 'Software', notes: 'n' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Test Corp');
    const id = created.body.id;

    const got = await app.get(`/api/organizations/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.contacts).toEqual([]);
    expect(got.body.deals).toEqual([]);

    const updated = await app.put(`/api/organizations/${id}`).send({ name: 'Test Corp Inc', industry: 'SaaS' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Test Corp Inc');

    const del = await app.delete(`/api/organizations/${id}`);
    expect(del.status).toBe(204);
    expect((await app.get(`/api/organizations/${id}`)).status).toBe(404);
  });

  it('rejects a missing name and searches by name', async () => {
    const app = freshApp();
    expect((await app.post('/api/organizations').send({ industry: 'x' })).status).toBe(400);
    await app.post('/api/organizations').send({ name: 'Unique Zebra Ltd' });
    const found = await app.get('/api/organizations?search=zebra');
    expect(found.body.some((o: { name: string }) => o.name === 'Unique Zebra Ltd')).toBe(true);
    const missed = await app.get('/api/organizations?search=qqq-no-such-org');
    expect(missed.body).toEqual([]);
  });

  it('seeds sample data on first launch', async () => {
    const app = freshApp();
    const res = await app.get('/api/organizations');
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });
});

describe('contacts CRUD', () => {
  it('creates, reads, updates and deletes a contact', async () => {
    const app = freshApp();
    const org = await app.post('/api/organizations').send({ name: 'Contact Test Co' });
    const created = await app.post('/api/contacts').send({
      name: 'Jane Doe',
      email: 'jane@testco.com',
      phone: '555-1234',
      title: 'CEO',
      organization_id: org.body.id,
      status: 'qualified',
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const got = await app.get(`/api/contacts/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.organization.name).toBe('Contact Test Co');
    expect(got.body.activities).toEqual([]);

    const updated = await app.put(`/api/contacts/${id}`).send({ ...created.body, status: 'customer' });
    expect(updated.body.status).toBe('customer');

    expect((await app.delete(`/api/contacts/${id}`)).status).toBe(204);
    expect((await app.get(`/api/contacts/${id}`)).status).toBe(404);
  });

  it('filters by status and searches by name and email', async () => {
    const app = freshApp();
    await app.post('/api/contacts').send({ name: 'Zed Lead', email: 'zed@unique-mail-xyz.com', status: 'lead' });
    const byStatus = await app.get('/api/contacts?status=lead');
    expect(byStatus.body.length).toBeGreaterThan(0);
    expect(byStatus.body.every((c: { status: string }) => c.status === 'lead')).toBe(true);
    const byEmail = await app.get('/api/contacts?search=unique-mail-xyz.com');
    expect(byEmail.body.some((c: { name: string }) => c.name === 'Zed Lead')).toBe(true);
    expect((await app.post('/api/contacts').send({ name: 'Bad', status: 'bogus' })).status).toBe(400);
  });
});

describe('deals CRUD', () => {
  it('creates, reads, updates and deletes a deal', async () => {
    const app = freshApp();
    const org = await app.post('/api/organizations').send({ name: 'Deal Test Co' });
    const contact = await app.post('/api/contacts').send({ name: 'Dan Deal', organization_id: org.body.id });
    const created = await app.post('/api/deals').send({
      name: 'Big Contract',
      organization_id: org.body.id,
      contact_id: contact.body.id,
      stage: 'qualified',
      value: 50000,
      close_date: '2026-12-01',
    });
    expect(created.status).toBe(201);
    expect(created.body.stage).toBe('qualified');
    expect(created.body.probability).toBe(25);
    const id = created.body.id;

    const got = await app.get(`/api/deals/${id}`);
    expect(got.body.organization.name).toBe('Deal Test Co');
    expect(got.body.contact.name).toBe('Dan Deal');

    const moved = await app.patch(`/api/deals/${id}/stage`).send({ stage: 'won' });
    expect(moved.status).toBe(200);
    expect(moved.body.stage).toBe('won');
    expect(moved.body.probability).toBe(100);

    const lost = await app.patch(`/api/deals/${id}/stage`).send({ stage: 'lost' });
    expect(lost.status).toBe(200);
    expect(lost.body.stage).toBe('lost');
    expect(lost.body.probability).toBe(0);

    expect((await app.patch(`/api/deals/${id}/stage`).send({ stage: 'bogus' })).status).toBe(400);
    expect((await app.delete(`/api/deals/${id}`)).status).toBe(204);
    expect((await app.get(`/api/deals/${id}`)).status).toBe(404);
  });

  it('searches deals by name', async () => {
    const app = freshApp();
    await app.post('/api/deals').send({ name: 'Unicorn Rainbow Deal XYZ', value: 1 });
    const res = await app.get('/api/deals?search=unicorn rainbow');
    expect(res.body.some((d: { name: string }) => d.name.includes('Unicorn'))).toBe(true);
  });

  it('defaults close_date to today when a deal is closed without one', async () => {
    const app = freshApp();
    const today = new Date().toISOString().slice(0, 10);
    const created = await app.post('/api/deals').send({ name: 'No Date Deal', value: 1000 });
    expect(created.body.close_date).toBe('');
    const won = await app.patch(`/api/deals/${created.body.id}/stage`).send({ stage: 'won' });
    expect(won.body.close_date).toBe(today);
    const dash = await app.get('/api/dashboard');
    const entry = dash.body.wonByMonth.find((w: { month: string }) => w.month === today.slice(0, 7));
    expect(entry).toBeTruthy();
    expect(entry.revenue).toBeGreaterThanOrEqual(1000);
  });
});

describe('activities CRUD', () => {
  it('creates, lists newest-first, toggles done, and deletes', async () => {
    const app = freshApp();
    const contact = await app.post('/api/contacts').send({ name: 'Act Andy' });
    const deal = await app.post('/api/deals').send({ name: 'Act Deal' });

    const a1 = await app.post('/api/activities').send({
      type: 'call', contact_id: contact.body.id, description: 'First call', happened_at: '2026-01-01 10:00',
    });
    expect(a1.status).toBe(201);
    const a2 = await app.post('/api/activities').send({
      type: 'note', deal_id: deal.body.id, description: 'Second note', happened_at: '2026-02-01 10:00', due_date: '2026-12-31',
    });
    expect(a2.status).toBe(201);

    const list = await app.get('/api/activities');
    const idx1 = list.body.findIndex((a: { id: number }) => a.id === a1.body.id);
    const idx2 = list.body.findIndex((a: { id: number }) => a.id === a2.body.id);
    expect(idx2).toBeLessThan(idx1); // newest first

    const toggled = await app.put(`/api/activities/${a2.body.id}`).send({ done: true });
    expect(toggled.body.done).toBe(true);
    const untoggled = await app.put(`/api/activities/${a2.body.id}`).send({ done: false });
    expect(untoggled.body.done).toBe(false);

    expect((await app.delete(`/api/activities/${a1.body.id}`)).status).toBe(204);
    expect((await app.post('/api/activities').send({ type: 'note' })).status).toBe(400); // no description/target
  });

  it('shows a contact timeline including its activities', async () => {
    const app = freshApp();
    const contact = await app.post('/api/contacts').send({ name: 'Timeline Tess' });
    await app.post('/api/activities').send({ type: 'email', contact_id: contact.body.id, description: 'hello' });
    const detail = await app.get(`/api/contacts/${contact.body.id}`);
    expect(detail.body.activities.length).toBe(1);
    expect(detail.body.activities[0].description).toBe('hello');
  });
});

describe('dashboard aggregates', () => {
  it('reports won deals per month matching the underlying data', async () => {
    const app = freshApp();
    const dash = await app.get('/api/dashboard');
    expect(dash.status).toBe(200);
    const won = dash.body.wonByMonth as { month: string; deals: number; revenue: number }[];
    const totalDeals = won.reduce((n, w) => n + w.deals, 0);
    const totalRevenue = won.reduce((n, w) => n + w.revenue, 0);
    // seed data: 3 won deals ($120k + $210k + $95k) in three distinct months
    expect(totalDeals).toBe(3);
    expect(totalRevenue).toBe(425000);

    const pipeline = dash.body.pipeline as { stage: string; count: number }[];
    expect(pipeline.length).toBe(6);
    const stages = pipeline.map((p) => p.stage);
    expect(stages).toEqual(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);

    expect(dash.body.recentActivities.length).toBeGreaterThan(0);
  });
});
