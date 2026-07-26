# Analyse — Zaster Master

Spending and income insights over a chosen period and account set. Behavior overview also in [`../README.md`](../README.md); this file is the detailed spec.

## Purpose

Answer, without paying for AI:

1. How did income and expenses move over time?
2. Where does money go (and come from) by category / subcategory?
3. What is the detailed breakdown under a category?
4. Across several banks/Konten, am I **double-counting** PayPal↔bank or Giro↔Tagesgeld? (No — confirmed related pairs are netted.)

**Not** the job of Analyse in v1: reconstructing a full ledger from day one, editing transactions (that’s Transaktionen), or YoY report PDFs (later).

## Page layout

```
┌─ Top bar ────────────────────────────────────────────────┐
│ Kontostand · Investiert · Einnahmen · Ausgaben · Netto · Buchungen │
│                         CSV exportieren · Filter (toggle)│
├─ Filters (collapsible, default closed) ──────────────────┤
│ Zeitraum · Typ · Kategorie · Banken/Konten · …           │
├─ Sections (scroll) ──────────────────────────────────────┤
│ 1. Zeitlicher Trend (line)                               │
│ 2. Ausgaben nach Kategorie (pie + legend)                │
│ 3. Einnahmen nach Kategorie (pie + legend)               │
│ 4. Ausgaben-Aufschlüsselung (expandable table)           │
│ 5. Einnahmen-Aufschlüsselung (expandable table)          │
└──────────────────────────────────────────────────────────┘
```

One frosted content panel; summary + actions under the title (same pattern as Transaktionen); charts and tables below. Do not put five unrelated “dashboard cards” in the header.

## Defaults (first open)

| Filter | Default |
|---|---|
| Zeitraum | Current calendar year: **1 Jan of current year → end of today** |
| Granularity for trend | Auto from range length (table below) |
| Kategorie / Unterkategorie | All |
| Banken / Konten | All imported accounts |
| Typ | All (income + expenses) |

Changing any filter refetches analysis queries (no stale charts). **Route loading:** clicking any side-nav link shows a full-panel spinner immediately; the destination page clears it when its data is ready (Analyse waits for analysis queries).

## Filters (detailed)

### Zeitraum

Three complementary controls (German labels):

| Control | Behavior |
|---|---|
| **Jahr** | Select calendar year (list of years that appear in data + current year) |
| **Monat** | Optional; within year → that month only |
| **Tag** / from–to | Optional fine range; if set, overrides year/month to that inclusive date range |

Simplest v1 UX that still matches the brief:

- Preset chips: **Dieses Jahr** | **Letztes Jahr** | **Dieser Monat** | **Letzter Monat** | **Letzte 3 Monate** | **Benutzerdefiniert**
  - Dieses Jahr: 1 Jan current year → today
  - Letztes Jahr: 1 Jan–31 Dec previous calendar year
  - Dieser Monat: 1st of current month → today
  - Letzter Monat: full previous calendar month
  - Letzte 3 Monate: 1st of the month two months ago → today
- Benutzerdefiniert: date-from + date-to (required if custom)
- Year/month pickers can implement the presets under the hood

### Grouping (for the time trend)

Derived from the selected range (user can override if we expose a control; v1 may auto-pick):

| Range length | Grouping |
|---|---|
| ≤ ~400 days (covers “Dieses Jahr”) | `day` — continuous daily series (empty days = 0) so movement within/between months is visible |
| 401 days – 3 years | `month` |
| > 3 years | `year` |

Each bucket sums income and expenses separately for the line chart.

### Kategorie / Unterkategorie

- Optional main category; if set, optional subcategory under it.
- Filter always restricts the **underlying transaction set** (summary + trend + pies + breakdowns only see matching txs).
- **When a main category is selected (no subcategory):** pies and breakdowns show **subcategories of that category** (drill-down), not a single-slice pie.
- **When a subcategory is selected:** pies may be hidden or show a single slice; breakdown shows that subcategory only (or merchants later).
- “All” = no category filter; pies group by **main category**.

### Banken / Konten

- Multi-select banks and/or specific Konten (e.g. DKB Girokonto, DKB Tagesgeld, PayPal).
- Empty selection = treat as **all** (don’t show empty charts by accident).

### Typ (`transaction_type`)

| Value | Meaning |
|---|---|
| `all` | Summary shows Einnahmen + Ausgaben + Netto; both pies; both breakdowns; trend shows both lines |
| `expenses` | Summary: show **Ausgaben** (+ Buchungen); hide or zero-out Einnahmen/Netto in the strip; hide income pie + income breakdown; trend = expenses only |
| `income` | Symmetric for income |

Prefer **hide** unused chart/breakdown blocks (don’t leave empty zeros that look broken).

## Summary strip

Shown **inline in the top bar** (with CSV + Filter toggle), same pattern as Transaktionen. Includes **Netto** when Typ is Alle.

Always for the **current filters** (after netting):

