# Zaster Master
- Personal finance app for importing German bank exports, auto-categorizing transactions, linking related ones, and analyzing spending. Brand: Zaster Master. UI language: German.
- Upload DKB / Sparkasse / PayPal / Trade Republic statements → store in SQLite → keyword + learned-rule categorization → browse/edit transactions → optional related-tx linking → filterable charts (income/expenses by category & time).

This can be changed if there are better options:
- Backend: Python 3.11+, FastAPI, Uvicorn :8000, Pandas, SQLite
- Frontend: Vue 3 + Vite :9080, Tailwind, Axios, Chart.js, Heroicons
- Dev: Root npm run start (concurrently), optional Docker
- No auth. Local-only. CORS open. No Vite proxy — frontend calls http://localhost:8000.

## Core domain model
Transaction (canonical fields)
- datum (YYYY-MM-DD), betrag (signed: income >, expense <)
- sender, empfaenger, verwendungszweck, iban, kundenreferenz
- kategorie (default Sonstige), unterkategorie (default Unbekannt)
- confidence_score (manual edit → 1.0)
- bank (dkb | sparkasse | paypal), konto (e.g. Girokonto|5500)
- balance (export snapshot copied onto rows; analysis takes latest non-zero)
- related_transaction_id (one link per row; confirm writes both directions)
- Dedup key on insert: exact match of (datum, iban, verwendungszweck, betrag, kundenreferenz).

Categories (source of truth = JSON file, not SQLite)

- {
  "Einkaufen": {
    "color": "#hex",
    "keywords": [],
    "subcategories": {
      "Supermärkte": { "color": "#hex", "keywords": ["rewe", "aldi"] }
    }
  }
}
- mains roughly: Einkaufen, Fixkosten Alltag, Freizeit, Verkehr und Mobilität, Barabhebungen, Sonstiges — each with German merchant/keyword lists.

Learned rules (SQLite categorization_rules)
- description_fragment (unique), category, subcategory, confidence, usage_count
- Created when user manually changes a category (fragment = full Verwendungszweck, or sender/empfänger fallback)

## Backend behavior
Import pipeline (POST /upload-csv)
- Multipart: file + form bank (required; not auto-detected)
- Bank-specific importer → normalized DataFrame
- Auto-categorize every row
- Optionally clean text (current code strips punctuation / non-ASCII — prefer keeping umlauts if you rebuild)
- Insert with dedup
- Return { success, imported_count, duplicate_count, transactions }
Normalized columns every importer must produce:
Datum, Betrag, Sender*in, Empfänger*in, Verwendungszweck, IBAN, Kundenreferenz, Bank, Konto, balance

look at the folder "Bankauszüge" in dem die Bankauszüge liegen, die ich aktuell habe.

### Categorization algorithm
- Learned rules first: for verwendungszweck / sender / empfaenger, if fragment is substring of text: weighted = (len(fragment)/len(text)) * (1 + usage_count*0.1); accept if > 0.3
- Else keyword map from subcategory keywords only (top-level keywords currently unused): match sender → empfaenger → purpose; confidence 0.7
- Else Sonstige / Unbekannt / 0.0
Keyword match: case-insensitive substring; multi-word keywords allow flexible separators.

### Related transactions
Tolerance: ±3 days, ±0.01 €. Detectors:
- PayPal ↔ bank: same absolute amount, same sign, within 3 days
- Transfers: amounts ≈ opposite; different bank/konto; purpose keywords (überweisung, umbuchung, …) or name cross-match
- Duplicates: same date/bank/amount + ≥50% purpose-word overlap
Flow: detect (suggest pairs) → user confirm → persist bidirectional IDs.

## Key API surface
- Upload: POST /upload-csv
- Tx: GET /transactions, POST /transactions/{id}/categorize, DELETE /transactions/all, related detect/confirm/list
- Categories: CRUD on /categories (+ subcats/keywords/color/rename) → mutates JSON
- Analysis: GET /analysis (filters), GET /analysis/stats
- Legacy: POST /update-category (also learns a rule)

GET /analysis filters: grouping (all|year|month|day), year/month/dates, category, bank(s), konto(s), transaction_type (all|income|expenses).

Response: category_analysis, subcategory_analysis, time_analysis (period → category → sum), colors, summary (total_income, total_expenses as abs, net_amount, balance, transaction_count).

## Frontend behavior
Header: logo + live income / expenses / balance / count + Arrow to switch between Tabs.

