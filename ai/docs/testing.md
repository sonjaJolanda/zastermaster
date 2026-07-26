# Testing — Zaster Master

How we verify money-critical behavior. Product behavior stays in the feature docs; this file owns **what** we test and **how**.

Related: [`implementation-plan.md`](implementation-plan.md) Slice 11 · [`transactions.md`](transactions.md) · [`analysis.md`](analysis.md) · [`categorization.md`](categorization.md)

---

## Goals

1. **Catch regressions** in parsers, categorizer, related-detect, Analyse-netting, and Transaktionen-Summen without clicking through the UI every time.
2. **Support manual smoke** with a small, round-number dataset that mirrors real bank formats.
3. **Never commit real bank exports** or private PII into automated fixtures.

---

## Layers

| Layer | Tool | DB? | Scope (v1) |
|---|---|---|---|
| **Unit** | Vitest (`npm test`) | No | Pure functions under `src/features/**` |
| **Manual** | App + `_Tester` bank files | Yes (local Postgres) | Import → table → Related → Analyse → Konten |
| **Not in v1** | Playwright / Prisma integration | — | Optional later (Slice 11 Thick) |

Unit tests are the default gate before/after domain changes. Manual tester files are for end-to-end confidence before trusting real `Bankauszüge/`.

---

## Automated unit tests

### Run

```bash
npm test           # once
npm run test:watch # watch mode
```

Config: repo-root [`vitest.config.ts`](../../vitest.config.ts) — includes `src/**/*.test.ts`, Node environment.

### Layout

| Area | Tests | Production code |
|---|---|---|
| Amount / date / bank sniff | `src/features/import/types.test.ts` | `import/types.ts` |
| Bank parsers | `src/features/import/parsers.test.ts` | `dkb.ts`, `paypal.ts`, `sparkasse.ts`, `traderepublic.ts` |
| Parser snippets (synthetic) | `src/features/import/__fixtures__/` | — |
| Hybrid categorizer | `src/features/categorization/categorizeRow.test.ts` | `categorizeRow.ts`, match helpers |
| Related detectors | `src/features/related/detect.test.ts` | `related/detect.ts` |
| Analyse netting | `src/features/analysis/netting.test.ts` | `analysis/netting.ts` |
| TX Summen | `src/features/transactions/summary.test.ts` | `transactions/summary.ts` (used by `getTransactionsSummary`) |

### What must stay green (P0)

- **Parsers:** at least one happy path per bank; DKB skips non-`Gebucht`; PayPal skips non-`Abgeschlossen` / non-EUR; BOM tolerated where covered.
- **Categorizer:** keyword hit; learned rule beats keyword; fallback Sonstiges/Unbekannt.
- **Related:** PayPal↔Bank positive + opposite-sign negative; transfer positive + same-account negative; near-dup positive + unrelated negative.
- **Netting:** transfer drops both legs; PayPal↔bank keeps PayPal, drops bank leg.
- **Summen:** Einnahmen / Ausgaben / Netto / Buchungen — `net = income − |expense|`; zero amounts count in `count` only.

### Rules for new unit tests

- Prefer **pure helpers**; do not spin up Wasp/Prisma in Thin tests.
- Fixtures: tiny synthetic strings in `__fixtures__/` or inline — **not** copies of real `Bankauszüge/`.
- If Summary/Prisma logic changes, update `summary.ts` + its tests in the same change.

---

## Manual smoke (tester bank files)

Synthetische Uploads im echten Export-Format, runde Beträge, eingebettete Related-Fälle.

**Cheat-Sheet neben den Files:** [`Bankauszüge/_Tester_LESE_MICH.md`](../../Bankauszüge/_Tester_LESE_MICH.md)

### Files (one per bank)

| Bank | Path |
|---|---|
| DKB | `Bankauszüge/DKB/2026_Umsatzliste_Girokonto_DE62120300001081465500_Tester.csv` |
| PayPal | `Bankauszüge/PayPal/2026_Paypal_Tester.TXT` |
| Sparkasse | `Bankauszüge/Sparkasse/27072025_25072026_Tester.TXT` |
| Trade Republic | `Bankauszüge/TradeRepublic/transactions_2025-07-01_2026-07-25_Tester.csv` |

Upload-Reihenfolge egal. Skipped rows: DKB `Vorgemerkt` (−999), PayPal `Ausstehend` (−15).

### Fresh DB before a full pass

Wipe money data, **keep categories**:

```sql
TRUNCATE TABLE
  "RelatedRejection",
  "InvestmentRejection",
  "InvestmentKeyword",
  "Transaction",
  "Account",
  "LearnedRule"
RESTART IDENTITY CASCADE;
```

(e.g. `docker exec -i zastermaster-db psql -U zaster -d zastermaster` und SQL pipen.)

Dann App neu laden und die vier `_Tester`-Dateien importieren.

### Expected after all four imports (filters: alle)

| Metric | Value |
|---|---|
| Buchungen | **14** |
| Einnahmen | **2710,00** |
| Ausgaben | **730,00** |
| Netto | **1980,00** |

Breakdown: DKB 7 · PayPal 2 · Sparkasse 3 · Trade Republic 2.

### Manual checklist

1. **Upload** — each bank imports without error; skipped rows only as above.
2. **Transaktionen** — summary strip matches 2710 / 730 / 1980 / 14; filters (Bank, Typ) change strip sensibly.
3. **Keywords** — REWE, ALDI, Mensa, Tankstelle/Shell, Amazon should often auto-categorize (depends on seed).
4. **Zusammengehörige**
   - PayPal −25 ↔ DKB −25 (12.07.) → confirm → Analyse drops bank leg.
   - DKB −200 ↔ TR +200 (13.07.) → confirm → Analyse drops both.
   - Two DKB Amazon −100 (15.07.) → near-dup UI (Analyse does **not** net `near_duplicate` in v1).
5. **Analyse** — after both PayPal+transfer confirms: Einnahmen **2510**, Ausgaben **505**, Netto **2005** (see LESE_MICH for intermediate states).
6. **Konten** — calibration modal / suggested balances from file hints (DKB 1500, PayPal ~60, Sparkasse 1400); colors editable.

### Real exports

`Bankauszüge/` without `_Tester` are **personal** — smoke-test locally, do not use as Vitest fixtures, do not publish dumps.

---

## Out of scope (for now)

- Full UI / CSS regression suites  
- CI pipeline (easy add later: `npm test` on PR)  
- Live-DB integration tests for import dedup  
- Playwright E2E  

When adding those, extend this doc and optionally Slice 11 Thick in the implementation plan.
