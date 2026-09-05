# Categorization — Zaster Master

Free hybrid categorization (no cloud tokens). Overview in [`../README.md`](../README.md); UI for picking categories on a row in [`transactions.md`](transactions.md); tree editing visuals in [`design.md`](design.md).

## Purpose

1. Assign every imported transaction a **Kategorie** + **Unterkategorie**.
2. Do it **locally** with keywords (no paid AI in the core path).
3. Let the user **correct** assignments and optionally add Stichwörter from the booking (Details-Chips).
4. Keep the category **tree editable** in Einstellungen (structure + keywords).

**Not** this doc: bank file parsing (README import), Analyse charts, related-tx linking.

## Principles

| Principle | Meaning |
|---|---|
| Free by default | Keywords only; no API tokens required |
| Source of truth for tree | **PostgreSQL**, not a live JSON file |
| Seed once | [`categories_seed.json`](../../categories_seed.json) on empty DB |
| Color = source | Konfidenz UI follows `categorySource`, not only the numeric score |
| Edit tree ≠ pick on tx | Tree CRUD in Einstellungen; row assign in Transaktionen Details |
| Teach from a booking | Details overlay: Stichwort-Chips (no checkbox) → append to the chosen **Unterkategorie** |

## Data model

### Category tree

| Model | Fields (conceptual) |
|---|---|
| `Category` | id, name, color, sortOrder |
| `Subcategory` | id, categoryId, name, color, sortOrder |
| `CategoryKeyword` | id, keyword, subcategoryId **or** categoryId (exactly one owner) |

Ensure seeded defaults include usable **Sonstige** / **Unbekannt** (or create them in code if missing from seed) for fallback.

### LearnedRule

Removed. Teaching the categorizer = adding **CategoryKeyword** rows on the chosen subcategory (same list as Einstellungen).

The Prisma enum value `categorySource = learned` remains for old rows; new writes never set it.

### Transaction fields

| Field | Notes |
|---|---|
| `categoryId`, `subcategoryId` | FKs; required after categorize (fallback Sonstige/Unbekannt on import) |
| `confidenceScore` | `0.0`–`1.0`; manual → `1.0` |
| `categorySource` | `manual` \| `learned` \| `keyword` \| `none` |

## Seed

- File: repo-root `categories_seed.json` (shape: main → color, keywords[], subcategories → color, keywords[]).
- Run **once** when category table is empty (startup or explicit seed action).
- Re-run must not duplicate (check empty / “already seeded” flag).
- Optional later: “Reset to defaults” (destructive — confirm UI).

## Einstellungen / Kategorien (tree editing)

**Two-step UI:**

1. Card pencil → expand **overview**: main category + subcategories in a **two-column** grid; keywords shown comma-separated (read-only).
2. Pencil on a main/sub row → **edit that node** (color picker, name, add/remove keywords). Pencil again closes edit mode.

Also: add subcategory via the small row at the bottom of the expanded card.

**v1 delete policy (locked):** Trash on category/subcategory cards. If no txs reference it → delete immediately. If txs remain → **modal** (`CategoryDeleteModal`): pick **any other subcategory** (not necessarily same main category) to reassign those txs, then delete. Last subcategory of a category cannot be deleted. Do not leave dangling FKs. Analyse always displays current FK labels ([`analysis.md`](analysis.md)).

Categories are **not** created from the Transaktionen Details overlay — only selected there.

## Hybrid algorithm (auto on import)

Run on each new row **before** insert (and optionally “re-categorize all uncategorized” later).

**Order:**

### 1. Keywords

Normalize: case-insensitive; multi-word keywords allow flexible separators (spaces/punctuation).

Match order of fields: **sender → empfaenger → verwendungszweck**.

Keyword sources:

1. All **subcategory** keywords (prefer longest / most specific match if several hit)
2. Else **main category** keywords

On subcategory keyword hit → that category + subcategory, score `0.7`, source `keyword`.  
On main-only keyword hit → that category + subcategory **Unbekannt** (or “Allgemein” if present), score `0.7`, source `keyword`.

### 2. Fallback

- Category Sonstige, subcategory Unbekannt  
- `confidenceScore = 0.0`, `categorySource = none`

### Manual override

User picks category/sub in Details → `categorySource = manual`, `confidenceScore = 1.0`.  
If the row has a **confirmed related partner**, apply the same category/sub/source/score to the partner as well (linked pairs always share one category).

