import type { DatabaseSync } from 'node:sqlite';

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDateTimeDaysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function monthAgo(monthsBack: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(Math.min(day, 28));
  return d.toISOString().slice(0, 10);
}

export function seedDatabase(db: DatabaseSync): void {
  const insertOrg = db.prepare(
    'INSERT INTO organizations (name, website, industry, notes) VALUES (?, ?, ?, ?)',
  );
  const orgIds: Record<string, number> = {};
  const orgs: [string, string, string, string, string][] = [
    ['acme', 'Acme Logistics', 'acmelogistics.com', 'Logistics', 'National freight carrier, 400-truck fleet. Evaluating telematics vendors.'],
    ['brightline', 'Brightline Health', 'brightlinehealth.com', 'Healthcare', 'Regional hospital network, 12 facilities. Modernizing patient systems.'],
    ['copperfield', 'Copperfield Manufacturing', 'copperfieldmfg.com', 'Manufacturing', 'Precision parts maker. Running a smart-factory pilot program.'],
    ['driftwell', 'Driftwell Media', 'driftwellmedia.com', 'Media', 'Digital publisher, 8M monthly readers. Rebuilding their ad stack.'],
    ['evergreen', 'Evergreen Retail Group', 'evergreenretail.com', 'Retail', '120-store grocery chain across the Midwest.'],
    ['foundry', 'Foundry & Co', 'foundryco.com', 'Financial Services', 'Boutique investment firm. Strict compliance requirements.'],
    ['harborview', 'Harborview Hospitality', 'harborviewhotels.com', 'Hospitality', '14 boutique hotels on the east coast.'],
    ['northbeam', 'Northbeam Energy', 'northbeamenergy.com', 'Energy', 'Commercial solar installer expanding into grid services.'],
  ];
  for (const [key, name, website, industry, notes] of orgs) {
    orgIds[key] = Number(insertOrg.run(name, website, industry, notes).lastInsertRowid);
  }

  const insertContact = db.prepare(
    'INSERT INTO contacts (name, email, phone, title, organization_id, status) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const contactIds: Record<string, number> = {};
  const contacts: [string, string, string, string, string, string, string][] = [
    ['sarah', 'Sarah Chen', 'sarah.chen@acmelogistics.com', '555-010-2241', 'VP Operations', 'acme', 'qualified'],
    ['marcus', 'Marcus Webb', 'marcus.webb@acmelogistics.com', '555-010-2242', 'Procurement Manager', 'acme', 'lead'],
    ['priya', 'Dr. Priya Nair', 'priya.nair@brightlinehealth.com', '555-010-3310', 'Chief Information Officer', 'brightline', 'customer'],
    ['tom', 'Tom Becker', 'tom.becker@brightlinehealth.com', '555-010-3311', 'IT Director', 'brightline', 'qualified'],
    ['angela', 'Angela Rossi', 'angela.rossi@copperfieldmfg.com', '555-010-4472', 'Chief Operating Officer', 'copperfield', 'customer'],
    ['dave', 'Dave Kim', 'dave.kim@copperfieldmfg.com', '555-010-4473', 'Plant Manager', 'copperfield', 'lead'],
    ['jess', 'Jess Morales', 'jess.morales@driftwellmedia.com', '555-010-5530', 'Chief Marketing Officer', 'driftwell', 'qualified'],
    ['leo', 'Leo Park', 'leo.park@driftwellmedia.com', '555-010-5531', 'Marketing Manager', 'driftwell', 'lead'],
    ['rachel', 'Rachel Torres', 'rachel.torres@evergreenretail.com', '555-010-6684', 'VP Sales', 'evergreen', 'customer'],
    ['sam', 'Sam Okafor', 'sam.okafor@evergreenretail.com', '555-010-6685', 'Store Operations Lead', 'evergreen', 'qualified'],
    ['james', 'James Whitfield', 'james.whitfield@foundryco.com', '555-010-7719', 'Chief Financial Officer', 'foundry', 'qualified'],
    ['nina', 'Nina Petrova', 'nina.petrova@foundryco.com', '555-010-7720', 'Controller', 'foundry', 'lead'],
    ['olivia', 'Olivia Grant', 'olivia.grant@harborviewhotels.com', '555-010-8842', 'General Manager', 'harborview', 'qualified'],
    ['chris', 'Chris Doyle', 'chris.doyle@harborviewhotels.com', '555-010-8843', 'Front Office Manager', 'harborview', 'lead'],
    ['ben', 'Ben Alvarez', 'ben.alvarez@northbeamenergy.com', '555-010-9961', 'VP Engineering', 'northbeam', 'customer'],
    ['kate', 'Kate Morrison', 'kate.morrison@northbeamenergy.com', '555-010-9962', 'Sustainability Lead', 'northbeam', 'qualified'],
  ];
  for (const [key, name, email, phone, title, org, status] of contacts) {
    contactIds[key] = Number(insertContact.run(name, email, phone, title, orgIds[org], status).lastInsertRowid);
  }

  const insertDeal = db.prepare(
    'INSERT INTO deals (name, organization_id, contact_id, stage, value, probability, close_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const dealIds: Record<string, number> = {};
  const deals: [string, string, string, string, string, number, number, string][] = [
    ['acme-fleet', 'Acme Logistics — Fleet tracking rollout', 'acme', 'sarah', 'proposal', 48000, 50, isoDateDaysFromNow(45)],
    ['brightline-portal', 'Brightline — Patient portal integration', 'brightline', 'priya', 'won', 120000, 100, monthAgo(1, 10)],
    ['copperfield-sensors', 'Copperfield — Factory sensor pilot', 'copperfield', 'angela', 'negotiation', 85000, 75, isoDateDaysFromNow(30)],
    ['driftwell-analytics', 'Driftwell — Ad analytics platform', 'driftwell', 'jess', 'qualified', 32000, 25, isoDateDaysFromNow(60)],
    ['evergreen-pos', 'Evergreen — POS upgrade (120 stores)', 'evergreen', 'rachel', 'won', 210000, 100, monthAgo(2, 22)],
    ['foundry-compliance', 'Foundry — Compliance reporting suite', 'foundry', 'james', 'proposal', 64000, 50, isoDateDaysFromNow(60)],
    ['harborview-wifi', 'Harborview — Guest wifi overhaul', 'harborview', 'olivia', 'new', 28000, 10, isoDateDaysFromNow(105)],
    ['northbeam-grid', 'Northbeam — Grid monitoring dashboard', 'northbeam', 'ben', 'won', 95000, 100, monthAgo(3, 18)],
    ['acme-warehouse', 'Acme — Warehouse automation phase 2', 'acme', 'marcus', 'new', 54000, 10, isoDateDaysFromNow(130)],
    ['driftwell-licensing', 'Driftwell — Content licensing deal', 'driftwell', 'leo', 'lost', 18000, 0, monthAgo(1, 5)],
    ['evergreen-loyalty', 'Evergreen — Loyalty program rebuild', 'evergreen', 'sam', 'negotiation', 72000, 75, isoDateDaysFromNow(20)],
    ['copperfield-erp', 'Copperfield — ERP connector', 'copperfield', 'dave', 'qualified', 41000, 25, isoDateDaysFromNow(75)],
  ];
  for (const [key, name, org, contact, stage, value, probability, closeDate] of deals) {
    dealIds[key] = Number(
      insertDeal.run(name, orgIds[org], contactIds[contact], stage, value, probability, closeDate).lastInsertRowid,
    );
  }

  const insertActivity = db.prepare(
    'INSERT INTO activities (type, contact_id, deal_id, description, happened_at, due_date, done) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const A: [string, string | null, string | null, string, number, string, number][] = [
    // type, contact, deal, description, daysAgo(+hour), dueDate('' or relative), done
    ['email', 'sarah', 'acme-fleet', 'Sent the revised proposal with volume pricing for 400 trucks.', 1, '', 0],
    ['call', 'sarah', 'acme-fleet', 'Discovery call: their biggest pain is fuel reporting, not routing.', 6, '', 0],
    ['note', 'james', 'foundry-compliance', 'James wants legal to review the DPA before we go further.', 2, isoDateDaysFromNow(4), 0],
    ['call', 'angela', 'copperfield-sensors', 'Pilot kickoff went well. They want pricing for a full rollout by month end.', 3, '', 0],
    ['email', 'angela', 'copperfield-sensors', 'Sent full-rollout pricing options.', 1, '', 0],
    ['note', 'priya', 'brightline-portal', 'Won! Priya signed the order form. Implementation starts next quarter.', 30, '', 0],
    ['call', 'rachel', 'evergreen-pos', 'Rollout complete across all 120 stores. Ask for a reference quote.', 45, '', 0],
    ['email', 'ben', 'northbeam-grid', 'Contract signed. Ben introduced us to their grid services team.', 75, '', 0],
    ['note', 'jess', 'driftwell-analytics', 'Jess asked for a technical deep-dive with their data team.', 4, isoDateDaysFromNow(2), 0],
    ['call', 'leo', 'driftwell-licensing', 'Lost to an incumbent. Leo said pricing was the deciding factor.', 32, '', 0],
    ['email', 'sam', 'evergreen-loyalty', 'Sam is championing us internally; needs a one-pager for the CFO.', 2, '', 0],
    ['note', 'sam', 'evergreen-loyalty', 'Draft the CFO one-pager: focus on payback period.', 2, isoDateDaysFromNow(-2), 0],
    ['call', 'olivia', 'harborview-wifi', 'Intro call. Olivia is comparing three vendors on coverage maps.', 8, '', 0],
    ['email', 'marcus', 'acme-warehouse', 'Marcus requested a site visit to the Memphis distribution center.', 5, isoDateDaysFromNow(6), 0],
    ['note', 'dave', 'copperfield-erp', 'Dave needs IT security sign-off before the pilot can start.', 3, isoDateDaysFromNow(-5), 0],
    ['call', 'tom', 'brightline-portal', 'Tom confirmed the integration timeline with their EHR vendor.', 28, '', 0],
    ['note', 'nina', 'foundry-compliance', 'Nina asked about SOC 2 documentation — send the report.', 7, isoDateDaysFromNow(1), 1],
    ['email', 'kate', 'northbeam-grid', 'Kate wants a sustainability impact summary for their board.', 10, '', 0],
    ['call', 'chris', 'harborview-wifi', 'Chris walked me through their current access point layout.', 9, '', 0],
    ['note', 'sarah', null, 'Sarah mentioned they are hiring a new logistics director in Q1.', 12, '', 0],
    ['email', 'jess', null, 'Sent Jess the case study from the Evergreen rollout.', 11, '', 0],
    ['call', 'rachel', null, 'Quarterly check-in: Rachel is happy, renewal conversation in spring.', 20, isoDateDaysFromNow(10), 0],
    ['note', 'ben', null, 'Ben is speaking at the solar expo — good networking opportunity.', 15, isoDateDaysFromNow(-1), 0],
    ['email', 'priya', null, 'Thank-you note after the go-live. Priya offered a reference call.', 29, '', 0],
  ];
  for (const [type, contact, deal, description, daysAgo, due, done] of A) {
    insertActivity.run(
      type,
      contact ? contactIds[contact] : null,
      deal ? dealIds[deal] : null,
      description,
      isoDateTimeDaysFromNow(-daysAgo),
      due,
      done,
    );
  }
}
