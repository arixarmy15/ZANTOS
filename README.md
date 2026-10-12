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
2. **Read** — the configured AI model (Claude by default, see [AI providers](#ai-providers)) reads each document, in any language, and returns structured fields. Every field keeps the value as printed, a normalized value, a confidence score and its source (page and text excerpt). Output that does not match the schema is rejected.
3. **Review** — any extracted value can be corrected. Corrected values are labelled "Corrected by you" and every check runs again; low-confidence values are marked.
4. **Check** — deterministic code runs the arithmetic, format, cross-document and completeness checks.
5. **Report** — findings appear next to the document with the evidence highlighted, and the report can be printed or saved as PDF in the selected interface language.

### Who does what

| Done by deterministic code                                                        | Done by the AI model (Claude by default)                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Line arithmetic (quantity × unit price = line total; lines add up to the total)   | Reading documents and extracting fields                            |
| Format checks: ISO 4217, ISO 3166-1, Incoterms® 2020, HS code format, IBAN mod-97 | Deciding whether differently written names or descriptions match   |
| Date logic, expected fields per document type, missing documents                  | Optional plain-language explanations (labelled as AI-generated)    |
| Cross-document comparison of totals, packages, weights, parties, references       | Optional correction e-mail drafts (labelled as AI-generated draft) |

The model is never asked for HS codes, tax-ID formats or regulations, its prompts tell it never to follow instructions found inside documents, and every answer is validated against a schema whichever provider produced it.

## Two-minute demo

Use your own documents for one shipment, kept in `/samples` (git-ignored). TradeCheck ships no sample documents or results.

1. `npm run dev`, open http://localhost:3000 — you land in your browser's language; switch it top right.
2. **New check** → give it a reference, drop the invoice, packing list and purchase order, **Create check** → **Continue to the check**. A file that is not really a PDF, PNG or JPG is rejected with the reason next to it.
3. **Read documents.** Each document shows "Reading…" and then its detected type and language; the type can be changed. After reading, names and descriptions written differently are compared by the AI model automatically.
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

Requirements: Node.js 22.12 or newer (Node 24 LTS recommended, see `.nvmrc`) and access to an AI provider — an Anthropic API key, or any OpenAI-compatible endpoint (see [AI providers](#ai-providers)).

```bash
npm ci
cp .env.example .env.local   # then configure a provider in .env.local
npm run dev                  # http://localhost:3000
```

Without a configured provider the app runs, but reading and the AI features are disabled and the interface says so.

### GitHub Codespaces

The repository includes `.devcontainer/devcontainer.json` (Node 24 LTS, port 3000 forwarded, Playwright Chromium installed on create). Add `ANTHROPIC_API_KEY` or `OPENAI_COMPATIBLE_API_KEY` as a [Codespaces secret](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces) rather than writing it to a file.

### Configuration

All variables are server-side only. See `.env.example` for the template.

| Variable                     | Default             | Purpose                                                                  |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `AI_PROVIDER`                | `anthropic`         | Default provider for every AI task: `anthropic` or `openai-compatible`.  |
| `ANTHROPIC_API_KEY`          | —                   | Anthropic key. Tasks routed to Anthropic are disabled without it.        |
| `ANTHROPIC_MODEL`            | `claude-sonnet-5-5` | Model for tasks that run on Anthropic.                                   |
| `OPENAI_COMPATIBLE_BASE_URL` | —                   | Base URL of an OpenAI-compatible API, up to and including `/v1`.         |
| `OPENAI_COMPATIBLE_API_KEY`  | —                   | Key for that endpoint (optional for local servers).                      |
| `OPENAI_COMPATIBLE_MODEL`    | —                   | Default model id on that endpoint.                                       |
| `AI_EXTRACT_MODEL`           | —                   | Optional route for reading documents: `<model>` or `<provider>:<model>`. |
| `AI_COMPARE_MODEL`           | —                   | Optional route for comparing names and descriptions.                     |
| `AI_EXPLAIN_MODEL`           | —                   | Optional route for plain-language explanations.                          |
| `AI_EMAIL_MODEL`             | —                   | Optional route for correction e-mail drafts.                             |
| `DATA_DIR`                   | `./data`            | SQLite database and uploaded files (git-ignored).                        |
| `UPLOAD_MAX_FILE_MB`         | `20`                | Max size per file, 1–20 MB.                                              |
| `UPLOAD_MAX_PAGES`           | `20`                | Max pages per PDF, 1–100.                                                |
| `UPLOAD_MAX_FILES_PER_CHECK` | `10`                | Max documents in one check, 1–20.                                        |
| `RETENTION_HOURS`            | `24`                | Files, extracted data and findings are deleted after this many hours.    |

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
| `npm run ai:models`       | Lists the models the OpenAI-compatible endpoint offers            |
| `npm run test:live`       | Opt-in checks against the configured provider (real requests)     |
| `npm run check`           | All of the above except the end-to-end tests                      |

If Playwright cannot download its browser, point it at an installed Chromium with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Checks

All arithmetic and rule-based checks are deterministic code (`src/lib/validation/`) using exact decimal arithmetic. The AI model is asked only whether two differently written names or goods descriptions mean the same thing; those answers are labelled "AI-assisted", cached by content hash, and a missing or low-confidence answer is shown as "could not be verified".

| Category         | Checks                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic       | quantity × unit price = line total; lines add up to the document total (configurable tolerance); line quantities add up to the total quantity; net ≤ gross weight                                               |
| Across documents | total quantity, packages, gross and net weight (unit-converted), order reference, currency, Incoterms® rule and place, origin, destination, exporter, importer, goods descriptions, HS codes (first six digits) |
| Formats          | ISO 4217 currency, ISO 3166-1 country, Incoterms® 2020, HS code format (never the classification), IBAN check digits, readable values, purchase order dated first                                               |
| Completeness     | expected fields per document type, missing or unread documents, a general reminder to check the destination country's rules                                                                                     |

## AI providers

The AI tasks — reading documents, comparing names and descriptions, explanations and e-mail drafts — go through one provider layer (`src/lib/ai/`). Each task can run on a different provider and model; the deterministic checks never depend on which one is used.

- **Anthropic** (default): Claude reads PDFs and images natively, with schema-constrained output, prompt caching and server-side refusal fallback.
- **OpenAI-compatible**: any server that implements the chat completions API — an LLM gateway, OpenAI, vLLM, Ollama and others — called directly with `fetch`. Structured output is negotiated per endpoint and model (JSON Schema, then JSON mode, then instructions only); every answer is still validated with Zod and rejected if it does not match. PDFs are sent as their text layer, page by page, because chat models generally cannot read PDF files; scanned PDFs without a text layer are refused with an explanation, and images are sent as image inputs, which need a vision-capable model.

Example: an OpenAI-compatible gateway for everything except reading, which stays on Claude:

```bash
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://evren-llmapi.ssyz.org.tr/v1
OPENAI_COMPATIBLE_API_KEY=…            # in .env.local or a secret store, never in git
OPENAI_COMPATIBLE_MODEL=deepseek-v4.1-flash
ANTHROPIC_API_KEY=…
AI_EXTRACT_MODEL=anthropic:claude-sonnet-5-5
```

`npm run ai:models` lists the models the endpoint offers (the key is sent as `Authorization: Bearer` and `X-API-Key`). `npm run test:live` sends a synthetic invoice through reading, comparison, explanation and e-mail drafting on whatever is configured and checks the answers — real requests that use tokens. Behind a corporate proxy, Node needs `NODE_USE_ENV_PROXY=1` to use `HTTPS_PROXY`.

The token usage of every request is recorded with the model that answered, whichever provider it came from.

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
- The interface language and the document language are independent: documents can be in any language the configured model can read, and e-mail drafts default to the documents' language.
- Numbers, dates and currencies are formatted with `Intl`; Arabic uses Latin digits so values look like the paper documents.

## Phones and tablets

Every screen works on phones down to 320 px wide, with touch emulation in the tests:

- **No sideways scrolling.** Long file names and values wrap or truncate; wide tables become card lists on phones (check list, report documents).
- **Touch-sized controls.** On touch screens buttons, fields, tabs and menus are at least 44 px tall, and form text is 16 px so iOS does not zoom in on focus.
- **Evidence on a small screen.** The document opens as a full-screen sheet with zoom (100–300 %) and horizontal scrolling; the page is redrawn at the shown size, so highlights stay on their text. Category and document filters fold behind "More filters", and jump links lead to each section of a check.
- **Dialogs dock to the bottom** of the screen, and the layout respects notches and the home indicator (`viewport-fit=cover` with safe-area insets).
- **Add to home screen** opens TradeCheck full-screen (web app manifest and icons). There is deliberately no service worker, so no documents are cached on the device.

## Privacy and data

- Everything is stored locally under `DATA_DIR`: a SQLite database and the uploaded files (created with owner-only permissions).
- Documents are sent to the configured AI provider only when the user chooses **Read documents**. Names and descriptions are sent for comparison, and findings for explanations and e-mail drafts, only when those features run.
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
- **AI features need a provider** and were exercised with mocked responses and a local OpenAI-compatible stand-in in automated tests; run `npm run test:live` and review the output on real documents before production use.
- **OpenAI-compatible models read PDFs as text.** Scanned PDFs need Anthropic (or another provider that reads PDF files natively) or must be uploaded as images for a vision-capable model; extraction quality depends on the model chosen.
- **Single instance, no accounts.** SQLite and the local file system suit one server; there is no authentication, so any deployment must sit behind your own access control. Node's built-in SQLite prints an "experimental" warning.
- **Light theme only**, by design for the MVP.
- **Translations are machine-generated** and need native-speaker review.

## Testing

- **Unit tests** (Vitest): every rule, the engine, rule-pack validation, extraction and comparison calls with a mocked client, the OpenAI-compatible client (wire format, format negotiation, retries, error mapping) and real HTTP round trips to a local stand-in with per-task routing, storage, evidence location, presentation in several languages, design tokens (WCAG contrast) and translation parity.
- **End-to-end tests** (Playwright) at 390 (touch), 834 (touch) and 1440 px, plus a phone sweep at 320 and 390 px that fails on sideways scrolling, touch targets under 44 px or form text under 16 px: every page in every language with axe (WCAG 2.2 AA tags), upload and rejection, field correction, findings, filters, evidence selection, the report and the rounding tolerance — using synthetic, labelled fixtures generated at test time.
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
