# Implementation plan (LLM coding guide)

Actionable runbook for building Zaster Master. **Behavior details live in feature docs** — this file sequences work and is the **only** slice roadmap (see [`prd.md`](prd.md) for MVP boundaries).

**How to use with an LLM:** One slice at a time. Paste the **Slice card** + linked specs. Finish **Thin DoD** before Thick or the next slice. Do not implement Out-of-scope items for that slice.

---

## Global rules (every coding session)

1. **Stack:** Wasp + React + Prisma + PostgreSQL. No auth. Docker **only** for Postgres (`docker compose up -d db`). No custom REST for app features.
2. **Source of truth:** [`ai/README.md`](../README.md) · [`prd.md`](prd.md) · feature docs linked on each card.
3. **Layout:** `src/features/{feature}/operations.ts` + page components; group `main.wasp` with `//#region`.
4. **German UI** copy. Design: [`design.md`](design.md) (background + logo + frosted panel).
5. **After schema change:** `wasp db migrate-dev`.
6. **Do not:** OpenSaaS/auth, all models upfront, Jobs, Fly.io, perfect mobile, full related-detect before Slice 8.
7. **Done means Thin DoD** on the active card is checked; then stop or start Thick only if asked.

**Template:** `wasp new` → **minimal** or **basic** (not OpenSaaS). Work in **WSL** on the Linux filesystem.

**Seed file:** repo-root `categories_seed.json` (move/copy into app as needed; path noted in Slice 1).

---

## Progress tracker

| Slice | Name | Thin | Thick |
|---|---|---|---|
| 0 | Foundation | ☑ | ☑ |
| 1 | Categories | ☑ | ☑ |
| 2 | Import DKB + list | ☑ | ☑ |
| 3 | Categorize | ☑ | ☑ |
| 4 | Accounts / balance | ☑ | ☑ |
| 5 | Transaktionen UX | ☑ | ☑ |
| 6 | Analyse | ☑ | ☑ |
| 7 | More banks | ☑ | ☑ |
| 8 | Related txs | ☑ | ☑ |
| 9 | Hardening | ☑ | ☑ |

**MVP complete** when Thin of slices **0–6** are done (Analyse thin = summary only).

---

## Slice 0 — Foundation

**Goal:** Runnable Wasp app with shell + 4 navigable empty pages.

**Specs:** [`design.md`](design.md) · [`prd.md`](prd.md) Slice 0

### Thin steps

1. In WSL: create app with `wasp new` (minimal/basic) in the project (or subfolder agreed with user); wire Postgres `DATABASE_URL` in `.env.server`.
2. Confirm `wasp start` works.
3. Set `app.client.rootComponent` → shell with `<Outlet />`.
4. Add routes/pages: Upload, Einstellungen, Transaktionen (default), Analyse.
5. Header: logo (`Design/Zaster_Master_Logo.svg`), placeholder balance, 4 nav icons; active state; German tooltips.
6. Full-app background (`Design/BackgroundImage_Office.JPEG`); frosted content panel wrapper.
7. Remove any auth/template cruft if present.

### Thin DoD

- [x] Four pages open via header icons
- [x] Background + logo visible; German labels
- [x] No auth gates

### Thick (later)

- [x] Theme tokens in CSS (`--zm-*` income/expense/confidence/focus/surface)
- [x] Motion: nav active transition + page enter fade/slide
- [x] Mobile polish: toolbar stack, larger nav hit targets, single-column categories, lighter bg transform
- [x] Shadcn/Tailwind **not** bolted on mid-project — existing `zm-*` design system covers primitives; optional later migration only if needed

### Out of scope

DB models beyond defaults; import; charts.

---

## Slice 1 — Categories

**Goal:** Category tree in Postgres; seed; visible in Einstellungen (read-only thin).

**Specs:** [`categorization.md`](categorization.md) · `categories_seed.json`

### Thin steps

