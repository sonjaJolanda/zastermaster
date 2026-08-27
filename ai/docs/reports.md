# PDF reports — Zaster Master

Printable PDF snapshots for **Transaktionen** and **Analyse**. CSV remains the full data dump; PDF is the human-readable report.

Related: [`transactions.md`](transactions.md) · [`analysis.md`](analysis.md) · [`implementation-plan.md`](implementation-plan.md) Slice 13

---

## Approach

| | |
|---|---|
| **Where** | Client (`jspdf` + `jspdf-autotable`) |
| **Not** | html2canvas screenshot, server/Puppeteer |
| **Charts** | Analyse only — Chart.js `toBase64Image()` from on-page chart refs |
| **Logo** | `/design/Zaster_Master_Logo.svg` rasterized to PNG for the PDF header |

---

## Shared header / footer

Every page:

- Logo (left)
- Report title: „Transaktionen“ / „Analyse“
- Erstellt am: `de-DE` date + time
- Version: `Zaster Master v{APP_VERSION}` ([`src/version.ts`](../../src/version.ts))

Footer: `Seite n / m`

---

## Filenames

| Tab | Pattern |
|---|---|
| Transaktionen | `zastermaster-transaktionen-YYYY-MM-DD.pdf` |
| Analyse | `zastermaster-analyse-YYYY-MM-DD.pdf` |

---

## Transaktionen body

1. Summary: Kontostand · Investiert · Einnahmen · Ausgaben · Netto · Buchungen  
2. Active filters (banks, konten, dates, typ, Konfidenz, search, …)  
3. Table columns: Datum, Bank, Konto, Betrag, Verwendungszweck, Kategorie  
4. **Cap:** 2 000 rows. If more match filters → include first 2 000, note in PDF + UI alert; use **CSV** for full dump (100 000).

Data: query `exportTransactionsForPdf` (same filters as list/CSV).

---

## Analyse body

1. Summary (as strip; respects Typ visibility)  
2. Filter / Zeitraum  
3. **Zeitlicher Trend** chart image (if rendered) — drawn **preserving the on-screen aspect ratio** (not stretched into a fixed box)  
4. **Vergleich pro Monat** bar chart image (if rendered) — same aspect-ratio handling as the trend  
5. **Pie chart row** — Total / Ausgaben / Einnahmen (whichever are shown for Typ) **side by side** in one row (`addChartImageRow`). Each pie is capped (~36 mm, ≈ on-screen ~132 px triple pies), centered in its column, aspect ratio preserved — not stretched to full column width.  
6. Breakdown tables: Total (when Alle), then Ausgaben, then Einnahmen (matching UI order)

Uses already-loaded Analyse query data + chart refs — no extra server PDF op. Trend and monthly-bar export also pass `getAspectRatio()` from the Chart.js canvas.

---

## UI

Toolbar next to **CSV exportieren**: **PDF exportieren** on both pages.

---

## Out of scope (v1)

- Pixel-perfect UI screenshots  
- Excel  
- Server-generated PDFs / e-mail  
- Office background in the PDF  
