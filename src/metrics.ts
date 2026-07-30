import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MetricRun, MetricsSummary } from "./types.js";

export function aggregateMetrics(
  runs: MetricRun[],
  model: string,
): MetricsSummary {
  const total = runs.length;
  const schemaPassed = runs.filter((r) => r.schemaPassed).length;
  const businessRuleFailures = runs.filter(
    (r) => r.failureLayer === "business_rule",
  ).length;
  const successes = runs.filter((r) => r.success);
  const avgAttemptsPerSuccess =
    successes.length === 0
      ? 0
      : successes.reduce((sum, r) => sum + r.attempts, 0) / successes.length;

  return {
    total,
    schemaPassRate: total === 0 ? 0 : schemaPassed / total,
    businessRuleFailureRate: total === 0 ? 0 : businessRuleFailures / total,
    avgAttemptsPerSuccess,
    runs,
    model,
    generatedAt: new Date().toISOString(),
  };
}

export async function writeMetrics(
  path: string,
  summary: MetricsSummary,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

export async function appendMetricRun(
  path: string,
  run: MetricRun,
  model: string,
): Promise<MetricsSummary> {
  let runs: MetricRun[] = [];
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as MetricsSummary;
    runs = parsed.runs ?? [];
  } catch {
    runs = [];
  }
  runs.push(run);
  const summary = aggregateMetrics(runs, model);
  await writeMetrics(path, summary);
  return summary;
}

export function formatSummary(summary: MetricsSummary): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return [
    `total: ${summary.total}`,
    `schemaPassRate: ${pct(summary.schemaPassRate)}`,
    `businessRuleFailureRate: ${pct(summary.businessRuleFailureRate)}`,
    `avgAttemptsPerSuccess: ${summary.avgAttemptsPerSuccess.toFixed(3)}`,
    `model: ${summary.model}`,
  ].join("\n");
}
