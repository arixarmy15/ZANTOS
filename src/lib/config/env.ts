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

export const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ANTHROPIC_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\S+$/, "must not contain whitespace").default(DEFAULT_ANTHROPIC_MODEL),
  ),
  DATA_DIR: z.preprocess(emptyToUndefined, z.string().default("./data")),
  UPLOAD_MAX_FILE_MB: intInRange(1, UPLOAD_FILE_MB_CEILING, UPLOAD_FILE_MB_CEILING),
  UPLOAD_MAX_PAGES: intInRange(1, 100, 20),
  UPLOAD_MAX_FILES_PER_CHECK: intInRange(1, 20, 10),
  RETENTION_HOURS: intInRange(1, 720, 24),
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

export function isAnthropicConfigured(env: ServerEnv): boolean {
  return env.ANTHROPIC_API_KEY !== undefined;
}
