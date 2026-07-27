# Design — Zaster Master

Visual and UX requirements for the UI. Product behavior lives in [`../README.md`](../README.md); this file owns look, layout, and interaction polish.

## Brand assets

| Asset | Path | Use |
|---|---|---|
| Logo | [`Design/Zaster_Master_Logo.svg`](../../Design/Zaster_Master_Logo.svg) | Fixed top-left brand mark only (icon); clickable home → Transaktionen. Black circular “Z” monogram — keep crisp. **Do not** show the wordmark “Zaster Master”. Also served as tab favicon (`public/favicon.svg`). |
| Upload icon | [`Design/Upload.svg`](../../Design/Upload.svg) | Side nav → Upload; also page title |
| Settings icon | [`Design/Settings.svg`](../../Design/Settings.svg) | Side nav → Einstellungen; also page title |
| Tables icon | [`Design/Tables.svg`](../../Design/Tables.svg) | Side nav → Transaktionen; also page title |
| Analysis icon | [`Design/Analysis.svg`](../../Design/Analysis.svg) | Side nav → Analyse; also page title |
| Edit icon | [`Design/Edit.svg`](../../Design/Edit.svg) | Edit actions: category cards, Konten kalibrieren/anpassen, Transaktionen row action (opens Details overlay) |
| Close icon | [`Design/Close.svg`](../../Design/Close.svg) | Dismiss overlays / expanded editors (top-right): TX details, related detect, account calibration, category card expand |
| Backgrounds | Raster files in [`Design/`](../../Design/) matching `BackgroundImage_*` (JPEG/PNG/WebP) | **Per-tab** full-viewport background (fixed/cover), softly blurred (~6px). Default historically: office photo; user picks separately for Transaktionen / Analyse / Upload / Einstellungen under Einstellungen. |

Served copies live under `public/design/` (and `public/favicon.svg` for the logo). Do not replace these with generic gradients, stock “fintech purple” themes, or Lucide icons for chrome nav. Photos remain atmosphere, not competition for the content panel.

### Per-tab background selection

- **UI:** Einstellungen → **Hintergrundbilder** — one select per tab.
- **Storage:** `localStorage` key `zm-backgrounds-v1` (event `zm-backgrounds-changed` so `App` updates without reload).
- **Options:** query `getBackgroundOptions` lists raster files from `Design/`, sync-copies them into `public/design/`, and returns `/design/…` URLs. **New images dropped into `Design/` appear after reload** (no code change).
- **Apply:** `App` sets `--zm-bg-image` from the preference for the current route.

## Visual direction

**Mood:** calm, personal, desk-at-home — clear enough for money work, soft enough not to feel like a bank terminal.

**Inspired by the background:** natural light, oak/wood warmth, off-white surfaces, muted greens. Primary UI accent is **near-black / warm gray** (CTAs, active chips, focus) — not orange, not purple/indigo.

**Avoid:**

- Purple / indigo “AI SaaS” gradients (except intentional **bank/konto badges** that use purple as a *sonstige*-token)
- Dark-mode-first UI (optional later; v1 stays light-over-photo)
- Dense dashboard chrome (no balance, no wordmark, no full header bar)
- Tab carousels; decorative glow stacks; emoji as UI

## Layout shell

```
┌─ [Logo] ───────────────────────────────────┐  ┌─┐
│                                            │  │☰│  ← sticky side nav
│   frosted content panel (~2rem top pad;    │  │📊│    (vertikal zentriert,
│   rechts Platz für Nav)                    │  │↑│     custom SVGs, no boxes)
│                                            │  │⚙│
└────────────────────────────────────────────┘  └─┘
     background image: cover, fixed, full viewport, soft blur
```

- **No full header bar.** Only a fixed **logo** top-left (icon only, no wordmark).
- **Side nav (right):** sticky, vertically centered; order top→bottom: **Transaktionen → Analyse → Upload → Einstellungen** (custom SVGs `Tables`, `Analysis`, `Upload`, `Settings`) — **no** frosted boxes/backgrounds behind them. German tooltip/`aria-label`. Active = full opacity + slight scale; inactive muted. Import lock still mutes non-Upload icons.
- **No** Kontostand in the **chrome** (logo / side nav). Wealth appears in the Transaktionen & Analyse **summary strip** as **Kontostand** (calibrated roll-forward; scoped to selected bank/konto filters); details/edit still under Einstellungen → Konten.
- **Logo:** fixed; **top** aligns with the frosted content panel top; **horizontally centered** in the left gutter between viewport edge and panel.
- **Content panel:** ~`2rem` top padding; leave right padding so the side nav doesn’t cover the panel. Prefer **one** main panel. Width ~`min(1520px, 96vw)`.
- **Desktop-primary**; on narrow screens keep side nav, stack content as needed.
- Default landing: **Transaktionen**.

