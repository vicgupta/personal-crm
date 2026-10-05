# Personal CRM

A simple, single-user sales CRM — your own private Salesforce on your own computer.
Data lives in a SQLite file on your machine. The deployed server is protected by a
username + password login (see "Login & security" below).

## Quick start

Prerequisites: Node.js 22+ and npm.

```bash
npm install   # first time only
npm run dev   # start everything
```

Then open **http://localhost:5173** in your browser.

That's it — one command starts the API server (port 4000) and the web app (port 5173).
Both bind to `0.0.0.0`, so the app is reachable through mapped container ports too.

On first launch the SQLite database is created at `server/data/crm.db` and seeded with
realistic sample data, so every screen looks alive immediately. To start over with a fresh
database, stop the app and delete `server/data/crm.db`.

## Login & security

The server supports username + password login (session cookie). Credentials are
stored as scrypt hashes in the SQLite `users` table — never in plaintext, never
in environment files.

- **Local development:** `npm run dev` sets `CRM_AUTH_DISABLED=true`, so no login
  is needed while developing.
- **Production:** the server refuses to start unless at least one user exists in
  the database. Manage users from the `server/` directory:
  - `npm run user list` — show login users
  - `npm run user add <username>` — create a user (prompts for password)
  - `npm run user set-password <username>` — rotate a password
  - `npm run user remove <username>` — remove a user (refuses to remove the last one)
- **First-time bootstrap:** if the `users` table is empty and `CRM_PASSWORD_HASH`
  (+ optional `CRM_USERNAME`, default `vic`) is set, the server creates that user
  once at startup. This is the migration path from env-file auth.
- All `/api` routes except `/api/health`, `/api/login`, `/api/logout`, and `/api/me`
  require a valid session. The login endpoint is rate-limited (10 attempts per
  10 minutes per IP). Session cookies are `HttpOnly`, `SameSite=Lax`, and marked
  `Secure` when served over HTTPS.

The production deployment sits behind Caddy, which terminates TLS:
**https://nova.kantsy.com** (the app itself listens on localhost:4000 only).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the API + web app together (development) |
| `npm run test` | Run all unit tests (server + client) |
| `npm run build` | Build the web app for production |

## Layout

- `server/` — Express + SQLite (`node:sqlite`) REST API. Run alone with `npm run dev -w server`.
- `client/` — Vite + React + TypeScript frontend. Run alone with `npm run dev -w client`.
- API base: `/api` (the Vite dev server proxies it to the API server).

## Data model

- **Organizations** — companies you sell to (name, website, industry, notes)
- **Contacts** — people (name, email, phone, title, organization, status: lead / qualified / customer)
- **Deals** — potential sales (name, organization, contact, stage, value in USD, probability, close date)
- **Activities** — notes, calls and emails on contacts/deals; with an optional due date an activity
  doubles as a follow-up task

Pipeline stages: New → Qualified → Proposal → Negotiation → Won → Lost.