Four tabs that can be rotated through with an arrow button so that this doesnt take up much space:
- Upload: pick bank, drop CSV/TXT, simulated progress, lock other tabs while uploading; on success reload + jump to Transaktionen. Check if the uploaded file meets the expected structure
- Kategorien: grid of category cards; create/edit/delete; keywords + subcategories (drives next imports)
- Transaktionen: filterable/paginated table; inline category/subcategory; confidence colors; Details modal; detect/confirm related pairs
    - so header is: bank, konto, datum, sender, empfänger, verwendungszweck, betrag, kategorie, konfidenz, details and there are hidden columns that can be shown through a "Filer & Optionen": iban, kundenreferenz, verknüpfte Transaktion
    - Konfidenz zeigt in Farben an an ob die Kategorie manuell ausgewählt: grün, gelernt wurde (sicher): blau, mittlere Konfidenz (keywords): gelb, niedrige Konfidenz (<50%): rot, und keine Kategorisierung: grau
    - die Tabelle zeigt initial 100 Transaktionen an, man kann aber Seiten wechseln und auch auswählen ob 50, 100, 250 oder 500 Transaktionen pro Seite ausgewählt werden sollen
    - Der Inhalt der Betragspalte ist entweder rot (bei Minusbeträgen) oder grün bei positiven Beträgen
    - wenn man auf Details klickt, öffnet sich ein Overlay, das alle Infos noch mal anzeigt und einen die Transaktion kategorisieren lässt. Also man kann aus Kategorien und dann Unterkategorien auswählen. Die Auswahl wird im Kategorien Tab verwaltet. Im Details Overlay kann man außerdem auswählen ob sich das System diese Zuordnung merken soll für zukünftige Transaktionen.
    - Dann gibt es noch einen Button "Zusammengehörige Transaktionen erkennen". Das ist ein längerer Prozess. Dafür wird ebenfalls ein Overlay geöffnet. Das System soll dann alle Transaktionen durchgehen und schauen ob es Transaktionen gibt, die zusammen gehören. Das sind Transaktionen die beispielsweise in Paypal und in DKB vorkommen, aber die selbe Aktion waren, wenn also mit Paypal gezahlt wurde, aber das Geld vom DKB Konto dafür genutzt wurde. Diese Transaktion soll dann nicht zweimal mit in die Statistik zählen. Dafür müssen diese verwandten Transaktionen aber gefunden werden. Ein weiteres Beispiel sind Transaktionen, die vom einen Konto zum anderen flossen. Also zb vom DKB Girokonto wurde Geld in das DKB Tagesgeldkonto verschoben. Diese Transaktion soll auch zusammengeführt werden, sodass wenn ich über alle Konten analysiere, da kein Verlust oder Gewinn analysiert wird, sondern die sich gegenseitig einfach ausgleichen. Außerdem möchte ich die verknüpfte Transaktion nutzen, in der ich dann einfach auf die verknüpfte Transaktion (ein Symbol in der Spalte) klicken kann und ich da verlinkt werde. Das Overlay zeigt zuerst einen Ladebalken an, dann kann ich alle neuen Verknüpfungen einmal betrachten und entweder bestätigen oder ablehnen. Das Overlay zeigt da die beiden Transaktionen die verknüpft werden sollen nebeneinander an mit Id, Konto, Datum, Betrag, Konto und Verwendungszweck. Ähnliche Transaktionen werden gefunden, wenn das Datum ähnlich und der Betrag gleich sind.
- Analyse: filters → refetch /analysis; summary cards; line chart (income vs expenses over time); two pies; expandable breakdown tables
    - hier möchte ich die verschiedene Analysen (zeitlicher Trend, Ausgaben nach Kategorie, Einnahmen nach Kategorie, Ausgaben-Aufschlüsselung und Einnahmen-Aufschlüsselung) sehen können. Initial zeigt diese Seite diese Analysen über alle Bankkonten und über das aktuelle Jahr an. Ich möchte aber den Zeitraum auswählen können (nach Jahr, Monat und Tag), die Kategorie, die betrachtet wird auswählen können (nach Kategorie und Subkategorie) und die Banken und Bankkonten auswählen können (Eine oder mehrere).

### Design
- The app should have one background image everywhere which can be found in the folder Design
- the app design should be very clean
- The app already has a logo which can be found in the folder Design as well
- the app should work in desktop and in mobile but primarily be used in desktop

## Product rules worth keeping
- Amounts always signed; UI formats de-DE EUR
- Balance is export snapshot, not a reconstructed ledger
- Re-uploads must not duplicate the same rows
- Manual category edits teach future imports
- Related pairs should ideally not double-count in totals/charts (roadmap; only partially modeled today via the link field)
- Opening-balance: roadmap says new account upload should ask for current balance and synthesize an opening transaction — not fully done yet

## Potential Problems
- i dont have the bank statements from the beginning of the conto opening to now, i only have the recent ones. I want to be able to see the acutal money I own now. So I need a solution for that. Maybe I can put in what the bank says how much money is in the conto now and we can store the value that it must have had when the first bank statements are there or something. 
- todo: analyse what other problems could arise

Intentionally out of scope / roadmap:
More banks, better transfer netting in charts, stronger learning, ML categorization, Excel/PDF export, Report tab (quarterly YoY), Settings backgrounds.