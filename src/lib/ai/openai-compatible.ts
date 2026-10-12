import "server-only";
import { z } from "zod";
import { AiError, type TokenUsage } from "./errors";
import { pdfPageTexts } from "./pdf-text";
import type { AiPart, StructuredInput } from "./types";

/**
 * Client for any server that implements the OpenAI chat completions API: LLM gateways,
 * OpenAI, vLLM, Ollama and others. Written against the wire format with `fetch`, so no
 * provider SDK is needed.
 */
export type OpenAiCompatibleEndpoint = {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
};

type Options = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> };

/** Structured output is negotiated: JSON Schema, then JSON mode, then instructions only. */
type FormatMode = "json_schema" | "json_object" | "none";
const MODES: FormatMode[] = ["json_schema", "json_object", "none"];
const acceptedMode = new Map<string, FormatMode>();

const TIMEOUT_MS = 180_000;
const RETRIES = 2;

type ContentPart =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Document text cannot close the tags it is wrapped in. */
function neutralizeTags(text: string): string {
  return text.replace(/<(\/?)(document|page)\b/gi, "‹$1$2");
}

/** A PDF as its text layer, page by page, for models that cannot read PDF files. */
export function pdfAsText(pages: string[]): string {
  return [
    "The attached document is a PDF. Its text layer follows, page by page; page numbers are 1-based.",
    "<document>",
    ...pages.map((text, index) => `<page number="${index + 1}">\n${neutralizeTags(text)}\n</page>`),
    "</document>",
  ].join("\n");
}

async function toContent(parts: AiPart[]): Promise<string | ContentPart[]> {
  const content: ContentPart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      content.push({ type: "text", text: part.text });
    } else if (part.type === "image") {
      const data = Buffer.from(part.data).toString("base64");
      content.push({
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${data}` },
      });
    } else {
      const pages = await pdfPageTexts(part.data);
      // A scan has no text layer; this route cannot read it, and nothing is guessed.
      if (pages.every((page) => page.length === 0)) throw new AiError("unsupported_document");
      content.push({ type: "text", text: pdfAsText(pages) });
    }
  }
  // Plain text keeps text-only models and simple servers happy.
  return content.every((part) => part.type === "text")
    ? content.map((part) => (part as { text: string }).text).join("\n\n")
    : content;
}

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}

function responseFormat(mode: FormatMode, schema: Record<string, unknown>) {
  if (mode === "json_schema") {
    return {
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", schema, strict: false },
      },
    };
  }
  return mode === "json_object" ? { response_format: { type: "json_object" } } : {};
}

/** The JSON object in a model's answer, tolerating code fences and surrounding prose. */
export function parseJsonAnswer(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

type ChatResponse = {
  model?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    prompt_tokens_details?: { cached_tokens?: unknown } | null;
  } | null;
  choices?: { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown } }[];
};

export function usageOf(data: ChatResponse, model: string): TokenUsage {
  return {
    model: typeof data.model === "string" && data.model ? data.model : model,
    inputTokens: count(data.usage?.prompt_tokens),
    outputTokens: count(data.usage?.completion_tokens),
    cacheReadTokens: count(data.usage?.prompt_tokens_details?.cached_tokens),
    cacheWriteTokens: 0,
  };
}

function statusError(status: number, detail: string): AiError {
  if (status === 401 || status === 403) return new AiError("auth");
  if (status === 408) return new AiError("unreachable");
  if (status === 413 || /context[_ ]length|maximum context|too many tokens/i.test(detail)) {
    return new AiError("document_too_large");
  }
  if (status === 429) return new AiError("rate_limited");
  return new AiError("api_error");
}

function headers(apiKey: string | undefined): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

async function postWithRetries(
  url: string,
  body: unknown,
  apiKey: string | undefined,
  options: Required<Options>,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await options.fetch(url, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      if (attempt < RETRIES) {
        await options.sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new AiError("unreachable");
    }
    if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
      await options.sleep(1000 * 2 ** attempt);
      continue;
    }
    return response;
  }
}

export async function openAiCompatibleStructured<S extends z.ZodType>(
  endpoint: OpenAiCompatibleEndpoint,
  input: StructuredInput<S>,
  options: Options = {},
): Promise<{ output: z.infer<S>; usage: TokenUsage }> {
  const resolved: Required<Options> = {
    fetch: options.fetch ?? fetch,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  };
  const schema = jsonSchemaFor(input.schema);
  const system = `${input.system}\n\nAnswer with one JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(schema)}`;
  const content = await toContent(input.parts);
  const key = `${endpoint.baseUrl}\u0000${endpoint.model}`;

  for (let index = MODES.indexOf(acceptedMode.get(key) ?? "json_schema"); ; index++) {
    const mode = MODES[index]!;
    const response = await postWithRetries(
      `${endpoint.baseUrl}/chat/completions`,
      {
        model: endpoint.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        max_tokens: input.maxTokens,
        ...responseFormat(mode, schema),
      },
      endpoint.apiKey,
      resolved,
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Servers that do not support a response format reject the request; try the next one.
      if ((response.status === 400 || response.status === 422) && index < MODES.length - 1) {
        const error = statusError(response.status, detail);
        if (error.code !== "document_too_large") continue;
      }
      throw statusError(response.status, detail);
    }

    let data: ChatResponse;
    try {
      data = (await response.json()) as ChatResponse;
    } catch {
      throw new AiError("invalid_output");
    }
    const usage = usageOf(data, endpoint.model);
    const choice = data.choices?.[0];
    if (!choice) throw new AiError("invalid_output", usage);
    if (choice.finish_reason === "length") throw new AiError("truncated", usage);
    if (
      choice.finish_reason === "content_filter" ||
      (typeof choice.message?.refusal === "string" && choice.message.refusal)
    ) {
      throw new AiError("refused", usage);
    }
    const checked = input.schema.safeParse(parseJsonAnswer(contentText(choice.message?.content)));
    if (!checked.success) throw new AiError("invalid_output", usage);
    acceptedMode.set(key, mode);
    return { output: checked.data, usage };
  }
}

/** Model ids the endpoint offers (`GET /models`). Some gateways read the key from X-API-Key. */
export async function listModels(
  endpoint: Omit<OpenAiCompatibleEndpoint, "model">,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  let response: Response;
  try {
    response = await fetchImpl(`${endpoint.baseUrl}/models`, {
      headers: {
        ...headers(endpoint.apiKey),
        ...(endpoint.apiKey ? { "X-API-Key": endpoint.apiKey } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AiError("unreachable");
  }
  if (!response.ok) throw statusError(response.status, "");
  const data = (await response.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
  return (data?.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string");
}

/** Test hook: forget negotiated response formats. */
export function resetNegotiatedFormats() {
  acceptedMode.clear();
}
