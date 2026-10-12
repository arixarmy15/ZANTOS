#!/usr/bin/env node
// Fails if a tracked or about-to-be-tracked file contains something that looks like a secret.
// A lightweight guard for CI and local use; it does not replace GitHub secret scanning.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  { name: "Anthropic API key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI-style API key", regex: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/ },
  { name: "Evren LLM API key", regex: /evren_llm_[A-Za-z0-9_-]{20,}/ },
  { name: "Private key block", regex: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
];

const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file);
  } catch {
    continue; // deleted in the working tree
  }
  if (content.includes(0)) continue; // binary file
  const text = content.toString("utf8");
  for (const { name, regex } of PATTERNS) {
    if (regex.test(text)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length > 0) {
  console.error(`Secret check failed:\n${findings.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`Secret check passed (${files.length} files scanned).`);
