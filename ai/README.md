# Zaster Master

Local personal finance app for importing German bank exports, categorizing transactions without paid AI, linking related movements, and analyzing spending.

| | |
|---|---|
| **Brand** | Zaster Master |
| **UI language** | German |
| **Privacy** | Local-only — data stays on your machine |
| **Auth** | None in v1 (single-user); may be added later |
| **Stack** | [Wasp](https://wasp.sh) + React + Prisma + PostgreSQL |
| **DB runtime** | Local PostgreSQL inside WSL (no Docker in v1) |
| **Windows** | **WSL required** — Wasp does not run natively on Windows |

Sample exports: [`Bankauszüge/`](../Bankauszüge/). Design assets: [`Design/`](../Design/). Feature specs: [`docs/`](docs/) (filled as features are built).

This README ([ai/README.md](ai/README.md)) is the product and architecture source of truth. Cursor rules in [`.cursor/rules/`](../.cursor/rules/) must match it.

---

## Goals

- Import statements from multiple German banks and wallets into one place.
- Categorize transactions for analysis **without subscriptions or API token costs**.
- Link related transactions (PayPal ↔ bank, account-to-account transfers) so they do not double-count in totals.
- Show what you actually own now, even when statement history is incomplete.
- Stay well structured and documented (`ai/docs/` + feature folders).

## Non-goals (v1)

- Authentication / multi-user (roadmap: may come later)
- Public cloud hosting (roadmap: may come later; not Fly.io in v1)
- Background job queue (import/related-detect use actions + UI progress instead)
- Docker / Compose (WSL + local Postgres + `wasp start` only)
- Paid cloud AI as the default categorizer
- Replacing your bank’s official app or doing payments

---

## Architecture

**Stack (locked):**

| Layer | Choice |
|---|---|
| Framework | Wasp (config in `main.wasp` / `main.wasp.ts`) |
| Frontend | React + TypeScript, Tailwind CSS, Shadcn/ui, Chart.js (or similar), **Lucide** icons |
| Backend | Node.js (Wasp server), TypeScript |
| Client ↔ server | **Wasp operations** (queries = read, actions = write) |
| Database | **PostgreSQL** via Prisma (`schema.prisma`) |
| DB process | **Local PostgreSQL** (install inside WSL on Windows); `DATABASE_URL` in `.env.server` |
| App process | `wasp start` (dev) — on Windows, run this **inside WSL** |
| Network | Localhost only in v1 |

**Why this stack:** Full-stack TypeScript with Wasp, Prisma models, typed operations, and a clear path to auth later. PostgreSQL fits Prisma well and leaves room for optional Jobs later. **No Docker in v1.**

**Windows / WSL:** Wasp needs a Unix environment. On Windows there is **no native install** — use **WSL** (e.g. Ubuntu). Docker does **not** replace WSL for day-to-day `wasp start` development. Install Node, Wasp CLI, and PostgreSQL **inside WSL**. Keep the project on the **Linux filesystem** (e.g. `~/projects/...`), not under `/mnt/c/...`, so file watching works. Cursor/VS Code can open the folder via the WSL remote.

```mermaid
flowchart LR
  exports[BankExports] --> importers[ImportActions]
  importers --> normalize[NormalizedTransactions]
  normalize --> categorize[HybridCategorizer]
  categorize --> pg[(PostgreSQL)]
  pg --> ops[WaspOperations]
  ops --> ui[ReactUI]
  ui --> analysis[ChartsAndFilters]
```

### Environment

On Windows: open an **Ubuntu (WSL)** terminal first. Install Node (nvm), Wasp CLI, and PostgreSQL there.

```bash
# PostgreSQL running locally in WSL; DATABASE_URL set in .env.server
wasp db migrate-dev        # after schema changes
wasp start                 # client + server
```

| Piece | Role | Typical port |
|---|---|---|
| PostgreSQL (local / in WSL) | Database | `5432` |
| Wasp server | Operations / APIs | Wasp default (often `3001`) |
| Wasp client | React UI | Wasp default (often `3000`) |

**Persistence:** Normal Postgres data directory in WSL. Back up that DB (or dumps) if you care about your history.

**Privacy:** Do not publish `Bankauszüge/` or DB dumps. Keep the app on localhost.

**Design assets:** Serve logo + background from the client (`Design/` or `public/`).

**Docker:** Out of scope for v1. It is not required for Wasp on Windows (use WSL instead). May revisit later for packaging.

### Background jobs — what they are (and v1 choice)

A **job queue** (in Wasp: Jobs + PgBoss on PostgreSQL) runs long work **outside** a single HTTP request: e.g. scanning all transactions for related pairs, huge imports, later ML training.

**v1 decision: no job queue.** Import and “Zusammengehörige Transaktionen erkennen” run in actions with UI progress. Add Jobs later if those flows feel too slow or time out.

---

## Documentation & conventions

- **Config source of truth:** `main.wasp` (routes, pages, operations) + `schema.prisma` (models).
- **Feature docs (existing):** [`prd.md`](docs/prd.md), [`implementation-plan.md`](docs/implementation-plan.md), [`design.md`](docs/design.md), [`transactions.md`](docs/transactions.md) (includes related-detect), [`analysis.md`](docs/analysis.md), [`categorization.md`](docs/categorization.md). Import and accounts domain rules live in **this README** until split out. Update the matching doc when behavior changes.
- **Code:** `src/features/{featureName}/` with `operations.ts` for that feature’s queries/actions.
- **Regions in `main.wasp`:** group feature declarations with `//#region` / `//#endregion`.
- **TypeScript only** for app code (`.ts` / `.tsx`).
- **Imports:** `wasp/...` in TS/TSX; `@src/...` only inside `main.wasp`; relative imports within `src/`.
- **Deps:** `npm install` (do not stuff dependencies into `main.wasp`).

---

## Domain model (Prisma)

Define models in `schema.prisma`. Apply with `wasp db migrate-dev`.

### Transaction

| Field | Notes |
|---|---|
| `datum` | `DateTime` @ date |
| `betrag` | Signed Decimal: income `>`, expense `<` |
| `sender`, `empfaenger`, `verwendungszweck`, `iban`, `kundenreferenz` | From export |
| `categoryId`, `subcategoryId` | FK; defaults Sonstige / Unbekannt |
| `confidenceScore` | Manual edit → `1.0` |
| `bank` | `dkb` \| `sparkasse` \| `paypal` \| `traderepublic` |
| `konto` | e.g. Girokonto, Tagesgeld, PayPal |
| `balance` | Optional export snapshot; not a full ledger |
| `relatedTransactionId` | One link; confirm writes both directions |

**Dedup key:** unique on `(bank, konto, datum, betrag, verwendungszweck, iban, kundenreferenz)` (normalize empty `iban` / `kundenreferenz` to `''` so NULLs don’t bypass uniqueness). Bank+Konto are included because PayPal/Trade Republic rows often lack IBAN.

Importers normalize to the same logical columns: Datum, Betrag, Sender\*in, Empfänger\*in, Verwendungszweck, IBAN, Kundenreferenz, Bank, Konto, balance.

### Account & balance calibration

Incomplete history is expected. Accounts are first-class:

1. User enters **current bank balance** + **as-of date** per account.
2. That is the truth for that account’s “money I own now.”
3. App derives an **implied opening balance** at the start of imported history (or synthesizes an opening transaction marked as balance plumbing — visible in Transaktionen if we keep it, but **excluded from Analyse**).
4. Row `balance` stays snapshot metadata; it does not drive the header.

**Header balance** = **sum of calibrated balances across all accounts** (total wealth). Not “balance of the currently filtered Konto” unless we add that later.

Ask for current balance on first upload of a new account.

### Categories & learned rules

Full model + editing + algorithm: [`docs/categorization.md`](docs/categorization.md).  
Seed: [`categories_seed.json`](../categories_seed.json). PostgreSQL is source of truth (not live JSON).

### Related transactions

Bidirectional link; used for navigation and **netting in analysis**.

---

## Categorization (hybrid, free by default)

Full spec: [`ai/docs/categorization.md`](docs/categorization.md).

**Order:** learned rules (if any) → keywords (sub then main) → Sonstige/Unbekannt. Manual → `1.0` + optional “merken” (Slice 3 Thick). Konfidenz color follows **source**. Tree CRUD in Einstellungen; seed from `categories_seed.json`.

---

## Import pipeline

Wasp **action** (multipart upload + required `bank` — not auto-detected):

1. Validate structure for that bank.
2. Bank-specific importer → normalized rows.
3. Keep UTF-8 / umlauts.
4. Auto-categorize (hybrid).
5. Insert with dedup.
6. Return `{ success, importedCount, duplicateCount, … }`.

**v1 sources:** DKB, Sparkasse, PayPal, Trade Republic (`Bankauszüge/`).

Parsing of messy German CSV/TXT lives in TypeScript server modules under `src/features/import/` (Papa Parse or similar). Keep importers versioned and testable.

---

## Related transactions

**Tolerance:** ±3 days, ±0.01 €.

| Type | Idea |
|---|---|
| PayPal ↔ bank | Same abs amount, **same sign**, within tolerance (both look like expenses when funding a purchase, or both income on refund) |
| Internal transfers | ≈ **opposite** amounts; different bank/konto; purpose keywords (`überweisung`, `umbuchung`, …) or name cross-match |
| Near-duplicates | Same date/bank/amount + ≥50% purpose-word overlap — suggest link or flag; do **not** auto-delete |

**Flow:** detect action → UI review → confirm/reject → bidirectional IDs.  
**Detailed frontend + detection plan:** [`ai/docs/transactions.md`](docs/transactions.md) (section *Zusammengehörige Transaktionen erkennen*).  
**Analysis:** net confirmed pairs so totals/charts do not double-count ([`analysis.md`](docs/analysis.md)).

---

## UI

**Shell:** root React component with shared header + `<Outlet />` for pages (Wasp routes).

**Header (primary nav — no tab carousel):**

| Element | Role |
|---|---|
| Logo | Brand mark from `Design/Zaster_Master_Logo.svg` (default route: Transaktionen) |
| Balance | Calibrated total, `de-DE` EUR |
| Upload icon | Upload page |
| Settings icon | Einstellungen → Kategorien (v1) |
| Transaktionen icon | Transaktionen |
| Analyse icon | Analyse |

| Page | Role |
|---|---|
| **Upload** | Bank + file drop; progress; lock nav while importing; then → Transaktionen |
| **Einstellungen / Kategorien** | Manage the category tree: create/rename/delete/recolor categories; add/edit/remove **subcategories**; edit **keywords** on a main category and/or on each subcategory (these drive auto-categorization on import) |
| **Transaktionen** | Table + page summary (income / expenses / count for **current table filters**, default: no date filter = all imported txs); confidence; details; related detect |
| **Analyse** | Filtered period insights: trend, category pies, expandable breakdowns; related pairs netted |

**Styling stack:** Tailwind + Shadcn/ui in `src/components`; German copy; desktop-primary.

Full visual requirements: [`ai/docs/design.md`](docs/design.md).

### Transaktionen (details)

Full spec: [`ai/docs/transactions.md`](docs/transactions.md).

- Wide filterable/paginated table; summary strip for **current table filters** (default: all time).
- Default columns + optional IBAN / Kundenreferenz / Verknüpfung via Filter & Optionen.
- Details overlay (categorize; “merken” = Slice 3 Thick); related-detect overlay (progress → confirm/reject).
- Both legs of a link stay visible here; Analyse does the netting.

### Analyse (details)

Full spec: [`ai/docs/analysis.md`](docs/analysis.md).

**Defaults:** all Konten, current calendar year (1 Jan → today).

**Filters:** Zeitraum (year / month / custom from–to), optional Kategorie / Unterkategorie, multi bank/Konto, Typ (alle / Ausgaben / Einnahmen).

**Views:** (1) Zeitlicher Trend Einnahmen vs Ausgaben · (2) Ausgaben nach Kategorie · (3) Einnahmen nach Kategorie · (4) Ausgaben-Aufschlüsselung · (5) Einnahmen-Aufschlüsselung — plus summary strip (Einnahmen, Ausgaben, Netto, Buchungen).

**Netting:** confirmed related pairs must not double-count; own-account transfers drop both legs when both are in scope; PayPal↔bank counts the PayPal/wallet leg once when both are in scope. Server-side aggregation only.

---

## Operations surface (Wasp)

Prefer **queries/actions** over custom HTTP APIs for app features. Use `api` routes only for external integrations if ever needed.

| Area | Kind | Purpose |
|---|---|---|
| Upload / import | action | Parse + insert + categorize |
| Transactions | query + actions | List (paginated), categorize, delete-all |
| Related | actions + query | Detect, confirm, list |
| Categories | query + actions | CRUD → Postgres |
| Accounts | query + actions | Calibrated balance |
| Analysis | queries | Aggregates + stats |

Analysis aggregates must net related pairs. Paginate large lists.

---

## Product rules

- Signed amounts; UI `de-DE` EUR.
- Export row balance = snapshot; wealth = account calibration.
- Re-uploads must not duplicate rows.
- Manual edits can create learned rules.
- Related pairs must not double-count in totals/charts.
- Keep umlauts / text fidelity on import.
- Update `ai/docs/` when features change.
- No auth checks in v1 operations; design models so a future `User` relation is possible without a full rewrite.

---

## Known challenges & solutions

| Challenge | Solution |
|---|---|
| Incomplete history | Account balance calibration |
| PayPal + bank double count | Related links + analysis netting |
| Own-account transfers | Same |
| Format drift | Versioned importers + validation |
| No paid AI | Hybrid keywords + learned rules |
| Overlapping exports | Dedup key |
| Long related-detect | v1: action + progress UI; later: Wasp Jobs if needed |

---

## Project layout (target)

```
zastermaster/
  ai/README.md              # product source of truth
  ai/docs/                  # feature specs
  main.wasp                 # app, routes, pages, operations
  schema.prisma             # PostgreSQL models
  .env.server               # DATABASE_URL (gitignored secrets)
  src/
    features/
      import/
      transactions/
      categories/
      related/
      analysis/
      accounts/
    components/             # Shadcn + shared UI
    App.tsx                 # root: header + Outlet
  categories_seed.json      # category tree seed (repo root)
  Design/
  Bankauszüge/
  .cursor/rules/
```

---

## Roadmap

### v1

- Wasp app + Prisma + local PostgreSQL (no Docker)
- `ai/docs/` for core features
- Importers: DKB, Sparkasse, PayPal, Trade Republic
- Hybrid categorization + Einstellungen/Kategorien
- Header icon nav; Transaktionen / Analyse / Upload
- Related detect → confirm + analysis netting (action + progress UI, no job queue)
- Account balance calibration
- Design background + logo, German UI ([`ai/docs/design.md`](docs/design.md))
- Cursor rules aligned with this README

### Later

- Auth (Wasp built-in), if sharing or remote access is needed
- Cloud deploy (e.g. Fly.io), if leaving pure local-only
- Optional Docker packaging / Compose
- Wasp Jobs for long related-detect / heavy import / ML
- Stronger transfer netting
- Optional local ML / optional cloud AI categorization
- More banks, Excel/PDF export, Report tab, more Einstellungen
