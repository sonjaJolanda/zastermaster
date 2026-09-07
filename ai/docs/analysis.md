# Analyse — Zaster Master

Spending and income insights over a chosen period and account set. Behavior overview also in [`../README.md`](../README.md); this file is the detailed spec.

## Purpose

Answer, without paying for AI:

1. How did income and expenses move over time?
2. Where does money go (and come from) by category / subcategory?
3. What is the detailed breakdown under a category?
4. Across several banks/Konten, am I **double-counting** PayPal↔bank or Giro↔Tagesgeld? (No — confirmed related pairs are netted.)

**Not** the job of Analyse in v1: reconstructing a full ledger from day one, or editing transactions (that’s Transaktionen).

## Page layout

```
┌─ Top bar ────────────────────────────────────────────────┐
│ Kontostand · Investiert · Einnahmen · Ausgaben · Netto · Buchungen │
│                    CSV · PDF exportieren · Filter (toggle)│
├─ Filters (collapsible, default closed) ──────────────────┤
│ Zeitraum · Typ · Kategorie · Banken/Konten · …           │
├─ Sections (scroll) ──────────────────────────────────────┤
│ 1. Zeitlicher Trend (line, typically days)               │
│ 2. Vergleich pro Monat (bars)                            │
│ 3. Total · Ausgaben · Einnahmen (pies, side by side)     │
│ 4. Total- / Ausgaben- / Einnahmen-Aufschlüsselung        │
└──────────────────────────────────────────────────────────┘
```

One frosted content panel; summary + actions under the title (same pattern as Transaktionen); charts and tables below. Do not put five unrelated “dashboard cards” in the header.

## Defaults (first open)

| Filter | Default |
|---|---|
| Zeitraum | **Dieser Monat**: 1st of current month → today |
| Granularity for trend | Auto from range length (table below) |
| Kategorie / Unterkategorie | All |
| Banken / Konten | All imported accounts |
| Typ | All (income + expenses) |

Changing any filter refetches analysis queries (no stale charts). Filters are persisted in `localStorage` (`zm-analyse-filters-v1`) and restored on reload; relative presets recompute their date range. **Route loading:** clicking any side-nav link shows a full-panel spinner immediately; the destination page clears it when its data is ready (Analyse waits for analysis queries).

## Filters (detailed)

### Zeitraum

Three complementary controls (German labels):

| Control | Behavior |
|---|---|
| **Jahr** | Select calendar year (list of years that appear in data + current year) |
| **Monat** | Optional; within year → that month only |
| **Tag** / from–to | Optional fine range; if set, overrides year/month to that inclusive date range |

Simplest v1 UX that still matches the brief:

- Preset chips: **Dieses Jahr** | **Letztes Jahr** | **Dieser Monat** | **Letzter Monat** | **Vorletzter Monat** | **Letzte 3 Monate** | **Benutzerdefiniert**
  - Dieses Jahr: 1 Jan current year → today
  - Letztes Jahr: 1 Jan–31 Dec previous calendar year
  - Dieser Monat: 1st of current month → today
  - Letzter Monat: full previous calendar month
  - Vorletzter Monat: full calendar month before last
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

Each bucket sums income, expenses, and confirmed **investment buys** separately for the **line** chart (investments stay inside `expense` and are also in `invested`). The bar chart always uses **month** buckets for the same filtered set.

### Kategorie / Unterkategorie

- Optional main category; if set, optional subcategory under it.
- Filter always restricts the **underlying transaction set** (summary + trend + monthly bars + pies + breakdowns only see matching txs).
- **When a main category is selected (no subcategory):** pies and breakdowns show **subcategories of that category** (drill-down), not a single-slice pie.
- **When a subcategory is selected:** pies may be hidden or show a single slice; breakdown shows that subcategory only (or merchants later).
- “All” = no category filter; pies group by **main category**.

### Banken / Konten

- Multi-select banks and/or specific Konten (e.g. DKB Girokonto, DKB Tagesgeld, PayPal).
- Empty selection = treat as **all** (don’t show empty charts by accident).

### Typ (`transaction_type`)

| Value | Meaning |
|---|---|
| `all` | Summary shows Einnahmen + Ausgaben + Netto; three pies (Total, Ausgaben, Einnahmen); three breakdowns; trend line + monthly bars show income, expense, and investment series |
| `expenses` | Summary: show **Ausgaben** (+ Buchungen); hide or zero-out Einnahmen/Netto in the strip; hide income pie + income breakdown; trend line + monthly bars = expenses + investments |
| `income` | Symmetric for income (hide expense and investment series) |

