# Investitionen — Zaster Master

ETF-/Depot-Käufe sind **Vermögensumschichtungen**, kein Konsum. Bestätigte Investments fließen in die Kennzahl **Investiert** (Einkaufswert / EK) und zählen **nicht** in Einnahmen/Ausgaben/Netto (Transaktionen-Summary + Analyse) — damit Kategorie-Analysen (z. B. Sparen) nicht „weniger Gespartes“ zeigen, nur weil Geld investiert wurde.

Related: [`transactions.md`](transactions.md) · [`analysis.md`](analysis.md) · [`design.md`](design.md)

---

## Kennzahl **Investiert**

| | |
|---|---|
| **Anzeige** | Summary-Leiste neben **Kontostand** (Transaktionen + Analyse), mit Info-(i) |
| **Bedeutung** | Bestätigter Kapitaleinsatz (EK), **nicht** Marktwert |
| **Formel** | `Investiert = −Σ(betrag)` über alle `Transaction.isInvestment = true` (Käufe negativ → positiver EK; Verkäufe positiv → EK sinkt) |
| **Filter** | Unabhängig von Zeitraum-/Bank-Filtern (wie Kontostand) |
| **vs. Ausgaben** | Bestätigte Investments **nicht** in Ausgaben/Einnahmen/Netto; sichtbar in der Tabelle (Betrag schwarz) und unter **Investiert** |

Ohne bestätigte Investments: **—** oder **0,00** (UI: **—** wenn noch nie bestätigt, sonst 0,00).

---

## Keywords (Regeln)

Unter **Einstellungen → Investitionen** pflegt die Userin Stichwörter (z. B. `BUY`, `Savings plan`, `MSCI`, `iShares`).

- Match wie Kategorie-Keywords: normalisiert gegen Sender / Empfänger / Verwendungszweck.
- Keywords allein buchen **nichts** — sie steuern nur die Erkennung.

---

## Erkennen + Absegnen (wie Zusammengehörige)

1. Auf Transaktionen: Button **Investitionen erkennen**.
2. Overlay läuft Erkennung (Keyword-Match auf noch nicht investierte, nicht abgelehnte Buchungen).
3. Review einzeln: **Bestätigen** → `isInvestment = true`; **Ablehnen** → Rejection, erscheint nicht wieder.
4. Danach aktualisiert sich **Investiert**; die Buchung bleibt in der Tabelle sichtbar, fällt aber aus Konsum-Summen/Analyse-Flow.

Kein Auto-Tag beim Import.

---

## Datenmodell

| Model / Feld | Rolle |
|---|---|
| `Transaction.isInvestment` | Nach Confirm `true` |
| `InvestmentKeyword` | User-Stichwort (`keyword` unique) |
| `InvestmentRejection` | Abgelehnte `transactionId` (unique) |

---

## Operations

| Name | Typ | Zweck |
|---|---|---|
| `getInvestmentKeywords` | query | Liste |
| `setInvestmentKeywords` | action | Ersetzen der Keyword-Liste |
| `getInvestedTotal` | query | `{ total: string \| null, count: number }` |
| `detectInvestments` | action | Vorschläge `{ suggestions[], truncated }` |
| `confirmInvestment` | action | `{ transactionId }` → flag |
| `rejectInvestment` | action | Rejection speichern |

---

## UI

- Summary: **Kontostand · Investiert(i) · Einnahmen · …**
- Einstellungen: Keyword-Chips add/remove (wie Kategorie-Stichwörter).
- Transaktionen: Detect-Button + Overlay (eine Buchung pro Schritt, Keyword-Treffer anzeigen).

---

## Out of scope (v1)

- Live-Depotkurs / Marktwert  
- Auto-`isInvestment` beim Import  
- Investiert nach Zeitraum filtern  