## Color & tokens

Define CSS variables (`--zm-*` in `App.css`) and reuse everywhere:

| Token | Intent |
|---|---|
| `--zm-bg-image` | Office JPEG as `background-image` |
| `--zm-surface` | Content panel fill: **solid white** (`#ffffff`) + backdrop blur |
| `--zm-surface-border` | Soft warm gray / wood-tinted hairline |
| `--zm-text` | Near-black for body text on surfaces |
| `--zm-text-muted` | Secondary labels |
| `--zm-accent` | Near-black CTA / active chips / focus (`#1c1917`) — not orange or purple |
| `--zm-income` | Green for positive amounts |
| `--zm-expense` | Red/rose for negative amounts |
| `--zm-conf-manual` | Green |
| `--zm-conf-learned` | Blue |
| `--zm-conf-keyword` | Yellow/amber |
| `--zm-conf-low` | Red |
| `--zm-conf-none` | Gray |

Category colors come from DB (user-editable); charts use those + the income/expense tokens.

### Bank badges (table)

White fill, colored border + text (`.zm-bank-badge`). Color is stored per **Account** (`Account.color`) and editable under Einstellungen → Konten & Kontostand. Empty/unset falls back to these bank defaults (same tokens as before in code: `defaultAccountColor`):

| Bank | Default text + border |
|---|---|
| DKB | `#428eec` |
| PayPal | `#00457c` |
| Sparkasse | `#dc2626` |
| Trade Republic | `#6b21a8` |
| Fallback | `#1f2937` |

### Konto pills (table)

Soft filled pills by Konto-Typ (match name heuristically: Giro / Tagesgeld / PayPal / Sparkasse / …):

| Typ | ≈ Background / Text |
|---|---|
| Girokonto | `#dbeafe` / `#1e40af` |
| Tagesgeld | `#dcfce7` / `#166534` |
| PayPal | `#fef9c3` / `#854d0e` |
| Sparkasse | `#fee2e2` / `#991b1b` |
| Unbekannt | `#f3f4f6` / `#1f2937` |
| sonstige Typen (z. B. Trade Republic) | `#f3e8ff` / `#6b21a8` |

## Typography

- UI language: **German**.
- **Locked fonts:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) for all UI (load via Google Fonts or self-host).
  - Reason: calm, readable, distinct from Inter/Roboto; strong **tabular figures** for EUR amounts (`font-variant-numeric: tabular-nums` on Betrag columns).
  - Do **not** use Inter, Roboto, or Arial as the primary UI font.
- Amounts: `de-DE` EUR, always signed; color by sign (`--zm-income` / `--zm-expense`).
- Hierarchy: page title + one short supporting line max per section; don’t stack competing headlines.

## Components (`zm-*`)

- **v1 lock:** custom `zm-*` CSS design system (tokens in `App.css`). Full Shadcn/Tailwind install deferred — map “Tailwind-like” badge colors above to plain CSS classes.
- Prefer consistent primitives: Button (`.zm-btn`), Dialog (`.zm-overlay`), Table (`.zm-table`), Select/Input, chips, Progress (related spinner).
- **Overlays** (Details, Related, Konto bearbeiten) sit inside the white content panel (`.zm-surface`), which fills the main column height so short pages (e.g. Upload) still have room; panel body scrolls if needed.
- **Overlays** (Details, Related-detect, Balance calibration): modal centered over the **frosted content panel**, **not** the full browser viewport. Dim only that panel; keep logo, side nav, and photo outside the dim.
- **Tables:** hairline rows; sticky header optional; confidence as colored pill + label; **category** with color swatch/dot; **Bank/Konto** as badges/pills (tables above); **Details** as icon button (not a text button).
- **Related link in table:** icon button; target row briefly highlighted after navigation.
- **Forms:** generous hit targets; German labels; validation messages under fields.
- **Empty states:** short German copy + one CTA — no illustration clutter.

## Motion

Ship a few intentional motions (not noise):