Prefer **hide** unused chart/breakdown blocks (don’t leave empty zeros that look broken).

## Summary strip

Shown **inline in the top bar** (with CSV + Filter toggle), same pattern as Transaktionen. Includes **Netto** when Typ is Alle.

Always for the **current filters** (after netting):

| Metric | Definition |
|---|---|
| **Kontostand** | Calibrated wealth for **selected** bank/konto filters (same as Transaktionen); **not** period-filtered |
| **Investiert** | Confirmed investment EK for selected bank/konto **and Zeitraum** (`getInvestedTotal`); see [`investments.md`](investments.md) — **additional** to Ausgaben, not a replacement |
| **Einnahmen** | Sum of positive `betrag` (display abs as EUR); includes confirmed investments |
| **Ausgaben** | Sum of absolute values of negative `betrag`; includes confirmed investments |
| **Saldo / Netto** | Einnahmen − Ausgaben (signed) |
| **Buchungen** | Count of transactions **included** after filters and netting (investments included) |

**Caveat (UI):** Einnahmen, Ausgaben, and Netto show an **(i)** tooltip on **Analyse and Transaktionen** (and matching Analyse pie / Aufschlüsselung headings): related netting (own-account transfers, PayPal-Kauf funding). Kontostand / Investiert / Buchungen do not get that hint.

Calibrated wealth is shown for orientation; Analyse flow metrics still describe the **period** under filters. Edit balances under Einstellungen → Konten.

## The analyses

### 1. Zeitlicher Trend

- Line chart: **Einnahmen** (green) vs **Ausgaben** (red) vs **Investitionen** (black) over buckets (`day` / `month` / `year`).
- **Investitionen** = confirmed investment **buys** (`isInvestment` and `betrag < 0`, abs). They **remain inside** the red Ausgaben series; black is an extra overlay, not a subtraction. Not auto-tagged on import — only after confirm on Transaktionen. The black series **and** the header **Investiert** figure follow the Analyse **Zeitraum** (default Dieser Monat; bank/konto filters too). Hint when confirmed investments exist all-time but none in the period. Line chart marks buys as dots (empty days omitted so sparse buys stay visible).
- X = period label (`de-DE`), Y = EUR.
- Tooltip: period, shown series.
- Empty range → empty state copy, not a broken chart.

### 2. Vergleich pro Monat

- Grouped **bar** chart under the line: same netted data, always **calendar-month** buckets (partial months at range edges only include days in the filter).
- Series: Einnahmen (green), Ausgaben (red, includes investments), Investitionen (black buys).
- Data: `getAnalysisTimeSeries.monthlyPoints` (server). If that field is missing (stale API), the client rolls the already-netted daily `points` up to months — it does not fetch extra rows.
- Same Typ rules as the line (hide income or expense **and** investment series).
- Empty range → empty state copy.

### 3–5. Pies: Total · Ausgaben · Einnahmen

- Three doughnuts side by side when Typ is **Alle** (order: Total, Ausgaben, Einnahmen).
- Ausgaben / Einnahmen: absolute totals by category (as before).
- **Total:** per category net = Σ `betrag` (Einnahmen − Ausgaben). Slice size = `|net|`; legend shows signed amount (green/red).
- Colors from category records. Click slice drills into category when not already on a subcategory.

### 6–8. Aufschlüsselung

- Expandable tables for **Total**, Ausgaben, and Einnahmen (signed amounts for Total). Each Aufschlüsselung section is **collapsed by default** and toggled independently via its heading.
- Columns: Name (with color swatch), Betrag, Anteil %, Anzahl Buchungen.
- Sorted by amount descending (Total: by `|amount|`).
- Uncategorized (`Sonstige` / `Unbekannt`) always visible if non-zero.

When `transaction_type` is `expenses` or `income`, hide the opposite pie/breakdown **and** Total (see Typ table). Do not leave empty opposite sections visible.

## Related-transaction netting (critical)

Confirmed related pairs must **not** inflate Analyse when both legs would otherwise appear under the current filters.

### Rules (v1)

