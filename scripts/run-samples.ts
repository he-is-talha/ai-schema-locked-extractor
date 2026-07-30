#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { extract } from "../src/extract.js";
import { aggregateMetrics, formatSummary, writeMetrics } from "../src/metrics.js";
import { getProvider } from "../src/provider/index.js";
import { documentTypes } from "../src/schemas/index.js";
import type { DocumentType, MetricRun } from "../src/types.js";

async function loadEnvFile(): Promise<void> {
  try {
    const raw = await readFile(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function listSamples(type: DocumentType): Promise<string[]> {
  const dir = resolve("samples", type);
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => join(dir, f));
}

await loadEnvFile();

const provider = await getProvider();
await provider.healthCheck();

const model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const runs: MetricRun[] = [];
const outPath = resolve(process.cwd(), "metrics.json");

console.error(`Running 30-document sample suite against ${model}…`);

for (const type of documentTypes) {
  const files = await listSamples(type);
  for (const file of files) {
    const id = `${type}/${file.split("/").pop()}`;
    const text = await readFile(file, "utf8");
    process.stderr.write(`  ${id} … `);
    const result = await extract({ type, text, provider });
    const run: MetricRun = {
      id,
      type,
      success: result.ok,
      schemaPassed: result.ok || result.failure.layer === "business_rule",
      attempts: result.attempts,
      failureLayer: result.ok ? undefined : result.failure.layer,
      ms: result.ms,
    };
    runs.push(run);
    if (result.ok) {
      console.error(`ok attempts=${result.attempts} (${result.ms}ms)`);
    } else {
      console.error(
        `FAIL ${result.failure.layer}${result.failure.field ? `:${result.failure.field}` : ""} attempts=${result.attempts}`,
      );
    }
  }
}

const summary = aggregateMetrics(runs, model);
await writeMetrics(outPath, summary);
console.error("\n" + formatSummary(summary));
console.error(`Wrote ${outPath}`);

if (summary.schemaPassRate < 0.95) {
  console.error(
    `\nWarning: schemaPassRate ${(summary.schemaPassRate * 100).toFixed(1)}% is below the 95% target.`,
  );
}
if (
  summary.avgAttemptsPerSuccess > 0 &&
  summary.avgAttemptsPerSuccess >= 1.3
) {
  console.error(
    `Warning: avgAttemptsPerSuccess ${summary.avgAttemptsPerSuccess.toFixed(3)} is above the 1.3 target.`,
  );
}
