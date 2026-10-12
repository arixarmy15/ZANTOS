#!/usr/bin/env node
// Lists the models the configured OpenAI-compatible endpoint offers (GET /models).
// Reads OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY from the environment or
// .env.local; prints model ids only, never the key.
const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim().replace(/\/+$/, "");
const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();

if (!baseUrl) {
  console.error("Set OPENAI_COMPATIBLE_BASE_URL (for example in .env.local) first.");
  process.exit(1);
}

const headers = { Accept: "application/json" };
if (apiKey) {
  // Some gateways read the key from Authorization, others from X-API-Key.
  headers.Authorization = `Bearer ${apiKey}`;
  headers["X-API-Key"] = apiKey;
}

try {
  const response = await fetch(`${baseUrl}/models`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.error(`The endpoint answered HTTP ${response.status}.`);
    process.exit(1);
  }
  const data = await response.json();
  const ids = (data?.data ?? []).map((model) => model?.id).filter((id) => typeof id === "string");
  if (ids.length === 0) console.log("The endpoint lists no models.");
  for (const id of ids.sort()) console.log(id);
} catch (error) {
  console.error(`Could not reach ${new URL(baseUrl).host}: ${error.cause?.code ?? error.name}`);
  process.exit(1);
}
