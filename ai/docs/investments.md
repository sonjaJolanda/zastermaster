# Investitionen — Zaster Master

ETF-/Depot-Käufe können als **Investition** markiert werden. Sie bleiben **normale Buchungen** in Einnahmen/Ausgaben/Netto (Transaktionen-Summary + Analyse) und erscheinen **zusätzlich** unter **Investiert** (Einkaufswert / EK) sowie mit Badge in der Tabelle.

Related: [`transactions.md`](transactions.md) · [`analysis.md`](analysis.md) · [`design.md`](design.md)

---

## Kennzahl **Investiert**

| | |
|---|---|
| **Anzeige** | Summary-Leiste neben **Kontostand** (Transaktionen + Analyse), mit Info-(i) |
| **Bedeutung** | Bestätigter Kapitaleinsatz (EK), **nicht** Marktwert |
| **Formel** | `Investiert = −Σ(betrag)` über alle `Transaction.isInvestment = true` (Käufe negativ → positiver EK; Verkäufe positiv → EK sinkt) |
| **Filter** | Folgt Bank-/Konto-Filtern (wie Kontostand); **nicht** Zeitraum |
| **vs. Ausgaben** | Bestätigte Investments **bleiben** in Ausgaben/Einnahmen/Netto und in den Analyse-Charts. **Investiert** ist die Extra-Sicht (EK, alle Zeiten), keine Herausnahme aus dem Flow. Trend + Monatssäulen zeigen zusätzlich eine **schwarze** Serie „Investitionen“ (Käufe im **Analyse-Zeitraum**), ohne sie aus Rot herauszunehmen. Nicht automatisch beim Import — erst nach Bestätigen |

Ohne bestätigte Investments: **—** oder **0,00** (UI: **—** wenn noch nie bestätigt, sonst 0,00).

---

## Keywords (Regeln)

Unter **Einstellungen → Investitionen** pflegt die Userin Stichwörter (z. B. `BUY`, `Savings plan`, `MSCI`, `iShares`).

- Match wie Kategorie-Keywords: normalisiert gegen Sender / Empfänger / Verwendungszweck.
- Keywords allein buchen **nichts** — sie steuern nur die Erkennung.

---

## Erkennen + Absegnen (wie Zusammengehörige)

1. Auf Transaktionen: Button **Investitionen erkennen** (near-black primary; hover `title` explains keyword-based detect + confirm).
2. Overlay läuft Erkennung (Keyword-Match auf noch nicht investierte, nicht abgelehnte Buchungen).
3. Review einzeln: **Bestätigen** → `isInvestment = true`; **Ablehnen** → Rejection, erscheint nicht wieder.
4. Danach aktualisiert sich **Investiert**; die Buchung bleibt in Tabelle **und** in den Konsum-Summen/Analyse-Charts (Betrag rot/grün wie üblich, Badge **Investition**).
5. In **Details**: **Als Investition markieren** bzw. bei bestätigter Investition **Investition entfernen** (`clearInvestment` → Flag weg + Rejection).

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
| `getInvestedTotal` | query | `{ total, count }` — optional `banks` / `konten` |
| `detectInvestments` | action | Vorschläge `{ suggestions[], truncated }` |
| `confirmInvestment` | action | `{ transactionId }` → flag |
| `rejectInvestment` | action | Rejection speichern |
| `clearInvestment` | action | Details: Flag entfernen + Rejection |

---

## UI

- Summary: **Kontostand · Investiert(i) · Einnahmen · …** — (i) explains EK **plus** that the rows still count in Ausgaben
- Tabelle: signed amount colors + **Investition** badge
- Einstellungen: Keyword-Chips add/remove (wie Kategorie-Stichwörter)
- Transaktionen: Detect-Button + Overlay (eine Buchung pro Schritt, Keyword-Treffer anzeigen)
- Details: **Als Investition markieren** / **Investition entfernen**

---

## Out of scope (v1)

- Live-Depotkurs / Marktwert  
- Auto-`isInvestment` beim Import  
- Investiert nach Zeitraum filtern  
