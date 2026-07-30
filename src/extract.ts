import type { z } from "zod";
import { getSchema } from "./schemas/index.js";
import type { LlmProvider } from "./provider/index.js";
import type {
  AttemptRecord,
  ChatMessage,
  DocumentType,
  ExtractFailure,
  ExtractResult,
  FailureLayer,
} from "./types.js";

export const MAX_REPAIR_ATTEMPTS = 2;
export const MAX_TOTAL_ATTEMPTS = 1 + MAX_REPAIR_ATTEMPTS;

export function buildSystemPrompt(label: string): string {
  return [
    `You extract structured ${label} data from messy text.`,
    "Return only JSON that matches the provided JSON Schema.",
    "Use ISO dates as YYYY-MM-DD.",
    "Do not invent fields that are not in the schema.",
    "If a nullable field is unknown, use null.",
  ].join(" ");
}

export function buildUserPrompt(text: string): string {
  return `Extract structured data from the following text:\n\n---\n${text}\n---`;
}

export function buildRepairPrompt(
  text: string,
  previousJson: string,
  errorText: string,
): string {
  return [
    "Your previous JSON failed validation.",
    "Fix ONLY the reported errors and return corrected JSON that matches the schema.",
    "",
    "Validation errors:",
    errorText,
    "",
    "Previous JSON:",
    previousJson,
    "",
    "Original text:",
    "---",
    text,
    "---",
  ].join("\n");
}

export function formatZodError(error: z.ZodError): { field?: string; message: string } {
  const first = error.issues[0];
  if (!first) {
    return { message: error.message };
  }
  const field = first.path.length > 0 ? first.path.join(".") : undefined;
  return {
    field,
    message: field ? `${field}: ${first.message}` : first.message,
  };
}

function tryParseJson(raw: string):
  | { ok: true; value: unknown }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (err) {
    return {
      ok: false,
      message: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type ExtractOptions = {
  type: DocumentType;
  text: string;
  provider: LlmProvider;
};

export async function extract<T = unknown>(
  options: ExtractOptions,
): Promise<ExtractResult<T>> {
  const started = Date.now();
  const entry = getSchema(options.type);
  const attemptRecords: AttemptRecord[] = [];
  let lastFailure: ExtractFailure | undefined;
  let lastRaw = "";

  for (let attempt = 0; attempt < MAX_TOTAL_ATTEMPTS; attempt++) {
    const attemptStarted = Date.now();
    const messages: ChatMessage[] =
      attempt === 0
        ? [
            { role: "system", content: buildSystemPrompt(entry.label) },
            { role: "user", content: buildUserPrompt(options.text) },
          ]
        : [
            { role: "system", content: buildSystemPrompt(entry.label) },
            {
              role: "user",
              content: buildRepairPrompt(
                options.text,
                lastRaw || "(empty)",
                lastFailure?.message ?? "unknown error",
              ),
            },
          ];

    let raw: string;
    try {
      raw = await options.provider.chat({
        messages,
        format: entry.jsonSchema,
        temperature: 0,
      });
    } catch (err) {
      lastFailure = {
        layer: "decode",
        message: err instanceof Error ? err.message : String(err),
      };
      attemptRecords.push({
        attempt: attempt + 1,
        layer: "decode",
        message: lastFailure.message,
        ms: Date.now() - attemptStarted,
      });
      continue;
    }

    lastRaw = raw;
    const parsed = tryParseJson(raw);
    if (!parsed.ok) {
      lastFailure = { layer: "decode", message: parsed.message };
      attemptRecords.push({
        attempt: attempt + 1,
        layer: "decode",
        message: parsed.message,
        ms: Date.now() - attemptStarted,
      });
      continue;
    }

    const validated = entry.zod.safeParse(parsed.value);
    if (!validated.success) {
      const formatted = formatZodError(validated.error);
      lastFailure = {
        layer: "schema",
        field: formatted.field,
        message: formatted.message,
      };
      attemptRecords.push({
        attempt: attempt + 1,
        layer: "schema",
        message: formatted.message,
        ms: Date.now() - attemptStarted,
      });
      continue;
    }

    // Schema passed — business rules are a post-schema gate (no repair budget).
    const ruleFailures = entry.rules(validated.data as never);
    if (ruleFailures.length > 0) {
      const first = ruleFailures[0]!;
      lastFailure = {
        layer: "business_rule",
        field: first.field,
        message: first.message,
      };
      attemptRecords.push({
        attempt: attempt + 1,
        layer: "business_rule",
        message: first.message,
        ms: Date.now() - attemptStarted,
      });
      return {
        ok: false,
        failure: lastFailure,
        attempts: attempt + 1,
        attemptRecords,
        ms: Date.now() - started,
      };
    }

    attemptRecords.push({
      attempt: attempt + 1,
      ms: Date.now() - attemptStarted,
    });

    return {
      ok: true,
      data: validated.data as T,
      attempts: attempt + 1,
      attemptRecords,
      ms: Date.now() - started,
    };
  }

  return {
    ok: false,
    failure: lastFailure ?? {
      layer: "decode" satisfies FailureLayer,
      message: "extraction exhausted without a result",
    },
    attempts: attemptRecords.length || MAX_TOTAL_ATTEMPTS,
    attemptRecords,
    ms: Date.now() - started,
  };
}
