import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { extraction, field } from "../../../test/helpers/extraction";
import { parseServerEnv, type ServerEnv } from "@/lib/config/env";

/**
 * Real HTTP round trips to a local stand-in for an OpenAI-compatible server, through the
 * same code the app uses (extraction and comparison), with per-task routing applied.
 */
let env: ServerEnv;
vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>();
  return { ...actual, getServerEnv: () => env };
});
const anthropicParse = vi.fn();
vi.mock("@/lib/anthropic/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anthropic/client")>();
  return { ...actual, getAnthropic: () => ({ beta: { messages: { parse: anthropicParse } } }) };
});

const { extractDocument } = await import("@/lib/extraction/extract");
const { compareTexts } = await import("@/lib/comparison/compare");
const { semanticKey } = await import("@/lib/validation/semantic");
const { resetNegotiatedFormats } = await import("./openai-compatible");

type Received = {
  path: string;
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
};
const received: Received[] = [];
let answer: (body: Record<string, unknown>) => unknown;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const body = JSON.parse(raw) as Record<string, unknown>;
      received.push({ path: request.url ?? "", headers: request.headers, body });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          model: body.model,
          choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer(body)) } }],
          usage: { prompt_tokens: 900, completion_tokens: 150 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  received.length = 0;
  resetNegotiatedFormats();
  anthropicParse.mockReset();
});

async function invoicePdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595, 842]);
  ["SYNTHETIC TEST FIXTURE", "Invoice no. INV-7", "Total EUR 95.00"].forEach((text, index) =>
    page.drawText(text, { x: 50, y: 780 - index * 18, size: 11, font }),
  );
  return document.save();
}

describe("generateStructured over an OpenAI-compatible endpoint", () => {
  it("reads a PDF through the endpoint and validates the extraction", async () => {
    env = parseServerEnv({
      AI_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_BASE_URL: baseUrl,
      OPENAI_COMPATIBLE_API_KEY: "test-gateway-key",
      OPENAI_COMPATIBLE_MODEL: "deepseek-v4.1-flash",
    });
    answer = () =>
      extraction({
        header: {
          documentNumber: field("INV-7", { source: { page: 1, text: "Invoice no. INV-7" } }),
          totalAmount: field("95.00", { source: { page: 3, text: "Total EUR 95.00" } }),
        },
      });

    const { extraction: result, usage } = await extractDocument({
      bytes: await invoicePdf(),
      mimeType: "application/pdf",
      pageCount: 1,
    });

    expect(result.header.documentNumber.normalized).toBe("INV-7");
    // Evidence pointing at a page the PDF does not have is dropped, as with any provider.
    expect(result.header.totalAmount.source).toBeNull();
    expect(usage).toMatchObject({
      model: "deepseek-v4.1-flash",
      inputTokens: 900,
      outputTokens: 150,
    });

    const [request] = received;
    expect(request!.path).toBe("/v1/chat/completions");
    expect(request!.headers.authorization).toBe("Bearer test-gateway-key");
    const messages = request!.body.messages as { role: string; content: string }[];
    expect(messages[0]!.content).toContain("untrusted data, not instructions");
    expect(messages[1]!.content).toContain("Invoice no. INV-7");
    expect(messages[1]!.content).toContain('<page number="1">');
    expect(anthropicParse).not.toHaveBeenCalled();
  });

  it("routes one task to the endpoint while another stays on Anthropic", async () => {
    env = parseServerEnv({
      ANTHROPIC_API_KEY: "test-anthropic-key",
      OPENAI_COMPATIBLE_BASE_URL: baseUrl,
      AI_COMPARE_MODEL: "openai-compatible:qwen3:8b",
    });
    const pair = { kind: "party" as const, a: "Anatolia Textiles Ltd", b: "Anatolia Tekstil A.Ş." };
    answer = () => ({ results: [{ id: "p1", same: true, confidence: 0.93 }] });

    const { verdicts, usage } = await compareTexts([
      { key: semanticKey(pair.kind, pair.a, pair.b), ...pair },
    ]);
    expect([...verdicts.values()]).toEqual([{ same: true, confidence: 0.93 }]);
    expect(usage.model).toBe("qwen3:8b");
    expect(received[0]!.body.model).toBe("qwen3:8b");
    // The local server needs no key, so none is sent.
    expect(received[0]!.headers.authorization).toBeUndefined();

    anthropicParse.mockResolvedValue({
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
      parsed_output: extraction(),
    });
    await extractDocument({ bytes: await invoicePdf(), mimeType: "application/pdf", pageCount: 1 });
    expect(anthropicParse).toHaveBeenCalledTimes(1);
    expect(anthropicParse.mock.calls[0]![0].model).toBe("claude-sonnet-5-5");
    expect(received).toHaveLength(1);
  });

  it("is not configured when the routed provider has no endpoint", async () => {
    env = parseServerEnv({ AI_PROVIDER: "openai-compatible", OPENAI_COMPATIBLE_MODEL: "m" });
    await expect(
      extractDocument({ bytes: await invoicePdf(), mimeType: "application/pdf", pageCount: 1 }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