1. Only **confirmed** links count (not suggestions).
2. **Transfer between own accounts** (amounts ≈ opposite): if **both** legs are in the filtered set, **exclude both** from income/expense aggregates and from pies/breakdowns/trend/monthly bars (they are not real income/expense). They may still appear in Transaktionen.
3. **PayPal ↔ bank** (same economic payment, usually same-sign expenses): if both legs are in the filtered set, count **once**. **v1 lock:** keep the **PayPal** (or wallet) merchant leg when present; otherwise keep the **earlier** `datum` (then lower id). Drop the other from aggregates only — both rows remain in Transaktionen.
4. **PayPal-Kauf** (`paypal_purchase`, 3 legs: paypal− + bank− + paypal+): if the merchant PayPal− is in the filtered set, **keep that purchase** and drop wallet+ and bank− from aggregates (otherwise Einnahmen/Ausgaben inflate). If only funding legs are in the set, drop them (wallet top-up, not consumption). If only one leg is in the filter, count that leg (same as pair rule 5).
5. If the filter includes **only one** leg of a pair, count that leg normally (user intentionally scoped one account).
6. Opening-balance / calibration synthetic rows: **exclude** from Analyse income/expense (they are balance plumbing, not spending). Tag them in data (e.g. `isBalanceAdjustment`) so filters can hide them consistently.

Netting applies to **summary, trend, monthly bars, pies, and breakdowns** consistently.

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
| `getAnalysisTimeSeries` | `{ grouping, points, monthlyPoints }` — `points` follow auto grouping; `monthlyPoints` are always month buckets; each point has `income`, `expense`, `invested` |
| `getAnalysisByCategory` | per category totals for income and/or expenses + colors |
| `getAnalysisBreakdown` | category → subcategory rows with amounts, %, counts |

Shared filter input type: `{ dateFrom, dateTo, grouping, categoryId?, subcategoryId?, bankIds? / accountIds?, transactionType }`.

All aggregation and netting happen **on the server**. Client only renders, except the monthly-bar **fallback**: if `monthlyPoints` is absent, it sums the already-returned daily `points` by calendar month.

## UX details

- German labels throughout.
- Loading: skeleton or spinner in panel; don’t flash wrong old data (clear or keep previous with opacity + “Aktualisiere…”).
- Charts: Chart.js (or similar) — readable, flat, token colors; no 3D.
- Desktop: filters in one row; mobile: filters collapse into “Filter” sheet.
- Amounts: `de-DE` EUR; expenses in summary as positive “spent” magnitudes with expense coloring.

## Out of scope (v1) / later

- Excel export of Analyse (CSV + PDF available — see [`reports.md`](reports.md))
- Click-through from breakdown row → filtered Transaktionen (nice follow-up)
- **Bilanz UI** — not shipped; see § Bilanz below (decision pending)

## Bilanz (not built — decision pending)

A **Bilanz** on Analyse was requested. This section records the discussion so a later slice can implement **one** of the two shapes without re-deriving rules. **Nothing here is in the UI yet.**

### Locked regardless of shape

| Lock | Meaning |
|---|---|
| **No export** | Bilanz is **not** in Analyse CSV or PDF |
| **No liabilities** | Schulden are not in the data model. Passiva in v1 = **Eigenkapital** only (maybe later, additive) |
| **Calibrate all accounts** | Stichtag-Aktiva for cash = calibrated roll-forward `displayBalance` (Einstellungen). Incomplete calibration → incomplete Aktiva |
| **Confirm all investments** | **Investiert** = confirmed EK ([`investments.md`](investments.md)), not market value. Confirming **tags** the row; it still counts in period Ausgaben |
| **Investments stay in period flow** | Confirmed buys **remain** in Einnahmen/Ausgaben/Netto and Analyse charts. **Investiert** is an extra EK total (and table badge), not an exclusion |
| **German labels** | UI copy German; amounts `de-DE` EUR |

Quality of a *real* stock Bilanz is mostly **data practice** (calibrate + confirm investments), not a new formula.

### Two different statements (do not mix)

A **Bilanz** is a **Stichtag** (Aktiva = Passiva).  
**Einnahmen vs Ausgaben** is a **Periodenrechnung** (GuV / Haushaltsrechnung).  
Analyse charts **and Investiert** stay period-filtered; **Kontostand** in the strip is a Stichtag (not Zeitraum).

---

### A — Stichtagsbilanz (Aktiva / Passiva) — current preference

Follows accounting identity: **Summe Aktiva = Summe Passiva**. Shows **where money is now**, not how it moved.

**Stichtag:** today (same as strip **Kontostand**). A future Bilanz **Investiert (EK)** would be all-time confirmed EK, not the period strip. **Zeitraum, Typ, Kategorie do not apply.** Bank/Konto filters do (empty = all accounts).

