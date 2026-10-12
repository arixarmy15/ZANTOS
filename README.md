# TradeCheck

A multilingual pre-shipment check for international trade documents. Exporters upload their commercial invoice, packing list and purchase order; TradeCheck extracts the fields, compares the documents with each other and reports errors and gaps, each one linked to the evidence in the document.

> **Status: early development (Phase 2 — application skeleton).** There is no hosted version and the app does not run yet. The design direction and tokens are in [DESIGN.md](DESIGN.md). This README is a draft and will be completed in Phase 6.

## What TradeCheck is — and is not

- It is a **self-service pre-check** that a small exporter, freight forwarder or the operations team of a customs broker runs _before_ a shipment leaves, to catch inconsistencies early.
- It is **not** a customs broker, a legal adviser or an official authority, and it does not replace one. Findings are **for information only and are not official customs or legal advice.** This notice appears in the interface and in every exported report.
- It does not classify goods. HS codes are only checked for format (the first six digits are shared internationally) and are always marked as **requiring expert confirmation**.
- It makes no country-specific claims unless a rule pack with a verifiable source has been added for that country (see [Rule packs](#rule-packs-planned)).

## How it works (planned)

1. **Upload** PDF, PNG or JPG documents for one shipment.
2. **Extract** — Claude reads each document (in any language) and returns structured fields. Every field keeps its original value, a normalized value, a confidence score and its source (page + text snippet). Output that does not match the schema is rejected.
3. **Review** — the user can correct any extracted field. Corrected fields are labelled "corrected by user" and all checks run again. Low-confidence fields are clearly marked.
4. **Validate** — deterministic code runs arithmetic, format and cross-document checks.
5. **Report** — findings are shown next to the document with the evidence highlighted, and can be exported as a PDF in the selected interface language.

### Who does what

| Done by deterministic code                                                     | Done by Claude                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Line arithmetic (quantity × unit price = line total; sum of lines = total)     | Reading documents and extracting fields                         |
| Format checks: ISO 4217, ISO 3166, Incoterms 2020, HS code format, IBAN mod-97 | Semantic matching (e.g. product descriptions across documents)  |
| Date logic, required fields per document type                                  | Optional plain-language explanations (labelled as AI-generated) |
| Cross-document comparison of totals, packages, weights, parties, references    | Correction-request email drafts (labelled as AI-generated)      |

Claude never produces HS codes, tax ID formats or regulations from memory.

## Principles

- **No fake data.** No hard-coded sample results, invented documents, statistics, logos or testimonials. Where there is no data, the UI shows a designed empty state.
- **Document content is untrusted input.** The extraction prompt tells the model to ignore any instructions inside documents, and model output is validated with Zod.
- **Unverifiable means unverified.** If an external source cannot be reached, the result is shown as "could not be verified" — never as a guessed value.
- **Privacy.** Document contents are never logged. Uploaded files are deleted automatically after a configurable period and can be deleted manually at any time.
- **Cost visibility.** The model is configurable, and the tokens used by every analysis are recorded and shown in the interface.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS + shadcn/ui · next-intl · Zod · Anthropic TypeScript SDK (server-side only) · SQLite + local file system behind a storage interface · Vitest · Playwright + axe.

TypeScript is pinned to 6.0.x: TypeScript 7 does not yet expose the stable compiler API that `typescript-eslint` and Next.js type checking rely on.

## Getting started

Requirements: Node.js 22.12 or newer (Node 24 LTS recommended, see `.nvmrc`) and an Anthropic API key.

```bash
npm ci
cp .env.example .env.local   # then set ANTHROPIC_API_KEY in .env.local
npm run test
```

Run `npm run dev` and open http://localhost:3000 — you are redirected to your browser's language.

### GitHub Codespaces

The repository includes `.devcontainer/devcontainer.json` (Node 24 LTS, port 3000 forwarded, Playwright Chromium installed on create). Add `ANTHROPIC_API_KEY` as a [Codespaces secret](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces) rather than writing it to a file.

### Configuration

All variables are server-side only. See `.env.example` for the template.

| Variable                     | Default             | Purpose                                                              |
| ---------------------------- | ------------------- | -------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`          | —                   | Required for extraction. Without it, extraction is disabled.         |
| `ANTHROPIC_MODEL`            | `claude-sonnet-5-5` | Model used for extraction, semantic comparison and drafts.           |
| `DATA_DIR`                   | `./data`            | SQLite database and uploaded files (git-ignored).                    |
| `UPLOAD_MAX_FILE_MB`         | `20`                | Max size per file, 1–20 MB.                                          |
| `UPLOAD_MAX_PAGES`           | `20`                | Max pages per PDF, 1–100.                                            |
| `UPLOAD_MAX_FILES_PER_CHECK` | `10`                | Max documents in one check, 1–20.                                    |
| `RETENTION_HOURS`            | `24`                | Uploaded files and extracted data are deleted after this many hours. |

### Scripts

| Command                 | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm run lint`          | ESLint (Next.js, React hooks, jsx-a11y rules)                |
| `npm run typecheck`     | TypeScript in strict mode                                    |
| `npm run format:check`  | Prettier                                                     |
| `npm run test`          | Vitest unit tests                                            |
| `npm run test:e2e`      | Playwright end-to-end and accessibility tests (from Phase 2) |
| `npm run check:secrets` | Fails if a tracked file looks like it contains a key         |
| `npm run check`         | All of the above except end-to-end tests                     |

## Test documents

Put real test documents in `/samples`. The folder is git-ignored and must never be committed. The repository contains no sample documents or sample results.

## Languages

Interface languages: English (default), Turkish, German, Spanish, French and Arabic (right-to-left). Adding a language will only require adding a message file.

Translations other than English are **machine-generated drafts and need human review** before production use.

The interface language and the document language are independent: documents can be in any language Claude can read.

## Checks

All arithmetic and rule-based checks are deterministic code (`src/lib/validation/`), using exact decimal arithmetic. Claude is asked only whether two differently written names or goods descriptions mean the same thing; those answers are labelled "AI-assisted", cached by content hash, and a missing or low-confidence answer is shown as "could not be verified".

| Category         | Checks                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic       | quantity × unit price = line total; lines add up to the document total (configurable tolerance); line quantities add up to the total quantity; net ≤ gross weight                                               |
| Across documents | total quantity, packages, gross and net weight (unit-converted), order reference, currency, Incoterms® rule and place, origin, destination, exporter, importer, goods descriptions, HS codes (first six digits) |
| Formats          | ISO 4217 currency, ISO 3166-1 country, Incoterms® 2020, HS code format (never the classification), IBAN check digits, readable values, purchase order dated first                                               |
| Completeness     | expected fields per document type, missing or unread documents, a general reminder to check the destination country's rules                                                                                     |

## Results, report and AI assistance

- **Evidence ledger.** Findings and the documents side by side: every finding has a reference tag (`F3`); selecting it shows the page with the evidence highlighted and the same tag in the margin. PDFs are rendered in the browser with PDF.js (legacy build, for browsers a few versions old). Images and scans without a text layer list their evidence above the page as "Exact position not available".
- **Summary and filters.** Counts by status, issues per check category (chart with a table view), filters by status, category and document, and the full list of checks that ran — "no issues" always refers to that list.
- **Report.** `/<language>/checks/<id>/report` is laid out for printing; "Print or save as PDF" uses the browser's print dialog, so every script (Arabic included) is shaped correctly. It carries the information-only notice, the documents, all findings with evidence, the checks that ran and the token usage.
- **AI assistance (optional, labelled).** "Explain in plain language" for one finding, and a correction e-mail draft in the documents' language (changeable). Drafts are only shown for copying or opening in your own mail program — TradeCheck never sends e-mail. Both are cached per content hash and their tokens are added to the check's usage.

## Rule packs

Country-specific rules live in `/rules/<ISO 3166-1 alpha-2 code>/` and run when a document names that country as its destination. The interface and registry exist, but **no pack ships**: a rule may only be added together with the official source it implements. See [`rules/README.md`](rules/README.md) for the step-by-step guide.

## Roadmap

| Phase | Scope                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 0     | Repository skeleton, configuration, dev container, README draft                                                           |
| 1     | Design direction and design system (`DESIGN.md`)                                                                          |
| 2     | App skeleton, internationalization, main layout, empty states, accessible base components                                 |
| 3     | Upload flow, Claude extraction with schema validation, evidence locations, token counter, field correction                |
| 4     | Validation engine and cross-document comparison, with unit tests                                                          |
| 5     | Results view (document and finding side by side), filters, summary dashboard, PDF export, correction-request email drafts |
| 6     | Polish, motion, accessibility audit, screenshots at three widths and in RTL, final README                                 |

## Out of scope for the MVP

Payments and subscriptions, user accounts, letter-of-credit mode, country-specific rule content, importing documents from email, team sharing. The planned pricing model is a per-shipment fee; no payment or account system is implemented.

## Security

- `ANTHROPIC_API_KEY` is read only on the server; the configuration module imports `server-only` so it cannot be bundled into client code.
- Configuration errors name the variable but never echo its value.
- Report a vulnerability privately to the repository owner rather than in an issue.