| Metric | Definition |
|---|---|
| **Kontostand** | Calibrated wealth (`getHeaderBalance`); same as Transaktionen — **not** period-filtered |
| **Investiert** | Confirmed investment EK (`getInvestedTotal`); see [`investments.md`](investments.md) — excluded from Ausgaben |
| **Einnahmen** | Sum of positive `betrag` (display abs as EUR); excludes confirmed investments |
| **Ausgaben** | Sum of absolute values of negative `betrag`; excludes confirmed investments |
| **Saldo / Netto** | Einnahmen − Ausgaben (signed) |
| **Buchungen** | Count of transactions **included** after filters, netting, and investment exclusion |

Calibrated wealth is shown for orientation; Analyse flow metrics still describe the **period** under filters. Edit balances under Einstellungen → Konten.

## The five analyses

### 1. Zeitlicher Trend

- Line (or dual-line) chart: **Einnahmen** vs **Ausgaben** over buckets (`day` / `month` / `year`).
- X = period label (`de-DE`), Y = EUR.
- Tooltip: period, both amounts, optional net.
- Empty range → empty state copy, not a broken chart.

### 2. Ausgaben nach Kategorie

- Pie (or doughnut) of **expense** totals by **main category**.
- Colors from category records in DB.
- Legend: name + amount + %.
- Click legend/slice (nice-to-have v1): set category filter to that category and refresh (drill-down).

### 3. Einnahmen nach Kategorie

- Same as (2) for **income**.

### 4. Ausgaben-Aufschlüsselung

- Expandable table: main category → subcategories → optional top merchants/keywords later.
- Columns: Name (with **color swatch** for category and subcategory), Betrag, Anteil %, Anzahl Buchungen.
- Sorted by amount descending.
- Uncategorized (`Sonstige` / `Unbekannt`) always visible if non-zero.

### 5. Einnahmen-Aufschlüsselung

- Same structure for income.

When `transaction_type` is `expenses` or `income`, hide the opposite pie + breakdown (see Typ table). Do not leave empty opposite sections visible.

## Related-transaction netting (critical)

Confirmed related pairs must **not** inflate Analyse when both legs would otherwise appear under the current filters.

### Rules (v1)

1. Only **confirmed** links count (not suggestions).
2. **Transfer between own accounts** (amounts ≈ opposite): if **both** legs are in the filtered set, **exclude both** from income/expense aggregates and from pies/breakdowns/trend (they are not real income/expense). They may still appear in Transaktionen.
3. **PayPal ↔ bank** (same economic payment, usually same-sign expenses): if both legs are in the filtered set, count **once**. **v1 lock:** keep the **PayPal** (or wallet) merchant leg when present; otherwise keep the **earlier** `datum` (then lower id). Drop the other from aggregates only — both rows remain in Transaktionen.
4. If the filter includes **only one** leg of a pair, count that leg normally (user intentionally scoped one account).
5. Opening-balance / calibration synthetic rows: **exclude** from Analyse income/expense (they are balance plumbing, not spending). Tag them in data (e.g. `isBalanceAdjustment`) so filters can hide them consistently.

Netting applies to **summary, trend, pies, and breakdowns** consistently.

## Edge cases

| Case | Behavior |
|---|---|
| No transactions in range | Summary zeros; empty-state message; CTA optional “Zeitraum anpassen” |
| All uncategorized | Pies show Sonstige; still useful |
| Only one account selected | Transfers to other own accounts look like expenses/income unless linked and the other leg is also in set — encourage related-detect |
| Huge ranges | Server-side aggregation only (do not ship every row to the client) |
| Category deleted | See [`categorization.md`](categorization.md) delete policy; Analyse uses current FK labels |

## Data / operations

Wasp **queries** (names illustrative):

| Query | Returns |
|---|---|
| `getAnalysisSummary` | Einnahmen, Ausgaben, Netto, count (filtered + netted) |
| `getAnalysisTimeSeries` | `{ period, income, expenses }[]` |
| `getAnalysisByCategory` | per category totals for income and/or expenses + colors |
| `getAnalysisBreakdown` | category → subcategory rows with amounts, %, counts |

Shared filter input type: `{ dateFrom, dateTo, grouping, categoryId?, subcategoryId?, bankIds? / accountIds?, transactionType }`.

All aggregation and netting happen **on the server**. Client only renders.

## UX details

- German labels throughout.
- Loading: skeleton or spinner in panel; don’t flash wrong old data (clear or keep previous with opacity + “Aktualisiere…”).
- Charts: Chart.js (or similar) — readable, flat, token colors; no 3D.
- Desktop: filters in one row; mobile: filters collapse into “Filter” sheet.
- Amounts: `de-DE` EUR; expenses in summary as positive “spent” magnitudes with expense coloring.

## Out of scope (v1) / later

- Excel/PDF export of Analyse (CSV export of summary + breakdown is available)
- Click-through from breakdown row → filtered Transaktionen (nice follow-up)

## Open / known issues

**Perceived slow load (even with empty DB)** — not fixed yet:

- Analyse fires many parallel queries; route overlay waits until most of them finish.
- `getAnalysisTimeSeries` still builds empty day buckets for the whole default year (~15 KB) with no rows.
- Each analysis query runs `loadNettedRows` separately (4× DB work when data exists).
- First visit may also pay Chart.js client chunk load.

Possible follow-ups: clear nav overlay after summary; skip empty bucket fill; consolidate into one query; lazy-load charts.
