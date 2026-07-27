# Shipping plan — Zaster Master

How to **distribute the app to other people** without putting bank data online.  
Status: **ready for local ship** — checklist complete (smoke-tested 2026-07-27).

Related: [`../README.md`](../README.md) · [`../../ANLEITUNG.md`](../../ANLEITUNG.md) · [`.cursor/rules/8-environment-deployment.mdc`](../../.cursor/rules/8-environment-deployment.mdc) · [`design.md`](design.md)

---

## Goals

| Goal | Decision |
|---|---|
| Who runs it | Each person installs and runs **locally** on their own PC |
| What may be online | **Code only** (public Git repo is OK) |
| What must stay local | Bank exports, Postgres data, user settings / balances |
| Audience | **Windows**, little / no development experience |
| Allowed installs | **Docker Desktop** (required) + **Git** (clone / update) |
| Updates | `git pull` + start/update script |
| Auth / cloud hosting | **Out of scope** (no shared server, no login) |

---

## Non-goals

- Cloud deploy (Fly, Railway, …)
- Multi-user / auth
- Native `.exe` without Docker
- End-user **feature manual** (how Analyse / Kategorien work) — that stays in `ai/docs/*` for developers
- Publishing `Bankauszüge/`, DB dumps, or real `.env` files

---

## Public repo & privacy

Making the GitHub/GitLab repo **public is fine** if:

- `Bankauszüge/` stays gitignored (already)
- Real `.env` / `.env.server` stay gitignored (already)
- No personal CSVs, screenshots with balances, or DB dumps in history
- Only examples like `.env.server.example` (localhost dummy credentials) are committed

**Runtime privacy:** Ship bind addresses are **`127.0.0.1` only** — not reachable from the internet or other LAN devices by default. Data lives in a **local Docker volume**.

Before going public: scan the repo + git history once for accidental secrets / real bank files.

---

## Target UX (end user)

1. Install **Docker Desktop** and start it  
2. Install **Git** (if missing)  
3. `git clone` the public repo  
4. Run **`start.bat`** (or equivalent) → `docker compose up --build -d`  
5. Open **`http://zastermaster`** in the browser (no port in the URL)  
6. Update later: **`update.bat`** → `git pull` + rebuild/restart  
7. Stop: **`stop.bat`**

**Docs to write for them:** setup / install / update / backup / troubleshooting only — **not** how to use the finance features.

---

## Friendly URL: `http://zastermaster`

Users should not type `localhost:3000`.

| Piece | Approach |
|---|---|
| Hostname | Windows **hosts** entry: `127.0.0.1 zastermaster` (once; needs Admin) |
| Port | Map UI to **port 80** on `127.0.0.1` so the URL has no `:port` |
| Fallback | If 80 is taken: `http://127.0.0.1:3080` (document in setup guide) |

Still localhost-only; this is not exposing the app on the internet.

---

## Architecture (ship)

```mermaid
flowchart LR
  User[Windows_User]
  DT[Docker_Desktop]
  Git[Git_Repo_Code_Only]
  Compose[compose_ship]
  DB[(Postgres_Volume_local)]
  Server[Wasp_Server]
  Client[Static_Client]

  User --> DT
  User -->|"git clone / pull"| Git
  Git --> Compose
  DT --> Compose
  Compose --> DB
  Compose --> Server
  Compose --> Client
  User -->|"http://zastermaster"| Client
  Client --> Server
  Server --> DB
```

### Full stack in Docker (ship)

For **recipients** (and when you run the ship path), **everything runs in Docker**:

| Piece | Where it lives |
|---|---|
| PostgreSQL | Container `zastermaster-ship-db` (volume `zastermaster_ship_pgdata`) |
| Node / Wasp server | Built **inside** `ship/Dockerfile` (Wasp CLI + `npm` in the image) → `zastermaster-ship-server` |
| React client | Vite production build in the image → static files in `zastermaster-ship-client` |
| Host needs | **Docker Desktop** + **Git** only — **no** WSL, Node, or Wasp CLI on the PC |

Dependencies (Node modules, Prisma, Wasp toolchain) are resolved at **image build** time and stay inside the images/containers.

### Contrast with maintainer **dev**

| | Dev (you coding) | Ship (end users / try-ship) |
|---|---|---|
| Compose file | [`docker-compose.yml`](../../docker-compose.yml) | [`docker-compose.ship.yml`](../../docker-compose.ship.yml) |
| Project / containers | `zastermaster-db` | `zastermaster-ship-*` |
| Postgres volume | `zastermaster_pgdata` | `zastermaster_ship_pgdata` |
| App process | `wasp start` in **WSL** | Server + client **containers** |
| Host ports (typical) | DB `5432`, Wasp `3000`/`3001` | UI `80` (+ fallback `3080`), API **`3002`** |