1. Prisma: `Category`, `Subcategory`, `CategoryKeyword` (+ relations).
2. Migrate.
3. Seed action or server startup: import `categories_seed.json` **once** if empty.
4. Query `getCategories` (tree with keywords).
5. Einstellungen page: list/grid of categories + subcategories (read-only).

### Thin DoD

- [x] Fresh DB → seed runs → UI shows seeded German categories
- [x] Re-start does not duplicate seed

### Thick (later)

- [x] Create/edit/delete category & sub; edit keywords; colors
- [x] Delete policy: block while transactions still reference the category/sub (German error); last subcategory cannot be deleted

### Out of scope

Transaction FKs required for display; keyword matching engine.

---

## Slice 2 — Import DKB + list

**Goal:** Upload DKB CSV → rows in DB → table on Transaktionen.

**Specs:** [`ai/README.md`](../README.md) Import · Transaction model (minimal fields)

### Thin steps

1. Prisma `Transaction` (canonical fields; `categoryId`/`subcategoryId` nullable OK for now; skip related fields).
2. Migrate.
3. `src/features/import/dkb.ts` — parse DKB Giro/Tagesgeld export → normalized rows (keep umlauts).
4. Action `importBankFile` — multipart/file + `bank: 'dkb'`; validate; insert; basic dedup `(bank, konto, datum, betrag, verwendungszweck, iban, kundenreferenz)`.
5. Upload page: bank fixed/select DKB, file drop, call action, on success navigate to Transaktionen.
6. Query `getTransactions` — latest first, simple limit (e.g. 100) if pagination not ready.
7. Transaktionen page: basic HTML/Shadcn table with core columns.

### Thin DoD

- [x] Real file from `Bankauszüge/DKB/` imports without crash
- [x] Rows visible in table
- [x] Re-import same file → duplicates skipped or reported

### Thick (later)

- [x] Richer validation errors (`ImportParseError` + bank mismatch check + hints)
- [x] Upload progress bar; nav locked while importing; drag & drop
- [x] Giro vs Tagesgeld konto normalization (`Girokonto` / `Tagesgeld`)

### Out of scope

Other banks; related-detect; full filters; Analyse.

---

## Slice 3 — Categorize

**Goal:** Auto keyword categorize on import; manual fix in Details.

**Specs:** [`categorization.md`](categorization.md) · [`transactions.md`](transactions.md) Details / Konfidenz

### Thin steps

1. Ensure txs link to category/subcategory FKs + `confidenceScore` + `categorySource` (`manual` \| `keyword` \| `learned` \| `none`).
2. `src/features/categorization/` — keyword matcher (sub then main keywords per README).
3. Run matcher inside import action before insert.
4. Details overlay: show fields; select Kategorie → Unterkategorie; save via `categorizeTransaction` (source `manual`, score 1.0). After Slice 8: also sync category to linked partner.
5. Table: confidence color + label; amount red/green.

### Thin DoD

- [x] New import gets non-all-Sonstige when keywords match seed
- [x] Manual categorize updates row + colors

### Thick (later)

- [x] “Merken” → `LearnedRule`; learned-rule pass before keywords on import; `usageCount` increments
- [x] Konfidenz filter on Transaktionen (`manual` / `learned` / `keyword` / `none`)

### Out of scope

Related pairs; Analyse; category tree editing (unless Slice 1 thick done).

---

## Slice 4 — Accounts / balance

**Goal:** Calibrated balances; header shows total wealth.

**Specs:** [`ai/README.md`](../README.md) Account & balance

### Thin steps

1. Prisma `Account` (`bank`, `konto`, `currentBalance`, `asOfDate`, …).
2. On import: upsert Account for bank/konto; if no calibrated balance yet, prompt UI (modal after upload or on Upload page).
3. Actions/queries to set/get balances.
4. Header balance = sum of account `currentBalance` (`de-DE` EUR).

### Thin DoD

- [x] After import + entering balance, header shows that value (multi-account = sum)

### Thick (later)