### Keyword suggestions (Details)

Always shown when there are candidates (no checkbox). `suggestKeywordsFromTransaction` in `suggestKeywords.ts`.

**Order on screen:** single words first, then optional two-word phrases.

**Sources:** Empfänger (card merchants), leftover Verwendungszweck after bank templates, then Sender.

**Skip:** ISSUER, PayPal-own-email, VISA-Standardtexte, unique SEPA refs, payment facilitators (SumUp, Zettle, …) as standalone tokens, legal suffixes (GmbH, AG, …), keywords already on that sub/main.

**Examples:** `SumUp PadelCity GmbH` → `PadelCity` (not SumUp, not GmbH). `1.200` in a DKB amount is import parsing, not this matcher.

Selected chips are **appended** to the chosen **Unterkategorie** on Speichern (same `CategoryKeyword` list as Einstellungen). Do not store full Verwendungszweck as a hidden rule.

### Related-pair category sync

| Moment | Behavior |
|---|---|
| `categorizeTransaction` | Write category to the edited row **and all** `relatedGroupId` members (fallback: `relatedTransactionId` partner) |
| `confirmRelatedPair` | After linking 2–3 txs, copy the stronger existing category onto the whole group (`manual` > `learned` (legacy) > `keyword` > `none`) |

## Konfidenz UI

| Source | Color | Label (DE) |
|---|---|---|
| `manual` | Green | Manuell |
| `learned` | Blue | Gelernt |
| `keyword` | Yellow/amber | Stichwort |
| `none` | Gray | Keine |

Do **not** treat `learned` as a live source — it is legacy only.

Pair color with text/icon (a11y). Optional filter by source on Transaktionen (Slice 5 Thick).

## Where it runs

| Moment | Behavior |
|---|---|
| Import | Auto hybrid pipeline on each new row |
| Details save | Manual; selected Stichwort-Chips append to the subcategory |
| Confirm related pair | Align both legs to one category (stronger source wins) |
| Re-import deduped row | Do **not** overwrite an existing manual/keyword category on duplicate skip |
| Bulk re-categorize | Out of scope v1 (nice later: only `none`/`keyword` rows) |

## Operations (Wasp)

| Op | Kind | Purpose |
|---|---|---|
| `getCategories` | query | Full tree + keywords (with ids) |
| `seedCategoriesIfEmpty` | action | Idempotent seed |
| `createCategory` / `updateCategory` / `deleteCategory` | actions | Main category CRUD; new category gets default sub **Unbekannt**; delete with optional `reassignToSubcategoryId` when txs still reference it |
| `createSubcategory` / `updateSubcategory` / `deleteSubcategory` | actions | Sub CRUD; last sub blocked; delete with optional reassign to any other subcategory |
| `setKeywords` | action | Replace keyword list for category **or** subcategory |
| `categorizeTransaction` | action | Manual assign on row **and related partner**; optional `rememberKeywords[]` → append to subcategory |
| (internal) `categorizeRow(text fields)` | pure fn | Used by import |
| (internal) `suggestKeywordsFromTransaction` | pure fn | Details Stichwort-Chips |

## Module layout

```
src/features/categorization/
  matchKeywords.ts
  suggestKeywords.ts        # Details chips
  categorizeRow.ts          # keywords → fallback
  operations.ts             # categorizeTransaction
src/features/categories/
  operations.ts             # tree CRUD + getCategories
```

## Thin vs Thick (implementation)

| Thin (Slice 3) | Thick |
|---|---|
| Keyword match on import (sub **and** main keywords from seed/DB) | Details: Stichwort-Chips an die Unterkategorie |
| Manual Details categorize | Konfidenz source filter |
| Konfidenz colors by source | — |

Editing main/sub keywords in the UI = **Slice 1 Thick** (Einstellungen), not Slice 3.

## Later (not v1 core)

- Local ML on your history (free, offline)
- Optional cloud AI (paid tokens, opt-in)
- Neither replaces the free hybrid path — plug in as an extra stage after keywords if ever added

## Test ideas

1. Seed loads; “rewe” → Einkaufen / Supermärkte  
2. Unknown merchant → Sonstige / Unbekannt / none  
3. Manual save → green / score 1.0  
4. Chips: Empfänger singles, not „VISA Debitkartenumsatz“; SumUp+GmbH → PadelCity; selected keyword hits on next import  
5. Delete category/sub with txs → modal offers reassign to any other subcategory, then delete
