# Country rule packs

TradeCheck's built-in checks use only international standards and general trade practice
(arithmetic, cross-document consistency, ISO 4217, ISO 3166-1, Incoterms® 2020, the 6-digit
HS format, IBAN check digits). Rules that depend on a destination country — required
fields, tax identifiers, licences, declarations — belong in a **rule pack** here.

**This folder is empty on purpose.** A rule pack is added only together with the official
sources it implements. No country rule is written from memory.

## Layout

```
rules/
  index.ts          registry: RULE_PACKS
  <ISO>/            one folder per destination country, ISO 3166-1 alpha-2 (e.g. DE)
    index.ts        exports the RulePack
    *.ts            rules
    *.test.ts       tests with synthetic data
```

## When a pack runs

A pack runs when any read document in a check names its country as the country of
destination (`countryOfDestination`). Its findings appear next to the built-in ones,
marked with the pack id, and its rules are listed in the report's rule overview.

## Writing a pack

1. **Find the official source.** A customs administration, ministry or official journal
   page that states the requirement. Record its title, publisher, https URL and the date
   you read it. Secondary sources (blogs, forwarders' guides) are not enough.
2. **Create the folder** `rules/<ISO>/` and export a `RulePack`
   (`src/lib/validation/rule-pack.ts`):

   ```ts
   import type { RulePack } from "@/lib/validation/rule-pack";

   export const pack: RulePack = {
     country: "XX",
     id: "xx-2026.1",
     version: "2026.1",
     sources: [{ title: "…", publisher: "…", url: "https://…", retrieved: "2026-01-31" }],
     rules: [/* Rule objects, ids starting with "pack-xx-" */],
   };
   ```

3. **Write each rule** as a `Rule` (`src/lib/validation/types.ts`): a pure function of the
   read documents that returns how many cases it evaluated and its findings. Use the
   helpers in `src/lib/validation/helpers.ts` (`dec` for exact decimals, `finding`,
   `evidence`, `param`). Rules are deterministic code; they never call the model.
4. **Add the messages.** Each finding's `messageKey` needs an entry under
   `findings.messages` and each rule id an entry under `findings.rules` in **every** file
   in `messages/`. The i18n test fails if one is missing. Messages name the source
   ("according to …") and never read as legal advice.
5. **Register** the pack in `rules/index.ts` and run `npm test`: the registry test checks
   the country code, id prefix, rule id prefixes and that every source has a publisher,
   an https URL and a retrieved date.
6. **Review dates.** Regulations change. Re-check the sources at least once a year and
   bump `version` when a rule changes.