Dev workflow for day-to-day coding stays unchanged (WSL + `wasp start` + `docker compose up -d db`).

### Trying ship on the same PC as dev (safe)

**Yes** — ship does **not** wipe or reuse your dev database or WSL setup.

- Separate Compose **project name** (`zastermaster-ship`) and **volume**
- Does not modify `.env.server` / `Bankauszüge/` / your WSL Node install
- Dev Postgres on `5432` can keep running while you try ship

**Parallel with maintainer:** ship API uses host port **`3002`** so `wasp start` can keep **`3001`**. Before / after trying ship you only need `start.bat` / `stop.bat` — no need to stop Wasp for the API port.

You can leave `docker compose up -d db` (dev) and even `wasp start` running; ship UI is on `80`/`3080`, ship API on `3002`.

---

## Deliverables (implemented)

### 1. Compose + images

- Ship Compose file (e.g. `docker-compose.ship.yml` or Compose profile `ship`)
- Services: `db`, `server`, `client`
- Internal `DATABASE_URL` to `db`
- `WASP_WEB_CLIENT_URL` / `WASP_SERVER_URL` aligned with `http://zastermaster`
- Publish ports only as `127.0.0.1:80:…` (and fallback mapping if needed)
- Named volume for Postgres (survives updates)
- Multi-stage Dockerfiles: Wasp build in builder → server image; Vite static → nginx (or similar) for client
- Run migrations on server start (Wasp default)

### 2. Windows scripts (repo root)

- `start.bat` — ensure Docker running, compose up --build, open browser optional  
- `stop.bat`  
- `update.bat` — `git pull` + compose up --build  
- Optional `backup.bat` — `pg_dump` to a folder on disk  
- Optional helper to add the `zastermaster` hosts entry (UAC/Admin once)

### 3. Env

- `.env.ship.example` → copied to gitignored `.env.ship` on first start  
- No real secrets in git

### 4. Documentation

| Doc | Audience | Content |
|---|---|---|
| **This file** [`shipping-plan.md`](shipping-plan.md) | Maintainer / agents | Requirements + architecture + checklist |
| Setup guide e.g. `ANLEITUNG.md` (root or `docs/`) | End users | Docker, Git, clone, start, update, URL, backup, troubleshooting — **setup only** |
| Update [`../README.md`](../README.md) + env Cursor rule | Devs | Point to ship path; keep “dev = Postgres-only Compose” |

**Not** an end-user product handbook.

### 5. Asset layout

Static design assets live only under **`public/design/`** (logos, nav SVGs, background rasters). There is no separate `Design/` folder.
---

## Honest constraints

- First `compose up --build` (and updates that change dependencies) can take **several minutes**
- Git is a second install beside Docker (needed for update path)
- Port 80 can conflict with other Windows software → fallback `3080`
- Hosts edit needs one elevated run
- On a maintainer machine: ship API is on **`3002`** so it can run beside `wasp start` (`3001`)

---

## Implementation checklist

- [x] Ship Compose + Dockerfiles (server + client) — `docker-compose.ship.yml`, `ship/Dockerfile`
- [x] Localhost-only publish + `zastermaster` hosts helper — `setup-hosts.bat`
- [x] `start` / `stop` / `update` / `backup` `.bat`
- [x] `.env.ship.example` + first-run copy in `start.bat`
- [x] End-user **setup** guide (`ANLEITUNG.md`)
- [x] Link from README + environment Cursor rule
- [x] Smoke test: `docker compose -f docker-compose.ship.yml up --build` — client `:80`/`:3080`, server host `:3002`, migrations + backgrounds OK (2026-07-27)
- [x] Pre-public repo scan — `Bankauszüge/`, `.env.ship`, `.env.server`, `backups/` gitignored; only `.env.*.example` for env templates (confirm before making repo public)

---

## Decision log

| Date | Decision |
|---|---|
| 2026-07-27 | Local install per person; code may be public; data never online |
| 2026-07-27 | Docker Desktop OK as only heavy prerequisite; Git for clone/update |
| 2026-07-27 | Updates via `git pull` + scripts |
| 2026-07-27 | Friendly URL `http://zastermaster` (port 80 + hosts); bind `127.0.0.1` |
| 2026-07-27 | Setup Anleitung yes; app usage Anleitung no |
| 2026-07-27 | Public repo OK given gitignore + localhost runtime |
| 2026-07-27 | Ship = full Docker stack (db+server+client); safe beside dev via separate volume; ship API host port **3002** (wasp keeps 3001) |
