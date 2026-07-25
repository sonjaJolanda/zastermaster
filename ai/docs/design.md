# Design — Zaster Master

Visual and UX requirements for the UI. Product behavior lives in [`../README.md`](../README.md); this file owns look, layout, and interaction polish.

## Brand assets

| Asset | Path | Use |
|---|---|---|
| Logo | [`Design/Zaster_Master_Logo.svg`](../../Design/Zaster_Master_Logo.svg) | Header brand mark; clickable home → Transaktionen. Black circular “Z” monogram — keep crisp, don’t recolor arbitrarily. |
| Background | [`Design/BackgroundImage_Office.JPEG`](../../Design/BackgroundImage_Office.JPEG) | **Full-app** background on every view (fixed/cover). Softly blurred (~6px) so the photo stays atmosphere, not competition for the content panel. Warm daylight office: light wood, soft walls, greenery, natural light. |

Do not replace these with generic gradients or stock “fintech purple” themes. The office photo *is* the atmosphere.

## Visual direction

**Mood:** calm, personal, desk-at-home — clear enough for money work, soft enough not to feel like a bank terminal.

**Inspired by the background:** natural light, oak/wood warmth, off-white surfaces, muted greens, one restrained warm accent (fruit/poster orange in the photo — use sparingly for focus states / primary CTA, not as a purple/indigo substitute).

**Avoid:**

- Purple / indigo “AI SaaS” gradients
- Dark-mode-first UI (optional later; v1 stays light-over-photo)
- Dense dashboard chrome in the first viewport (no stat-card walls in the header)
- Tab carousels; decorative glow stacks; emoji as UI

## Layout shell

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]   Balance €…          [↑] [⚙] [☰] [📊]         │  ← header (always)
├─────────────────────────────────────────────────────────┤
│                                                         │
│   frosted / translucent content panel                   │  ← page body
│   (readable over photo)                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
     background image: cover, fixed, full viewport, soft blur
```

- **Header:** one slim bar — logo left, balance, icon nav right. Active route icon highlighted. Tooltips on icons (German labels).
- **Content:** sits in a semi-opaque / frosted panel (or soft white card with blur) so text stays readable over the photo. Prefer **one** main panel per page, not a grid of competing cards.
- **Desktop-primary** (~1280px+ comfortable); usable on mobile (icons stay; tables scroll horizontally or collapse to stacked rows).
- Default landing: **Transaktionen**.

## Color & tokens

Define CSS variables (Tailwind theme extension) and reuse everywhere:

| Token | Intent |
|---|---|
| `--zm-bg-image` | Office JPEG as `background-image` |
| `--zm-surface` | Frosted panel fill (e.g. white ~75–90% opacity + backdrop blur) |
| `--zm-surface-border` | Soft warm gray / wood-tinted hairline |
| `--zm-text` | Near-black for body text on surfaces |
| `--zm-text-muted` | Secondary labels |
| `--zm-accent` | Sparse warm accent (CTA, focus ring) — not purple |
| `--zm-income` | Green for positive amounts |
| `--zm-expense` | Red/rose for negative amounts |
| `--zm-conf-manual` | Green |
| `--zm-conf-learned` | Blue |
| `--zm-conf-keyword` | Yellow/amber |
| `--zm-conf-low` | Red |
| `--zm-conf-none` | Gray |

Category colors come from DB (user-editable); charts use those + the income/expense tokens.

## Typography

- UI language: **German**.
- **Locked fonts:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) for all UI (load via Google Fonts or self-host).
  - Reason: calm, readable, distinct from Inter/Roboto; strong **tabular figures** for EUR amounts (`font-variant-numeric: tabular-nums` on Betrag columns).
  - Do **not** use Inter, Roboto, or Arial as the primary UI font.
- Wire into Tailwind / Shadcn theme (`font-sans` → IBM Plex Sans).
- Amounts: `de-DE` EUR, always signed; color by sign (`--zm-income` / `--zm-expense`).
- Hierarchy: page title + one short supporting line max per section; don’t stack competing headlines.

## Components (Shadcn + custom)

- Prefer Shadcn primitives (Button, Dialog, Table, Select, Input, Checkbox, Progress) styled to the tokens above.
- **Overlays** (Details, Related-detect): modal/dialog centered on the frosted layer; dim the rest slightly; keep the background photo faintly visible.
- **Tables:** zebra or hairline rows; sticky header optional on desktop; confidence as colored pill/dot + optional text.
- **Forms:** generous hit targets; German labels; validation messages under fields.
- **Empty states:** short German copy + one CTA (e.g. “Jetzt Importieren”) — no illustration clutter.

## Motion

Ship a few intentional motions (not noise):

1. Header icon: short active-state transition
2. Page content: light fade/slide on route change
3. Upload / related-detect: determinate or indeterminate progress that feels calm

No continuous parallax on the background; keep the photo still (`background-attachment: fixed` on desktop; `scroll` on mobile if fixed is janky).

## Page-specific design

### Header

- Logo ~32–40px height, optically balanced with icons.
- Balance is the only number in the header (wealth). Income/expenses live on Transaktionen.
- Icons: **Lucide** only; same stroke weight throughout.

### Upload

- Large drop zone inside the content panel; bank selector above or beside.
- Progress bar during import; disable nav icons while locked (visually muted).

### Transaktionen

- Full behavior: [`transactions.md`](transactions.md).
- **Main view = wide data table** with many columns — not a two-column page layout.
- Summary strip **inside** the page for **current table filters** (default all imported txs — not Analyse’s year default).
- Filters & Optionen as a compact toolbar above the table.
- **Details overlay only:** on desktop, modal may use two sides — left: fields, right: categorize. Mobile: stack. Does **not** change table column count.

### Einstellungen / Kategorien

- List/grid of main categories (color swatch + name).
- **Editing a category** means managing its full definition:
  - name / color of the main category
  - which **subcategories** exist (add / rename / delete / recolor)
  - which **keywords** belong to the main category and to each subcategory
- Keywords are the free auto-categorization input for the next imports — see [`categorization.md`](categorization.md). Keep editing obvious (chip list or editable list per subcategory).
- Prefer expand-in-place or a side panel for one category at a time; avoid nested card overload.

### Analyse

- Sticky filter bar + summary strip + five sections (see [`analysis.md`](analysis.md)).
- Charts use category DB colors and income/expense tokens; flat legends, no 3D.
- Prefer one scrollable panel; when Typ is Ausgaben or Einnahmen, hide the opposite pie and breakdown (and simplify the summary strip) — see analysis.md.

## Accessibility & readability

- Contrast of text on `--zm-surface` must meet WCAG AA for body text.
- Never put small body text directly on the raw photo without a surface.
- Focus rings visible (accent token).
- Don’t rely on color alone for confidence — pair with label or icon.

## Implementation notes

- Assets: copy or import from `Design/` into `public/` (or Wasp static) for the client build.
- Document token values in code (`src/client/index.css` or theme file) once chosen; tweak once against the real JPEG.
- When design decisions change, update this file.
