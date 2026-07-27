# PRD — Zaster Master

Product boundaries and MVP. **Slice-by-slice build steps:** [`implementation-plan.md`](implementation-plan.md) (single source for the roadmap). Behavior detail: [`../README.md`](../README.md) and feature docs.

## Constraints (locked)

- **Wasp** full-stack (entities, queries/actions, pages, Prisma) — use batteries, don’t reinvent
- **Personal use** — no auth, no multi-tenant, no enterprise admin, no cloud deploy in v1
- **Vertical slices** — each slice ships schema + operation + UI, thin first then thicken
- Specs: design, transactions (+ related detect), analysis, categorization, `categories_seed.json`

## What Wasp should own (don’t rebuild)

| Concern | Use |
|---|---|
| Routing / pages | `main.wasp` routes + React pages |
| Client ↔ server | Queries / actions (not custom REST for app features) |
| DB access | Prisma via `context.entities` |
| Migrations | `wasp db migrate-dev` |
| App shell | `app.client.rootComponent` + `<Outlet />` |
| Later auth | Wasp auth when/if needed — not now |

**Custom:** bank parsers, hybrid categorizer, related-detect, Chart.js, design tokens.

**Template:** `wasp new` **minimal** or **basic** (not OpenSaaS). Seed from `categories_seed.json`.

## Personal MVP

Useful app **before** related-detect and fancy Analyse:

1. Shell: logo, balance placeholder, nav icons, background, German UI  
2. Seed categories  
3. Upload **DKB** → store → Transaktionen table  
4. Keyword + manual categorize (**merken** = later / Slice 3 Thick — not required for MVP)  
5. Basic filters, pagination, Details  
6. Account balance → header sum  
7. Analyse **summary only** (no pies/trend yet)

**After MVP:** other banks, related-detect, Analyse charts, column toggles, etc.

## Build order

Do **not** duplicate slice tables here. Follow and check off:

→ **[`implementation-plan.md`](implementation-plan.md)** (slices 0–13, Thin DoD, Thick, out of scope)

**MVP complete** = Thin of slices **0–6** done.

## Anti-patterns

- All Prisma models before first import works  
- Custom REST beside Wasp operations  
- OpenSaaS / auth scaffolding  
- Full related-detect before a second bank exists  
- Full Chart.js dashboards before summary numbers exist  

## Doc map

| Doc | Role |
|---|---|
| [`../README.md`](../README.md) | Product + architecture |
| [`implementation-plan.md`](implementation-plan.md) | **Slice roadmap + LLM steps** |
| [`design.md`](design.md) | Look & shell |
| [`transactions.md`](transactions.md) | Table + related-detect |
| [`analysis.md`](analysis.md) | Analyse + netting |
| [`categorization.md`](categorization.md) | Categorizer + tree |
| [`investments.md`](investments.md) | Investiert (EK) + confirm flow |
| [`reports.md`](reports.md) | PDF reports (TX + Analyse) |
| [`testing.md`](testing.md) | Automated + manual test concept |
| `categories_seed.json` | Seed data |