1. **Roll-forward header (per account):**  
   `Anzeige = kalibrierter Stand + Summe(Betrag) der Buchungen dieses Kontos mit Datum > asOfDate`  
   (cutoff `>` = bank balance is end-of-day on `asOfDate`). Header = sum of those per-account displays. Recompute when txs are imported/changed.
2. Synthetic opening tx + `isBalanceAdjustment`; exclude from Analyse; filter on Transaktionen.

### Thick DoD

- [x] Header uses roll-forward (not raw `currentBalance` alone)
- [x] Calibration marker (`isBalanceAdjustment`) excluded from Analyse; optional show on Transaktionen
- [x] Re-calibrate from Einstellungen

### Out of scope

Related netting; full Analyse.

---

## Slice 5 — Transaktionen UX

**Goal:** Usable browsing: pagination, sort, basic filters, page summary.

**Specs:** [`transactions.md`](transactions.md) (table/filters/summary — skip related section)

### Thin steps

1. `getTransactions` — page, pageSize (50/100/250/500), sort `datum` desc.
2. `getTransactionsSummary` — income/expense/count for **same filters**.
3. Filters: bank/konto multi, optional typ (alle/ein/aus).
4. Summary strip above table.
5. Pagination controls.

### Thin DoD

- [x] Change page size/page works
- [x] Summary matches filtered set (not only current page)

### Thick (later)

Date range, search, column toggles, Konfidenz filter, balance-adj hide, localStorage columns.

### Thick DoD

- [x] Optional Zeitraum + Suche (Zweck/Sender/Empfänger) filter list + summary
- [x] Spalten-Optionen with localStorage (IBAN / Kundenref. / Verknüpfung default hidden)
- [x] Konfidenz filter + Saldo-Kalibrierung hide (defaults)

### Out of scope

Related-detect overlay; Analyse charts.

---

## Slice 6 — Analyse

**Goal:** Thin = period summary; Thick = charts.

**Specs:** [`analysis.md`](analysis.md)

### Thin steps

1. Query `getAnalysisSummary` — filters: dateFrom/to (default year start → today), optional accounts; **no** related netting yet (or stub).
2. Exclude `isBalanceAdjustment` if flag exists.
3. Analyse page: filter controls + summary strip (Einnahmen, Ausgaben, Netto, Buchungen).

### Thin DoD

- [x] Default year filter shows plausible totals for imported data

### Thick (later)

Time series, pies, breakdowns, Typ hide, category drill-down; apply related netting once Slice 8 exists.

### Thick DoD

- [x] Zeitlicher Trend (auto day/month/year) + Ausgaben/Einnahmen-Pies
- [x] Expandable category breakdowns; Typ hides opposite sections
- [x] Category filter + pie/legend drill-down to subcategory view
- [x] Related-pair netting applied to summary, trend, pies, breakdowns

### Out of scope

Related-detect UI; Excel export.

---

## Slice 7 — More banks

**Goal:** Second importer, then the rest.

**Specs:** [`ai/README.md`](../README.md) Import · `Bankauszüge/`

### Thin steps

1. Add **PayPal** *or* **Sparkasse** parser + `bank` branch in import action.
2. Upload UI: bank select.
3. Smoke-test one real file.

### Thin DoD

- [x] Second bank imports into same table with correct `bank`/`konto` (PayPal TSV → `bank=paypal`, `konto=PayPal`; smoke-tested `2026_Paypal.TXT`)

### Thick (later)

Remaining banks (Sparkasse / Trade Republic); format drift handling.

### Thick DoD

- [x] Sparkasse MT940-like TXT imports (`bank=sparkasse`, `konto=Girokonto`)
- [x] Trade Republic transactions CSV imports (`bank=traderepublic`, `konto=Trade Republic`)
- [x] Upload bank select + format sniff rejects mismatched bank
- [x] Clear parse errors/hints on format drift (missing tags/columns)

### Out of scope

Related-detect (can start Slice 8 thin after ≥2 sources exist).

---

## Slice 8 — Related transactions

