# Categorization — Zaster Master

Free hybrid categorization (no cloud tokens). Overview in [`../README.md`](../README.md); UI for picking categories on a row in [`transactions.md`](transactions.md); tree editing visuals in [`design.md`](design.md).

## Purpose

1. Assign every imported transaction a **Kategorie** + **Unterkategorie**.
2. Do it **locally** with keywords + learned rules (no paid AI in the core path).
3. Let the user **correct** assignments and optionally **teach** the system (“merken”).
4. Keep the category **tree editable** in Einstellungen (structure + keywords).

**Not** this doc: bank file parsing (README import), Analyse charts, related-tx linking.

## Principles

| Principle | Meaning |
|---|---|
| Free by default | Keywords + learned rules; no API tokens required |
| Source of truth for tree | **PostgreSQL**, not a live JSON file |
| Seed once | [`categories_seed.json`](../../categories_seed.json) on empty DB |
| Color = source | Konfidenz UI follows `categorySource`, not only the numeric score |
| Edit tree ≠ pick on tx | Tree CRUD in Einstellungen; row assign in Transaktionen Details |
| Merken is Thick | Slice 3 Thin = keywords + manual; learned rules come in Slice 3 Thick ([`implementation-plan.md`](implementation-plan.md)) |

## Data model

### Category tree

| Model | Fields (conceptual) |
|---|---|
| `Category` | id, name, color, sortOrder |
| `Subcategory` | id, categoryId, name, color, sortOrder |
| `CategoryKeyword` | id, keyword, subcategoryId **or** categoryId (exactly one owner) |

Ensure seeded defaults include usable **Sonstige** / **Unbekannt** (or create them in code if missing from seed) for fallback.

### LearnedRule (Slice 3 Thick+)

| Field | Notes |
|---|---|
| `descriptionFragment` | Unique; usually full Verwendungszweck, else sender/empfaenger fallback |
| `categoryId`, `subcategoryId` | Target FKs |
| `confidence`, `usageCount` | Strengthen with reuse |

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

Editing a category means the **whole definition**:

1. Main category — name, color, optional **main-level keywords**
2. **Subcategories** — add / rename / delete / recolor
3. **Keywords** on each subcategory (and on main) — drive auto-categorize on future imports

**v1 delete policy (locked):** Block delete of a category/subcategory while transactions still reference it, **or** require reassigning those txs to Sonstige/Unbekannt first. Do not leave dangling FKs. Analyse always displays current FK labels ([`analysis.md`](analysis.md)).

Categories are **not** created from the Transaktionen Details overlay — only selected there.

## Hybrid algorithm (auto on import)

Run on each new row **before** insert (and optionally “re-categorize all uncategorized” later).

**Order:**

### 1. Learned rules (if any exist)

For each rule, test whether `descriptionFragment` is a substring of (case-insensitive) `verwendungszweck`, else `sender`, else `empfaenger`.

```
weighted = (len(fragment) / len(text)) * (1 + usageCount * 0.1)
```

Accept best rule with `weighted > 0.3`.

- Set category/subcategory from rule  
- `categorySource = learned`  
- `confidenceScore = min(1, weighted)` (or store rule.confidence)  
- Increment `usageCount` on match (Thick+)

### 2. Keywords

Normalize: case-insensitive; multi-word keywords allow flexible separators (spaces/punctuation).

Match order of fields: **sender → empfaenger → verwendungszweck**.

Keyword sources:

1. All **subcategory** keywords (prefer longest / most specific match if several hit)
2. Else **main category** keywords

On subcategory keyword hit → that category + subcategory, score `0.7`, source `keyword`.  
On main-only keyword hit → that category + subcategory **Unbekannt** (or “Allgemein” if present), score `0.7`, source `keyword`.

### 3. Fallback

- Category Sonstige, subcategory Unbekannt  
- `confidenceScore = 0.0`, `categorySource = none`

### Manual override

User picks category/sub in Details → `categorySource = manual`, `confidenceScore = 1.0`.  
If the row has a **confirmed related partner**, apply the same category/sub/source/score to the partner as well (linked pairs always share one category).

If **Diese Zuordnung merken** (Thick): upsert `LearnedRule` with fragment = Verwendungszweck if non-empty, else sender, else empfaenger.

### Related-pair category sync

| Moment | Behavior |
|---|---|
| `categorizeTransaction` | Write category to the edited row **and** `relatedTransactionId` partner |
| `confirmRelatedPair` | After linking, copy the stronger existing category onto the other leg (`manual` > `learned` > `keyword` > `none`; tie → prefer A) |

## Konfidenz UI

| Source | Color | Label (DE) |
|---|---|---|
| `manual` | Green | Manuell |
| `learned` | Blue | Gelernt |
| `keyword` | Yellow/amber | Stichwort |
| `none` | Gray | Keine |

Do **not** paint a learned match red just because `weighted` is 0.35 — source wins.

Pair color with text/icon (a11y). Optional filter by source on Transaktionen (Slice 5 Thick).

## Where it runs

| Moment | Behavior |
|---|---|
| Import | Auto hybrid pipeline on each new row |
| Details save | Manual (+ optional merken); sync to related partner if linked |
| Confirm related pair | Align both legs to one category (stronger source wins) |
| Re-import deduped row | Do **not** overwrite an existing manual/learned category on duplicate skip |
| Bulk re-categorize | Out of scope v1 (nice later: only `none`/`keyword` rows) |

## Operations (Wasp)

| Op | Kind | Purpose |
|---|---|---|
| `getCategories` | query | Full tree + keywords |
| `seedCategoriesIfEmpty` | action | Idempotent seed |
| Category CRUD | actions | Slice 1 Thick — name/color/subs/keywords |
| `categorizeTransaction` | action | Manual assign on row **and related partner**; `remember?: boolean` |
| (internal) `categorizeRow(text fields)` | pure fn | Used by import |

Learned-rule CRUD can stay internal to `categorizeTransaction` + matcher.

## Module layout

```
src/features/categorization/
  matchKeywords.ts
  matchLearnedRules.ts      # Thick
  categorizeRow.ts          # orchestrates order
  operations.ts             # categorizeTransaction, seed helpers if colocated
src/features/categories/
  operations.ts             # tree CRUD + getCategories
```

## Thin vs Thick (implementation)

| Thin (Slice 3) | Thick |
|---|---|
| Keyword match on import (sub **and** main keywords from seed/DB) | Learned rules + merken checkbox |
| Manual Details categorize | Konfidenz source filter; usageCount updates; bulk re-run |
| Konfidenz colors by source | — |

Editing main/sub keywords in the UI = **Slice 1 Thick** (Einstellungen), not Slice 3.

## Later (not v1 core)

- Local ML on your history (free, offline)
- Optional cloud AI (paid tokens, opt-in)
- Neither replaces the free hybrid path — plug in as an extra stage after learned/keywords if ever added

## Test ideas

1. Seed loads; “rewe” → Einkaufen / Supermärkte  
2. Unknown merchant → Sonstige / Unbekannt / none  
3. Manual save → green / score 1.0  
4. Merken (Thick) → second import with same purpose → learned  
5. Delete category with txs → blocked or reassigned per policy  
