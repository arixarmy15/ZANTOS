# gettradecheck.com and this project

_Reviewed 2026-10-12 from public search results; the site itself could not be opened from the
build environment, so everything below about it comes from its public homepage as indexed by
search engines. No content, text or design was copied._

## What gettradecheck.com is

A paid due-diligence service for **counterparties in the Netherlands**, aimed at commodity
traders. The user enters a Dutch company; the service returns a report with a trust score,
red flags and a summary, built from **13 verification categories and 30+ data points**:
the KvK business register, VAT validation through VIES, EORI, sanctions lists, directors and
financial data. Its sample report shows flags such as a director not listed in the register, a
recently registered web domain and a virtual office address. An instant report costs €29.95
(results in 2–5 minutes), with a higher-priced expert-reviewed tier.

## How it differs from this project

|             | gettradecheck.com                            | This project (TradeCheck, self-hosted)                                         |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Question    | "Is this Dutch company who it claims to be?" | "Do this shipment's invoice, packing list and order agree with each other?"    |
| Input       | A company name or registration number        | The shipment's own documents (PDF, PNG, JPG)                                   |
| Method      | Lookups in registers and lists, scored       | Extraction with an AI model, then deterministic rules with page-level evidence |
| Output      | Trust score and red flags                    | Findings tied to the document lines; "could not be verified" instead of scores |
| Data leaves | Company identifiers to the service           | Nothing until the user chooses to read documents; stored on the user's server  |
| Price       | Per report                                   | Self-hosted; only the user's own AI provider costs                             |

They are complementary: one checks the counterparty, the other checks the paperwork. They are
not the same project.

## What was taken from it, and what was not

**Taken (within this project's rules — deterministic, sourced, no guessing):**

1. **Party identifiers.** The documents now yield the seller's and buyer's VAT and EORI numbers
   (`sellerVatId`, `sellerEori`, `buyerVatId`, `buyerEori`).
2. **Format checks with cited sources:** the EU VAT prefix (Directive 2006/112/EC, art. 215,
   `EL` for Greece, `XI` for Northern Ireland), the Dutch VAT structure NL + 9 digits + B +
   2 digits (Belastingdienst), the EORI structure (European Commission) and the Dutch EORI
   structure NL + 9-digit RSIN (European Commission). This is the Netherlands focus that fits
   this product: Dutch identifiers are checked to their published structure; other countries'
   are checked only as far as an EU-wide source allows.
3. **Consistency across documents:** a seller's or buyer's VAT or EORI number that differs
   between the invoice, packing list and purchase order is an error with evidence.
4. **Pointing to official verification.** The check page and the report list every party
   number with a link to VIES or the Commission's EORI validation, and say plainly that only
   those services confirm registration. A landing-page question states the scope.

**Not taken, and why:**

- **Trust scores and red-flag scoring** — a single score hides why; this product shows each
  finding with its evidence and never scores companies.
- **Live register, sanctions, director or financial lookups** — they need third-party data
  sources, contracts and personal-data handling that this self-hosted tool does not have.
  VIES does offer a public service, but its exact API could not be verified against the
  Commission's own documentation from this environment, so no call to it was written.
- **Domain-age and virtual-office signals** — heuristics, not documented requirements.
- **Per-report pricing and an expert tier** — a business model, not a product feature.

## Open points for the owner

- **Name.** gettradecheck.com trades as "TradeCheck" in the Netherlands, in an adjacent
  market (trade compliance). Before any public launch under the same name, a trademark search
  (EUIPO, BOIP) is advisable.
- **VIES lookups.** If live VAT validation is wanted later, implement it against the
  Commission's published VIES technical documentation, opt-in per check, with the request
  time and the consultation number recorded in the report.

## Sources

- gettradecheck.com homepage, "TradeCheck — Verify any Dutch company in minutes" (via search).
- Council Directive 2006/112/EC, article 215; Council Directive (EU) 2020/1756.
- Belastingdienst, "Alles over uw btw-identificatienummer en omzetbelastingnummer";
  business.gov.nl, "Numbers for VAT".
- European Commission, Taxation and Customs Union, "Economic Operators Registration and
  Identification number (EORI)" and "EORI National Implementation" (2022).