```
Bilanz  ·  Stichtag: heute  (i)

Aktiva                              | Passiva
Konto … (je kalibriert)     €       | Eigenkapital              €
…                                   | Verbindlichkeiten         —
Investiert (EK)             €       |
────────────────────────────────────|────────────────────────────────
Summe Aktiva                €       | Summe Passiva             €
```

| Side | Contents |
|---|---|
| **Aktiva** | One row per selected calibrated account (`displayBalance`) + one row **Investiert (EK)** |
| **Passiva** | **Verbindlichkeiten** = — (v1). **Eigenkapital** = balancing residual = Σ Aktiva (no debts) |
| **Identity** | The two sums **must** match; do not show an “approx” mismatch |

**Uncalibrated accounts:** show „—“ and **exclude** from the sum (or refuse a complete Bilanz until every selected account is calibrated — pick at implement time).

**Placement if built:** **above** the period charts (under the summary strip), because it is the same Stichtag as Kontostand / Investiert.

**(i) tooltip:** Stichtag heute, not the Analyse period; EK ≠ Kurswert; no Schulden; related txs are **not** extra-netted here (see Dubletten).

#### Dubletten / PayPal-3er on a stock Bilanz

Related groups are **flows**. The Bilanz lists **stocks**.

PayPal-Kauf 50 € (`paypal_purchase`: PayPal−, PayPal+, Giro−):

- After the three legs, **Giro** and **PayPal** `displayBalance` already reflect the economic −50 € on cash.
- **Do not** put the three bookings as Bilanz rows and **do not** drop related pairs from Kontostand — that would understate cash (PayPal and Giro are real accounts).
- Pair netting stays on **period** aggregates (summary, trend, bars, pies, breakdowns) as today.

Umbuchung Giro ↔ Tagesgeld: wealth unchanged; both accounts’ stands are correct as-is.

#### Investments on a stock Bilanz

**Aktiva → Investiert (EK)**. The cash already left the Giro `displayBalance`. Do **not** add the buy a second time as a Passiva/expense line on this statement.

Period Analyse **does** keep the same buy in Ausgaben (product lock). That is a **flow** figure; mixing it onto the Stichtagsbilanz would break Aktiva = Passiva.

---

### B — Periodenbilanz (Einnahmen / Ausgaben) — considered, not chosen as “the Bilanz”

A two-column **Haushaltsrechnung** for the **current Analyse filters** (same netting as charts). Useful, but it is a **GuV**, not a Bilanz.

Draft (rejected as the Analyse “Bilanz”):

```
Einnahmen              | Ausgaben
Kategorien …           | Kategorien …
Summe                  | Summe
                 Ergebnis = Netto (Einnahmen − Ausgaben)
```

- Same filters + related netting as summary / pies / breakdowns.
- Typ **Alle** only; hide when Typ is income- or expense-only.
- Category rows from existing `getAnalysisBreakdown`; no extra query.
- Confirmed investments **stay in** Konsum columns (same as charts); **Investiert** strip / badge is the extra view.
- **No CSV/PDF** (same export lock).

A later variant added a third column **Umschichtung** so PayPal-Funding (Giro− / PayPal+) and **period** investment EK could be **visible** without calling them Konsum. That still is not Aktiva/Passiva.

PayPal-Kauf in period totals: netting keeps the merchant PayPal− and drops wallet+ / bank− when those legs are in the filter (Einnahmen/Ausgaben show the purchase once; net is −50). A Umschichtung column would still be useful later to show funding separately.

---

### What would still be needed for a “real” Bilanz later

1. All relevant **accounts calibrated** (already the product rule for Kontostand).
2. All depot/ETF buys **confirmed** as investments.
3. **Schulden** only if/when a liability model exists (v1: skip).
4. **Marktwert** for Investiert — out of scope ([`investments.md`](investments.md)); EK is the honest figure today.
5. Reconstructing equity from day-one history — **not** Analyse’s job; Eigenkapital stays a **residual**, not “Gewinnvortrag seit 2010”.

### Status

**Not implemented.** Prefer **A (Stichtagsbilanz)** unless product choice changes. Do not ship both as one widget (stocks and flows mixed).

---

## Open / known issues

**Perceived slow load (even with empty DB)** — not fixed yet:

- Analyse fires many parallel queries; route overlay waits until most of them finish.
- `getAnalysisTimeSeries` still builds empty day buckets for the whole default year (~15 KB) with no rows.
- Each analysis query runs `loadNettedRows` separately (4× DB work when data exists).
- First visit may also pay Chart.js client chunk load.

Possible follow-ups: clear nav overlay after summary; skip empty bucket fill; consolidate into one query; lazy-load charts.
