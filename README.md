# TradeCheck

A multilingual pre-shipment check for international trade documents. Exporters upload the commercial invoice, packing list and purchase order for one shipment; TradeCheck reads them, compares them with each other and lists what needs attention — each finding linked to the evidence in the document.

> **Status: MVP complete, not deployed.** All development phases are done (see [Development phases](#development-phases)). The repository is private and there is no hosted version. Design decisions are documented in [DESIGN.md](DESIGN.md).

## What TradeCheck is — and is not

- It is a **self-service pre-check** that a small exporter, a freight forwarder or the operations team of a customs broker runs _before_ a shipment leaves, to catch inconsistencies early.
- It is **not** a customs broker, a legal adviser or an official authority, and it does not replace one. Findings are **for information only and are not official customs or legal advice.** This notice appears on every page, above the results and in every report.
- It does not classify goods. HS codes are only checked for format (the first six digits are shared internationally) and always carry a note that the classification **needs expert confirmation**.
- It makes no country-specific claims. Country rules can only be added as [rule packs](#rule-packs) together with an official source; none ship today.

## How it works

1. **Upload** PDF, PNG or JPG documents for one shipment. Files are checked by their content (magic bytes), size and page count.
2. **Read** — Claude reads each document, in any language, and returns structured fields. Every field keeps the value as printed, a normalized value, a confidence score and its source (page and text excerpt). Output that does not match the schema is rejected.
3. **Review** — any extracted value can be corrected. Corrected values are labelled "Corrected by you" and every check runs again; low-confidence values are marked.
4. **Check** — deterministic code runs the arithmetic, format, cross-document and completeness checks.
5. **Report** — findings appear next to the document with the evidence highlighted, and the report can be printed or saved as PDF in the selected interface language.

### Who does what

| Done by deterministic code                                                        | Done by Claude                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Line arithmetic (quantity × unit price = line total; lines add up to the total)   | Reading documents and extracting fields                            |
| Format checks: ISO 4217, ISO 3166-1, Incoterms® 2020, HS code format, IBAN mod-97 | Deciding whether differently written names or descriptions match   |
| Date logic, expected fields per document type, missing documents                  | Optional plain-language explanations (labelled as AI-generated)    |
| Cross-document comparison of totals, packages, weights, parties, references       | Optional correction e-mail drafts (labelled as AI-generated draft) |

Claude never produces HS codes, tax-ID formats or regulations from memory, and instructions found inside documents are never followed.

## Two-minute demo

Use your own documents for one shipment, kept in `/samples` (git-ignored). TradeCheck ships no sample documents or results.

1. `npm run dev`, open http://localhost:3000 — you land in your browser's language; switch it top right.
2. **New check** → give it a reference, drop the invoice, packing list and purchase order, **Create check** → **Continue to the check**. A file that is not really a PDF, PNG or JPG is rejected with the reason next to it.
3. **Read documents.** Each document shows "Reading…" and then its detected type and language; the type can be changed. After reading, names and descriptions written differently are compared by Claude automatically.
4. **Findings.** The summary shows errors, warnings, results that could not be verified and notes, plus issues per check category. Filter by status, category or document.
5. Click **Show in document** on a finding: the page opens with the evidence highlighted, a bracket in the margin and the same `F` tag. Click a tag in the margin to jump back to its finding.
6. In **Extracted data**, correct a value that was read wrongly — the findings update. Change the **rounding tolerance** under "Checks that ran" to see the arithmetic checks re-run.
7. **Explain in plain language** on a finding, or **Draft correction e-mail** for the errors and warnings (in the documents' language, changeable). Copy the draft or open it in your mail program — TradeCheck sends nothing.
8. **Open report** → **Print or save as PDF**. The token usage of every step is in the page header and in the report.
9. **Delete check** removes the files and data immediately; otherwise they are deleted automatically after `RETENTION_HOURS`.

## Principles

- **No fake data.** No hard-coded sample results, invented documents, statistics, logos or testimonials. Where there is no data, the interface shows a designed empty state.
- **Document content is untrusted input.** Prompts tell the model that documents are data, not instructions, and all model output is validated with Zod; invalid output is discarded, never repaired by guessing.
- **Unverifiable means unverified.** When a check cannot reach a conclusion — a value is missing, the AI comparison has not run or is not confident — the result says "could not be verified", never a guess.
- **Privacy.** Document content is never logged (errors are logged by code only). Files are deleted automatically after a configurable period and can be deleted at any time.
- **Cost visibility.** The model is configurable, and the tokens used by every request (reading, comparison, explanations, e-mail drafts) are recorded and shown.

## Getting started

Requirements: Node.js 22.12 or newer (Node 24 LTS recommended, see `.nvmrc`) and an Anthropic API key.

```bash
npm ci
cp .env.example .env.local   # then set ANTHROPIC_API_KEY in .env.local
npm run dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app runs, but reading and the AI features are disabled and the interface says so.

### GitHub Codespaces

The repository includes `.devcontainer/devcontainer.json` (Node 24 LTS, port 3000 forwarded, Playwright Chromium installed on create). Add `ANTHROPIC_API_KEY` as a [Codespaces secret](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces) rather than writing it to a file.

### Configuration

All variables are server-side only. See `.env.example` for the template.

| Variable                     | Default             | Purpose                                                                 |
| ---------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`          | —                   | Required for reading and the AI features. Without it they are disabled. |
| `ANTHROPIC_MODEL`            | `claude-sonnet-5-5` | Model used for reading, comparison, explanations and e-mail drafts.     |
| `DATA_DIR`                   | `./data`            | SQLite database and uploaded files (git-ignored).                       |
| `UPLOAD_MAX_FILE_MB`         | `20`                | Max size per file, 1–20 MB.                                             |
| `UPLOAD_MAX_PAGES`           | `20`                | Max pages per PDF, 1–100.                                               |
| `UPLOAD_MAX_FILES_PER_CHECK` | `10`                | Max documents in one check, 1–20.                                       |
| `RETENTION_HOURS`            | `24`                | Files, extracted data and findings are deleted after this many hours.   |

### Scripts

| Command                   | What it does                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| `npm run dev`             | Development server                                                |
| `npm run build` / `start` | Production build and server                                       |
| `npm run lint`            | ESLint (Next.js, React hooks, jsx-a11y rules)                     |
| `npm run typecheck`       | TypeScript in strict mode                                         |
| `npm run format:check`    | Prettier                                                          |
| `npm run test`            | Vitest unit tests                                                 |
| `npm run test:e2e`        | Playwright end-to-end and axe accessibility tests at three widths |
| `npm run check:secrets`   | Fails if a tracked file looks like it contains a key              |
| `npm run check`           | All of the above except the end-to-end tests                      |

If Playwright cannot download its browser, point it at an installed Chromium with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Checks

All arithmetic and rule-based checks are deterministic code (`src/lib/validation/`) using exact decimal arithmetic. Claude is asked only whether two differently written names or goods descriptions mean the same thing; those answers are labelled "AI-assisted", cached by content hash, and a missing or low-confidence answer is shown as "could not be verified".

| Category         | Checks                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic       | quantity × unit price = line total; lines add up to the document total (configurable tolerance); line quantities add up to the total quantity; net ≤ gross weight                                               |
| Across documents | total quantity, packages, gross and net weight (unit-converted), order reference, currency, Incoterms® rule and place, origin, destination, exporter, importer, goods descriptions, HS codes (first six digits) |
| Formats          | ISO 4217 currency, ISO 3166-1 country, Incoterms® 2020, HS code format (never the classification), IBAN check digits, readable values, purchase order dated first                                               |
| Completeness     | expected fields per document type, missing or unread documents, a general reminder to check the destination country's rules                                                                                     |

## Results, report and AI assistance

- **Evidence ledger.** Findings and the documents side by side (two panes from 1024 px, tabs on tablets, a full-screen sheet on phones). Every finding has a reference tag (`F3`); selecting it shows the page with the evidence highlighted and the same tag in the margin. PDFs are rendered in the browser with PDF.js (legacy build, for browsers a few versions old). Images and scans without a text layer list their evidence above the page as "Exact position not available".
- **Summary and filters.** Counts by status, issues per check category (chart with a table view), filters by status, category and document, and the full list of checks that ran — "No issues found" always refers to that list.
- **Report.** `/<language>/checks/<id>/report` is laid out for printing; "Print or save as PDF" uses the browser's print dialog, so every script (Arabic included) is shaped correctly. It carries the information-only notice, the documents, all findings with evidence, the checks that ran and the token usage.
- **AI assistance (optional, labelled).** "Explain in plain language" for one finding, and a correction e-mail draft in the documents' language (changeable). Drafts are only shown for copying or opening in your own mail program — TradeCheck never sends e-mail. Both are cached by content hash and their tokens are added to the check's usage.

## Rule packs

Country-specific rules live in `/rules/<ISO 3166-1 alpha-2 code>/` and run when a document names that country as its destination. The interface (`src/lib/validation/rule-pack.ts`) and the registry (`rules/index.ts`) exist, but **no pack ships**: a rule may only be added together with the official source it implements.

In short — the full guide is [`rules/README.md`](rules/README.md):

1. Find the official source (customs administration, ministry, official journal) and note its title, publisher, https URL and the date you read it.
2. Create `rules/<ISO>/` exporting a `RulePack` with `country`, `id`, `version`, `sources` and `rules` (ids prefixed `pack-<iso>-`).
3. Write each rule as deterministic code with the helpers in `src/lib/validation/helpers.ts`; rules never call the model.
4. Add the messages for its findings to **every** file in `messages/`.
5. Register the pack in `rules/index.ts` and run `npm test` — the registry test rejects packs without valid sources.

## Languages

Interface languages: English (default), Turkish, German, Spanish, French and Arabic (right-to-left). Routes are `/<language>/…`, and the browser's language is detected on the first visit.

- **Adding a language** only requires adding `messages/<code>.json` with the same keys and `meta.name` / `meta.direction`; the i18n test checks key and placeholder parity.
- Translations other than English are **machine-generated drafts and need human review** before production use.
- The interface language and the document language are independent: documents can be in any language Claude can read, and e-mail drafts default to the documents' language.
- Numbers, dates and currencies are formatted with `Intl`; Arabic uses Latin digits so values look like the paper documents.

## Privacy and data

- Everything is stored locally under `DATA_DIR`: a SQLite database and the uploaded files (created with owner-only permissions).
- Documents are sent to Anthropic's API only when the user chooses **Read documents**. Names and descriptions are sent for comparison, and findings for explanations and e-mail drafts, only when those features run.
- Checks expire after `RETENTION_HOURS` and are purged automatically; **Delete check** and **Remove** delete immediately.
- Logs never contain document content.

## Known limitations

- **Accuracy depends on the scan.** Extraction quality depends on print and scan quality; low-confidence values are marked, and every value can be corrected.
- **Evidence position needs a text layer.** Scanned PDFs and images get page-level notes ("Exact position not available") instead of highlights.
- **One document per type is compared.** When a check has two invoices, only the first is compared and the others are noted.
- **Line-by-line comparison assumes the same line order.** When the number of goods lines differs, descriptions are not compared line by line (the difference is reported).
- **Reference lists are bundled.** ISO 4217 comes from the `currency-codes` package (SIX list dated 2024-06-25) — a newer code is reported as a warning that names the list date; ISO 3166-1 comes from `i18n-iso-countries`; the Incoterms® 2020 rules are listed in code.
- **Expected fields are general practice**, not any country's legal requirements; no country rule packs ship.
- **Weight units:** kg, g, t and lb.
- **AI features need a key** and were exercised with mocked responses in automated tests; review their output on real documents before production use.
- **Single instance, no accounts.** SQLite and the local file system suit one server; there is no authentication, so any deployment must sit behind your own access control. Node's built-in SQLite prints an "experimental" warning.
- **Light theme only**, by design for the MVP.
- **Translations are machine-generated** and need native-speaker review.

## Testing

- **Unit tests** (Vitest): every rule, the engine, rule-pack validation, extraction and comparison calls with a mocked client, storage, evidence location, presentation in several languages, design tokens (WCAG contrast) and translation parity.
- **End-to-end tests** (Playwright) at 390, 834 and 1440 px: every page in every language with axe (WCAG 2.2 AA tags), upload and rejection, field correction, findings, filters, evidence selection, the report and the rounding tolerance — using synthetic, labelled fixtures generated at test time.
- **Review screenshots** of every screen and content state at three widths, in English and Arabic: `SCREENSHOTS=1 npm run test:e2e -- e2e/screenshots.spec.ts` (output in `screenshots/`, git-ignored). The Phase 6 review is summarized in [DESIGN.md](DESIGN.md#14-phase-6-review).

## Development phases

| Phase | Scope                                                                                                     | Status |
| ----- | --------------------------------------------------------------------------------------------------------- | ------ |
| 0     | Repository skeleton, configuration, dev container                                                         | Done   |
| 1     | Design direction and design system (`DESIGN.md`)                                                          | Done   |
| 2     | App skeleton, internationalization, layout, empty states, accessible base components                      | Done   |
| 3     | Upload, Claude extraction with schema validation, evidence locations, token usage, field correction       | Done   |
| 4     | Validation engine and cross-document comparison, with unit tests                                          | Done   |
| 5     | Results view, evidence ledger, filters, summary, report export, explanations and correction e-mail drafts | Done   |
| 6     | Polish, motion, accessibility audit, screenshots at three widths and in RTL, final README                 | Done   |

## Out of scope for the MVP

Payments and subscriptions, user accounts, letter-of-credit mode, country-specific rule content, importing documents from e-mail, team sharing. The planned pricing model is a per-shipment fee; no payment or account system is implemented.

## Security

- `ANTHROPIC_API_KEY` is read only on the server; server modules import `server-only` so they cannot be bundled into client code.
- Configuration errors name the variable but never echo its value; `npm run check:secrets` runs in CI.
- Uploads are limited by type (magic bytes), size, page count and number of files; encrypted PDFs are rejected; PDFs are rendered without XFA forms.
- Report a vulnerability privately to the repository owner rather than in an issue.