1. Side-nav icon: opacity / scale active-state transition
2. Page content: light fade/slide on route change (`.zm-page-enter`)
3. Upload / related-detect: determinate or indeterminate progress that feels calm
4. Collapsible filter toolbar: short expand/collapse (height/opacity)

No continuous parallax on the background; keep the photo still.

## Page-specific design

### Chrome (logo + side nav)

- Logo ~72px, fixed top-left, plain (no frosted disc).
- Side nav: fixed right, vertically centered; **no** surface boxes — bare custom SVGs on the photo.
- Icons top→bottom: `Tables.svg`, `Analysis.svg`, `Upload.svg`, `Settings.svg` (not Lucide). Active = opacity 1 + slight scale.
- Each page **h1** repeats the matching side-nav icon before the German title; icon and text share a **bottom** alignment.
- Edit actions use `Edit.svg` (categories, accounts, transaction row) — not Lucide pencil/panel icons.
- Kontostand **not** in chrome — shown in Transaktionen/Analyse summary strip; edit under Einstellungen → Konten.
- No page intro/lead blurbs under titles (Upload / Analyse / Einstellungen).

### Upload

- Large drop zone inside the content panel; bank selector above or beside.
- Progress bar during import; disable nav icons while locked (visually muted).

### Transaktionen

- Full behavior: [`transactions.md`](transactions.md).
- **Main view = wide data table** — not a two-column page layout.
- Top bar: **Einnahmen / Ausgaben / Netto / Buchungen** left; **CSV · Filter · Zusammengehörige** right (same row).
- **Filter:** collapsible, **default collapsed**; keep summary + table usable when collapsed.
- Table polish:
  - Category cell: name + small color circle (category DB color)
  - Row action: `Edit.svg` icon button (opens Details overlay; German `title`/`aria-label` e.g. Bearbeiten)
  - Bank + Konto: badges/pills per token tables above
- **Details overlay:** desktop two sides (fields | categorize); mobile stack.

### Einstellungen

- **Konten & Kontostand** and **Kategorien** as a **two-column** layout on desktop (stack on mobile). Left column also: **Investitionen** keywords + **Hintergrundbilder** (per-tab selects).
- Account rows: calibrate/adjust via `Edit.svg` icon (not text buttons); color swatch + color picker in the calibration modal (defaults = bank badge tokens). Modal: `Close.svg` top-right dismiss; **Speichern** bottom-right only (no “Später”).
- Category cards: tinted by main color; card pencil expands a **read-only overview** (main row + **2-column** subcategory grid with comma-separated keywords). No subcategory-count badge on the card. Expanded: `Close.svg` top-right collapses (inline saves stay on node edit icons). Delete (`Trash`) on main/sub with reassign modal when txs remain — see [`categorization.md`](categorization.md).
- Second pencil on main/sub row enters **edit mode** for that node only (color, name, keywords add/remove); pencil again = Fertig.
- “Neue Kategorie” is **another card in the category grid**, not a special block above the list.

### Analyse

- Sticky-ish top bar: **Kontostand · Investiert** + period summary left; CSV + collapsible **Filter** right (default collapsed); sections below (see [`analysis.md`](analysis.md)).
- While queries run: visible loading (spinner + German copy). **Any side-nav click** shows a full content-panel spinner until that page reports ready. *(Perf of that wait with many queries is still open — see [`analysis.md`](analysis.md) “Open / known issues”.)*
- When Typ is **Alle**: **three pies side-by-side** (Total · Ausgaben · Einnahmen). When Typ is Ausgaben or Einnahmen, show only that pie (+ matching breakdown); hide Total and the opposite.
- Charts use category DB colors and income/expense tokens; flat legends, no 3D.

## Accessibility & readability

- Contrast of text on `--zm-surface` must meet WCAG AA for body text.
- Never put small body text directly on the raw photo without a surface (side-nav SVG icons on the photo are the chrome exception).
- Focus rings visible (accent token).
- Don’t rely on color alone for confidence or bank — pair badge with readable text.

## Implementation notes

- Nav/chrome SVGs: keep copies under `public/design/`. Background rasters: prefer files in `Design/`; `getBackgroundOptions` syncs them to `public/design/` when Einstellungen (or App prefs refresh) loads options.
- Token values live in `src/App.css`; tweak against the real photos (`--zm-bg-image` overridden per tab from prefs).
- When design decisions change, update this file (and Slice 10 DoD in [`implementation-plan.md`](implementation-plan.md)).
