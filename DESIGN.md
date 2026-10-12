# Tickline — Design System

> Status: **Phase 1 draft, awaiting product-owner approval.** No interface code exists yet.
> Tokens live in [`design/tokens.json`](design/tokens.json) and are contrast-tested by
> [`test/design-tokens.test.ts`](test/design-tokens.test.ts). A rendered specimen of this document
> is in [`design/preview.html`](design/preview.html).

**Skills used for this document:** `frontend-design-direction`, `design-system`,
`make-interfaces-feel-better`, `motion-foundations`, `motion-patterns`, `motion-advanced`,
`frontend-a11y`, `accessibility` (ECC, read from the owner's Drive copy), `theme-factory`,
`dataviz`, and `brand-guidelines` (structure only — see [§3](#3-brand)). `liquid-glass-design` was
reviewed and deliberately not applied — see [§12](#12-deliberately-not-used).

**Current design: v3 "Notebook Tabs" — see [§18](#18-redesign-v3-notebook-tabs-october-2026).**
The default language is Hebrew; see [§19](#19-hebrew-edition-october-2026) for the Hebrew edition and its writing rules.
Where §18 gives a value, it replaces the one in the earlier sections and in §17.

## 0. Skills behind the current design (v3)

All from the ECC skill collection in the owner's Drive (`tasarım skill/ECC-main/skills/`), read in
full before use. One was reviewed and left out on purpose.

| #   | Skill                                  | What it decided in v3                                                                                                                                                                                                       |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `frontend-slides` → `STYLE_PRESETS.md` | The direction: **Notebook Tabs** (cream paper on a warm desk, coloured binder tabs, punched margin) combined with the **Electric Studio** two-panel split for the overview hero. Chosen to differ from v1, v2 and "Signal". |
| 2   | `frontend-design-direction`            | The design contract, the six content states and the finish gate. Its `check-evidence` script is in the repo (`scripts/design/check-evidence.mjs`, `npm run design:evidence`) with the record in `design/evidence/v3/`.      |
| 3   | `design-system`                        | Tokens rebuilt in `design/tokens.json` and the `@theme` block, contrast pairs extended to the tabs and charcoal bands, and its "AI slop" checklist (§18).                                                                   |
| 4   | `gan-style-harness`                    | The four-criterion rubric used to score v2 against v3 from screenshots (§18); threshold 7.0.                                                                                                                                |
| 5   | `make-interfaces-feel-better`          | Press scale 0.96, no `transition: all`, 44 px targets, tabular numbers, balanced heading wraps, concentric radii (sheet 6 → tab 3).                                                                                         |
| 6   | `motion-foundations`                   | Duration tokens 80 / 180 / 350 / 600 ms with one ease-out curve; only `transform` and `opacity` animate; reduced motion removes movement.                                                                                   |
| 7   | `motion-patterns`                      | The hero enters as a stagger at 80 ms steps (title, lead, actions, facts, then the binder sheet at 320 ms) — inside the 50–100 ms rule.                                                                                     |
| 8   | `motion-advanced`                      | The evidence bracket draws in (`scaleY` from the top) when a finding is selected; nothing loops.                                                                                                                            |
| 9   | `accessibility`                        | WCAG 2.2 AA: contrast of every new pair, target size, focus visible on charcoal (butter ring), status never by colour alone — tabs are categorical, never a status.                                                         |
| 10  | `frontend-a11y`                        | Landmarks and skip link kept; punched holes and tab stripes are `aria-hidden`; evidence marks keep their screen-reader text.                                                                                                |
| 11  | `brand-voice`                          | Copy unchanged in tone: direct, figures and mechanisms, no superlatives. OG image facts shortened to fit one line.                                                                                                          |
| 12  | `seo`                                  | Open Graph / Twitter image regenerated in the new look from the product's own figures (rule count, language count); titles, descriptions, JSON-LD unchanged and still tested.                                               |
| 13  | `liquid-glass-design`                  | **Not used.** It is an iOS 26 SwiftUI/UIKit material; a translucent glass layer would also fight the paper-and-ink idea.                                                                                                    |

The Drive's "taste" skills were checked again; they cover music-video direction and do not apply
to an interface.

---

## 1. Design direction

Following `frontend-design-direction`, every choice below traces back to this contract.

|                      |                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**          | Let one person check a shipment's commercial invoice, packing list and purchase order against each other before the goods leave, and see exactly where each problem sits in the paperwork.                                                                                                                                                                      |
| **Audience**         | Operations and accounting staff at small exporters, freight forwarders and customs brokers' back offices. They repeat this workflow weekly or daily, read numbers for a living, and work on office monitors — sometimes a laptop or tablet on the warehouse floor.                                                                                              |
| **First scan**       | "Is anything blocking? What is wrong, in which document, on which page?"                                                                                                                                                                                                                                                                                        |
| **Tone**             | Calm, exact, dependable. Closer to a well-kept ledger than to a marketing site. Dense where data is dense; quiet everywhere else.                                                                                                                                                                                                                               |
| **Memorable detail** | **The evidence ledger** — documents and findings side by side, cross-referenced the way auditors mark working papers: each finding carries a reference tag (`F3`), and the same tag sits in the document margin beside a bracket around the evidence. Selecting either end reveals the other. Everything else stays plain so this one idea carries the product. |
| **Constraints**      | Next.js + Tailwind + shadcn/ui; WCAG 2.2 AA; six interface languages including Arabic (RTL); numbers formatted by `Intl`; no fake data, so every screen must have an honest empty state; PDF export of the report.                                                                                                                                              |
| **Target viewports** | `390x844` (phone), `834x1112` (tablet), `1440x900` (desktop). These are also the Playwright projects.                                                                                                                                                                                                                                                           |

**Reference observations.** No external competitor research was done: `frontend-design-direction`
allows external research only with consent for that service, and `design-system` step 3 assumes a
browser research tool this project does not use. The references are the domain's own artefacts —
the paperwork the users already handle:

- Trade documents are grids of labelled boxes on white paper with thin rules → hairline rules, not
  card shadows, separate content.
- Auditors tick and cross-reference figures in the margin with short codes → reference tags and
  margin brackets for evidence.
- Ledger paper is cool grey-green, not cream → the app background.
- Identifiers (invoice numbers, HS codes, IBANs) are read character by character → monospaced type
  for codes only.

### Content states

Every data surface designs all six states from `frontend-design-direction`. "Partial" is a
first-class state in this product, because extraction and verification can partly fail.

| State      | Trigger                                                                                            | Visible feedback                                                                                                                                           | Safe next action                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Loading    | Upload or extraction in progress                                                                   | Per-document status line with a determinate bar for upload and a step label for extraction ("Reading page 2 of 3"); layout keeps its final structure       | Cancel the extraction; keep working on other documents                  |
| Empty      | No checks yet / no documents in a check                                                            | One line explaining what is missing, the accepted file types and limits                                                                                    | "New check" / "Add documents"                                           |
| Error      | File rejected (type, size, pages), extraction failed or invalid model output                       | Specific reason in plain words, tied to the file                                                                                                           | Replace the file or retry; the rest of the check is kept                |
| Partial    | Some fields not found, evidence position not locatable on the page, an external source unreachable | The available data is shown; missing parts are marked "Not found" or "Could not be verified" — never filled with a guess                                   | Correct the field by hand, or continue with the gap shown in the report |
| Success    | Checks completed                                                                                   | Summary of what was checked and what was found; "no findings" is phrased as "No issues found by the checks listed below", never "compliant" or "all clear" | Export the report; review the list of checks that ran                   |
| Permission | `ANTHROPIC_API_KEY` is not configured (no user accounts exist in the MVP)                          | Extraction controls are disabled with an explanation for the operator                                                                                      | Link to the setup section of the README                                 |

---

## 2. First pass, slop check, and what changed

`design-system` mode 3 ("AI slop detection") and the anti-patterns in `frontend-design-direction`
were run against my first pass. That first pass was the default a component kit produces when
nobody decides anything. The revisions:

| First pass                                                                             | Problem found                                                                                                                                              | Revision                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inter for everything, near-white `#F7F8FA` page, `#2563EB` blue primary                | The stock component-kit look; "sans-serif font stack with no personality". Inter has no Arabic, so the RTL interface would fall back to an unrelated face. | IBM Plex Sans + IBM Plex Sans Arabic (designed as one family) + IBM Plex Mono for codes. A cool ledger-grey page and a deep petrol **Harbor** accent.                   |
| Blue primary colour **and** blue "info" status                                         | The same hue meant both "click here" and "for your information", so status colour lost meaning.                                                            | Action/linkage is petrol (Harbor, hue 214°); info is a separate blue (hue 260°) and always carries an icon and a label.                                                 |
| Yellow highlighter for evidence in the document                                        | Collided with the amber warning colour: a highlighted error looked like a warning.                                                                         | Evidence uses Harbor (the linkage colour) as a 14 % wash plus a margin bracket and tag. The finding's severity is shown by the tag's icon, not by the highlight colour. |
| A row of four rounded KPI cards above everything (documents, findings, errors, tokens) | "Everything split into identical rounded cards"; a dashboard hero pushing the actual work below the fold.                                                  | A single summary strip of counts with icons and labels, separated by rules, followed directly by the evidence ledger. Token usage moves to the check's metadata line.   |
| `rounded-xl` and soft shadows on every container, findings as cards inside a panel     | Cards inside cards; rounded corners on tables and documents, which are rectangular in real life.                                                           | Radius scale 0/2/4/6. Tables and the document pane are square. Shadows only on floating layers (menus, dialogs, toasts). Findings are rows in a ledger, not cards.      |
| Upload page with a centred headline, large illustration and gradient                   | A generic hero over a stock gradient; marketing on a tool page.                                                                                            | The upload page _is_ the tool: a start-aligned title, a plain drop area listing the real limits, and the document list beneath it. No illustrations, no gradients.      |
| Uppercase eyebrow labels over section headings, fade-in on every section               | Both are explicitly forbidden patterns in the brief and add noise.                                                                                         | Sentence-case headings only; no load-time or scroll animation. Motion responds only to user actions ([§9](#9-motion)).                                                  |
| Pill-shaped coloured badges for severity                                               | Colour-only meaning; pills read as decorative.                                                                                                             | Square-cornered tags with a shape-distinct icon and a text label for every status.                                                                                      |

### Rendered self-review of the specimen

`design/preview.html` was rendered with Playwright at 390, 834 and 1440 px, in LTR and RTL, and
inspected. The first render failed its own rules in four places, now fixed in both the specimen and
this document:

| Seen in the render                                                                                                        | Fix                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| In RTL, hex codes rendered as `0E5E6D#`                                                                                   | Identifiers are wrapped in `<bdi dir="ltr">` — the bidi rule in [§11](#11-right-to-left-and-internationalization) applies to the specimen too |
| The margin bracket was a 20 px corner hidden under the `F1` tag — the signature element was the weakest thing on the page | The evidence row became a logical grid: excerpt · bracket · margin tag; the bracket spans the whole excerpt and mirrors in RTL                |
| On phones, `R-ARITH-01` broke at the hyphen                                                                               | Codes never wrap internally ([§5](#5-typography))                                                                                             |
| On phones, the top bar wrapped "New check" onto two lines                                                                 | Below 640 px the navigation collapses into a "Menu" button ([§7](#7-layout))                                                                  |

---

## 3. Brand

The section structure (core colours, accent colours, type roles with fallbacks, application rules)
follows `brand-guidelines`. **None of that skill's values are used** — it ships Anthropic's own
palette and typefaces (a cream background, a serif body face and earth-toned accents), which is both
a different brand and exactly the pattern the brief rules out.

- **Name:** Tickline — one word, capital T only. Never "TickLine", "Tick Line" or all caps. The
  name is the auditor's tick beside a line of figures, which is also what the mark draws. Renamed
  from "TradeCheck" in October 2026 because that name is used by a Dutch company-verification
  service in an adjacent market (see [docs/analysis-gettradecheck.md](docs/analysis-gettradecheck.md)).
- **Wordmark:** "Tickline" set in IBM Plex Sans SemiBold, Carbon on light surfaces, one colour;
  no highlighted syllable.
- **Mark (concept, drawn in Phase 2 with `canvas-design`):** two short horizontal rules — two
  documents — crossed by a single tick: "cross-checked". Harbor tick, Slate rules. Must stay legible
  at 16 px (favicon).
- **Voice:** plain, specific, polite. State what was checked and what was found. No exclamation
  marks, no emoji, no "magic", no promises of compliance. Every screen that shows results carries
  the notice "For information only — not official customs or legal advice."

---

## 4. Colour

Light theme only in the MVP. All colours are semantic tokens, so a dark theme later is a token
set, not a redesign. A half-finished dark mode would be worse than none.

### 4.1 Named colours

| Name       | Hex       | Role                                                                                               | Contrast                                              |
| ---------- | --------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Ledger** | `#F2F4F3` | App background — cool ledger-paper grey (not cream)                                                | —                                                     |
| **Paper**  | `#FFFFFF` | Surfaces: document pane, tables, dialogs                                                           | —                                                     |
| **Carbon** | `#17212B` | Primary text and icons, blue-black ink                                                             | 16.29 on Paper · 14.75 on Ledger                      |
| **Slate**  | `#55616C` | Secondary text, metadata, placeholders                                                             | 6.34 on Paper · 5.74 on Ledger                        |
| **Rule**   | `#D5DCE0` | Hairlines between regions, rows and table cells (decorative, never the only boundary of a control) | —                                                     |
| **Harbor** | `#0E5E6D` | Action and linkage: primary buttons, links, focus ring, selection, evidence marks                  | 7.39 on Paper · 6.69 on Ledger · white on Harbor 7.39 |

Derived tokens: `harbor-strong #0A4955` (hover/pressed, white text 10.01), `harbor-tint #E2EEF0`
(selected row; Carbon 13.75, Harbor 6.24), `evidence-wash #DDE8EB` (Carbon 13.05, Slate 5.08),
`control-border #78838D` (input borders, 3.87 on Paper, 3.50 on Ledger — meets WCAG 1.4.11).

There is no separate "muted" text colour: a lighter grey failed 4.5:1 on Ledger (4.45), so
secondary text uses Slate everywhere.

### 4.2 Status colours

Status is never colour alone: every status has a **shape-distinct icon** (readable in greyscale and
print) and a **text label**. Icons are from Lucide, the shadcn/ui default.

| Status         | Meaning in Tickline                                                                       | Icon             | Text `fg` | Tint `bg` | Chart `mark` | Contrast (fg on Paper / on tint) |
| -------------- | ----------------------------------------------------------------------------------------- | ---------------- | --------- | --------- | ------------ | -------------------------------- |
| **Error**      | A check failed: the documents contradict each other or a value is invalid                 | `octagon-alert`  | `#B42318` | `#FDECEA` | `#C9372C`    | 6.57 / 5.75                      |
| **Warning**    | Needs review: likely problem, tolerance exceeded, low-confidence field                    | `triangle-alert` | `#8A4A00` | `#FFF3DB` | `#B86E00`    | 6.86 / 6.24                      |
| **Info**       | Worth knowing, not a problem (e.g. "HS code format valid — expert confirmation required") | `info`           | `#2A5BA8` | `#E9F0FB` | `#3A6CC0`    | 6.64 / 5.80                      |
| **Success**    | A check ran and passed                                                                    | `circle-check`   | `#1D6B36` | `#E6F4EA` | `#2B8446`    | 6.54 / 5.76                      |
| **Unverified** | Could not be checked (source unreachable, field missing) — shown, never guessed           | `circle-help`    | `#55616C` | `#EEF1F3` | `#7D8891`    | 6.34 / 5.59                      |

Unverified also uses a **dashed** border so it cannot be mistaken for info. Status borders
(`border` in the tokens) are decorative; the icon and label carry the meaning.

### 4.3 Field and content markers

| Marker               | Applies to                                            | Treatment                                                                                                                       |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Low confidence**   | Extracted field below the confidence threshold        | Warning tint behind the value, `gauge` icon, label "Low confidence — please verify". Prominent by design.                       |
| **Corrected by you** | Field edited by the user                              | Neutral tag with `pen-line` icon; the original extracted value stays available in the field's history.                          |
| **AI-generated**     | Plain-language explanations, correction e-mail drafts | Bordered block with a `bot` icon and the label "AI-generated explanation" / "AI-generated draft". Never styled like evidence.   |
| **Evidence**         | Verbatim text from a document                         | Harbor wash + margin bracket + finding tag in the document; in the findings list, a quoted excerpt with document name and page. |

### 4.4 Data visualization

Following `dataviz`: form first, colour last, palette validated by its script (results below).

- **Findings by severity** → not a chart. A summary strip of counts, each with its status icon and
  label.
- **Findings by rule category** (arithmetic, cross-document, format, completeness) → horizontal
  bars, one series, all bars in `series1 #007FA0`, direct value labels, and a table view.
- **Tokens used** → a figure in the check's metadata line, not a chart.
- No pies, donuts, gauges or dual axes.

`series1` is a chart-only step of Harbor: Harbor itself (`#0E5E6D`, chroma 0.074) failed the
validator's chroma floor, as did several nearby teals. `#007FA0` passes every check (L 0.554,
C 0.104, 4.62:1 on Paper). For possible multi-series charts later, the categorical order is
`#007FA0` followed by the validated reference slots 2–8 (`dataviz` reference palette): adjacent CVD
ΔE ≥ 9.1, normal-vision ΔE ≥ 19.6, all PASS. Slots 3, 4 and 5 sit below 3:1 on white, so any chart
using them must show direct labels or a table view. Status colours in charts always use the status
`mark` steps and never stand in for a series.

---

## 5. Typography

| Role               | Family                                                                     | Use                                                                                             |
| ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Interface and body | **IBM Plex Sans** (latin + latin-ext for Turkish, German, Spanish, French) | Everything by default                                                                           |
| Arabic             | **IBM Plex Sans Arabic**                                                   | Arabic interface text; same proportions as Plex Sans, so mixed Latin and Arabic lines stay even |
| Codes              | **IBM Plex Mono**                                                          | HS codes, IBANs, invoice/order numbers, ISO codes, rule IDs, finding tags                       |

Fallbacks: `system-ui, "Segoe UI", "Noto Sans", sans-serif`. Evidence excerpts in scripts that
Plex does not cover (for example Chinese or Japanese documents) fall back to the system font for that
script; that is expected and correct.

| Token      | Size / line | Weight | Used for                                                                      |
| ---------- | ----------- | ------ | ----------------------------------------------------------------------------- |
| `caption`  | 12 / 16     | 400    | Tags, chart labels, footnotes                                                 |
| `small`    | 13 / 18     | 400    | Table cells, metadata                                                         |
| `body`     | 14 / 20     | 400    | Default interface text                                                        |
| `reading`  | 16 / 24     | 400    | AI explanations, e-mail drafts, longer help text (max 72 characters per line) |
| `title-sm` | 15 / 20     | 600    | Panel and table titles                                                        |
| `title`    | 18 / 24     | 600    | Section headings                                                              |
| `heading`  | 22 / 28     | 600    | Screen headings                                                               |
| `page`     | 28 / 34     | 600    | One per page, the page title                                                  |

Rules:

- Three weights only (400, 500 for labels and buttons, 600 for headings). No italics anywhere
  (Arabic has none, and emphasis by weight works in every script).
- Sentence case. No uppercase transforms, no letter-spacing on text, no eyebrow labels above headings.
- All figures that can change or must align use `font-variant-numeric: tabular-nums`: amounts,
  quantities, weights, counts, token figures.
- `text-wrap: balance` on headings, `text-wrap: pretty` on short paragraphs and table notes; neither on
  evidence excerpts or codes.
- Codes (HS codes, IBANs, references, rule IDs, finding tags) never wrap internally
  (`white-space: nowrap`); a list of codes may wrap between codes.
- Arabic: line height +2 px on `body` and `reading`; never letter-spaced.

---

## 6. Space, size, radius, elevation

**Spacing** (4 px base): `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Inside components 4–12, between
related groups 16–24, between page regions 32–48.

**Control sizes:** 28 px (compact, inside table rows), 36 px (default), 44 px (primary actions on
touch screens). Table rows are 40 px.

**Hit areas:** at least 24 × 24 px everywhere (WCAG 2.5.8); icon buttons get a 40 × 40 px hit area
with a fine pointer and 44 × 44 px with a coarse pointer, extended with padding or a pseudo-element
without overlapping neighbours.

**Radius:** `0` tables, document pane, page regions · `2 px` tags · `4 px` buttons, inputs, menus
· `6 px` dialogs and toasts. Nested rounded surfaces follow _outer = inner + padding_
(`make-interfaces-feel-better`); when padding is large, the outer surface goes square instead.

**Borders and shadows:** hairline Rule borders separate content. A single shadow token exists, for
floating layers only (menus, popovers, dialogs, toasts): `0 1px 2px rgba(23,33,43,.06), 0 8px 24px
rgba(23,33,43,.12)`. Nothing that sits in the page flow has a shadow.

---

## 7. Layout

- **App shell:** a 48 px top bar (wordmark, "Checks", "New check", language switcher) on Paper with
  a bottom Rule; the page below on Ledger. Below 640 px the navigation and language switcher move
  into a "Menu" button. A footer line carries the information-only notice.
- **Grid:** content max width 1440 px; inline page padding 16 / 24 / 32 px at phone / tablet /
  desktop, never less than the device's safe-area inset.
- **Touch:** on coarse pointers controls are at least 44 px tall (small buttons extend their hit
  area with an invisible overlay) and form text is 16 px. Grid tracks are `minmax(0, 1fr)` so long
  unbroken text cannot widen a phone layout.
- **Phones:** tables become card lists; dialogs dock to the bottom as sheets; the evidence sheet
  has zoom steps 100 / 150 / 200 / 300 % and scrolls sideways; check pages get jump links and
  fold the category and document filters behind "More filters".
- **Evidence ledger (check detail):**
  - **≥ 1024 px:** two panes. The document pane on the _start_ side (7 fr), findings on the
    _end_ side (5 fr), both scrolling independently under a sticky check header (document set,
    status counts, model and token usage).
  - **768–1023 px:** one pane at a time with a two-tab switch "Findings | Documents". Selection
    persists across the switch.
  - **< 768 px:** findings list first. Selecting a finding opens the document as a full-screen sheet,
    scrolled to the evidence, with the finding pinned at the top of the sheet.
- **Upload:** a single column — page title, drop area, then the document list with its detected
  type (editable) and a remove action per file.
- No sidebar in the MVP; there are only two levels (check list, check detail).

---

## 8. Component rules

**Buttons.** Primary: Harbor fill, white text, one per view region. Secondary: Paper fill,
control-border outline, Carbon text. Ghost: text only, for tertiary actions in toolbars.
Destructive: error text and outline; the confirming button in its dialog is the only solid error
button. Labels are verbs ("Export report", "Delete check"). Loading keeps the button's width and
replaces the label with a status text.

**Inputs and selects.** 36 px; `control-border` outline; Paper fill; visible label above (never a
placeholder used as a label); errors below the field, linked with `aria-describedby`. The focus ring
replaces nothing — it is added on top (see [§10](#10-accessibility)).

**Tables.** Square, Rule hairlines, sticky header, no zebra stripes. Numeric columns align to the
_end_ and use tabular figures. Sortable headers expose `aria-sort`. Row hover is a faint Ledger
tint; the selected row is `harbor-tint` with a 3 px Harbor bar on the inline-start edge.

**Finding entry (a ledger row, not a card).** Reference tag (`F3`, Plex Mono, square 2 px
corners) · status icon + label · message (from a translation key with parameters) · involved
documents and fields · evidence excerpt(s) with document and page · actions: "Show in document",
"Explain in plain language" (AI), "Draft correction e-mail" (AI). Ordered by severity, then by
document order.

**Evidence mark (in the document pane).** When the evidence text can be located on the rendered
page: a Harbor wash over the text, a 2 px Harbor bracket in the page margin, and the finding tag with
its status icon beside the bracket. When it cannot be located (scans without a text layer): a
page-level margin note with the tag and the verbatim excerpt, labelled "Exact position not
available". Several findings on one line stack their tags.

**Extracted field row.** Label · original value (as printed, in the document's script) · normalized
value (secondary line, Slate) · confidence · source (page and excerpt) · edit. Low-confidence and
corrected markers per [§4.3](#43-field-and-content-markers).

**Tags and chips.** 20 px high, 2 px radius, icon 14 px + `caption` text. Status tags use the status
tint and fg; neutral tags use Paper with a Rule border.

**Empty states.** Start-aligned within the content column: a 20 px Lucide icon in Slate, one sentence
saying what is missing and why, and one action. No illustrations, no large centred headlines.

**Notices.** The information-only notice appears in the footer of every page, in the check header
when results are shown, and in the exported PDF. It is plain Slate text, not a dismissible banner.

**Dialogs and sheets.** Max width 560 px, 6 px radius, overlay shadow, scrim `rgba(23,33,43,.48)`.
Focus is trapped and returned to the trigger on close; Escape closes.

**Toasts.** Bottom inline-end. Only for confirmations of actions the user just took ("Report
exported"); errors that need action stay inline next to their cause.

**Progress.** Upload: determinate bar per file. Extraction: a step label per document plus an
indeterminate bar that pauses when the tab is hidden and becomes static text under reduced motion.

**Token usage.** Shown per check in the header metadata line ("Model · 12,345 input · 2,345
output tokens", numbers via `Intl.NumberFormat`) and per analysis in the check's history.

**Icons.** Lucide, 16 px in the interface, 1.75 px stroke, Carbon or the relevant status fg.
Directional icons (arrows, chevrons) mirror in RTL; check marks, status icons and the document
icon do not.

---

## 9. Motion

From `motion-foundations`, `motion-patterns`, `motion-advanced` and `make-interfaces-feel-better`,
narrowed by the brief: **motion only answers a user action**, and must help with orientation or
state.

**Tokens** (single source in `tokens.json`, no inline numbers): durations `instant 80 ms`,
`fast 140 ms`, `normal 200 ms`, `slow 280 ms`; easings `out cubic-bezier(.22,1,.36,1)` for
entering, `in cubic-bezier(.4,0,1,1)` for leaving, `standard cubic-bezier(.4,0,.2,1)` for state
changes. Shorter than the skills' sample values on purpose: this is a tool used all day, so motion
should never make anyone wait.

| Allowed (always triggered by the user)         | Motion                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Hover, press, selection colour changes         | Colour/background transitions, `fast`, `standard`                                                                            |
| Press on buttons                               | `scale(.98)`, `instant`; none on table-row actions                                                                           |
| Menus and popovers                             | Opacity + 4 px translate, `fast` in, `instant` out                                                                           |
| Dialogs and sheets                             | Enter: opacity + scale .98 → 1, `normal`; exit: opacity, `fast`                                                              |
| Toasts                                         | Enter from the inline-end edge, `normal`; exit `fast`                                                                        |
| **Selecting a finding** (the signature moment) | Document pane scrolls to the evidence; the margin bracket draws in (`scaleY` 0 → 1, `normal`) and the wash fades in (`fast`) |
| Drag over the drop area                        | Border and background change, `fast`                                                                                         |
| Upload progress                                | `scaleX` on the bar, `normal`                                                                                                |

**Never:** fade-in on page load, scroll-triggered reveals, staggered list entrances, animated
number counters (a figure in a financial tool must never be shown wrong, even for a frame), parallax,
looping decorative animation, shimmer skeletons (skeletons are static), animating `width`, `height`,
`top`, `left`, `margin` or `padding`, and `transition: all`.

**Reduced motion** (`prefers-reduced-motion: reduce`): all transforms off; opacity transitions
capped at 120 ms; scrolling jumps instead of animating; the indeterminate bar is replaced by static
text. Nothing is removed in a way that shifts layout.

**Implementation.** CSS transitions and Radix `data-state` keyframes driven by CSS custom
properties from the tokens. `make-interfaces-feel-better` favours CSS for interruptible state
changes, and `frontend-design-direction` asks not to add a dependency for a flourish. `motion/react`
(never `framer-motion`) is added only if a presence animation cannot be done in CSS — for example
exit animations of removed list items — and then follows `motion-foundations`' rules: shared
tokens, `useReducedMotion`, SSR-safe initial state, `"use client"`.

---

## 10. Accessibility

Target: **WCAG 2.2 AA** (`accessibility`, `frontend-a11y`).

- **Contrast:** every text/background pair in the tokens is tested in CI (31 pairs, all pass; lowest
  text pair 5.08:1). Non-text UI boundaries ≥ 3:1.
- **Colour is never the only signal:** status = icon + label + colour; selection = bar + tint;
  evidence = bracket + tag + wash.
- **Focus:** a 2 px Harbor ring with 2 px offset on every interactive element (≥ 3:1 against
  Paper and Ledger); never removed; not obscured by sticky headers (WCAG 2.4.11).
- **Keyboard:** everything reachable in a logical order. The findings list is the keyboard path into
  the document: Enter on a finding moves focus to its evidence mark; a "Back to finding" control
  returns. Dialogs trap focus and close on Escape.
- **Semantics:** landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, sequential
  headings, native elements before ARIA, a skip link.
- **Forms:** visible labels connected with `htmlFor`/`id`; required fields marked in text; errors
  linked with `aria-describedby` and `aria-invalid`, worded with a fix.
- **Live regions:** extraction progress `polite`; a failure that stops the check `assertive`, used
  sparingly.
- **Targets:** ≥ 24 × 24 px always, 44 × 44 px for touch (see [§6](#6-space-size-radius-elevation)).
- **Reflow:** usable at 320 px width and 400 % zoom without horizontal scrolling, except inside
  data tables and the document page, which scroll in their own region.
- **Testing:** axe in Playwright for every page in every language, including Arabic RTL.

---

## 11. Right-to-left and internationalization

- `lang` and `dir` are set on `<html>` from the route locale; Arabic is `dir="rtl"`.
- **Logical properties only:** `margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
  `text-align: start`, and Tailwind's `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`. Physical
  `left`/`right` utilities are not used; a lint rule will enforce this in Phase 2.
- The evidence ledger mirrors: the document pane is on the start side (the right in Arabic), the
  selection bar on the inline-start edge, margin brackets on the inline-end edge of the page text.
- **Bidirectional text:** document values (invoice numbers, IBANs, HS codes, amounts, dates as
  printed) are isolated with `<bdi>` or `dir="ltr"` + `unicode-bidi: isolate`; evidence excerpts get
  `dir="auto"` so they follow the document's own script, independent of the interface language.
- **Numbers, dates, currency, units:** always `Intl` (`NumberFormat`, `DateTimeFormat`, unit
  formatting). Proposed default for Arabic: Latin digits (`ar-u-nu-latn`), because trade documents and
  identifiers print Latin digits and the evidence must look like the paper. Native-speaker reviewers
  can switch this per locale.
- **Text expansion:** German and French run 20–35 % longer than English. Buttons and tags must wrap
  or grow — no fixed widths on text, no truncation of status labels.
- Charts in RTL: category bars start at the inline-start edge; numerals stay left-to-right.

---

## 12. Deliberately not used

- **`liquid-glass-design`:** the skill is an iOS 26 / SwiftUI, UIKit and WidgetKit system, not a web
  one, and this direction (paper, rules, density) does not call for translucent material. The brief
  allows it only if the direction needs it; it does not. No glass anywhere.
- Gradients, glassmorphism, decorative blobs, stock or AI imagery, illustrations in empty states.
- Dark mode in the MVP (see [§4](#4-colour)).
- Customer logos, testimonials or usage statistics — there are none, and the brief forbids
  inventing them.

## 13. Open items for later phases

All closed:

- Phase 2: tokens became CSS custom properties and the Tailwind theme; a test forbids physical
  left/right utilities; the mark was drawn with `canvas-design` ("Reconciled Lines").
- Phase 3: the low-confidence threshold is a validation setting (`LOW_CONFIDENCE_THRESHOLD`, 0.7).
- Phase 5: the report is an HTML page printed by the browser ("Save as PDF"), so Arabic is shaped
  correctly; status icons and labels survive greyscale, and status tints print exactly.
- Phase 6: the rendered finish gate ran — see §14.

## 14. Phase 6 review

**Rendered finish gate.** `e2e/screenshots.spec.ts` captures the check, the evidence view, the report
and the loading, empty, error and permission states at 390 × 844, 834 × 1112 and 1440 × 900, in
English and Arabic, from synthetic labelled fixtures. The evidence record (33 artifacts, every
content state, accessibility and responsive observations) passes `check-evidence.js` from
`frontend-design-direction`. axe reports no WCAG 2.2 AA violations on any page, in all six
languages, at all three widths.

**Polish pass** (`make-interfaces-feel-better`), changes only:

| Principle        | Before                                                                                 | After                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Hit areas        | Small buttons 28 px; evidence tags 20 px, stacked 22 px apart (axe `target-size` fail) | Small buttons keep 28 px visually with a 36 px hit area (`::after`); one 24 px tag per finding, stacked at 26 px |
| Enter and exit   | Dialogs and sheets appeared with a fade but vanished instantly                         | Exit fades out at `fast` with the `in` easing; AI blocks and the chart tooltip fade in on request                |
| Layout stability | The page frame collapsed while a PDF loaded, then jumped                               | An A4-shaped frame is reserved until the page is drawn                                                           |
| Numbers          | Amounts lost their decimals in messages ("10 × 9 = 90")                                | Amounts keep at least two decimals ("10 × 9.00 = 90.00")                                                         |
| Text density     | One excerpt quoted three times for three fields                                        | One quote per excerpt: "Line 1 · Quantity, Unit price, Line total"                                               |
| Naming           | Tablet tab "Documents" next to the "Documents" file section                            | Tab renamed "Document view"                                                                                      |
| RTL              | Arabic dates forced left-to-right displayed as "012026/03/"                            | Dates keep the language's own direction; codes and numbers stay left-to-right                                    |
| Browser support  | PDF.js modern build needed `Map.prototype.getOrInsertComputed`; pages failed to render | PDF.js legacy build with polyfills                                                                               |

## 15. Overview page

The public overview at `/<language>` (the check list moved to `/<language>/checks`).

**Skills used** (owner's Drive copy): `marketing-campaign` for positioning, section order and
its quality gate; `seo` for titles, descriptions, headings, structured data, robots, sitemap and
hreflang; `brand-voice` for the voice rules below; `frontend-design-direction` and
`make-interfaces-feel-better` as for the rest of the product. This time the owner asked for
research, so external sources were consulted — only for the figures quoted on the page.

**Positioning** (`marketing-campaign`, phase 2): _Tickline helps the people who prepare export
paperwork catch contradictions between the invoice, packing list and purchase order before the
goods leave, by reading each document and running deterministic cross-checks that point to the
page and line._ The angle is the moment before shipment, when a mismatch is still cheap to fix.

**Research → page.** Broker and forwarder guides agree that invoice errors and invoice/packing
list mismatches are among the most common causes of customs holds; that informs the list of
typical mismatches. Only two figures are quoted, each with its source linked beside it: the ICC
Banking Commission's estimate that 65–80 % of documents presented under letters of credit are
refused on first presentation (Technical Advisory Briefing No. 3, 27 June 2022) and UCP 600
article 14 (d) ("data … must not conflict"). The page says plainly that Tickline does not
examine letters of credit. No logos, testimonials, user counts or invented metrics: there are
none, and the brief forbids fake data.

**Section order:** hero → problem (with sources) → how a check works (in the order the user does
it) → what every check covers → evidence → what Tickline will not do → AI and privacy →
audience and languages → questions → final call to action. Product figures (rule count, upload
limits, retention, languages) are read from the engine, the server configuration and the message
files, so the page cannot promise something the product does not do.

**Visual direction.** No stock illustration, gradient or animated hero. The visual is the
product's signature element working: a miniature evidence ledger with two synthetic documents
whose compared rows line up, and findings that mark their evidence in both when selected (the
bracket draws in at `normal`, as in the viewer — motion only in response to the user). Display
sizes exist only here: `display` 44/50 and `display-sm` 32/38 for the one h1, `lead` 18/28 for
its paragraph. Bands alternate Paper and Ledger and are separated by hairline rules, like the
rest of the product.

**Voice** (`brand-voice`, `marketing-campaign` hard bans): plain, specific, no superlatives, no
"game-changing", no fake urgency, no exclamation marks; every claim is either a product fact or
sourced. Calls to action name the action ("Start a check", "View your checks"), never "Learn
more". The product's limits get their own section ("What Tickline will not do").

**SEO** (`seo`): one h1; h2/h3 follow the content; a 50–70 character title and a 120–160
character description per language; `SoftwareApplication` and `FAQPage` JSON-LD that mirror the
visible text; a 1200 × 630 social preview drawn from the same example (`npm run og:image`);
`robots.txt` disallows `/api/` and every check, check pages are `noindex`; with `SITE_URL` set,
canonical and hreflang links (`x-default` → English) and a sitemap of the overview page.

**First render, slop check, and what changed:**

| Seen in the render                                                                   | Fix                                                               |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| The invoice's extra Incoterms® row pushed its rows out of line with the packing list | Both documents list the compared fields first, in the same order  |
| Faint brackets on every row that has evidence read as stray lines                    | Bracket and tag only on the selected finding's evidence           |
| In Arabic, "65–80 %" displayed as "% 80–65"; "Incoterms®" labels lost the ®'s place  | The figure and the field labels are isolated (`<bdi>`)            |
| axe `definition-list`: the margin marks sat directly inside the `<dl>` rows          | The marks moved into the `<dd>`, still positioned against the row |
| A side column spanning two grid rows stretched the gap under each section heading    | Headings sit above a separate two-column grid                     |

## 16. Party identifiers

Added after reviewing gettradecheck.com, a Dutch counterparty-verification service (see
[docs/analysis-gettradecheck.md](docs/analysis-gettradecheck.md)). The seller's and buyer's VAT
and EORI numbers are extracted, checked for their sourced structure and compared across
documents. Below the checks that ran, a "Party identifiers" list shows each distinct number,
the documents that print it and a link to the official service that can confirm it (VIES, the
Commission's EORI validation), with the plain statement that Tickline checks format and
consistency only. Numbers are set in Plex Mono and kept left-to-right in every language; links
open in a new tab and say so to screen readers. No score, badge or "verified" state is shown,
because Tickline does not verify registration.

## 17. Redesign: "Deep water and signal" (October 2026)

The owner found the ledger look too plain and asked for a thorough, modern redesign. This
section supersedes the earlier values for colour (§4.1), type (§5), radius and elevation (§6);
everything about accessibility, status colours, RTL and evidence still applies.

**Skills.** The ECC skills on the owner's Drive were reviewed again; the "taste" family turned
out to cover music-video direction, not interfaces. Anthropic's `frontend-design` skill
(claude-plugins-official) was used instead: decide a direction from the subject, check it against
the common tells of generated design, spend boldness in one place, verify with screenshots.

**Direction, from the subject.** Export paperwork lives in ports: deep water, navy hulls,
stencilled marks on containers, harbour charts, and copies of the same document stacked on a
desk. So:

| Token         | Value     | Use                                                                   |
| ------------- | --------- | --------------------------------------------------------------------- |
| Fog           | `#EEF2F6` | App background                                                        |
| Paper         | `#FFFFFF` | Surfaces                                                              |
| Deep water    | `#0E2A47` | Text ink, and the overview's hero and call-to-action bands            |
| Teal          | `#0F766E` | Action and linkage (buttons, links, focus, evidence) — unchanged role |
| Glow          | `#5EEAD4` | Icons, links and focus ring on deep water; one glow behind the hero   |
| Signal orange | `#FF7A1A` | Reserved for decorative marks on deep water; never text, never status |

- **Type:** Archivo (variable width) for the interface — headings at 112 % width, like
  stencilled container marks; body at normal width. Geist Mono for codes only. IBM Plex Sans
  Arabic for Arabic, never stretched or letter-spaced.
- **Depth:** one radius per level (tags 4, controls 8, menus 12, panels 14, sheets 20) and
  navy-tinted elevation levels (`xs`, `card`, `raised`, `overlay`) instead of one grey shadow.
- **The one bold element:** the overview hero on deep water, with a faint harbour-chart grid and
  the interactive example drawn as a stack of carbon copies that fan out once on load (reduced
  motion respected). Everything else stays quiet.
- **App screens:** a frosted sticky header with pill navigation, raised panels, a segmented
  tab control, larger numbers in the summary strip, a softer drop area.

**Tells checked and avoided** (from `frontend-design`): no cream-and-serif, no acid accent on
near-black (the dark band is navy from the subject, with teal as the action colour), no single
radius and shadow on everything, no all-caps eyebrow labels, no "→" on buttons, no accented word
in headlines. Numbered markers appear only where the content is a sequence (how a check works).
The rule list became one ruled "manifest" sheet instead of four identical cards.

**Verified:** contrast pairs in `design/tokens.json` (now including the deep-water pairs), axe
WCAG 2.2 AA on every page in six languages, the phone sweep at 320 and 390 px, and screenshots
at 390 and 1440 px in English and Arabic.

## 18. Redesign v3: "Notebook Tabs" (October 2026)

The owner asked for a new, clearly different design built from the Drive design skills (§0). It
supersedes §17's colour, type, radius, elevation and hero; status colours, accessibility, RTL and
the evidence model are unchanged.

**Idea.** A shipment file is a binder: the invoice, the packing list and the order are sheets with
coloured tabs, punched along the margin, lying on a desk. Checking them is reading the sheets
side by side and marking what disagrees. The interface uses that literally in one place (the
overview's binder sheet) and quietly everywhere else (tab colours on the documents).

| Token        | Value                                                                          | Use                                                                        |
| ------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Desk         | `#ECE8E0`                                                                      | App background (`ledger`)                                                  |
| Paper        | `#FFFDF8`                                                                      | Surfaces and sheets                                                        |
| Charcoal ink | `#23252B`                                                                      | Text, and the hero and call-to-action panels (`deep`)                      |
| Slate        | `#5A5D66`                                                                      | Secondary text, mark rules                                                 |
| Rule         | `#DDD6C8`                                                                      | Hairlines between rows                                                     |
| Cobalt       | `#2B45C4`                                                                      | Action and linkage: buttons, links, focus, evidence brackets, chart series |
| Butter       | `#F6E3A1`                                                                      | Figures, focus ring and links on charcoal; the invoice tab                 |
| Tabs         | `#F6E3A1` invoice · `#BFE3CF` packing list · `#D6CCF2` order · `#F3C9C9` other | Document type, always with the type's name                                 |

- **Type:** Bodoni Moda (variable, optical size) for `h1` and section headings only — the serif
  sits where the binder has its printed titles. DM Sans for the interface, DM Mono for codes and
  values. Arabic headings stay in IBM Plex Sans Arabic with no letter-spacing. Bodoni was tried
  at body sizes and rejected: its hairlines break up below ~24 px.
- **Shape:** paper corners — 3 px tags, 6 px sheets and panels, 10 px menus, 12 px dialogs. Warm
  paper shadows (brown-tinted, short) instead of v2's navy elevation.
- **Overview hero:** a two-panel split. Left: charcoal with faint ruled lines like a notebook
  page, the headline, lead, actions and figures. Right: the desk with the binder sheet —
  punched margin, yellow and mint tabs on the two documents, and the interactive evidence.
- **App screens:** each document in the check gets a stripe in its type's tab colour; panels and
  the summary strip use the paper radius and shadow; the summary numbers stay in the sans.
- **Brand mark:** the two rules in slate and the tick in cobalt; icons and the manifest
  background follow the desk colour.

**Slop check** (`design-system`): no gradient blobs, no glass, no purple-blue gradient, no neon on
black, no identical icon-card grid, no all-caps eyebrows, no emoji, one accent colour for
action. Cream and serif is a known tell; here it is used deliberately and limited to headings, and
the tabs, punched margin and charcoal panel keep it from reading as a generic "editorial" theme.

**Scores** (`gan-style-harness`; weights Design 0.3, Originality 0.2, Craft 0.3, Functionality 0.2;
pass ≥ 7.0). A self-evaluation from the screenshots in `design/evidence/v3/` and the v2
screenshots, not an independent review:

| Criterion     | v2 "Deep water" | v3 "Notebook Tabs" | Note                                                            |
| ------------- | --------------- | ------------------ | --------------------------------------------------------------- |
| Design        | 7.0             | 8.0                | One idea carried from hero to document list                     |
| Originality   | 6.0             | 8.0                | Binder tabs and punched margin come from the subject            |
| Craft         | 7.0             | 7.5                | Aligned tabs and evidence marks; Bodoni limited to large sizes  |
| Functionality | 8.0             | 8.0                | Same flows, tests and states; tab colours add document identity |
| **Weighted**  | **7.0**         | **7.85**           | Passes; iteration stopped                                       |

**Verified:** `npm run check` (contrast pairs in `design/tokens.json` include the tabs and
charcoal), `npm run design:evidence`, the Playwright suite with axe (WCAG 2.2 AA) at 390, 834 and
1440 px in six languages, and the screenshots in `design/evidence/v3/`.

## 19. Hebrew edition (October 2026)

The owner asked for the product in Hebrew, written so it does not read like machine output, with
the earlier version kept. Hebrew is now the default language; nothing else was removed.

**Editions.** `TICKLINE_EDITION` (build time, `src/i18n/edition.ts`) chooses between `hebrew`
(default: `/` always opens `/he`, Hebrew first in the menu) and `multilingual` (the earlier
behaviour: English first, starting language from the browser). Both serve all seven languages.
The English, Turkish, German, Spanish, French and Arabic texts are unchanged apart from two new
strings (the social-preview alt text and Hebrew in the right-to-left sentence).

**Type.** Hebrew has no Bodoni, so it gets its own pair, switched on `html:lang(he)` like Arabic:

| Role                    | Face                        | Why                                                                   |
| ----------------------- | --------------------------- | --------------------------------------------------------------------- |
| Page and section titles | Frank Ruhl Libre (variable) | A Hebrew book and newspaper serif, the closest match to Bodoni's role |
| Text                    | IBM Plex Sans Hebrew        | Same family as the Arabic face; clear at 13–16 px                     |
| Codes and values        | DM Mono                     | Codes are Latin; Hebrew inside a value falls back to Plex Sans Hebrew |

The Hebrew faces load only for Hebrew letters (their `unicode-range`), so Latin text in a Hebrew
page keeps DM Sans and other languages download nothing extra.

**Writing (humanizer).** The Drive skill folder has no humanizer skill, so the widely used one
was taken from [github.com/blader/humanizer](https://github.com/blader/humanizer) (v3.1.0, MIT,
based on Wikipedia's "Signs of AI writing"). Applied to Hebrew interface text:

- **State the fact.** No "not only X but also Y" (לא רק… אלא גם), no closing line that repeats
  the point, no staged openers ("חשוב לדעת", "בואו נ…").
- **No dashes as connectors.** Commas, colons or a new sentence instead. A numeric range
  (65–80%) keeps its en dash; the maqaf (־) joins a prefix to Latin or digits (ב־PDF, ל־F1).
- **No sales words.** No חדשני, עוצמתי, בקלות, מושלם; the facts (30 rules, deleted after 24 hours)
  do the work.
- **One form of address.** Plural imperatives (הוסיפו, בדקו) for instructions and nouns for
  buttons (יצירת בדיקה, מחיקה), so the text never picks a gender.
- **Trade terms as used in Israel:** חשבונית מסחרית, רשימת אריזה, הזמנת רכש, עמיל מכס, משלח
  בינלאומי, ארץ מקור, טובין; "evidence" is אסמכתה, the word for a supporting document reference.
- **Hebrew punctuation:** geresh and gershayim (מס׳, מע״מ, סה״כ), and a right-to-left mark after
  commas between Latin words (PDF,‏ PNG) so the comma sits where a Hebrew reader expects it.

`test/hebrew-writing.test.ts` enforces the machine-checkable parts (dashes, exclamation marks
and emoji, the stock phrases above, singular gendered imperatives, ASCII quotes in
abbreviations). Like the other non-English texts, the Hebrew is machine-written and should be
read by a native speaker before production use.

**Social preview.** `npm run og:image` now renders one card per language from its message file,
in its own type and direction (`public/social/<locale>.png`); `opengraph-image.tsx` and
`twitter-image.tsx` serve the card and its alt text for the page's language.

**Verified:** translation parity and ICU arguments for all seven languages, the writing test,
the edition test, axe (WCAG 2.2 AA) on every page in Hebrew at three widths, the phone sweep on
the Hebrew overview, new-check and check pages, and screenshots of the Hebrew overview at 390 and
1440 px.