**Goal:** Find/confirm pairs; net in Analyse.

**Specs:** [`transactions.md`](transactions.md) related section · [`analysis.md`](analysis.md) netting

### Thin steps

1. `relatedTransactionId` (+ optional type); optional `RelatedRejection` model.
2. Pure detect: implement **one** detector first (PayPal↔bank **or** transfer).
3. Action `detectRelatedTransactions` → suggestions[].
4. Overlay: progress → side-by-side → confirm/reject.
5. `confirmRelatedPair` bidirectional.
6. Analyse summary: apply netting rules for that type only.

### Thin DoD

- [x] At least one real PayPal↔DKB or Giro↔Tagesgeld pair can be confirmed (detector: PayPal↔Bank; confirm bidirectional)
- [x] Analyse totals change sensibly when both legs in scope (PayPal leg kept once)

### UX locks (post-Thin, documented)

- Partner link in table → page jump + scroll/highlight + Details (`getTransactionNav`)
- Overlays centered on frosted **page** panel, not full display ([`design.md`](design.md))
- Linked legs share category: sync on categorize + on confirm ([`categorization.md`](categorization.md))

### Thick (later)

- [x] All three detectors (PayPal↔Bank, Umbuchung, Ähnlich) + greedy merge with type priority
- [ ] Unlink in Details; batch confirm; poll if slow

(Reject persistence already in Thin via `RelatedRejection`.)

### Out of scope

Auto-delete duplicates; Jobs unless detect &gt; ~15s.

---

## Slice 9 — Hardening

**Goal:** Real-data confidence.

### Thin steps

1. Import multiple real exports; fix parser/categorize bugs.
2. Fix UI bugs blocking daily use.
3. Update feature docs if behavior changed.

### Thin DoD

- [x] Smoke-tested all `Bankauszüge/DKB/*.csv` + `PayPal/*.TXT` parsers (0 failures; keyword categorize hits on real rows)
- [x] Daily-use fixes: Details form resets on partner switch; DKB imports only `Status=Gebucht`; category sync note in Details
- [x] Documented remaining formats: Sparkasse = MT940-like; Trade Republic = cash CSV (done in Slice 7 Thick)

### Thick (later)

Export, Jobs, auth, deploy — only if product goals change.

### Thick DoD (scoped)

Product locks unchanged: **no** Jobs, auth, or cloud deploy.

- [x] CSV export Transaktionen (current filters, semicolon + UTF-8 BOM)
- [x] CSV export Analyse (summary + breakdown, netted)
- [x] Hardening notes: all four bank sample formats supported

### Hardening notes (samples)

| Source | Format | Status |
|---|---|---|
| DKB Giro / Tagesgeld | Semicolon CSV | Supported |
| PayPal | German TSV/TXT, `Abgeschlossen`+EUR | Supported |
| Sparkasse | MT940-style `:61:`/`:86:` blocks | Supported |
| Trade Republic | ISO datetime cash CSV | Supported |

---

## LLM session template

Copy when starting work:

```
Project: Zaster Master (Wasp). Follow ai/docs/implementation-plan.md.

Active slice: <N> — <Name>
Mode: Thin only  (or Thick)

Read first: <spec links from the slice card>
Do the Thin steps in order.
Stop at Thin DoD. Do not implement Out of scope.
Prefer Wasp queries/actions; no auth; German UI; design.md for shell.
```

---

## Doc map

| Doc | Use when |
|---|---|
| [`implementation-plan.md`](implementation-plan.md) | **This file** — what to build next |
| [`prd.md`](prd.md) | Why slices / MVP boundary |
| [`../README.md`](../README.md) | Domain + stack |
| [`design.md`](design.md) | Shell / visuals |
| [`transactions.md`](transactions.md) | Table + related |
| [`analysis.md`](analysis.md) | Analyse + netting |
| [`categorization.md`](categorization.md) | Hybrid categorizer, tree, seed, Konfidenz |
| `categories_seed.json` | Slice 1 seed |
