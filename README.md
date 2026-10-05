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

The server supports a single-user login (username + password, session cookie).

- **Local development:** `npm run dev` sets `CRM_AUTH_DISABLED=true`, so no login
  is needed while developing.
- **Production:** set these environment variables (e.g. in a systemd `EnvironmentFile`):
  - `CRM_USERNAME` — login username (default: `vic`)
  - `CRM_PASSWORD_HASH` — scrypt hash of the password (see below)
- If neither `CRM_PASSWORD_HASH` nor `CRM_AUTH_DISABLED=true` is set, the server
  **refuses to start** rather than running open.
- To set or rotate the password: `cd server && npm run set-password`
  (prompts twice, stores only the hash in `server/.env`, mode 600).

All `/api` routes except `/api/health`, `/api/login`, `/api/logout`, and `/api/me`
require a valid session. The login endpoint is rate-limited (10 attempts per
10 minutes per IP).

> Note: the app is served over plain HTTP. Credentials are protected in transit
> only if you put TLS in front of it (reverse proxy with a certificate).

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
