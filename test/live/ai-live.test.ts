import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

/**
 * Opt-in checks against the AI provider configured in the environment: real requests, real
 * tokens. Run with `npm run test:live` (reads .env.local). Skipped in the normal test run
 * and in CI. Uses a synthetic, labelled document only.
 */
const live = process.env.AI_LIVE_TEST === "1";
const TIMEOUT = 300_000;

async function syntheticInvoice(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595, 842]);
  [
    "SYNTHETIC TEST FIXTURE - COMMERCIAL INVOICE",
    "Invoice no. INV-LIVE-1    Date: 2026-03-01",
    "Seller: Synthetic Exporter Ltd, Izmir, Turkey",
    "Buyer: Synthetic Importer GmbH, Hamburg, Germany",
    "Incoterms 2020: FOB Izmir    Currency: EUR",
    "1  Cotton towels   10 pcs   x 9.00   = 90.00",
    "Total EUR 90.00    Packages: 2",
  ].forEach((text, index) => page.drawText(text, { x: 40, y: 780 - index * 20, size: 11, font }));
  return document.save();
}

describe.skipIf(!live)("live AI provider", () => {
  it(
    "reads a synthetic invoice into the schema",
    async () => {
      const { extractDocument } = await import("@/lib/extraction/extract");
      const { extraction, usage } = await extractDocument({
        bytes: await syntheticInvoice(),
        mimeType: "application/pdf",
        pageCount: 1,
      });
      console.info(`extract: ${usage.model}, ${usage.inputTokens} in / ${usage.outputTokens} out`);
      expect(extraction.documentType).toBe("commercial_invoice");
      expect(extraction.header.documentNumber.normalized).toBe("INV-LIVE-1");
      expect(extraction.header.currency.normalized).toBe("EUR");
      expect(extraction.header.totalAmount.normalized).toMatch(/^90(\.0+)?$/);
      expect(extraction.lines.length).toBeGreaterThanOrEqual(1);
    },
    TIMEOUT,
  );

  it(
    "compares two spellings of one company",
    async () => {
      const { compareTexts } = await import("@/lib/comparison/compare");
      const { semanticKey } = await import("@/lib/validation/semantic");
      const pair = {
        kind: "party" as const,
        a: "Synthetic Exporter Ltd",
        b: "SYNTHETIC EXPORTER LIMITED",
      };
      const { verdicts, usage } = await compareTexts([
        { key: semanticKey(pair.kind, pair.a, pair.b), ...pair },
      ]);
      console.info(`compare: ${usage.model}, ${usage.inputTokens} in / ${usage.outputTokens} out`);
      expect([...verdicts.values()][0]?.same).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "explains a finding and drafts an e-mail as validated JSON",
    async () => {
      const { structuredRequest } = await import("@/lib/assist/request");
      const { emailSchema, explanationSchema, EMAIL_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT } =
        await import("@/lib/assist/prompts");
      const facts = JSON.stringify({
        check: "Number of packages across documents",
        severity: "error",
        result: "Number of packages differs: 2 in invoice.pdf, 3 in packing-list.pdf.",
      });
      const explanation = await structuredRequest({
        task: "explain",
        system: EXPLAIN_SYSTEM_PROMPT,
        user: `Language for the answer: Turkish (tr).\n<result>\n${facts}\n</result>`,
        schema: explanationSchema,
        maxTokens: 1500,
      });
      console.info(`explain: ${explanation.usage.model}`);
      expect(explanation.output.explanation.length).toBeGreaterThan(20);

      const email = await structuredRequest({
        task: "email",
        system: EMAIL_SYSTEM_PROMPT,
        user: `Language for the e-mail: English (en).\n<issues>\n[${facts}]\n</issues>`,
        schema: emailSchema,
        maxTokens: 4000,
      });
      console.info(`email: ${email.usage.model}`);
      expect(email.output.subject.length).toBeGreaterThan(3);
      expect(email.output.body).toMatch(/2|3/);
    },
    TIMEOUT,
  );
});
