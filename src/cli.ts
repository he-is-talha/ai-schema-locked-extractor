#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { extract } from "./extract.js";
import { appendMetricRun, formatSummary } from "./metrics.js";
import { getProvider } from "./provider/index.js";
import { documentTypes, isDocumentType } from "./schemas/index.js";
import type { DocumentType, MetricRun } from "./types.js";

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

function printFailure(
  failure: { layer: string; field?: string; message: string },
  attempts: number,
): void {
  const field = failure.field ? ` field=${failure.field}` : "";
  console.error(
    `FAIL layer=${failure.layer}${field} attempts=${attempts}: ${failure.message}`,
  );
}

async function runExtract(opts: {
  file: string;
  type: DocumentType;
  out?: string;
  metrics?: string;
}): Promise<number> {
  const text = await readFile(resolve(opts.file), "utf8");
  const provider = await getProvider();
  await provider.healthCheck();

  const result = await extract({
    type: opts.type,
    text,
    provider,
  });

  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
  if (opts.metrics) {
    const run: MetricRun = {
      id: basename(opts.file),
      type: opts.type,
      success: result.ok,
      schemaPassed:
        result.ok || result.failure.layer === "business_rule",
      attempts: result.attempts,
      failureLayer: result.ok ? undefined : result.failure.layer,
      ms: result.ms,
    };
    const summary = await appendMetricRun(resolve(opts.metrics), run, model);
    console.error(formatSummary(summary));
  }

  if (!result.ok) {
    printFailure(result.failure, result.attempts);
    return 1;
  }

  const json = JSON.stringify(result.data, null, 2);
  if (opts.out) {
    await writeFile(resolve(opts.out), `${json}\n`, "utf8");
  }
  console.log(json);
  return 0;
}

await loadEnvFile();

const program = new Command();
program
  .name("extract")
  .description(
    "Schema-locked extractor — Ollama constrained decode + Zod + capped repair loop",
  )
  .argument("<file>", "path to messy text file")
  .requiredOption(
    "-t, --type <type>",
    `document type: ${documentTypes.join(" | ")}`,
  )
  .option("-o, --out <path>", "write validated JSON to file")
  .option("-m, --metrics <path>", "append run metrics to JSON file")
  .action(async (file: string, options: { type: string; out?: string; metrics?: string }) => {
    if (!isDocumentType(options.type)) {
      console.error(
        `Invalid --type "${options.type}". Expected: ${documentTypes.join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    try {
      process.exitCode = await runExtract({
        file,
        type: options.type,
        out: options.out,
        metrics: options.metrics,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
