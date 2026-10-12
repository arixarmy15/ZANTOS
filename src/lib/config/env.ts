import "server-only";
import { z } from "zod";

/** Default model when ANTHROPIC_MODEL is not set. Verified against Anthropic's model list (2026-10). */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

/** Product rule: no single upload may exceed 20 MB, whatever the configuration says. */
export const UPLOAD_FILE_MB_CEILING = 20;

// Values copied from `.env.example` are often present but empty; treat them as unset.
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const intInRange = (min: number, max: number, fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));

/** AI providers Tickline can call. */
export const AI_PROVIDERS = ["anthropic", "openai-compatible"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** A model for one task: `model` (default provider) or `provider:model`. */
const ROUTE = new RegExp(`^(?:(?:${AI_PROVIDERS.join("|")}):)?[^\\s:][^\\s]*$`);
const optionalRoute = z.preprocess(
  emptyToUndefined,
  z.string().regex(ROUTE, "must be <model> or <provider>:<model>").optional(),
);

export const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANTHROPIC_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\S+$/, "must not contain whitespace").default(DEFAULT_ANTHROPIC_MODEL),
  ),
  // Default provider for every AI task; each task can be routed elsewhere below.
  AI_PROVIDER: z.preprocess(emptyToUndefined, z.enum(AI_PROVIDERS).default("anthropic")),
  // Any server that implements the OpenAI chat completions API (an LLM gateway, OpenAI,
  // vLLM, Ollama…). The key is optional for local servers.
  OPENAI_COMPATIBLE_BASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .url({ protocol: /^https?$/ })
      .transform((url) => url.replace(/\/+$/, ""))
      .optional(),
  ),
  OPENAI_COMPATIBLE_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  OPENAI_COMPATIBLE_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\S+$/, "must not contain whitespace").optional(),
  ),
  // Per-task routing, e.g. AI_EXTRACT_MODEL=anthropic:claude-opus-5-5 or
  // AI_COMPARE_MODEL=openai-compatible:deepseek-v4.1-flash.
  AI_EXTRACT_MODEL: optionalRoute,
  AI_COMPARE_MODEL: optionalRoute,
  AI_EXPLAIN_MODEL: optionalRoute,
  AI_EMAIL_MODEL: optionalRoute,
  DATA_DIR: z.preprocess(emptyToUndefined, z.string().default("./data")),
  UPLOAD_MAX_FILE_MB: intInRange(1, UPLOAD_FILE_MB_CEILING, UPLOAD_FILE_MB_CEILING),
  UPLOAD_MAX_PAGES: intInRange(1, 100, 20),
  UPLOAD_MAX_FILES_PER_CHECK: intInRange(1, 20, 10),
  RETENTION_HOURS: intInRange(1, 720, 24),
  // Address shown on the overview page for questions and feedback, e.g. founder@your-domain.
  CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  // Public address of this deployment, for canonical and language links, the sitemap and
  // social previews. Leave unset for local use.
  SITE_URL: z.preprocess(
    emptyToUndefined,
    z
      .url({ protocol: /^https?$/ })
      .transform((url) => url.replace(/\/+$/, ""))
      .optional(),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses server configuration. Error messages name the offending variables but never
 * echo their values, so a misconfigured API key cannot leak into logs.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server configuration: ${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export type AiTask = "extract" | "compare" | "explain" | "email";

const TASK_VARIABLES: Record<AiTask, keyof ServerEnv> = {
  extract: "AI_EXTRACT_MODEL",
  compare: "AI_COMPARE_MODEL",
  explain: "AI_EXPLAIN_MODEL",
  email: "AI_EMAIL_MODEL",
};

export type AiRoute = { task: AiTask; provider: AiProvider; model: string | null };

/** Which provider and model a task uses: its own variable, else the defaults. */
export function resolveRoute(env: ServerEnv, task: AiTask): AiRoute {
  const override = env[TASK_VARIABLES[task]] as string | undefined;
  let provider: AiProvider = env.AI_PROVIDER;
  let model: string | null = null;
  if (override) {
    const separator = override.indexOf(":");
    const prefix = separator > 0 ? override.slice(0, separator) : "";
    if ((AI_PROVIDERS as readonly string[]).includes(prefix)) {
      provider = prefix as AiProvider;
      model = override.slice(separator + 1);
    } else {
      model = override;
    }
  }
  model ??= provider === "anthropic" ? env.ANTHROPIC_MODEL : (env.OPENAI_COMPATIBLE_MODEL ?? null);
  return { task, provider, model };
}

/** A task can run when its provider has what it needs to make a request. */
export function isRouteConfigured(env: ServerEnv, route: AiRoute): boolean {
  if (!route.model) return false;
  return route.provider === "anthropic"
    ? env.ANTHROPIC_API_KEY !== undefined
    : env.OPENAI_COMPATIBLE_BASE_URL !== undefined;
}

export function isTaskConfigured(env: ServerEnv, task: AiTask): boolean {
  return isRouteConfigured(env, resolveRoute(env, task));
}
